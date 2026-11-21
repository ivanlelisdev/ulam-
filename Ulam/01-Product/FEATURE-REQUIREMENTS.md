# Feature requirements

Behavior below is the proposed implementation baseline for the confirmed features in [[MVP-SCOPE]]. Keep scenario IDs stable for QA.

| ID | Behavior and acceptance criteria |
|---|---|
| GUEST-01 | A new user can enter the app without identity fields. After setting default portions, force-close and reopen offline. The stored portions still apply to new entries and existing entries keep their previous portions. |
| SEARCH-01 | Search titles, aliases and ingredients. Normalize case and accents, combine active filters and show a clear empty state with a reset action. After offline cold launch, find a recipe by its Filipino alias and open its local image, ingredients and directions. |
| SUG-01 | Rank candidates locally by time fit, ingredient overlap and weekly variety after active exclusions. Show a reason and stable ordering for identical inputs. Given a restrictive filter with no results, explain which filter can be changed. Accepting a suggestion populates the selected empty slot. Suggestions never silently overwrite an entry or certify allergen safety. |
| PLAN-01 | Navigate Monday-based weeks, assign a recipe and portions, replace a meal with confirmation and remove with undo. Edit Sunday dinner, navigate away and reopen offline. The change remains on the intended calendar date. |
| TPL-01 | Save a named relative seven-day layout and preview it against a target week. Default to filling empty slots. Explicit replacement previews affected meals before applying. If a referenced recipe is missing, report the skipped slot. Commit all accepted changes together. |
| SHOP-01 | For the selected week, scale amounts by planned portions, then combine by canonical ingredient, meaningful form and compatible unit. Two 500 g entries produce 1 kg for display. A tablespoon entry for the same ingredient remains separate unless a reviewed ingredient-specific conversion exists. Unquantified entries remain visible. Preserve checks for unchanged rows and reset affected rows when quantity changes. |
| EDIT-01 | Save a local recipe with a name, positive yield, at least one ingredient and one step. Show field-level errors without losing drafts. Remix creates a new local ID, copies content and records lineage. Editing the copy leaves the original intact. Archived recipes stay readable in existing plans. A new local recipe may use a placeholder. |
| COOK-01 | Show one step at a time with relevant amounts and an ingredients panel. Set a step timer, background the app, then reopen offline. Recompute remaining time from the stored deadline, show expiry in-app and resume on the saved step. Support previous, next and exit without relying on gestures. |
| OFF-01 | After verified setup, force-close, disable connectivity and reopen from the installed surface where available. Search, view photos, plan, template, generate groceries, create or remix and cook. Interrupted initial downloads display meaningful progress and a retry action. |

Use [[DATA-MODELS]] for keys and arithmetic, [[DESIGN-SYSTEM]] for interaction states and [[OFFLINE-STRATEGY]] for the device matrix.
