import { z } from 'zod';

const text = z.string().trim().min(1);
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`));
const positiveInt = z.number().int().positive().safe();
const naturalInt = z.number().int().nonnegative().safe();
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
const fraction = z.object({ numerator: positiveInt, denominator: positiveInt }).strict().refine(v => gcd(v.numerator, v.denominator) === 1, 'Fraction must be reduced');
const amount = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact'), numerator: positiveInt, denominator: positiveInt }).strict().refine(v => gcd(v.numerator, v.denominator) === 1, 'Fraction must be reduced'),
  z.object({ kind: z.literal('range'), min: fraction, max: fraction }).strict().refine(v => BigInt(v.min.numerator) * BigInt(v.max.denominator) <= BigInt(v.max.numerator) * BigInt(v.min.denominator), 'Range must be ordered'),
  z.object({ kind: z.literal('qualitative'), label: text }).strict(),
]);
const source = z.object({ id: id('s'), creator: text, source: text, acquiredAt: z.iso.date(), rights: text, license: text, attribution: text, modifications: text, reviewedAt: z.iso.date(), evidence: text }).strict();
const image = z.object({ id: id('img'), path: z.string().regex(/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/, 'Image path must be a local relative file'), width: positiveInt, height: positiveInt, format: z.enum(['svg', 'webp', 'avif', 'jpeg', 'png']), byteLength: positiveInt, sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: text, sourceId: id('s') }).strict();
const ingredient = z.object({ id: id('i'), name: text, aliases: z.array(text), aisle: text }).strict();
const line = z.object({ id: id('line'), ingredientId: id('i'), amount, unit: text, form: text, prepNote: z.string(), optional: z.boolean() }).strict();
const step = z.object({ id: id('step'), text, ingredientLineIds: z.array(id('line')), timerSeconds: positiveInt.optional() }).strict();
const slot = z.enum(['breakfast', 'lunch', 'dinner']);
const recipe = z.object({ id: id('r'), revision: positiveInt, title: text, aliases: z.array(text), summary: text, tags: z.array(text), mealSlots: z.array(slot).min(1), allergens: z.object({ status: z.enum(['unknown', 'reviewed']), items: z.array(text) }).strict(), yieldServings: positiveInt, prepMinutes: naturalInt, cookMinutes: naturalInt, ingredients: z.array(line).min(1), steps: z.array(step).min(1), imageId: id('img'), sourceIds: z.array(id('s')).min(1), reviewStatus: z.literal('development') }).strict();

const catalogSchema = z.object({ formatVersion: z.literal(1), releaseId: z.string().regex(/^dev-[a-z0-9-]+$/), kind: z.literal('development'), ingredients: z.array(ingredient).min(1), sources: z.array(source).min(1), images: z.array(image).min(1), recipes: z.array(recipe).min(1) }).strict().superRefine((catalog, ctx) => {
  const add = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) add(`Duplicate ${label} ID`); };
  unique(catalog.recipes.map(x => x.id), 'recipe'); unique(catalog.images.map(x => x.id), 'image'); unique(catalog.ingredients.map(x => x.id), 'ingredient'); unique(catalog.sources.map(x => x.id), 'source');
  const ingredientIds = new Set(catalog.ingredients.map(x => x.id)), imageIds = new Set(catalog.images.map(x => x.id)), sourceIds = new Set(catalog.sources.map(x => x.id));
  for (const asset of catalog.images) if (!sourceIds.has(asset.sourceId)) add(`Missing image source: ${asset.sourceId}`);
  for (const item of catalog.recipes) {
    if (!imageIds.has(item.imageId)) add(`Missing image: ${item.imageId}`);
    for (const sourceId of item.sourceIds) if (!sourceIds.has(sourceId)) add(`Missing recipe source: ${sourceId}`);
    unique(item.ingredients.map(x => x.id), 'ingredient line'); unique(item.steps.map(x => x.id), 'step');
    const lineIds = new Set(item.ingredients.map(x => x.id));
    for (const entry of item.ingredients) if (!ingredientIds.has(entry.ingredientId)) add(`Missing ingredient: ${entry.ingredientId}`);
    for (const entry of item.steps) for (const lineId of entry.ingredientLineIds) if (!lineIds.has(lineId)) add(`Missing ingredient line: ${lineId}`);
  }
});
const dateString = z.iso.date().refine(value => { const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; }, 'Invalid calendar date');
const planSchema = z.object({ weekStart: dateString, date: dateString, slot, recipeId: id('r'), catalogReleaseId: z.string().regex(/^dev-[a-z0-9-]+$/), recipeRevision: positiveInt, servings: positiveInt, updatedAt: z.iso.datetime({ precision: 3 }) }).strict().superRefine((plan, ctx) => {
  const start = new Date(`${plan.weekStart}T00:00:00.000Z`), day = new Date(`${plan.date}T00:00:00.000Z`);
  const offset = (day.valueOf() - start.valueOf()) / 86400000;
  if (start.getUTCDay() !== 1 || offset < 0 || offset > 6 || !Number.isInteger(offset)) ctx.addIssue({ code: 'custom', message: 'Plan must belong to its Monday-based week' });
});
export type Catalog = z.infer<typeof catalogSchema>;
export type Plan = z.infer<typeof planSchema>;
export const validateCatalog = (input: unknown): Catalog => catalogSchema.parse(input);
export const validatePlan = (input: unknown): Plan => planSchema.parse(input);
