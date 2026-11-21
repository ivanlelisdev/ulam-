import { useEffect, useState } from "react";
import type { Snapshot, RecipeDraft, LocalRecipe } from "../data/schema";
import { type UlamDatabase, saveDraft, saveUserRecipe } from "../data/database";
import { newDraft, parseDraft } from "../product";
import { Icon } from "./Icon";
export function RecipeEditor({
  db,
  initial,
  defaultServings,
  onSaved,
  onCancel,
}: {
  db: UlamDatabase;
  initial?: Snapshot;
  defaultServings: number;
  onSaved: (record: LocalRecipe) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    newDraft(defaultServings, initial),
  );
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const existing = await db.drafts.get("active");
      if (!alive) return;
      if (existing) {
        if (!initial || existing.recipeId === initial.recipe.id)
          setDraft(existing);
        else if (
          !window.confirm(
            "Replace your unfinished draft to edit this recipe? Cancel to keep it.",
          )
        ) {
          onCancel();
          return;
        }
      }
      setLoaded(true);
    })().catch(() =>
      setError("Could not restore your draft. Please reopen the editor."),
    );
    return () => {
      alive = false;
    };
  }, [db, initial]);
  useEffect(() => {
    if (loaded)
      saveDraft(db, draft).catch(() =>
        setError(
          "Your draft could not be saved. Keep this page open and retry.",
        ),
      );
  }, [db, draft, loaded]);
  function field(key: keyof RecipeDraft, value: unknown) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  const feedback = (key: string) =>
    errors[key] ? (
      <span id={`error-${key}`} className="field-error">
        {errors[key]}
      </span>
    ) : null;
  const props = (key: string) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const result = parseDraft(draft);
    setErrors(result.errors);
    if (!result.snapshot) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      onSaved(await saveUserRecipe(db, result.snapshot, draft.revision));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      await saveDraft(db, draft);
      onCancel();
    } catch {
      setError("Your draft could not be saved. Keep this page open and retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1 tabIndex={-1}>
            {draft.revision ? "Edit recipe" : "Your own recipe"}
          </h1>
          <p>A family favourite, kept on this device.</p>
        </div>
        <button className="quiet" disabled={busy || !loaded} onClick={leave}>
          Back
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loaded ? (
        <p role="status">Opening your draft…</p>
      ) : (
        <form noValidate onSubmit={submit} className="editor">
          <div className="panel form-grid">
            <label className="wide">
              Recipe name
              <input
                aria-label="Recipe name"
                value={draft.title}
                onChange={(event) => field("title", event.target.value)}
                {...props("title")}
              />
              {feedback("title")}
            </label>
            <label className="wide">
              Description
              <textarea
                aria-label="Description"
                value={draft.summary}
                onChange={(event) => field("summary", event.target.value)}
              />
            </label>
            <label>
              Recipe yield
              <input
                aria-label="Recipe yield"
                inputMode="numeric"
                value={draft.yield}
                onChange={(event) => field("yield", event.target.value)}
                {...props("yield")}
              />
              {feedback("yield")}
            </label>
            <label>
              Prep minutes
              <input
                aria-label="Prep minutes"
                inputMode="numeric"
                value={draft.prep}
                onChange={(event) => field("prep", event.target.value)}
                {...props("prep")}
              />
              {feedback("prep")}
            </label>
            <label>
              Cook minutes
              <input
                aria-label="Cook minutes"
                inputMode="numeric"
                value={draft.cook}
                onChange={(event) => field("cook", event.target.value)}
                {...props("cook")}
              />
              {feedback("cook")}
            </label>
          </div>
          <section className="editor-section">
            <div className="section-heading">
              <h2>Ingredients</h2>
              <button
                type="button"
                className="quiet"
                onClick={() =>
                  field("ingredients", [
                    ...draft.ingredients,
                    {
                      id: `line_${crypto.randomUUID().replaceAll("-", "")}`,
                      label: "",
                      amount: "",
                      unit: "g",
                      form: "as listed",
                      optional: false,
                    },
                  ])
                }
              >
                <Icon name="plus" />
                Add ingredient
              </button>
            </div>
            <p>Use numbers, fractions, ranges, or “to taste”.</p>
            {feedback("ingredients")}
            {draft.ingredients.map((line, index) => (
              <fieldset className="panel ingredient-editor" key={line.id}>
                <legend>Ingredient {index + 1}</legend>
                <label className="ingredient-name">
                  Ingredient name
                  <input
                    aria-label="Ingredient name"
                    value={line.label}
                    onChange={(event) =>
                      field(
                        "ingredients",
                        draft.ingredients.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                label: event.target.value,
                                ingredientId: undefined,
                              }
                            : item,
                        ),
                      )
                    }
                    {...props(`ingredient.${index}.label`)}
                  />
                  {feedback(`ingredient.${index}.label`)}
                </label>
                <label>
                  Amount
                  <input
                    aria-label="Amount"
                    value={line.amount}
                    onChange={(event) =>
                      field(
                        "ingredients",
                        draft.ingredients.map((item, i) =>
                          i === index
                            ? { ...item, amount: event.target.value }
                            : item,
                        ),
                      )
                    }
                    {...props(`ingredient.${index}.amount`)}
                  />
                  {feedback(`ingredient.${index}.amount`)}
                </label>
                <label>
                  Unit
                  <input
                    aria-label="Unit"
                    value={line.unit}
                    list="units"
                    onChange={(event) =>
                      field(
                        "ingredients",
                        draft.ingredients.map((item, i) =>
                          i === index
                            ? { ...item, unit: event.target.value }
                            : item,
                        ),
                      )
                    }
                    {...props(`ingredient.${index}.unit`)}
                  />
                  {feedback(`ingredient.${index}.unit`)}
                </label>
                <label>
                  Form / preparation
                  <input
                    aria-label="Form / preparation"
                    value={line.form}
                    onChange={(event) =>
                      field(
                        "ingredients",
                        draft.ingredients.map((item, i) =>
                          i === index
                            ? { ...item, form: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={line.optional}
                    onChange={(event) =>
                      field(
                        "ingredients",
                        draft.ingredients.map((item, i) =>
                          i === index
                            ? { ...item, optional: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  Optional
                </label>
                <button
                  type="button"
                  className="quiet"
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() =>
                    field(
                      "ingredients",
                      draft.ingredients.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Icon name="remove" />
                  Remove
                </button>
              </fieldset>
            ))}
            <datalist id="units">
              {[
                "g",
                "kg",
                "ml",
                "l",
                "tsp",
                "tbsp",
                "cup",
                "piece",
                "clove",
              ].map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </section>
          <section className="editor-section">
            <div className="section-heading">
              <h2>Directions</h2>
              <button
                type="button"
                className="quiet"
                onClick={() =>
                  field("steps", [
                    ...draft.steps,
                    {
                      id: `step_${crypto.randomUUID().replaceAll("-", "")}`,
                      text: "",
                      minutes: "",
                    },
                  ])
                }
              >
                <Icon name="plus" />
                Add step
              </button>
            </div>
            {feedback("steps")}
            {draft.steps.map((step, index) => (
              <fieldset className="panel" key={step.id}>
                <legend>Step {index + 1}</legend>
                <label>
                  Step instructions
                  <textarea
                    aria-label="Step instructions"
                    value={step.text}
                    onChange={(event) =>
                      field(
                        "steps",
                        draft.steps.map((item, i) =>
                          i === index
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                    {...props(`step.${index}.text`)}
                  />
                  {feedback(`step.${index}.text`)}
                </label>
                <div className="section-heading">
                  <label>
                    Optional timer (minutes)
                    <input
                      aria-label="Optional timer (minutes)"
                      inputMode="decimal"
                      value={step.minutes}
                      onChange={(event) =>
                        field(
                          "steps",
                          draft.steps.map((item, i) =>
                            i === index
                              ? { ...item, minutes: event.target.value }
                              : item,
                          ),
                        )
                      }
                      {...props(`step.${index}.minutes`)}
                    />
                    {feedback(`step.${index}.minutes`)}
                  </label>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() =>
                      field(
                        "steps",
                        draft.steps.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <Icon name="remove" />
                    Remove
                  </button>
                </div>
              </fieldset>
            ))}
          </section>
          <div className="form-actions">
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={leave}
            >
              Keep draft & back
            </button>
            <button disabled={busy}>{busy ? "Saving…" : "Save recipe"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
