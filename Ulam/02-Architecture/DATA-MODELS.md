# Data models

The fields below describe a proposed storage contract. Catalog and guest records use separate namespaces. Keep schema and catalog versions independent.

| Store or record | Key and fields |
|---|---|
| CatalogRecipe | Stable `r_<id>`, content revision, title, aliases[], summary, cuisine/region tags[], meal slots[], allergens and review status, yieldServings, prepMinutes, cookMinutes, ingredient lines[], ordered steps[], imageId, sourceIds[]. Catalog storage is keyed by release and recipe ID. |
| UserRecipe | `u_<uuid>`, editable recipe fields, optional image reference and lineage `{recipeId, revision}`, created/updated timestamps, optional archivedAt. A remix owns its copied content. |
| Ingredient | Stable canonical ID, display name, aliases[], aisle and optional reviewed conversion metadata. A line carries its own ID, ingredient ID or local label, amount, unit, form, prep note, optional flag. |
| Step | Stable step ID, imperative text, ingredient line IDs[], optional timerSeconds. Display order follows the stored array. |
| ImageAsset | ID, immutable local path, width, height, format, byte length, SHA-256, descriptive alt text, source and rights record IDs. |
| WeekPlan | Key is local Monday `YYYY-MM-DD`. Entry key is `{date, slot}`, with recipe reference, pinned revision or snapshot, servings and updatedAt. Slot is breakfast, lunch or dinner. |
| Template | UUID, name, relative entries with day offset 0–6, slot, recipe reference and servings. |
| GroceryProgress | Compound key `{weekStart, rowKey}`, amount signature and checked state. Generated rows are derived from the plan and versioned ingredient rules. |
| CookingSession | UUID, recipe snapshot, servings, current step ID, timer deadline UTC or null, updatedAt. |
| Preferences / CatalogState | Singleton keys. Preferences include default servings. Catalog state stores active release, in-progress release and manifest verification metadata. |

## Invariants

- Persist plan dates as local calendar strings and timestamps as UTC. Week navigation adds calendar days, preserving the selected date through timezone and daylight-saving changes.
- Store exact recipe quantities as positive reduced rational values. Use explicit range bounds or qualitative kinds such as “to taste.” Scale exact values and both range bounds by planned servings divided by recipe yield. Convert within unit dimensions using exact factors and round only for display. Keep qualitative entries visible and separate. Avoid merging uncertain range rows in MVP.
- Merge grocery rows by canonical ID, compatible form and base-unit dimension. Keep unknown ingredients and unknown units separate. Include conversion rules in deterministic row construction. Reset checkbox state when an amount signature changes.
- Preserve pinned content for planned meals and active cooking sessions. Keep referenced assets available through upgrade or expose a missing-image state while preserving text. Archive local recipes referenced by plans. For missing template references, show a skip notice at apply time.
- Validate catalog inputs before activation and validate guest writes before persistence. Use transactions for template application, plan writes with derived-state changes and active catalog pointer swaps. Pause writes and prompt for tab closure when a schema upgrade is blocked. Test migrations against populated older records and preserve data on failure.

See [[FEATURE-REQUIREMENTS]], [[RECIPE-STANDARDS]] and [[OFFLINE-STRATEGY]].
