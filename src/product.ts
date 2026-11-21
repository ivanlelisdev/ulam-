import type { Catalog, Plan, Snapshot, RecipeDraft } from "./data/schema";
import { normalize } from "./domain";

export function catalogSnapshots(catalog: Catalog): Snapshot[] {
  return catalog.recipes.map((recipe) => ({
    recipe,
    ingredients: catalog.ingredients,
    image: catalog.images.find((image) => image.id === recipe.imageId),
  }));
}
export type Filters = {
  query?: string;
  slot?: "all" | Plan["slot"];
  maxMinutes: number;
  excluded: string[];
  available?: string[];
};
export function ingredientName(
  snapshot: Snapshot,
  line: Snapshot["recipe"]["ingredients"][number],
) {
  return (
    line.label ||
    snapshot.ingredients.find((item) => item.id === line.ingredientId)?.name ||
    "Unknown ingredient"
  );
}
function terms(snapshot: Snapshot) {
  return snapshot.recipe.ingredients.flatMap((line) => {
    const ingredient = snapshot.ingredients.find(
      (item) => item.id === line.ingredientId,
    );
    return [ingredientName(snapshot, line), ...(ingredient?.aliases || [])];
  });
}
export function filterRecipes(snapshots: Snapshot[], filters: Filters) {
  return snapshots.filter((snapshot) => {
    const recipe = snapshot.recipe,
      ingredients = normalize(terms(snapshot).join(" "));
    return (
      (!filters.slot ||
        filters.slot === "all" ||
        recipe.mealSlots.includes(filters.slot)) &&
      recipe.prepMinutes + recipe.cookMinutes <= filters.maxMinutes &&
      !filters.excluded.some(
        (value) => value.trim() && ingredients.includes(normalize(value)),
      ) &&
      normalize(
        [recipe.title, ...recipe.aliases, ...terms(snapshot)].join(" "),
      ).includes(normalize(filters.query || ""))
    );
  });
}
export function suggestRecipes(
  snapshots: Snapshot[],
  filters: Filters,
  plans: Plan[],
) {
  return filterRecipes(snapshots, filters)
    .map((snapshot) => {
      const names = normalize(terms(snapshot).join(" "));
      const overlap = (filters.available || []).filter(
        (value) => value.trim() && names.includes(normalize(value)),
      );
      const used = plans.filter(
        (plan) => plan.recipeId === snapshot.recipe.id,
      ).length;
      const minutes = snapshot.recipe.prepMinutes + snapshot.recipe.cookMinutes;
      return {
        snapshot,
        score:
          overlap.length * 100 -
          used * 30 +
          (Number.isFinite(filters.maxMinutes)
            ? (filters.maxMinutes - minutes) / Math.max(filters.maxMinutes, 1)
            : 1 / (1 + minutes)),
        reason: `${minutes} min${overlap.length ? ` · uses ${overlap.join(", ")}` : ""}${used === 0 ? " · adds variety this week" : ` · planned ${used} time${used === 1 ? "" : "s"} this week`}`,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.snapshot.recipe.id < b.snapshot.recipe.id
          ? -1
          : a.snapshot.recipe.id > b.snapshot.recipe.id
            ? 1
            : 0),
    );
}

type Fraction = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
function fraction(n: bigint, d = 1n): Fraction {
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}
const multiply = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const add = (a: Fraction, b: Fraction) =>
  fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const signature = (a: Fraction) => `${a.n}/${a.d}`;
function format(a: Fraction) {
  const whole = a.n / a.d,
    remainder = a.n % a.d;
  return remainder === 0n
    ? String(whole)
    : whole > 0
      ? `${whole} ${remainder}/${a.d}`
      : `${a.n}/${a.d}`;
}
const units: Record<
  string,
  { dimension: string; factor: bigint; unit: string }
> = {
  g: { dimension: "mass", factor: 1n, unit: "g" },
  kg: { dimension: "mass", factor: 1000n, unit: "g" },
  ml: { dimension: "volume", factor: 1n, unit: "ml" },
  l: { dimension: "volume", factor: 1000n, unit: "ml" },
  tsp: { dimension: "volume", factor: 5n, unit: "ml" },
  tbsp: { dimension: "volume", factor: 15n, unit: "ml" },
  cup: { dimension: "volume", factor: 240n, unit: "ml" },
  piece: { dimension: "piece", factor: 1n, unit: "piece" },
  clove: { dimension: "clove", factor: 1n, unit: "clove" },
};
function display(a: Fraction, unit: string) {
  if ((unit === "g" || unit === "ml") && a.n >= 1000n * a.d)
    return `${format(multiply(a, fraction(1n, 1000n)))} ${unit === "g" ? "kg" : "l"}`;
  return `${format(a)} ${unit}`.trim();
}
export type GroceryRow = {
  key: string;
  name: string;
  aisle: string;
  quantity: string;
  signature: string;
  checked: boolean;
};
export function buildGroceries(plans: Plan[]): GroceryRow[] {
  const rows = new Map<
    string,
    { row: GroceryRow; amount?: Fraction; unit: string }
  >();
  for (const plan of plans) {
    const snapshot = plan.snapshot;
    if (!snapshot) {
      const key = JSON.stringify(["missing", plan.date, plan.slot]);
      rows.set(key, {
        row: {
          key,
          name: "Unavailable recipe — review this saved meal",
          aisle: "Review",
          quantity: "Quantities unavailable",
          signature: plan.recipeId,
          checked: false,
        },
        unit: "",
      });
      continue;
    }
    const scale = fraction(
      BigInt(plan.servings),
      BigInt(snapshot.recipe.yieldServings),
    );
    for (const line of snapshot.recipe.ingredients) {
      const canonical = snapshot.ingredients.find(
        (item) => item.id === line.ingredientId,
      );
      const rule = units[normalize(line.unit)];
      const identity = [plan.date, plan.slot, line.id];
      const exact = line.amount.kind === "exact";
      const merge = !!canonical && !!rule && exact;
      const key = JSON.stringify([
        "rules-1",
        canonical?.id || line.label,
        normalize(line.form),
        rule?.dimension || line.unit,
        ...(merge ? [] : identity),
      ]);
      const factor = fraction(rule?.factor || 1n);
      const unit = rule?.unit || line.unit;
      const toAmount = (value: { numerator: number; denominator: number }) =>
        multiply(
          multiply(
            fraction(BigInt(value.numerator), BigInt(value.denominator)),
            scale,
          ),
          factor,
        );
      let quantity: string, amount: Fraction | undefined, sig: string;
      if (line.amount.kind === "exact") {
        amount = toAmount(line.amount);
        const previous = rows.get(key)?.amount;
        if (previous) amount = add(amount, previous);
        quantity = display(amount, unit);
        sig = signature(amount);
      } else if (line.amount.kind === "range") {
        const min = toAmount(line.amount.min),
          max = toAmount(line.amount.max);
        quantity = `${display(min, unit)}–${display(max, unit)}`;
        sig = `range:${signature(min)}:${signature(max)}`;
      } else {
        quantity = line.amount.label;
        sig = `qualitative:${line.amount.label}`;
      }
      rows.set(key, {
        row: {
          key,
          name: `${ingredientName(snapshot, line)}${line.form && line.form !== "as listed" ? ` (${line.form})` : ""}`,
          aisle: canonical?.aisle || "Other",
          quantity,
          signature: `rules-1:${sig}`,
          checked: false,
        },
        amount,
        unit,
      });
    }
  }
  return [...rows.values()]
    .map((item) => item.row)
    .sort(
      (a, b) =>
        a.aisle.localeCompare(b.aisle) ||
        a.name.localeCompare(b.name) ||
        a.key.localeCompare(b.key),
    );
}
export function remainingSeconds(deadline: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}

export function parseAmount(
  value: string,
): Snapshot["recipe"]["ingredients"][number]["amount"] {
  const input = value.trim();
  if (/^[\p{L} ]+$/u.test(input) && input.length > 0)
    return { kind: "qualitative", label: input };
  const parse = (part: string) => {
    let result: Fraction;
    const mixed = part.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    const ratio = part.match(/^(\d+)\/(\d+)$/);
    const decimal = part.match(/^(\d+)(?:\.(\d+))?$/);
    if (mixed) {
      const d = BigInt(mixed[3]);
      if (!d) throw new Error("Use a positive amount");
      result = fraction(BigInt(mixed[1]) * d + BigInt(mixed[2]), d);
    } else if (ratio) {
      const d = BigInt(ratio[2]);
      if (!d) throw new Error("Use a positive amount");
      result = fraction(BigInt(ratio[1]), d);
    } else if (decimal) {
      const precision = decimal[2]?.length || 0;
      result = fraction(
        BigInt(decimal[1] + (decimal[2] || "")),
        10n ** BigInt(precision),
      );
    } else throw new Error("Use a number, fraction, range, or “to taste”.");
    if (
      result.n <= 0n ||
      result.n > BigInt(Number.MAX_SAFE_INTEGER) ||
      result.d > BigInt(Number.MAX_SAFE_INTEGER)
    )
      throw new Error("Use a positive amount within the supported range");
    return { numerator: Number(result.n), denominator: Number(result.d) };
  };
  const range = input.split(/\s*[-–]\s*/);
  if (range.length === 2) {
    const min = parse(range[0]),
      max = parse(range[1]);
    if (
      BigInt(min.numerator) * BigInt(max.denominator) >
      BigInt(max.numerator) * BigInt(min.denominator)
    )
      throw new Error("Put the smaller amount first");
    return { kind: "range", min, max };
  }
  return { kind: "exact", ...parse(input) };
}
export function amountText(
  amount: Snapshot["recipe"]["ingredients"][number]["amount"],
): string {
  return amount.kind === "qualitative"
    ? amount.label
    : amount.kind === "range"
      ? `${format(fraction(BigInt(amount.min.numerator), BigInt(amount.min.denominator)))}–${format(fraction(BigInt(amount.max.numerator), BigInt(amount.max.denominator)))}`
      : format(fraction(BigInt(amount.numerator), BigInt(amount.denominator)));
}
export function scaledAmount(
  amount: Snapshot["recipe"]["ingredients"][number]["amount"],
  servings: number,
  yieldServings: number,
): string {
  const scale = fraction(BigInt(servings), BigInt(yieldServings));
  const part = (value: { numerator: number; denominator: number }) =>
    format(
      multiply(
        fraction(BigInt(value.numerator), BigInt(value.denominator)),
        scale,
      ),
    );
  return amount.kind === "qualitative"
    ? amount.label
    : amount.kind === "range"
      ? `${part(amount.min)}–${part(amount.max)}`
      : part(amount);
}
export function newDraft(
  defaultServings = 2,
  snapshot?: Snapshot,
): RecipeDraft {
  const recipe = snapshot?.recipe;
  return {
    id: "active",
    recipeId: recipe?.id.startsWith("u_")
      ? recipe.id
      : `u_${crypto.randomUUID()}`,
    revision: recipe?.id.startsWith("u_") ? recipe.revision : 0,
    title: recipe?.title || "",
    summary: recipe?.summary || "",
    yield: String(recipe?.yieldServings || defaultServings),
    prep: String(recipe?.prepMinutes || 0),
    cook: String(recipe?.cookMinutes || 0),
    ingredients: recipe
      ? recipe.ingredients.map((line) => ({
          id: line.id,
          label: ingredientName(snapshot!, line),
          ingredientId: line.ingredientId,
          amount: amountText(line.amount),
          unit: line.unit,
          form: line.form,
          optional: line.optional,
        }))
      : [
          {
            id: "line_1",
            label: "",
            amount: "",
            unit: "g",
            form: "as listed",
            optional: false,
          },
        ],
    steps: recipe
      ? recipe.steps.map((step) => ({
          id: step.id,
          text: step.text,
          minutes: step.timerSeconds ? String(step.timerSeconds / 60) : "",
          ingredientLineIds: step.ingredientLineIds,
        }))
      : [{ id: "step_1", text: "", minutes: "" }],
    image: snapshot?.image,
    sourceIngredients: snapshot?.ingredients || [],
    base: recipe,
  };
}
export function parseDraft(draft: RecipeDraft): {
  snapshot?: Snapshot;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "Give your recipe a name.";
  const count = (value: string, key: string, min: number) => {
    const number = Number(value);
    if (!value.trim() || !Number.isSafeInteger(number) || number < min)
      errors[key] = min
        ? "Use a positive whole number."
        : "Use zero or a positive whole number.";
    return number;
  };
  const yieldServings = count(draft.yield, "yield", 1),
    prepMinutes = count(draft.prep, "prep", 0),
    cookMinutes = count(draft.cook, "cook", 0);
  if (!draft.ingredients.length)
    errors.ingredients = "Add at least one ingredient.";
  const ingredients = draft.ingredients.map((line, index) => {
    const prefix = `ingredient.${index}`;
    if (!line.label.trim()) errors[`${prefix}.label`] = "Name this ingredient.";
    let amount: ReturnType<typeof parseAmount> = {
      kind: "qualitative",
      label: "to taste",
    };
    try {
      amount = parseAmount(line.amount);
    } catch (cause) {
      errors[`${prefix}.amount`] = (cause as Error).message;
    }
    if (amount.kind !== "qualitative" && !line.unit.trim())
      errors[`${prefix}.unit`] = "Choose a unit.";
    return {
      id: line.id,
      ingredientId: line.ingredientId,
      label: line.label.trim(),
      amount,
      unit: line.unit.trim(),
      form: line.form.trim() || "as listed",
      prepNote:
        draft.base?.ingredients.find((item) => item.id === line.id)?.prepNote ||
        "",
      optional: line.optional,
    };
  });
  if (!draft.steps.length) errors.steps = "Add at least one step.";
  const steps = draft.steps.map((step, index) => {
    if (!step.text.trim()) errors[`step.${index}.text`] = "Describe this step.";
    const seconds = step.minutes.trim() ? Number(step.minutes) * 60 : undefined;
    if (
      seconds !== undefined &&
      (!Number.isSafeInteger(seconds) || seconds <= 0)
    )
      errors[`step.${index}.minutes`] = "Use a positive timer duration.";
    return {
      id: step.id,
      text: step.text.trim(),
      ingredientLineIds: (
        step.ingredientLineIds || ingredients.map((line) => line.id)
      ).filter((id) => ingredients.some((line) => line.id === id)),
      ...(seconds ? { timerSeconds: seconds } : {}),
    };
  });
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    snapshot: {
      recipe: {
        ...draft.base,
        id: draft.recipeId,
        revision: Math.max(draft.revision, 1),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        aliases: draft.base?.aliases || [],
        tags: draft.base?.tags || [],
        mealSlots: draft.base?.mealSlots || ["breakfast", "lunch", "dinner"],
        allergens: { status: "unknown", items: [] },
        yieldServings,
        prepMinutes,
        cookMinutes,
        ingredients,
        steps,
        imageId: draft.image?.id,
        sourceIds: [],
        reviewStatus: "local",
      },
      ingredients: draft.sourceIngredients,
      image: draft.image,
    },
  };
}
