import { z } from "zod";
const text = z.string().trim().min(1);
const positiveInt = z.number().int().positive().safe();
const naturalInt = z.number().int().nonnegative().safe();
const id = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`));
const userId = z
  .string()
  .refine(
    (value) =>
      value.startsWith("u_") && z.uuid().safeParse(value.slice(2)).success,
    "Invalid local recipe ID",
  );
const recipeId = id("r").or(userId);
export const slotSchema = z.enum(["breakfast", "lunch", "dinner"]);
export const dateSchema = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}, "Invalid calendar date");
const utc = z.iso.datetime({ precision: 3 });
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const fraction = z
  .object({ numerator: positiveInt, denominator: positiveInt })
  .strict()
  .refine(
    (value) => gcd(value.numerator, value.denominator) === 1,
    "Fraction must be reduced",
  );
export const amountSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("exact"),
      numerator: positiveInt,
      denominator: positiveInt,
    })
    .strict()
    .refine(
      (value) => gcd(value.numerator, value.denominator) === 1,
      "Fraction must be reduced",
    ),
  z
    .object({ kind: z.literal("range"), min: fraction, max: fraction })
    .strict()
    .refine(
      (value) =>
        BigInt(value.min.numerator) * BigInt(value.max.denominator) <=
        BigInt(value.max.numerator) * BigInt(value.min.denominator),
      "Range must be ordered",
    ),
  z.object({ kind: z.literal("qualitative"), label: text }).strict(),
]);
const source = z
  .object({
    id: id("s"),
    creator: text,
    source: text,
    acquiredAt: dateSchema,
    rights: text,
    license: text,
    attribution: text,
    modifications: text,
    reviewedAt: dateSchema,
    evidence: text,
  })
  .strict();
export const imageSchema = z
  .object({
    id: id("img"),
    path: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/,
        "Image path must be a local relative file",
      ),
    width: positiveInt,
    height: positiveInt,
    format: z.enum(["svg", "webp", "avif", "jpeg", "png"]),
    byteLength: positiveInt,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    alt: text,
    sourceId: id("s"),
  })
  .strict();
export const ingredientSchema = z
  .object({ id: id("i"), name: text, aliases: z.array(text), aisle: text })
  .strict();
const line = z
  .object({
    id: id("line"),
    ingredientId: id("i").optional(),
    label: text.optional(),
    amount: amountSchema,
    unit: z.string().trim(),
    form: text,
    prepNote: z.string(),
    optional: z.boolean(),
  })
  .strict()
  .refine(
    (value) => !!value.ingredientId || !!value.label,
    "Ingredient name is required",
  )
  .refine(
    (value) => value.amount.kind === "qualitative" || value.unit.length > 0,
    "Unit is required",
  );
const step = z
  .object({
    id: id("step"),
    text,
    ingredientLineIds: z.array(id("line")),
    timerSeconds: positiveInt.optional(),
  })
  .strict();
const recipeFields = {
  id: recipeId,
  revision: positiveInt,
  title: text,
  aliases: z.array(text),
  summary: z.string().trim(),
  tags: z.array(text),
  mealSlots: z.array(slotSchema).min(1),
  allergens: z
    .object({ status: z.enum(["unknown", "reviewed"]), items: z.array(text) })
    .strict(),
  yieldServings: positiveInt,
  prepMinutes: naturalInt,
  cookMinutes: naturalInt,
  ingredients: z.array(line).min(1).max(500),
  steps: z.array(step).min(1).max(500),
  imageId: id("img").optional(),
  sourceIds: z.array(id("s")),
  reviewStatus: z.enum(["development", "local"]),
};
export const recipeSchema = z
  .object(recipeFields)
  .strict()
  .superRefine((recipe, ctx) => {
    const lines = new Set(recipe.ingredients.map((item) => item.id));
    if (
      lines.size !== recipe.ingredients.length ||
      new Set(recipe.steps.map((item) => item.id)).size !== recipe.steps.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate ingredient line or step ID",
      });
    for (const entry of recipe.steps)
      for (const lineId of entry.ingredientLineIds)
        if (!lines.has(lineId))
          ctx.addIssue({
            code: "custom",
            message: `Missing ingredient line: ${lineId}`,
          });
  });
const catalogRecipe = recipeSchema.safeExtend({
  id: id("r"),
  summary: text,
  imageId: id("img"),
  sourceIds: z.array(id("s")).min(1),
  reviewStatus: z.literal("development"),
});
export const snapshotSchema = z
  .object({
    recipe: recipeSchema,
    ingredients: z.array(ingredientSchema),
    image: imageSchema.optional(),
  })
  .strict();
const catalogSchema = z
  .object({
    formatVersion: z.literal(1),
    releaseId: z.string().regex(/^dev-[a-z0-9-]+$/),
    kind: z.literal("development"),
    ingredients: z.array(ingredientSchema).min(1),
    sources: z.array(source).min(1),
    images: z.array(imageSchema).min(1),
    recipes: z.array(catalogRecipe).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length)
        issue(`Duplicate ${label} ID`);
    };
    unique(
      catalog.recipes.map((x) => x.id),
      "recipe",
    );
    unique(
      catalog.images.map((x) => x.id),
      "image",
    );
    unique(
      catalog.ingredients.map((x) => x.id),
      "ingredient",
    );
    unique(
      catalog.sources.map((x) => x.id),
      "source",
    );
    const ingredients = new Set(catalog.ingredients.map((x) => x.id)),
      images = new Set(catalog.images.map((x) => x.id)),
      sources = new Set(catalog.sources.map((x) => x.id));
    for (const asset of catalog.images)
      if (!sources.has(asset.sourceId))
        issue(`Missing image source: ${asset.sourceId}`);
    for (const item of catalog.recipes) {
      if (!images.has(item.imageId)) issue(`Missing image: ${item.imageId}`);
      for (const sourceId of item.sourceIds)
        if (!sources.has(sourceId)) issue(`Missing recipe source: ${sourceId}`);
      for (const entry of item.ingredients)
        if (!entry.ingredientId || !ingredients.has(entry.ingredientId))
          issue(`Missing ingredient: ${entry.ingredientId}`);
    }
  });
const reference = {
  recipeId,
  recipeRevision: positiveInt,
  catalogReleaseId: z
    .string()
    .regex(/^dev-[a-z0-9-]+$/)
    .optional(),
};
const planSchema = z
  .object({
    weekStart: dateSchema,
    date: dateSchema,
    slot: slotSchema,
    ...reference,
    servings: positiveInt,
    updatedAt: utc,
    snapshot: snapshotSchema.optional(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const start = new Date(`${plan.weekStart}T00:00:00.000Z`),
      date = new Date(`${plan.date}T00:00:00.000Z`);
    const offset = (date.valueOf() - start.valueOf()) / 86400000;
    if (
      start.getUTCDay() !== 1 ||
      offset < 0 ||
      offset > 6 ||
      !Number.isInteger(offset)
    )
      ctx.addIssue({
        code: "custom",
        message: "Plan must belong to its Monday-based week",
      });
    if (plan.recipeId.startsWith("r_") && !plan.catalogReleaseId)
      ctx.addIssue({ code: "custom", message: "Catalog release is required" });
    if (
      plan.snapshot &&
      (plan.snapshot.recipe.id !== plan.recipeId ||
        plan.snapshot.recipe.revision !== plan.recipeRevision)
    )
      ctx.addIssue({
        code: "custom",
        message: "Pinned snapshot does not match recipe reference",
      });
  });
export const preferencesSchema = z
  .object({
    id: z.literal("settings"),
    defaultServings: positiveInt,
    selectedDate: dateSchema.optional(),
  })
  .strict();
export const localRecipeSchema = snapshotSchema
  .extend({
    id: userId,
    createdAt: utc,
    updatedAt: utc,
    archivedAt: utc.optional(),
    lineage: z
      .object({
        recipeId,
        revision: positiveInt,
        catalogReleaseId: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .superRefine((item, ctx) => {
    if (item.recipe.id !== item.id || item.recipe.reviewStatus !== "local")
      ctx.addIssue({
        code: "custom",
        message: "Local recipe identity mismatch",
      });
  });
export const templateSchema = z
  .object({
    id: z.uuid(),
    name: text,
    updatedAt: utc,
    entries: z
      .array(
        z
          .object({
            dayOffset: z.number().int().min(0).max(6),
            slot: slotSchema,
            ...reference,
            servings: positiveInt,
          })
          .strict(),
      )
      .min(1)
      .max(21),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => `${entry.dayOffset}:${entry.slot}`))
        .size === value.entries.length,
    "Duplicate template slot",
  );
export const progressSchema = z
  .object({
    weekStart: dateSchema,
    rowKey: text,
    signature: text,
    checked: z.boolean(),
  })
  .strict();
export const cookingSchema = z
  .object({
    id: z.literal("active"),
    sessionId: z.uuid(),
    snapshot: snapshotSchema,
    servings: positiveInt,
    stepId: text,
    timer: z.object({ stepId: text, deadline: utc }).strict().nullable(),
    updatedAt: utc,
  })
  .strict()
  .superRefine((session, ctx) => {
    if (
      !session.snapshot.recipe.steps.some(
        (step) => step.id === session.stepId,
      ) ||
      (session.timer &&
        !session.snapshot.recipe.steps.some(
          (step) => step.id === session.timer!.stepId,
        ))
    )
      ctx.addIssue({ code: "custom", message: "Cooking step is unavailable" });
  });
export const draftSchema = z
  .object({
    id: z.literal("active"),
    recipeId: userId,
    revision: naturalInt,
    title: z.string(),
    summary: z.string(),
    yield: z.string(),
    prep: z.string(),
    cook: z.string(),
    ingredients: z
      .array(
        z
          .object({
            id: id("line"),
            label: z.string(),
            ingredientId: id("i").optional(),
            amount: z.string(),
            unit: z.string(),
            form: z.string(),
            optional: z.boolean(),
          })
          .strict(),
      )
      .max(500),
    steps: z
      .array(
        z
          .object({
            id: id("step"),
            text: z.string(),
            minutes: z.string(),
            ingredientLineIds: z.array(id("line")).optional(),
          })
          .strict(),
      )
      .max(500),
    image: imageSchema.optional(),
    sourceIngredients: z.array(ingredientSchema),
    base: recipeSchema.optional(),
  })
  .strict();
export type Catalog = z.infer<typeof catalogSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type LocalRecipe = z.infer<typeof localRecipeSchema>;
export type Template = z.infer<typeof templateSchema>;
export type GroceryProgress = z.infer<typeof progressSchema>;
export type CookingSession = z.infer<typeof cookingSchema>;
export type RecipeDraft = z.infer<typeof draftSchema>;
export const validateCatalog = (input: unknown): Catalog =>
  catalogSchema.parse(input);
export const validatePlan = (input: unknown): Plan => planSchema.parse(input);
