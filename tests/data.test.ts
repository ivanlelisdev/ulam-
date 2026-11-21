import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateCatalog, validatePlan } from '../src/data/schema';
import { openDatabase, activateCatalog, getActiveCatalog, savePlan, getPlan } from '../src/data/database';
import { fixtureCatalog, invalidCatalog, nextCatalog, guestPlan } from './fixtures/catalog';

const dbName = () => `test-${crypto.randomUUID()}`;
const names: string[] = [];
afterEach(async () => { await Promise.all(names.splice(0).map(name => Dexie.delete(name))); });
const fresh = () => { const name = dbName(); names.push(name); return name; };

describe('catalog input', () => {
  it('loads the complete, explicitly non-production fixture', () => {
    const catalog = validateCatalog(fixtureCatalog);
    expect(catalog.kind).toBe('development');
    expect(catalog.recipes[0].title).toBe('Garlic fried rice');
  });
  it('ships locally readable fixture images with matching declared hashes', () => {
    for (const image of validateCatalog(fixtureCatalog).images) {
      const bytes = readFileSync(image.path);
      expect(bytes.length).toBe(image.byteLength);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.sha256);
      expect(bytes.toString()).toContain('<svg');
    }
    expect(validateCatalog(fixtureCatalog).recipes).toHaveLength(2);
  });
  it('rejects broken references, duplicate IDs and malformed amounts', () => {
    expect(() => validateCatalog(invalidCatalog)).toThrow(/image/i);
    expect(() => validateCatalog({ ...fixtureCatalog, kind: 'production' })).toThrow();
    expect(() => validateCatalog({ ...fixtureCatalog, images: [{ ...fixtureCatalog.images[0], path: '../outside.svg' }] })).toThrow(/local/i);
    expect(() => validateCatalog({ ...fixtureCatalog, recipes: [...fixtureCatalog.recipes, fixtureCatalog.recipes[0]] })).toThrow(/duplicate/i);
    const recipe = structuredClone(fixtureCatalog.recipes[0]);
    recipe.ingredients[0].amount.denominator = 0;
    expect(() => validateCatalog({ ...fixtureCatalog, recipes: [recipe] })).toThrow();
  });
  it('checks local dates, week membership and UTC timestamps at the boundary', () => {
    expect(validatePlan(guestPlan).date).toBe('2026-11-22');
    expect(() => validatePlan({ ...guestPlan, date: '2026-02-30' })).toThrow();
    expect(() => validatePlan({ ...guestPlan, weekStart: '2026-11-17' })).toThrow();
    expect(() => validatePlan({ ...guestPlan, date: '2026-11-23' })).toThrow();
    expect(() => validatePlan({ ...guestPlan, updatedAt: '2026-11-22T09:30:00' })).toThrow();
  });
});

describe('catalog and guest storage', () => {
  it('replaces catalog atomically while preserving guest plans', async () => {
    const db = await openDatabase(fresh());
    await activateCatalog(db, fixtureCatalog);
    await savePlan(db, guestPlan);
    await activateCatalog(db, nextCatalog);
    expect((await getActiveCatalog(db))?.releaseId).toBe('dev-fixture-2');
    expect((await db.catalog.get(guestPlan.catalogReleaseId))?.recipes[0].revision).toBe(guestPlan.recipeRevision);
    expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toMatchObject(guestPlan);
    await expect(activateCatalog(db, invalidCatalog)).rejects.toThrow();
    expect((await getActiveCatalog(db))?.releaseId).toBe('dev-fixture-2');
    expect((await db.catalog.get(guestPlan.catalogReleaseId))?.recipes[0].revision).toBe(guestPlan.recipeRevision);
    expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toMatchObject(guestPlan);
    db.close();
  });
  it('rejects invalid guest writes and retains the prior plan', async () => {
    const db = await openDatabase(fresh());
    await activateCatalog(db, fixtureCatalog);
    await savePlan(db, guestPlan);
    await expect(savePlan(db, { ...guestPlan, servings: 0 })).rejects.toThrow();
    await expect(savePlan(db, { ...guestPlan, recipeRevision: 9 })).rejects.toThrow();
    expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toMatchObject(guestPlan);
    db.close();
  });
  it('rolls back an interrupted catalog activation and retains the old release', async () => {
    const db = await openDatabase(fresh());
    await activateCatalog(db, fixtureCatalog);
    db.state.hook('updating', () => { throw new Error('interrupted activation'); });
    await expect(activateCatalog(db, nextCatalog)).rejects.toThrow('interrupted activation');
    expect(await db.catalog.get(nextCatalog.releaseId)).toBeUndefined();
    expect((await getActiveCatalog(db))?.releaseId).toBe(fixtureCatalog.releaseId);
    db.close();
  });
  it('rejects changes to an existing release ID', async () => {
    const db = await openDatabase(fresh());
    await activateCatalog(db, fixtureCatalog);
    await expect(activateCatalog(db, { ...nextCatalog, releaseId: fixtureCatalog.releaseId })).rejects.toThrow(/immutable/);
    expect((await getActiveCatalog(db))?.recipes[0].revision).toBe(1);
    db.close();
  });
  it('upgrades a populated older database without losing guest data', async () => {
    const name = fresh();
    const old = new Dexie(name);
    old.version(1).stores({ plans: '[date+slot], weekStart' });
    await old.open(); await old.table('plans').put(guestPlan); old.close();
    const db = await openDatabase(name);
    expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toMatchObject(guestPlan);
    expect(await getActiveCatalog(db)).toBeUndefined();
    db.close();
  });
  it('preserves data after an aborted database upgrade', async () => {
    const name = fresh();
    const old = new Dexie(name); old.version(1).stores({ plans: '[date+slot], weekStart' });
    await old.open(); await old.table('plans').put(guestPlan); old.close();
    const bad = new Dexie(name); bad.version(1).stores({ plans: '[date+slot], weekStart' });
    bad.version(2).stores({ plans: '[date+slot], weekStart', catalog: 'releaseId', state: 'id' }).upgrade(async tx => {
      await tx.table('plans').put({ ...guestPlan, servings: 99 }); throw new Error('interrupted migration fixture');
    });
    await expect(bad.open()).rejects.toThrow('interrupted migration fixture'); bad.close();
    const db = await openDatabase(name);
    expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toMatchObject(guestPlan); db.close();
  });
});
