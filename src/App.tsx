import { useEffect, useState } from "react";
import {
  UlamDatabase,
  getActiveCatalog,
  getLibrary,
  getWeekPlans,
  getGroceries,
  getPreferences,
  savePreferences,
  getCooking,
  savePlan,
  planToken,
  removeMeal,
  undoRemove,
  checkGrocery,
  remixRecipe,
  archiveRecipe,
  startCooking,
} from "./data/database";
import type {
  Catalog,
  Plan,
  Snapshot,
  Preferences,
  Template,
  CookingSession,
} from "./data/schema";
import { localDate, weekStart } from "./domain";
import {
  filterRecipes,
  suggestRecipes,
  ingredientName,
  scaledAmount,
  type GroceryRow,
} from "./product";
import { isReady, prepareOffline } from "./offline";
import { Icon } from "./ui/Icon";
import { WeekPicker } from "./ui/WeekPicker";
import { RecipeEditor } from "./ui/RecipeEditor";
import { CookingScreen } from "./ui/CookingScreen";
import { TemplatesPanel } from "./ui/TemplatesPanel";
const pages = [
  "recipes",
  "plan",
  "templates",
  "groceries",
  "settings",
  "recipe",
  "editor",
  "cook",
];
const initialPage = () => {
  const value =
    location.hash.slice(1) || location.pathname.slice(1) || "recipes";
  return pages.includes(value) ? value : "recipes";
};
type Selected = { snapshot: Snapshot; releaseId?: string; archived?: boolean };
function readableError(cause: unknown) {
  if (cause instanceof Error) {
    if (cause.name === "QuotaExceededError")
      return "Local storage is full. Free some device space and retry; your saved work has not been removed.";
    if (cause.name === "ZodError")
      return "Some saved or downloaded data is invalid. Check your input or repair downloads and retry.";
    if (cause.name === "TypeError")
      return "The operation could not finish. Check your connection or local storage and retry.";
    return cause.message;
  }
  return "Could not finish. Keep this page open and retry.";
}
export function App() {
  const [db, setDb] = useState<UlamDatabase>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [library, setLibrary] = useState<Snapshot[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<GroceryRow[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    id: "settings",
    defaultServings: 2,
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [session, setSession] = useState<CookingSession>();
  const [date, setDate] = useState(localDate(new Date()));
  const [page, setPage] = useState(initialPage);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Preparing your kitchen…");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mealFilter, setMealFilter] = useState<"all" | Plan["slot"]>("all");
  const [maxMinutes, setMaxMinutes] = useState(Infinity);
  const [excluded, setExcluded] = useState("");
  const [available, setAvailable] = useState("");
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<Selected>();
  const [editing, setEditing] = useState<Snapshot>();
  const [servings, setServings] = useState(2);
  const [slot, setSlot] = useState<Plan["slot"]>("dinner");
  const [suggestSlot, setSuggestSlot] = useState<Plan["slot"]>("breakfast");
  const [removed, setRemoved] = useState<Plan>();
  const [defaultInput, setDefaultInput] = useState("2");
  const [storage, setStorage] = useState(
    "Storage estimates are unavailable in this browser.",
  );
  const week = weekStart(date);
  const refresh = () => setRevision((value) => value + 1);
  function go(destination: string) {
    location.hash = destination;
    setPage(destination);
    setError("");
  }
  useEffect(() => {
    const update = () => setPage(initialPage());
    window.addEventListener("hashchange", update);
    window.addEventListener("focus", refresh);
    let database: UlamDatabase | undefined;
    (async () => {
      if (!("indexedDB" in window) || !("serviceWorker" in navigator))
        throw new Error(
          "Use a current browser with local storage and service-worker support.",
        );
      database = new UlamDatabase();
      database.on("blocked", () =>
        setError(
          "Close other Ulam tabs so the local database can finish updating.",
        ),
      );
      database.on("versionchange", () => {
        database?.close();
        setDb(undefined);
        setError(
          "An app update needs this tab to reload. Saved meals are safe.",
        );
      });
      await database.open();
      const prefs = await getPreferences(database);
      setPreferences(prefs);
      setDefaultInput(String(prefs.defaultServings));
      setDate(prefs.selectedDate || localDate(new Date()));
      setDb(database);
      await navigator.serviceWorker.register("/sw.js");
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "App setup timed out. Check your connection and reload.",
                ),
              ),
            15000,
          ),
        ),
      ]);
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new Error("The app shell is not ready. Reconnect and reload."),
              ),
            10000,
          );
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
      const complete = await isReady(database);
      setReady(complete);
      setNotice(
        complete
          ? "Ready offline"
          : "Download the sample recipes for offline use.",
      );
    })()
      .catch((cause) => setError(readableError(cause)))
      .finally(() => setLoading(false));
    return () => {
      database?.close();
      window.removeEventListener("hashchange", update);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    Promise.all([
      getActiveCatalog(db),
      getLibrary(db),
      getWeekPlans(db, week),
      getGroceries(db, week),
      getPreferences(db),
      db.templates.toArray(),
      getCooking(db),
    ])
      .then(([active, recipes, meals, groceries, prefs, saved, cooking]) => {
        if (!alive) return;
        setCatalog(active);
        setLibrary(recipes);
        setPlans(meals);
        setRows(groceries);
        setPreferences(prefs);
        setDefaultInput(String(prefs.defaultServings));
        setTemplates(saved);
        setSession(cooking);
      })
      .catch((cause) => alive && setError(readableError(cause)));
    return () => {
      alive = false;
    };
  }, [db, week, revision]);
  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [page]);
  useEffect(() => {
    if (page === "settings" && navigator.storage?.estimate)
      navigator.storage
        .estimate()
        .then((info) =>
          setStorage(
            `Approximately ${((info.usage || 0) / 1048576).toFixed(1)} MB used${info.quota ? ` of ${(info.quota / 1048576).toFixed(0)} MB estimated browser quota` : ""}.`,
          ),
        )
        .catch(() => {});
  }, [page, revision]);
  function changeDate(value: string) {
    setDate(value);
    if (db)
      savePreferences(db, { selectedDate: value }).catch((cause) =>
        setError(readableError(cause)),
      );
  }
  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotice(message);
      refresh();
      return true;
    } catch (cause) {
      setError(readableError(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function setup() {
    if (!db) return;
    setBusy(true);
    setError("");
    setNotice("Checking offline files…");
    try {
      await prepareOffline(db, setNotice);
      if (!(await isReady(db)))
        throw new Error("Some offline files are missing. Reconnect and retry.");
      setReady(true);
      setNotice("Ready offline");
      refresh();
    } catch (cause) {
      setReady(false);
      setNotice("Offline setup needs repair. Reconnect and retry.");
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }
  function openRecipe(
    snapshot: Snapshot,
    releaseId?: string,
    portions = preferences.defaultServings,
    archived = false,
  ) {
    setSelected({ snapshot, releaseId, archived });
    setServings(portions);
    go("recipe");
  }
  async function openMeal(plan: Plan) {
    if (!plan.snapshot) return;
    const archived = plan.recipeId.startsWith("u_")
      ? !!(await db?.userRecipes.get(plan.recipeId))?.archivedAt
      : false;
    openRecipe(plan.snapshot, plan.catalogReleaseId, plan.servings, archived);
  }
  async function saveMeal(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !selected) return;
    const current = await db.plans.get([date, slot]).catch(() => undefined);
    if (current && !window.confirm("Replace the meal already in this slot?"))
      return;
    await perform(
      () =>
        savePlan(
          db,
          {
            weekStart: week,
            date,
            slot,
            recipeId: selected.snapshot.recipe.id,
            recipeRevision: selected.snapshot.recipe.revision,
            catalogReleaseId: selected.releaseId,
            servings,
            updatedAt: new Date().toISOString(),
          },
          planToken(current),
        ),
      "Meal saved to your plan.",
    );
  }
  async function cook() {
    if (!db || !selected) return;
    if (
      session &&
      session.snapshot.recipe.id === selected.snapshot.recipe.id &&
      session.snapshot.recipe.revision === selected.snapshot.recipe.revision
    ) {
      go("cook");
      return;
    }
    if (
      session &&
      !window.confirm(
        "Start this recipe and replace your current cooking session?",
      )
    )
      return;
    await perform(async () => {
      setSession(
        await startCooking(
          db,
          selected.snapshot,
          servings,
          session?.sessionId || null,
        ),
      );
      go("cook");
    }, "Cooking session saved.");
  }
  const filters = {
    query,
    slot: mealFilter,
    maxMinutes,
    excluded: excluded
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
  const visible = filterRecipes(
    library.filter((item) => !mine || item.recipe.id.startsWith("u_")),
    filters,
  );
  const suggestions = suggestRecipes(
    library,
    {
      ...filters,
      query: "",
      slot: suggestSlot,
      available: available.split(","),
    },
    plans,
  );
  const activeMeal = plans.find(
    (plan) => plan.date === date && plan.slot === suggestSlot,
  );
  const resetFilters = () => {
    setQuery("");
    setMealFilter("all");
    setMaxMinutes(Infinity);
    setExcluded("");
    setMine(false);
  };
  const heading = (title: string, subtitle?: string) => (
    <div className="page-heading">
      <div>
        <h1 tabIndex={-1}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
  const timeFilter = (
    <label>
      Maximum time
      <select
        aria-label="Maximum time"
        value={Number.isFinite(maxMinutes) ? maxMinutes : 0}
        onChange={(event) =>
          setMaxMinutes(Number(event.target.value) || Infinity)
        }
      >
        <option value="0">Any time</option>
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">60 minutes</option>
      </select>
    </label>
  );
  return (
    <div
      className={`app ${page === "cook" ? "is-cooking" : ""} ${session ? "has-session" : ""}`}
    >
      <a
        className="skip"
        href="#content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("content")?.focus();
        }}
      >
        Skip to content
      </a>
      {page !== "cook" && (
        <>
          <header className="app-header">
            <a className="brand" href="#recipes">
              ulam<span>?</span>
            </a>
            <span className={`offline-chip ${ready ? "is-ready" : ""}`}>
              {ready ? <Icon name="check" /> : <Icon name="clock" />}
              {ready ? "Ready offline" : "Setup needed"}
            </span>
            <a
              href="#settings"
              className="icon-button"
              aria-label="Open settings"
            >
              <Icon name="settings" />
            </a>
          </header>
          <div className="preview">
            Development preview · {catalog?.recipes.length || 2} sample recipes
            · guest mode
          </div>
        </>
      )}
      <main id="content" tabIndex={-1}>
        {page !== "cook" && (
          <>
            <div className="feedback">
              <p role="status">{notice}</p>
              {removed && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      db &&
                      (await perform(
                        () => undoRemove(db, removed),
                        "Meal restored.",
                      ))
                    )
                      setRemoved(undefined);
                  }}
                >
                  Undo removal
                </button>
              )}
            </div>
            {!ready && (
              <section className="setup panel" aria-label="Offline setup">
                <div>
                  <h2>
                    {catalog
                      ? "Offline files need repair"
                      : "Take your kitchen offline"}
                  </h2>
                  <p>
                    Recipes, images and your plans stay available after setup.
                  </p>
                </div>
                <button disabled={!db || busy || loading} onClick={setup}>
                  {busy
                    ? "Downloading…"
                    : catalog
                      ? "Repair offline files"
                      : "Download for offline use"}
                </button>
              </section>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        {page === "recipes" && (
          <section>
            <div className="page-heading">
              <div>
                <h1 tabIndex={-1}>Recipes</h1>
                <p>Anong ulam? A little inspiration for your table.</p>
              </div>
              <button
                disabled={!db}
                onClick={() => {
                  setEditing(undefined);
                  go("editor");
                }}
              >
                <Icon name="plus" />
                New recipe
              </button>
            </div>
            <div className="tabs" aria-label="Recipe collection">
              <button
                className={mine ? "quiet" : ""}
                aria-pressed={!mine}
                onClick={() => setMine(false)}
              >
                Explore
              </button>
              <button
                className={mine ? "" : "quiet"}
                aria-pressed={mine}
                onClick={() => setMine(true)}
              >
                My recipes
              </button>
            </div>
            <label className="search">
              Search recipes
              <div>
                <Icon name="search" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search dishes or ingredients"
                />
              </div>
            </label>
            <details className="recipe-filters">
              <summary>Filter recipes</summary>
              <div className="filter-row">
                <label>
                  Meal type
                  <select
                    aria-label="Meal type"
                    value={mealFilter}
                    onChange={(event) =>
                      setMealFilter(event.target.value as typeof mealFilter)
                    }
                  >
                    <option value="all">All meals</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </label>
                {timeFilter}
                <label>
                  Avoid ingredients
                  <input
                    value={excluded}
                    onChange={(event) => setExcluded(event.target.value)}
                    placeholder="e.g. egg, garlic"
                  />
                </label>
              </div>
            </details>
            {loading ? (
              <p>Opening your recipe shelf…</p>
            ) : visible.length ? (
              <div className="recipe-grid">
                {visible.map((snapshot) => (
                  <article className="recipe-card" key={snapshot.recipe.id}>
                    <RecipeImage
                      key={`${snapshot.image?.path}-${ready}`}
                      snapshot={snapshot}
                      onMissing={() => {
                        setReady(false);
                        setNotice(
                          "An image is missing. Reconnect and repair downloads.",
                        );
                      }}
                    />
                    <div className="recipe-card-body">
                      <h2>{snapshot.recipe.title}</h2>
                      <p>{snapshot.recipe.summary}</p>
                      <span className="recipe-meta">
                        <Icon name="clock" />
                        {snapshot.recipe.prepMinutes +
                          snapshot.recipe.cookMinutes}{" "}
                        min · {snapshot.recipe.yieldServings} servings
                      </span>
                      <button
                        className="quiet"
                        onClick={() =>
                          openRecipe(
                            snapshot,
                            snapshot.recipe.id.startsWith("r_")
                              ? catalog?.releaseId
                              : undefined,
                          )
                        }
                      >
                        View recipe &amp; plan
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                <Icon name="recipes" width="42" height="42" />
                <h2>
                  {library.length
                    ? "No recipes found"
                    : mine
                      ? "Your family favourites belong here"
                      : "Your recipe shelf is waiting"}
                </h2>
                <p>
                  {library.length
                    ? "Try another dish, a longer cooking time, or remove an ingredient exclusion."
                    : "Download the sample recipes above or create a recipe of your own."}
                </p>
                <button className="quiet" onClick={resetFilters}>
                  Reset search
                </button>
              </div>
            )}
          </section>
        )}
        {page === "recipe" &&
          (selected ? (
            <section>
              <div className="page-heading">
                <button className="quiet" onClick={() => go("recipes")}>
                  <Icon name="back" />
                  Recipes
                </button>
                <div className="inline-actions">
                  {!selected.archived && (
                    <button
                      className="quiet"
                      disabled={busy || !db}
                      onClick={async () => {
                        if (!db) return;
                        if (selected.snapshot.recipe.id.startsWith("u_")) {
                          setEditing(selected.snapshot);
                          go("editor");
                        } else
                          await perform(async () => {
                            const local = await remixRecipe(
                              db,
                              selected.snapshot,
                            );
                            setEditing({
                              recipe: local.recipe,
                              ingredients: local.ingredients,
                              image: local.image,
                            });
                            go("editor");
                          }, "Independent remix created.");
                      }}
                    >
                      <Icon name="edit" />
                      {selected.snapshot.recipe.id.startsWith("u_")
                        ? "Edit recipe"
                        : "Remix recipe"}
                    </button>
                  )}
                </div>
              </div>
              <div className="recipe-detail">
                <RecipeImage
                  key={`${selected.snapshot.image?.path}-${ready}`}
                  snapshot={selected.snapshot}
                  onMissing={() => {
                    setReady(false);
                    setNotice(
                      "An image is missing. Reconnect and repair downloads.",
                    );
                  }}
                />
                <div>
                  <h1 tabIndex={-1}>{selected.snapshot.recipe.title}</h1>
                  <p>{selected.snapshot.recipe.summary}</p>
                  <p className="small">
                    {selected.snapshot.recipe.reviewStatus === "development"
                      ? "Development recipe · not kitchen-tested."
                      : "Local recipe."}{" "}
                    Allergen information is unreviewed.
                  </p>
                  {selected.archived && (
                    <p className="warning">
                      Archived recipe · this saved meal keeps its original
                      content.
                    </p>
                  )}
                  <dl className="recipe-stats">
                    <div>
                      <dt>Prep</dt>
                      <dd>{selected.snapshot.recipe.prepMinutes} min</dd>
                    </div>
                    <div>
                      <dt>Cook</dt>
                      <dd>{selected.snapshot.recipe.cookMinutes} min</dd>
                    </div>
                    <div>
                      <dt>Yield</dt>
                      <dd>{selected.snapshot.recipe.yieldServings} servings</dd>
                    </div>
                  </dl>
                  <button disabled={busy || !db} onClick={cook}>
                    <Icon name="cook" />
                    {session?.snapshot.recipe.id === selected.snapshot.recipe.id
                      ? "Resume cooking"
                      : "Cook now"}
                  </button>
                </div>
              </div>
              <div className="detail-columns">
                <section>
                  <h2>Ingredients</h2>
                  <p>Amounts for {servings} servings</p>
                  <ul className="ingredient-list">
                    {selected.snapshot.recipe.ingredients.map((line) => (
                      <li key={line.id}>
                        <span>
                          {ingredientName(selected.snapshot, line)}
                          {line.form !== "as listed" ? `, ${line.form}` : ""}
                          {line.prepNote ? `, ${line.prepNote}` : ""}
                          {line.optional ? " (optional)" : ""}
                        </span>
                        <strong>
                          {scaledAmount(
                            line.amount,
                            Number.isSafeInteger(servings) && servings > 0
                              ? servings
                              : 1,
                            selected.snapshot.recipe.yieldServings,
                          )}{" "}
                          {line.unit}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2>Directions</h2>
                  <ol className="directions">
                    {selected.snapshot.recipe.steps.map((step) => (
                      <li key={step.id}>{step.text}</li>
                    ))}
                  </ol>
                </section>
              </div>
              <form className="panel" onSubmit={saveMeal}>
                <h2>Add to your plan</h2>
                <div className="form-grid">
                  <label>
                    Date
                    <input
                      required
                      type="date"
                      value={date}
                      onChange={(event) =>
                        event.target.value && changeDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Meal
                    <select
                      aria-label="Meal"
                      value={slot}
                      onChange={(event) =>
                        setSlot(event.target.value as Plan["slot"])
                      }
                    >
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                    </select>
                  </label>
                  <label>
                    Servings
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={servings}
                      onChange={(event) =>
                        setServings(Number(event.target.value))
                      }
                    />
                  </label>
                </div>
                <button disabled={busy || !db}>Save meal</button>
              </form>
              {selected.snapshot.recipe.id.startsWith("u_") &&
                !selected.archived && (
                  <section className="panel">
                    <h2>Archive this recipe</h2>
                    <p>
                      {selected.snapshot.recipe.title} will be hidden from your
                      recipe shelf. Existing plans and cooking sessions retain
                      their saved content.
                    </p>
                    <button
                      className="quiet danger"
                      disabled={!db || busy || loading}
                      onClick={async () => {
                        if (
                          db &&
                          window.confirm(
                            "Archive this local recipe? Saved meals will stay readable.",
                          ) &&
                          (await perform(
                            () =>
                              archiveRecipe(db, selected.snapshot.recipe.id),
                            "Recipe archived; saved meals kept.",
                          ))
                        )
                          setSelected({ ...selected, archived: true });
                      }}
                    >
                      Archive recipe
                    </button>
                  </section>
                )}
            </section>
          ) : (
            <div className="empty">
              <h1 tabIndex={-1}>Choose a recipe</h1>
              <a href="#recipes">Open your recipe shelf</a>
            </div>
          ))}
        {page === "plan" && (
          <section>
            {heading("Your week", "A little planning. A lot less wondering.")}
            <WeekPicker date={date} onChange={changeDate} />
            <label className="date-control">
              Plan date
              <input
                type="date"
                value={date}
                onChange={(event) =>
                  event.target.value && changeDate(event.target.value)
                }
              />
            </label>
            <h2 className="selected-day">
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h2>
            <div className="meal-list">
              {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
                const plan = plans.find(
                  (entry) => entry.date === date && entry.slot === meal,
                );
                return (
                  <section className="meal" key={meal}>
                    <div className="section-heading">
                      <h3>{meal[0].toUpperCase() + meal.slice(1)}</h3>
                      {plan && (
                        <button
                          className="icon-button quiet"
                          aria-label={`Remove ${meal}`}
                          disabled={busy}
                          onClick={() =>
                            db &&
                            perform(async () => {
                              setRemoved(
                                await removeMeal(
                                  db,
                                  date,
                                  meal,
                                  planToken(plan),
                                ),
                              );
                            }, "Meal removed.")
                          }
                        >
                          <Icon name="remove" />
                        </button>
                      )}
                    </div>
                    {plan ? (
                      <>
                        <button
                          className="meal-title"
                          disabled={!plan.snapshot}
                          onClick={() => openMeal(plan)}
                        >
                          {plan.snapshot?.recipe.title ||
                            "Recipe unavailable — meal retained"}
                        </button>
                        <MealPortions
                          plan={plan}
                          busy={busy}
                          onSave={(value) =>
                            db &&
                            perform(
                              () =>
                                savePlan(
                                  db,
                                  {
                                    ...plan,
                                    servings: value,
                                    updatedAt: new Date().toISOString(),
                                  },
                                  planToken(plan),
                                ),
                              "Meal portions updated.",
                            )
                          }
                        />
                      </>
                    ) : (
                      <button
                        className="add-meal quiet"
                        onClick={() => {
                          setSlot(meal);
                          go("recipes");
                        }}
                      >
                        <Icon name="plus" />
                        Choose a recipe
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
            <section className="panel suggestions">
              <h2>Something for this week</h2>
              <p>
                Local suggestions based on time, ingredients and variety. They
                do not certify allergen safety.
              </p>
              <div className="filter-row">
                <label>
                  Suggestion meal
                  <select
                    aria-label="Suggestion meal"
                    value={suggestSlot}
                    onChange={(event) =>
                      setSuggestSlot(event.target.value as Plan["slot"])
                    }
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </label>
                {timeFilter}
                <label>
                  Ingredients you have
                  <input
                    value={available}
                    onChange={(event) => setAvailable(event.target.value)}
                    placeholder="e.g. rice, garlic"
                  />
                </label>
                <label>
                  Avoid ingredients
                  <input
                    value={excluded}
                    onChange={(event) => setExcluded(event.target.value)}
                  />
                </label>
              </div>
              {activeMeal ? (
                <p>
                  This {suggestSlot} slot is filled. Choose an empty slot for
                  suggestions.
                </p>
              ) : suggestions.length ? (
                <ul className="suggestion-list">
                  {suggestions.slice(0, 5).map((item) => (
                    <li key={item.snapshot.recipe.id}>
                      <div>
                        <strong>{item.snapshot.recipe.title}</strong>
                        <p>{item.reason}</p>
                      </div>
                      <button
                        className="quiet"
                        disabled={busy || !db}
                        aria-label={`Add ${item.snapshot.recipe.title} suggestion`}
                        onClick={() =>
                          db &&
                          perform(
                            () =>
                              savePlan(
                                db,
                                {
                                  weekStart: week,
                                  date,
                                  slot: suggestSlot,
                                  recipeId: item.snapshot.recipe.id,
                                  recipeRevision: item.snapshot.recipe.revision,
                                  catalogReleaseId:
                                    item.snapshot.recipe.id.startsWith("r_")
                                      ? catalog?.releaseId
                                      : undefined,
                                  servings: preferences.defaultServings,
                                  updatedAt: new Date().toISOString(),
                                },
                                null,
                              ),
                            "Suggestion added to the empty slot.",
                          )
                        }
                      >
                        <Icon name="plus" />
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty compact">
                  <p>
                    No meals fit these choices. Try a longer time, remove an
                    ingredient exclusion, or choose another meal.
                  </p>
                </div>
              )}
            </section>
            <div className="form-actions">
              <button className="quiet" onClick={() => go("templates")}>
                <Icon name="templates" />
                Save or reuse a template
              </button>
              <button onClick={() => go("groceries")}>
                <Icon name="groceries" />
                Open groceries
              </button>
            </div>
          </section>
        )}
        {page === "groceries" && (
          <section>
            {heading(
              "Your grocery list",
              "Everything your planned meals need.",
            )}
            <WeekPicker date={date} onChange={changeDate} />
            {rows.length ? (
              <>
                <div className="shopping-progress">
                  <progress
                    aria-label="Shopping progress"
                    max={rows.length}
                    value={rows.filter((row) => row.checked).length}
                  />
                  <p>
                    {rows.filter((row) => row.checked).length} of {rows.length}{" "}
                    items checked
                  </p>
                </div>
                {[...new Set(rows.map((row) => row.aisle))].map((aisle) => (
                  <section className="grocery-section" key={aisle}>
                    <h2>{aisle[0].toUpperCase() + aisle.slice(1)}</h2>
                    <ul className="grocery-list">
                      {rows
                        .filter((row) => row.aisle === aisle)
                        .map((row) => (
                          <li
                            key={row.key}
                            className={row.checked ? "checked" : ""}
                          >
                            <label>
                              <input
                                type="checkbox"
                                checked={row.checked}
                                disabled={busy}
                                onChange={async (event) => {
                                  if (!db) return;
                                  const checked = event.target.checked;
                                  setRows((previous) =>
                                    previous.map((item) =>
                                      item.key === row.key
                                        ? { ...item, checked }
                                        : item,
                                    ),
                                  );
                                  if (
                                    !(await perform(
                                      () =>
                                        checkGrocery(
                                          db,
                                          week,
                                          row.key,
                                          checked,
                                          row.signature,
                                        ),
                                      "Shopping progress saved.",
                                    ))
                                  )
                                    refresh();
                                }}
                              />
                              <span>{row.name}</span>
                              <strong>{row.quantity}</strong>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
              </>
            ) : (
              <div className="empty">
                <Icon name="groceries" width="42" height="42" />
                <h2>A fresh list starts with a plan</h2>
                <p>
                  Add a meal to this week and its ingredients will appear here.
                </p>
                <button onClick={() => go("plan")}>Plan a meal</button>
              </div>
            )}
          </section>
        )}
        {page === "templates" &&
          (db ? (
            <TemplatesPanel
              db={db}
              templates={templates}
              week={week}
              onChanged={(message) => {
                setNotice(message);
                refresh();
              }}
            />
          ) : (
            <p>Opening your templates…</p>
          ))}
        {page === "editor" &&
          (db ? (
            <RecipeEditor
              key={editing?.recipe.id || "draft"}
              db={db}
              initial={editing}
              defaultServings={preferences.defaultServings}
              onCancel={() => go("recipes")}
              onSaved={(record) => {
                setNotice("Local recipe saved.");
                refresh();
                openRecipe(
                  {
                    recipe: record.recipe,
                    ingredients: record.ingredients,
                    image: record.image,
                  },
                  undefined,
                );
              }}
            />
          ) : (
            <p>Opening local storage…</p>
          ))}
        {page === "cook" &&
          (db && session ? (
            <CookingScreen
              db={db}
              session={session}
              onUpdate={setSession}
              onExit={() => go("recipes")}
              onFinished={() => {
                setSession(undefined);
                setNotice("Cooking finished. Enjoy your meal.");
                go("recipes");
                refresh();
              }}
            />
          ) : (
            <div className="empty">
              <h1 tabIndex={-1}>Ready to cook?</h1>
              <p>Open a recipe to begin a saved, step-by-step session.</p>
              <button onClick={() => go("recipes")}>Choose a recipe</button>
            </div>
          ))}
        {page === "settings" && (
          <section>
            {heading(
              "Your kitchen",
              "Simple preferences. Everything stays local.",
            )}
            <form
              className="panel"
              onSubmit={(event) => {
                event.preventDefault();
                if (db)
                  void perform(async () => {
                    setPreferences(
                      await savePreferences(db, {
                        defaultServings: Number(defaultInput),
                      }),
                    );
                  }, "Default portions saved. Existing meals keep their portions.");
              }}
            >
              <h2>Who are you cooking for?</h2>
              <p>
                New meals use this serving count. Existing meals keep their
                saved portions.
              </p>
              <div className="inline-form">
                <label>
                  Default servings
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={defaultInput}
                    onChange={(event) => setDefaultInput(event.target.value)}
                  />
                </label>
                <button disabled={!db || busy || loading}>
                  Save default portions
                </button>
              </div>
            </form>
            <section className="panel">
              <h2>Offline &amp; local storage</h2>
              <p>
                {ready
                  ? "The sample catalog and images are ready offline in this browser."
                  : "Offline files need setup or repair."}
              </p>
              <p>{storage}</p>
              <p>
                Your recipes, meal plans, templates, shopping progress and
                cooking session live on this device and in this browser.
                Clearing site data removes them. An installed app may use a
                separate storage context.
              </p>
              <button
                className="quiet"
                disabled={!db || busy || loading}
                onClick={setup}
              >
                Check and repair downloads
              </button>
            </section>
            <section className="panel">
              <h2>Install Ulam?</h2>
              <p>
                Use your browser’s Install app option when available. On iPhone
                Safari, use Share → Add to Home Screen. Open the installed app
                and check readiness there.
              </p>
            </section>
          </section>
        )}
      </main>
      {page !== "cook" && (
        <>
          <nav className="bottom-nav" aria-label="Main navigation">
            {["recipes", "plan", "templates", "groceries", "settings"].map(
              (item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  aria-current={
                    page === item ||
                    (item === "recipes" && ["recipe", "editor"].includes(page))
                      ? "page"
                      : undefined
                  }
                >
                  <Icon name={item} />
                  <span>{item[0].toUpperCase() + item.slice(1)}</span>
                </a>
              ),
            )}
          </nav>
          {session && (
            <button className="resume-cooking" onClick={() => go("cook")}>
              <Icon name="cook" />
              <span>
                <strong>{session.snapshot.recipe.title}</strong>
                <small>
                  Resume cooking · step{" "}
                  {session.snapshot.recipe.steps.findIndex(
                    (step) => step.id === session.stepId,
                  ) + 1}
                </small>
              </span>
              <Icon name="next" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
function RecipeImage({
  snapshot,
  onMissing,
}: {
  snapshot: Snapshot;
  onMissing: () => void;
}) {
  const [missing, setMissing] = useState(false);
  return !snapshot.image ? (
    <div className="recipe-placeholder" role="img" aria-label="No recipe image">
      <Icon name="plate" width="42" height="42" />
    </div>
  ) : missing ? (
    <div
      className="recipe-placeholder missing"
      role="img"
      aria-label={snapshot.image.alt}
    >
      Image unavailable · repair downloads
    </div>
  ) : (
    <img
      className="recipe-image"
      src={`/${snapshot.image.path}`}
      alt={snapshot.image.alt}
      width={snapshot.image.width}
      height={snapshot.image.height}
      loading="lazy"
      onError={() => {
        setMissing(true);
        onMissing();
      }}
    />
  );
}
function MealPortions({
  plan,
  busy,
  onSave,
}: {
  plan: Plan;
  busy: boolean;
  onSave: (value: number) => unknown;
}) {
  const [value, setValue] = useState(String(plan.servings));
  useEffect(
    () => setValue(String(plan.servings)),
    [plan.servings, plan.updatedAt],
  );
  return (
    <form
      className="meal-portions"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(Number(value));
      }}
    >
      <label>
        Servings for {plan.slot}
        <input
          type="number"
          required
          min="1"
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button className="quiet" disabled={busy}>
        Update servings
      </button>
    </form>
  );
}
