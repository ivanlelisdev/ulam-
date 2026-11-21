import Dexie, { type EntityTable, type Table } from "dexie";
import { z } from "zod";
import {
  type Catalog,
  type Plan,
  type Snapshot,
  type Preferences,
  type LocalRecipe,
  type Template,
  type GroceryProgress,
  type CookingSession,
  type RecipeDraft,
  validateCatalog,
  validatePlan,
  snapshotSchema,
  localRecipeSchema,
  templateSchema,
  preferencesSchema,
  progressSchema,
  cookingSchema,
  draftSchema,
  dateSchema,
} from "./schema";
import { catalogSnapshots, buildGroceries } from "../product";
import { addDays, weekStart } from "../domain";

export class UlamDatabase extends Dexie {
  plans!: Table<Plan, [string, Plan["slot"]]>;
  catalog!: EntityTable<Catalog, "releaseId">;
  state!: EntityTable<{ id: "active"; releaseId: string }, "id">;
  preferences!: Table<Preferences, string>;
  userRecipes!: Table<LocalRecipe, string>;
  templates!: Table<Template, string>;
  groceryProgress!: Table<GroceryProgress, [string, string]>;
  cooking!: Table<CookingSession, string>;
  drafts!: Table<RecipeDraft, string>;
  constructor(name = "ulam") {
    super(name);
    this.version(1).stores({ plans: "[date+slot], weekStart" });
    this.version(2).stores({
      plans: "[date+slot], weekStart",
      catalog: "releaseId",
      state: "id",
    });
    this.version(3)
      .stores({
        plans: "[date+slot], weekStart",
        catalog: "releaseId",
        state: "id",
        preferences: "id",
        userRecipes: "id",
        templates: "id",
        groceryProgress: "[weekStart+rowKey], weekStart",
        cooking: "id",
        drafts: "id",
      })
      .upgrade(async (tx) => {
        for (const plan of await tx.table("plans").toArray()) {
          if (plan.snapshot || !plan.catalogReleaseId) continue;
          const catalog = await tx.table("catalog").get(plan.catalogReleaseId);
          if (!catalog) continue;
          const parsed = validateCatalog(catalog);
          const snapshot = catalogSnapshots(parsed).find(
            (item) =>
              item.recipe.id === plan.recipeId &&
              item.recipe.revision === plan.recipeRevision,
          );
          if (snapshot) await tx.table("plans").put({ ...plan, snapshot });
        }
      });
  }
}
export async function openDatabase(name?: string) {
  const db = new UlamDatabase(name);
  await db.open();
  return db;
}
export async function activateCatalog(db: UlamDatabase, input: unknown) {
  const catalog = validateCatalog(input);
  await db.transaction("rw", db.catalog, db.state, async () => {
    const existing = await db.catalog.get(catalog.releaseId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(catalog))
      throw new Error("Catalog release IDs are immutable");
    if (!existing) await db.catalog.add(catalog);
    await db.state.put({ id: "active", releaseId: catalog.releaseId });
  });
}
export async function getActiveCatalog(db: UlamDatabase) {
  return db.transaction("r", db.catalog, db.state, async () => {
    const state = await db.state.get("active");
    return state ? db.catalog.get(state.releaseId) : undefined;
  });
}
const asSnapshot = (local: LocalRecipe): Snapshot => ({
  recipe: local.recipe,
  ingredients: local.ingredients,
  image: local.image,
});
export async function getLibrary(db: UlamDatabase): Promise<Snapshot[]> {
  const catalog = await getActiveCatalog(db);
  return [
    ...(catalog ? catalogSnapshots(catalog) : []),
    ...(await db.userRecipes.toArray())
      .filter((item) => !item.archivedAt)
      .map(asSnapshot),
  ];
}
async function resolveReference(
  db: UlamDatabase,
  reference: {
    recipeId: string;
    recipeRevision: number;
    catalogReleaseId?: string;
  },
  latestLocal = false,
  includeArchived = false,
): Promise<Snapshot | undefined> {
  if (reference.recipeId.startsWith("u_")) {
    const local = await db.userRecipes.get(reference.recipeId);
    return local &&
      (!local.archivedAt || includeArchived) &&
      (latestLocal || local.recipe.revision === reference.recipeRevision)
      ? asSnapshot(local)
      : undefined;
  }
  if (!reference.catalogReleaseId) return undefined;
  const catalog = await db.catalog.get(reference.catalogReleaseId);
  return catalog
    ? catalogSnapshots(catalog).find(
        (item) =>
          item.recipe.id === reference.recipeId &&
          item.recipe.revision === reference.recipeRevision,
      )
    : undefined;
}
export async function getPlan(
  db: UlamDatabase,
  date: string,
  slot: Plan["slot"],
) {
  return db.plans.get([date, slot]);
}
export async function getWeekPlans(db: UlamDatabase, week: string) {
  return Promise.all(
    (await db.plans.where("weekStart").equals(week).toArray()).map(
      async (plan) => ({
        ...plan,
        snapshot:
          plan.snapshot || (await resolveReference(db, plan, false, true)),
      }),
    ),
  );
}
export const planToken = (plan?: Plan) => (plan ? JSON.stringify(plan) : null);
const planTables = (db: UlamDatabase) => [
  db.plans,
  db.catalog,
  db.userRecipes,
  db.groceryProgress,
];
async function syncGroceries(db: UlamDatabase, week: string) {
  const rows = buildGroceries(await getWeekPlans(db, week));
  const previous = await db.groceryProgress
    .where("weekStart")
    .equals(week)
    .toArray();
  await db.groceryProgress.where("weekStart").equals(week).delete();
  if (rows.length)
    await db.groceryProgress.bulkPut(
      rows.map((row) =>
        progressSchema.parse({
          weekStart: week,
          rowKey: row.key,
          signature: row.signature,
          checked: previous.some(
            (old) =>
              old.rowKey === row.key &&
              old.signature === row.signature &&
              old.checked,
          ),
        }),
      ),
    );
}
export async function savePlan(
  db: UlamDatabase,
  input: unknown,
  expected?: string | null,
) {
  const plan = validatePlan(input);
  await db.transaction("rw", planTables(db), async () => {
    const current = await db.plans.get([plan.date, plan.slot]);
    if (expected !== undefined && planToken(current) !== expected)
      throw new Error(
        "This meal slot changed or is occupied. Review it before saving.",
      );
    const same =
      current &&
      current.recipeId === plan.recipeId &&
      current.recipeRevision === plan.recipeRevision &&
      current.catalogReleaseId === plan.catalogReleaseId;
    const snapshot =
      same && current.snapshot
        ? current.snapshot
        : await resolveReference(db, plan);
    if (!snapshot)
      throw new Error(
        "Pinned recipe revision is unavailable. Reopen the recipe and retry.",
      );
    await db.plans.put(validatePlan({ ...plan, snapshot }));
    await syncGroceries(db, plan.weekStart);
  });
}
export async function removeMeal(
  db: UlamDatabase,
  date: string,
  slot: Plan["slot"],
  expected?: string | null,
) {
  return db.transaction("rw", planTables(db), async () => {
    const current = await db.plans.get([date, slot]);
    if (expected !== undefined && planToken(current) !== expected)
      throw new Error("This meal changed. Review it before removing.");
    if (current) {
      await db.plans.delete([date, slot]);
      await syncGroceries(db, current.weekStart);
    }
    return current;
  });
}
export async function undoRemove(db: UlamDatabase, input: unknown) {
  const plan = validatePlan(input);
  await db.transaction("rw", planTables(db), async () => {
    if (await db.plans.get([plan.date, plan.slot]))
      throw new Error("That slot is occupied; undo will not replace it.");
    const snapshot =
      plan.snapshot || (await resolveReference(db, plan, false, true));
    if (!snapshot) throw new Error("The saved recipe is unavailable.");
    await db.plans.put({
      ...plan,
      snapshot,
      updatedAt: new Date().toISOString(),
    });
    await syncGroceries(db, plan.weekStart);
  });
}
export async function getPreferences(db: UlamDatabase): Promise<Preferences> {
  return (
    (await db.preferences.get("settings")) || {
      id: "settings",
      defaultServings: 2,
    }
  );
}
export async function savePreferences(db: UlamDatabase, input: unknown) {
  const patch = preferencesSchema.omit({ id: true }).partial().parse(input);
  return db.transaction("rw", db.preferences, async () => {
    const preferences = preferencesSchema.parse({
      ...(await getPreferences(db)),
      ...patch,
      id: "settings",
    });
    await db.preferences.put(preferences);
    return preferences;
  });
}
export async function getGroceries(db: UlamDatabase, week: string) {
  return db.transaction("r", planTables(db), async () => {
    const rows = buildGroceries(await getWeekPlans(db, week));
    const progress = await db.groceryProgress
      .where("weekStart")
      .equals(week)
      .toArray();
    return rows.map((row) => ({
      ...row,
      checked: progress.some(
        (item) =>
          item.rowKey === row.key &&
          item.signature === row.signature &&
          item.checked,
      ),
    }));
  });
}
export async function checkGrocery(
  db: UlamDatabase,
  week: string,
  key: string,
  checked: boolean,
  expectedSignature: string,
) {
  await db.transaction("rw", planTables(db), async () => {
    const row = buildGroceries(await getWeekPlans(db, week)).find(
      (item) => item.key === key,
    );
    if (!row || row.signature !== expectedSignature)
      throw new Error("This grocery row changed. Refresh the list.");
    await db.groceryProgress.put(
      progressSchema.parse({
        weekStart: week,
        rowKey: key,
        signature: row.signature,
        checked,
      }),
    );
  });
}
export async function saveUserRecipe(
  db: UlamDatabase,
  input: unknown,
  expectedRevision = 0,
) {
  const snapshot = snapshotSchema.parse(input);
  if (!snapshot.recipe.id.startsWith("u_"))
    throw new Error("Make a remix to edit a bundled recipe.");
  return db.transaction("rw", db.userRecipes, db.drafts, async () => {
    const existing = await db.userRecipes.get(snapshot.recipe.id);
    if (
      (existing?.recipe.revision || 0) !== expectedRevision ||
      existing?.archivedAt
    )
      throw new Error("This recipe changed. Reopen it before editing.");
    const now = new Date().toISOString();
    const record = localRecipeSchema.parse({
      ...snapshot,
      id: snapshot.recipe.id,
      recipe: {
        ...snapshot.recipe,
        revision: expectedRevision + 1,
        reviewStatus: "local",
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lineage: existing?.lineage,
    });
    await db.userRecipes.put(record);
    await db.drafts.delete("active");
    return record;
  });
}
export async function remixRecipe(db: UlamDatabase, input: unknown) {
  const source = snapshotSchema.parse(input);
  const now = new Date().toISOString();
  const id = `u_${crypto.randomUUID()}`;
  const record = localRecipeSchema.parse({
    ...source,
    id,
    recipe: {
      ...source.recipe,
      id,
      revision: 1,
      reviewStatus: "local",
      sourceIds: [],
    },
    lineage: { recipeId: source.recipe.id, revision: source.recipe.revision },
    createdAt: now,
    updatedAt: now,
  });
  await db.userRecipes.add(record);
  return record;
}
export async function archiveRecipe(db: UlamDatabase, id: string) {
  await db.transaction("rw", db.userRecipes, async () => {
    const record = await db.userRecipes.get(id);
    if (!record) throw new Error("Recipe unavailable.");
    await db.userRecipes.put(
      localRecipeSchema.parse({
        ...record,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  });
}
export async function saveDraft(db: UlamDatabase, input: unknown) {
  await db.drafts.put(draftSchema.parse(input));
}
function targetWeek(week: string) {
  dateSchema.parse(week);
  if (weekStart(week) !== week) throw new Error("Choose a Monday-based week.");
  return week;
}
export async function saveTemplate(
  db: UlamDatabase,
  name: string,
  week: string,
) {
  targetWeek(week);
  const plans = await db.plans.where("weekStart").equals(week).toArray();
  if (!plans.length)
    throw new Error("Plan at least one meal before saving a template.");
  const template = templateSchema.parse({
    id: crypto.randomUUID(),
    name,
    updatedAt: new Date().toISOString(),
    entries: plans.map((plan) => ({
      dayOffset: Math.round(
        (Date.parse(plan.date) - Date.parse(week)) / 86400000,
      ),
      slot: plan.slot,
      recipeId: plan.recipeId,
      recipeRevision: plan.recipeRevision,
      catalogReleaseId: plan.catalogReleaseId,
      servings: plan.servings,
    })),
  });
  await db.templates.add(template);
  return template;
}
async function templatePreview(
  db: UlamDatabase,
  id: string,
  week: string,
  replace: boolean,
) {
  targetWeek(week);
  const template = await db.templates.get(id);
  if (!template) throw new Error("Template unavailable.");
  const current = await db.plans.where("weekStart").equals(week).toArray();
  const changes: Plan[] = [],
    replacements: Plan[] = [],
    skipped: string[] = [],
    resolved: string[] = [];
  let kept = 0;
  for (const entry of template.entries) {
    const date = addDays(week, entry.dayOffset);
    const snapshot = await resolveReference(db, entry, true);
    resolved.push(
      snapshot
        ? `${snapshot.recipe.id}:${snapshot.recipe.revision}`
        : "missing",
    );
    if (!snapshot) {
      skipped.push(`${date} ${entry.slot}: recipe unavailable`);
      continue;
    }
    const existing = current.find(
      (plan) => plan.date === date && plan.slot === entry.slot,
    );
    if (existing && !replace) {
      kept++;
      continue;
    }
    if (existing) replacements.push(existing);
    changes.push(
      validatePlan({
        weekStart: week,
        date,
        slot: entry.slot,
        recipeId: snapshot.recipe.id,
        recipeRevision: snapshot.recipe.revision,
        catalogReleaseId: entry.catalogReleaseId,
        servings: entry.servings,
        updatedAt: new Date().toISOString(),
        snapshot,
      }),
    );
  }
  return {
    changes,
    replacements,
    skipped,
    kept,
    token: JSON.stringify({
      template,
      current: current.sort((a, b) =>
        (a.date + a.slot).localeCompare(b.date + b.slot),
      ),
      resolved,
      replace,
      week,
    }),
  };
}
export async function previewTemplate(
  db: UlamDatabase,
  id: string,
  week: string,
  replace: boolean,
) {
  return db.transaction("r", [...planTables(db), db.templates], () =>
    templatePreview(db, id, week, replace),
  );
}
export async function applyTemplate(
  db: UlamDatabase,
  id: string,
  week: string,
  replace: boolean,
  token: string,
) {
  return db.transaction("rw", [...planTables(db), db.templates], async () => {
    const preview = await templatePreview(db, id, week, replace);
    if (preview.token !== token)
      throw new Error(
        "The plan or recipe changed. Preview the template again.",
      );
    if (preview.changes.length) await db.plans.bulkPut(preview.changes);
    await syncGroceries(db, week);
    return preview;
  });
}
export async function startCooking(
  db: UlamDatabase,
  input: unknown,
  servings: number,
  expectedSessionId: string | null = null,
) {
  const snapshot = snapshotSchema.parse(input);
  const session = cookingSchema.parse({
    id: "active",
    sessionId: crypto.randomUUID(),
    snapshot,
    servings,
    stepId: snapshot.recipe.steps[0].id,
    timer: null,
    updatedAt: new Date().toISOString(),
  });
  return db.transaction("rw", db.cooking, async () => {
    if (((await getCooking(db))?.sessionId || null) !== expectedSessionId)
      throw new Error(
        "Your cooking session changed. Reopen it before starting another.",
      );
    await db.cooking.put(session);
    return session;
  });
}
export async function getCooking(db: UlamDatabase) {
  const session = await db.cooking.get("active");
  return session ? cookingSchema.parse(session) : undefined;
}
export async function updateCooking(
  db: UlamDatabase,
  sessionId: string,
  input: unknown,
) {
  const patch = z
    .object({
      stepId: z.string().min(1).optional(),
      timer: z
        .object({
          stepId: z.string().min(1),
          deadline: z.iso.datetime({ precision: 3 }),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict()
    .parse(input);
  return db.transaction("rw", db.cooking, async () => {
    const current = await getCooking(db);
    if (!current || current.sessionId !== sessionId)
      throw new Error("Your cooking session changed. Reopen it to continue.");
    const updated = cookingSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await db.cooking.put(updated);
    return updated;
  });
}
export async function finishCooking(db: UlamDatabase, sessionId: string) {
  await db.transaction("rw", db.cooking, async () => {
    if ((await getCooking(db))?.sessionId !== sessionId)
      throw new Error("Your cooking session changed.");
    await db.cooking.delete("active");
  });
}
