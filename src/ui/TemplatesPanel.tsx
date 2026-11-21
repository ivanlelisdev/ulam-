import { useState } from "react";
import {
  type UlamDatabase,
  saveTemplate,
  previewTemplate,
  applyTemplate,
} from "../data/database";
import type { Template } from "../data/schema";
import { weekStart } from "../domain";
import { Icon } from "./Icon";
export function TemplatesPanel({
  db,
  templates,
  week,
  onChanged,
}: {
  db: UlamDatabase;
  templates: Template[];
  week: string;
  onChanged: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [target, setTarget] = useState(week);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] =
    useState<Awaited<ReturnType<typeof previewTemplate>>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  function reset() {
    setPreview(undefined);
    setApplied(false);
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const template = await saveTemplate(db, name, week);
      setSelected(template.id);
      setName("");
      onChanged("Template saved.");
      reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1 tabIndex={-1}>Templates</h1>
          <p>A good week is worth keeping.</p>
        </div>
        <Icon name="templates" width="32" height="32" />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form className="panel" onSubmit={save}>
        <h2>Save this week</h2>
        <p>
          Save the meals in the week of{" "}
          {new Date(`${week}T12:00:00`).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          .
        </p>
        <div className="inline-form">
          <label>
            Template name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="A week of favourites"
            />
          </label>
          <button disabled={busy}>Save week as template</button>
        </div>
      </form>
      {!templates.length ? (
        <div className="empty">
          <Icon name="templates" width="40" height="40" />
          <h2>No templates yet</h2>
          <p>Plan a few meals, then save your week above to reuse it.</p>
        </div>
      ) : (
        <section className="panel">
          <h2>Reuse a week</h2>
          <div className="form-grid">
            <label>
              Saved template
              <select
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  reset();
                }}
              >
                <option value="">Choose a template</option>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target week date
              <input
                required
                type="date"
                value={target}
                onChange={(event) => {
                  if (event.target.value) setTarget(event.target.value);
                  reset();
                }}
              />
            </label>
            <label className="check-line wide">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => {
                  setReplace(event.target.checked);
                  reset();
                }}
              />
              Replace existing meals (preview required)
            </label>
          </div>
          <p>
            Target week starts Monday {weekStart(target)}. By default, existing
            meals stay in place.
          </p>
          <button
            className="quiet"
            disabled={!selected || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setPreview(
                  await previewTemplate(
                    db,
                    selected,
                    weekStart(target),
                    replace,
                  ),
                );
                setApplied(false);
              } catch (cause) {
                setError((cause as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Preview template
          </button>
          {preview && (
            <section className="template-preview" aria-label="Template preview">
              <h3>
                {preview.changes.length} meal
                {preview.changes.length === 1 ? "" : "s"} to apply
              </h3>
              {preview.kept > 0 && (
                <p>
                  {preview.kept} existing meal{preview.kept === 1 ? "" : "s"}{" "}
                  kept.
                </p>
              )}
              {preview.replacements.length > 0 && (
                <div className="warning">
                  <strong>
                    This will replace {preview.replacements.length} existing
                    meal{preview.replacements.length === 1 ? "" : "s"}:
                  </strong>
                  <ul>
                    {preview.replacements.map((plan) => (
                      <li key={plan.date + plan.slot}>
                        {plan.date} · {plan.slot} ·{" "}
                        {plan.snapshot?.recipe.title || "Saved meal"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="preview-list">
                {preview.changes.map((plan) => (
                  <li key={plan.date + plan.slot}>
                    <span>
                      {plan.date} · {plan.slot}
                    </span>
                    <strong>{plan.snapshot?.recipe.title}</strong>
                    <span>{plan.servings} servings</span>
                  </li>
                ))}
              </ul>
              {preview.skipped.length > 0 && (
                <div className="warning">
                  <h3>Skipped meals</h3>
                  <ul>
                    {preview.skipped.map((notice) => (
                      <li key={notice}>{notice}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                disabled={busy || !preview.changes.length || applied}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await applyTemplate(
                      db,
                      selected,
                      weekStart(target),
                      replace,
                      preview.token,
                    );
                    setApplied(true);
                    onChanged(
                      `Template applied. ${result.skipped.length ? `${result.skipped.length} unavailable meal(s) skipped.` : ""}`,
                    );
                  } catch (cause) {
                    setError((cause as Error).message);
                    setPreview(undefined);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {applied ? "Applied" : "Apply template"}
              </button>
            </section>
          )}
        </section>
      )}
    </section>
  );
}
