import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import Dexie from "dexie";
import { fixtureCatalog, guestPlan } from "./fixtures/catalog";
import { validateCatalog } from "../src/data/schema";
import {
  openDatabase,
  activateCatalog,
  savePlan,
  getPlan,
  getLibrary,
  savePreferences,
  getPreferences,
  removeMeal,
  undoRemove,
  saveTemplate,
  previewTemplate,
  applyTemplate,
  getGroceries,
  checkGrocery,
  remixRecipe,
  saveUserRecipe,
  archiveRecipe,
  startCooking,
  updateCooking,
  getCooking,
} from "../src/data/database";
import {
  catalogSnapshots,
  buildGroceries,
  suggestRecipes,
  remainingSeconds,
  parseAmount,
  newDraft,
  parseDraft,
} from "../src/product";
const names: string[] = [];
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name);
});
async function fresh() {
  const name = `phase4-${crypto.randomUUID()}`;
  names.push(name);
  const db = await openDatabase(name);
  await activateCatalog(db, fixtureCatalog);
  return db;
}

it("consolidates exact compatible units but preserves volume, form and qualitative rows", () => {
  const snapshot = catalogSnapshots(validateCatalog(fixtureCatalog))[0];
  snapshot.recipe.ingredients = [
    {
      ...snapshot.recipe.ingredients[0],
      amount: { kind: "exact", numerator: 500, denominator: 1 },
      unit: "g",
    },
    {
      ...snapshot.recipe.ingredients[0],
      id: "line_volume",
      amount: { kind: "exact", numerator: 1, denominator: 1 },
      unit: "tbsp",
    },
    {
      ...snapshot.recipe.ingredients[0],
      id: "line_taste",
      amount: { kind: "qualitative", label: "to taste" },
      unit: "",
    },
  ];
  const rows = buildGroceries([
    { ...guestPlan, snapshot },
    { ...guestPlan, date: "2026-11-21", snapshot },
  ]);
  expect(rows.find((row) => row.quantity === "1 kg")).toBeTruthy();
  expect(rows.some((row) => row.quantity.includes("ml"))).toBe(true);
  expect(rows.filter((row) => row.quantity === "to taste")).toHaveLength(2);
});
it("ranks suggestions deterministically and respects exclusions", () => {
  const snapshots = catalogSnapshots(validateCatalog(fixtureCatalog));
  const options = {
    maxMinutes: 30,
    available: ["bawang"],
    excluded: [],
    slot: "all" as const,
  };
  expect(suggestRecipes(snapshots, options, [])).toEqual(
    suggestRecipes(snapshots, options, []),
  );
  expect(suggestRecipes(snapshots, options, [])[0].snapshot.recipe.id).toBe(
    "r_dev_sinangag",
  );
  expect(
    suggestRecipes(
      snapshots,
      { ...options, excluded: ["bawang", "itlog"] },
      [],
    ),
  ).toEqual([]);
  expect(
    suggestRecipes(snapshots, { ...options, maxMinutes: Infinity }, []).every(
      (item) => Number.isFinite(item.score),
    ),
  ).toBe(true);
});
it("persists default portions without changing existing meals", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan);
  await savePreferences(db, { defaultServings: 5 });
  expect((await getPreferences(db)).defaultServings).toBe(5);
  expect((await getPlan(db, guestPlan.date, guestPlan.slot))?.servings).toBe(2);
  db.close();
});
it("prevents silent suggestion replacement and supports remove with conflict-safe undo", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan, null);
  await expect(savePlan(db, guestPlan, null)).rejects.toThrow(
    /changed|occupied/i,
  );
  const removed = await removeMeal(db, guestPlan.date, guestPlan.slot);
  expect(await getPlan(db, guestPlan.date, guestPlan.slot)).toBeUndefined();
  await undoRemove(db, removed!);
  expect((await getPlan(db, guestPlan.date, guestPlan.slot))?.recipeId).toBe(
    guestPlan.recipeId,
  );
  await expect(undoRemove(db, removed!)).rejects.toThrow(/occupied/i);
  db.close();
});
it("previews templates, fills empty slots and rejects stale previews atomically", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan);
  const template = await saveTemplate(db, "A good week", guestPlan.weekStart);
  const preview = await previewTemplate(db, template.id, "2026-11-23", false);
  expect(preview.changes[0].date).toBe("2026-11-29");
  await applyTemplate(db, template.id, "2026-11-23", false, preview.token);
  expect(
    (await previewTemplate(db, template.id, "2026-11-23", false)).changes,
  ).toHaveLength(0);
  await expect(
    applyTemplate(db, template.id, "2026-11-23", false, preview.token),
  ).rejects.toThrow(/changed/i);
  db.close();
});
it("preserves checks for unchanged grocery rows and resets changed amounts", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan);
  let rows = await getGroceries(db, guestPlan.weekStart);
  await checkGrocery(
    db,
    guestPlan.weekStart,
    rows[0].key,
    true,
    rows[0].signature,
  );
  expect((await getGroceries(db, guestPlan.weekStart))[0].checked).toBe(true);
  await savePlan(db, { ...guestPlan, servings: 4 });
  rows = await getGroceries(db, guestPlan.weekStart);
  expect(rows[0].checked).toBe(false);
  db.close();
});
it("rejects stale grocery checks and preserves the new amount as unchecked", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan);
  const row = (await getGroceries(db, guestPlan.weekStart))[0];
  await savePlan(db, { ...guestPlan, servings: 4 });
  await expect(
    checkGrocery(db, guestPlan.weekStart, row.key, true, row.signature),
  ).rejects.toThrow(/changed/);
  expect((await getGroceries(db, guestPlan.weekStart))[0].checked).toBe(false);
  db.close();
});
it("rejects stale cooking starts without replacing another session or timer", async () => {
  const db = await fresh();
  const snapshot = (await getLibrary(db))[0];
  const session = await startCooking(db, snapshot, 2);
  await updateCooking(db, session.sessionId, {
    timer: { stepId: session.stepId, deadline: "2026-11-22T09:00:00.000Z" },
  });
  await expect(startCooking(db, snapshot, 3)).rejects.toThrow(/changed/);
  expect((await getCooking(db))?.timer?.deadline).toBe(
    "2026-11-22T09:00:00.000Z",
  );
  expect(
    (await startCooking(db, snapshot, 3, session.sessionId)).servings,
  ).toBe(3);
  db.close();
});
it("parses reduced fractions, decimal and ranges while retaining invalid draft values", () => {
  expect(parseAmount("1 2/4")).toEqual({
    kind: "exact",
    numerator: 3,
    denominator: 2,
  });
  expect(parseAmount("0.25")).toEqual({
    kind: "exact",
    numerator: 1,
    denominator: 4,
  });
  expect(parseAmount("1/2–1")).toEqual({
    kind: "range",
    min: { numerator: 1, denominator: 2 },
    max: { numerator: 1, denominator: 1 },
  });
  for (const value of ["0", "1/0", "2-1", "-1", "9007199254740992"])
    expect(() => parseAmount(value)).toThrow();
  const draft = newDraft();
  draft.title = "Family soup";
  draft.ingredients[0].amount = "1/0";
  const result = parseDraft(draft);
  expect(result.snapshot).toBeUndefined();
  expect(result.errors["ingredient.0.amount"]).toBeTruthy();
  expect(draft.ingredients[0].amount).toBe("1/0");
});
it("keeps forms, ranges and unknown-unit or local ingredients separate", () => {
  const snapshot = catalogSnapshots(validateCatalog(fixtureCatalog))[0];
  const line = snapshot.recipe.ingredients[0];
  snapshot.recipe.ingredients = [
    { ...line, amount: parseAmount("500"), unit: "g", form: "whole" },
    {
      ...line,
      id: "line_sliced",
      amount: parseAmount("500"),
      unit: "g",
      form: "sliced",
    },
    { ...line, id: "line_range", amount: parseAmount("1–2"), unit: "g" },
    { ...line, id: "line_unknown", amount: parseAmount("1"), unit: "handful" },
    {
      ...line,
      id: "line_local",
      ingredientId: undefined,
      label: "Family mix",
      amount: parseAmount("1"),
      unit: "g",
    },
  ];
  const rows = buildGroceries([
    { ...guestPlan, snapshot },
    { ...guestPlan, date: "2026-11-21", snapshot },
  ]);
  expect(rows).toHaveLength(8);
  expect(rows.filter((row) => row.quantity === "1 kg")).toHaveLength(2);
});
it("rolls back all template meals on a failed derived-state write", async () => {
  const db = await fresh();
  await savePlan(db, guestPlan);
  const template = await saveTemplate(db, "Rollback week", guestPlan.weekStart);
  const preview = await previewTemplate(db, template.id, "2026-11-23", false);
  const fail = () => {
    throw new Error("Simulated quota failure");
  };
  db.groceryProgress.hook("creating", fail);
  await expect(
    applyTemplate(db, template.id, "2026-11-23", false, preview.token),
  ).rejects.toThrow("Simulated quota");
  db.groceryProgress.hook("creating").unsubscribe(fail);
  expect(await db.plans.where("weekStart").equals("2026-11-23").count()).toBe(
    0,
  );
  expect(await db.plans.count()).toBe(1);
  db.close();
});
it("aborts a failed schema v3 migration without losing older guest data", async () => {
  const name = `failed-${crypto.randomUUID()}`;
  names.push(name);
  const old = new Dexie(name);
  old
    .version(2)
    .stores({
      plans: "[date+slot], weekStart",
      catalog: "releaseId",
      state: "id",
    });
  await old.open();
  await old.table("plans").put(guestPlan);
  await old.table("catalog").put({ ...fixtureCatalog, recipes: [] });
  old.close();
  await expect(openDatabase(name)).rejects.toThrow();
  const restored = new Dexie(name);
  restored
    .version(2)
    .stores({
      plans: "[date+slot], weekStart",
      catalog: "releaseId",
      state: "id",
    });
  await restored.open();
  expect(
    await restored.table("plans").get([guestPlan.date, guestPlan.slot]),
  ).toEqual(guestPlan);
  restored.close();
});
it("remixes own their content; old plans survive edits and archiving", async () => {
  const db = await fresh();
  const original = (await getLibrary(db))[0];
  const local = await remixRecipe(db, original);
  await savePlan(db, {
    ...guestPlan,
    recipeId: local.recipe.id,
    recipeRevision: 1,
    catalogReleaseId: undefined,
  });
  await saveUserRecipe(
    db,
    {
      ingredients: local.ingredients,
      image: local.image,
      recipe: { ...local.recipe, title: "Family variation" },
    },
    1,
  );
  await archiveRecipe(db, local.id);
  expect(
    (await getLibrary(db)).some((item) => item.recipe.id === local.id),
  ).toBe(false);
  expect(
    (await getPlan(db, guestPlan.date, guestPlan.slot))?.snapshot?.recipe.title,
  ).toBe(original.recipe.title);
  expect((await getLibrary(db))[0].recipe.title).toBe(original.recipe.title);
  db.close();
});
it("restores cooking step and deadline, deriving expiry from the clock", async () => {
  const db = await fresh();
  let session = await startCooking(db, (await getLibrary(db))[0], 3);
  session = await updateCooking(db, session.sessionId, {
    stepId: session.snapshot.recipe.steps[1].id,
    timer: { stepId: session.stepId, deadline: "2026-11-22T09:00:00.000Z" },
  });
  expect((await getCooking(db))?.stepId).toBe(session.stepId);
  expect(
    remainingSeconds(
      session.timer!.deadline,
      Date.parse("2026-11-22T09:00:01Z"),
    ),
  ).toBe(0);
  db.close();
});
it("upgrades populated schema v2 while preserving catalog and guest plans", async () => {
  const name = `old-${crypto.randomUUID()}`;
  names.push(name);
  const old = new Dexie(name);
  old
    .version(2)
    .stores({
      plans: "[date+slot], weekStart",
      catalog: "releaseId",
      state: "id",
    });
  await old.open();
  await old.table("plans").put(guestPlan);
  await old.table("catalog").put(validateCatalog(fixtureCatalog));
  await old
    .table("state")
    .put({ id: "active", releaseId: fixtureCatalog.releaseId });
  old.close();
  const db = await openDatabase(name);
  expect(
    (await getPlan(db, guestPlan.date, guestPlan.slot))?.snapshot?.recipe.id,
  ).toBe(guestPlan.recipeId);
  expect((await getLibrary(db)).length).toBe(2);
  db.close();
});
