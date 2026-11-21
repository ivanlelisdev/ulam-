import Dexie, { type EntityTable, type Table } from 'dexie';
import { type Catalog, type Plan, validateCatalog, validatePlan } from './schema';

export class UlamDatabase extends Dexie {
  plans!: Table<Plan, [string, Plan['slot']]>;
  catalog!: EntityTable<Catalog, 'releaseId'>;
  state!: EntityTable<{ id: 'active'; releaseId: string }, 'id'>;
  constructor(name = 'ulam') {
    super(name);
    this.version(1).stores({ plans: '[date+slot], weekStart' });
    this.version(2).stores({ plans: '[date+slot], weekStart', catalog: 'releaseId', state: 'id' });
  }
}
export async function openDatabase(name?: string): Promise<UlamDatabase> {
  const db = new UlamDatabase(name); await db.open(); return db;
}
export async function activateCatalog(db: UlamDatabase, input: unknown): Promise<void> {
  const catalog = validateCatalog(input);
  await db.transaction('rw', db.catalog, db.state, async () => {
    const existing = await db.catalog.get(catalog.releaseId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(catalog)) throw new Error('Catalog release IDs are immutable');
    if (!existing) await db.catalog.add(catalog);
    await db.state.put({ id: 'active', releaseId: catalog.releaseId });
  });
}
export async function getActiveCatalog(db: UlamDatabase): Promise<Catalog | undefined> {
  return db.transaction('r', db.catalog, db.state, async () => {
    const state = await db.state.get('active'); return state ? db.catalog.get(state.releaseId) : undefined;
  });
}
export async function savePlan(db: UlamDatabase, input: unknown): Promise<void> {
  const plan = validatePlan(input);
  await db.transaction('rw', db.plans, db.catalog, async () => {
    const catalog = await db.catalog.get(plan.catalogReleaseId);
    if (!catalog?.recipes.some(recipe => recipe.id === plan.recipeId && recipe.revision === plan.recipeRevision)) throw new Error('Pinned recipe revision is unavailable');
    await db.plans.put(plan);
  });
}
export async function getPlan(db: UlamDatabase, date: string, slot: Plan['slot']): Promise<Plan | undefined> {
  return db.plans.get([date, slot]);
}
