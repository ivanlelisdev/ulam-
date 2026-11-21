# Development guide

A step-by-step implementation guide for Ulam?, from an empty application repository through the PWA release and native discovery. Use [[00-SOURCE-OF-TRUTH]] as the authority for confirmed scope, [[FEATURE-REQUIREMENTS]] for scenario IDs, and [[ROADMAP]] for milestone gates. This guide proposes an order; it does not confirm technology choices or report work as complete.

## How to use this guide

- Start each change by reading [[AGENTS]], the source of truth, and the relevant linked notes. Check the actual repository and current behavior before choosing an implementation.
- Work through the numbered steps in order, except that recipe production can run alongside application development after the format is established. Record owners, dates, status and evidence in the project tracker when available.
- Use clearly labeled development fixtures; never count them as production recipes. Each step's checks are exit evidence, not a substitute for the detailed linked requirements.
- Record approved architecture and behavior decisions in [[DECISIONS]] and reconcile affected notes. The proposed stack and tokens remain provisional until validated.

## 1. Establish the project

1. Inspect the repository, available tooling and existing instructions. Establish the application root, version-control workflow and a place for build, test and release evidence.
2. Evaluate the proposed React, Vite and TypeScript stack for accessible static screens and build output. Evaluate IndexedDB and Dexie for guest data, transactions and upgrades, and Workbox for offline delivery. Record the options, evidence and decision in [[DECISIONS]] after the device and migration spike; do not treat candidates as already chosen.
3. Set up the smallest selected application, local development commands, automated checks and a production static build. Keep domain rules independent of UI and storage libraries. Do not add a backend, account system, remote runtime service or cloud dependency.
4. Define an initial device test log. Use browser DevTools emulation for initial checks; physical iPhone and Android testing is deferred. Supported versions remain an open release decision.

**Check:** a clean checkout can run the documented checks and produce a static build; assumptions and unresolved decisions are visible.

## 2. Define data and a fixture

1. Read [[DATA-MODELS]], [[ARCHITECTURE]] and [[RECIPE-STANDARDS]]. Define the initial versioned catalog format, stable recipe and ingredient IDs, quantities, steps, images, provenance and validation boundaries.
2. Create one complete, clearly identified development recipe and local image with documented rights. Add a small, diverse fixture set for search, planning and failure cases, separate from production content.
3. Establish separate catalog and guest storage boundaries. Define independent schema and catalog versions, local calendar dates for plans, UTC timestamps, and validation before persistence.
4. Add a deterministic invalid or interrupted-update fixture. Exercise validation and a populated older database upgrade before relying on the storage design.

**Check:** valid fixtures load; malformed records fail clearly; guest records survive catalog replacement and failed migrations. Record the storage and migration spike results.

## 3. Build the offline vertical slice

1. Build a mobile-first shell with Recipes, Plan and Groceries navigation and Settings access. Apply the proposed tokens and system font from [[DESIGN-SYSTEM]], including accessible labels, focus, touch targets and text scaling.
2. Implement static delivery, the app manifest and service worker. Precache the shell and in-scope navigation; verify the running page is controlled before claiming the shell is ready.
3. Stage the fixture catalog and images locally, show download progress and retry, validate the snapshot, and activate it only when required data and assets are accessible. Keep guest data separate from disposable catalog data.
4. Implement fixture browsing and local search, a recipe detail with local image, and adding a recipe to a weekly plan. Persist at least one guest edit and restore it after restart.
5. Test a production build with an interrupted setup and retry. On physical iOS and Android, complete setup, close the app, disable connectivity, cold-launch and use search, image and planning. Record context and results; installed and browser contexts can differ.
6. Decide the initial stack and storage approach using the spike and device evidence. Record unresolved issues and compatibility limits.

**Milestone 1 gate:** [[ROADMAP]] vertical-slice evidence, including physical-device cold launch, retry and a recorded architecture decision.

## 4. Complete the product loop

For every feature, implement the domain rules, screen states and guest persistence together; test the linked scenario and failure paths before moving on. Keep the core path usable without network access.

1. **Guest and settings — GUEST-01:** start without identity fields, persist default portions, and show offline readiness and local-storage information. Existing entries retain their stored portions.
2. **Browse and search — SEARCH-01:** normalize case and accents; search titles, Filipino aliases and ingredients; combine filters; provide empty results and reset. Verify local images and full recipe content after offline cold launch.
3. **Weekly planning — PLAN-01:** use Monday-based local calendar weeks, breakfast/lunch/dinner slots and stored servings. Confirm replacement, support remove with undo, and preserve dates and entries across navigation and restart. Pin planned content as specified in [[DATA-MODELS]].
4. **Suggestions — SUG-01:** rank locally by time fit, ingredient overlap and weekly variety after exclusions. Make ordering repeatable, explain reasons and restrictive filters, and require acceptance into an empty slot. Never silently overwrite or claim allergen safety.
5. **Templates — TPL-01:** save named relative seven-day layouts. Preview the target week and affected meals, default to filling empty slots, report missing recipes, and commit accepted changes atomically.
6. **Groceries — SHOP-01:** scale quantities by planned portions using exact rational arithmetic. Combine only compatible canonical ingredients, forms and units; keep unknown and qualitative amounts visible and uncertain ranges separate. Preserve checks for unchanged rows and reset them when amount signatures change.
7. **Create and remix — EDIT-01:** validate names, positive yield, ingredients and steps without losing drafts. Save local recipes, create independent remixes with lineage, and keep archived recipes readable in existing plans. Provide a missing-image placeholder.
8. **Cooking — COOK-01:** show one step, relevant amounts, ingredient panel and progress, with accessible previous, next and exit controls. Persist the session and timer deadline; recompute remaining time and show expiry after reopening offline.
9. **Polish shared states:** implement setup, partial download, ready, repair, empty, no results, missing image and write failure states. Keep forms open on failed writes. Verify keyboard, screen reader, focus return, contrast, reduced motion and high text scaling against [[DESIGN-SYSTEM]].

**Milestone 2 gate:** all scenarios in [[FEATURE-REQUIREMENTS]] pass on the slice build, including date boundaries, grocery unit merging, timer resume, older records and relevant failure states. Run a production-build offline check for core flows.

## 5. Produce the release catalog in parallel

1. Establish the production ledger and review workflow in the application repository described by [[RECIPE-CATALOG]]. Track stable IDs, sources, image rights, reviewers, kitchen-test status and release revision. Keep fixtures separate.
2. Pilot roughly 20 diverse recipes. Validate schema, Filipino and English search terms, editorial quality, image compression, sourcing effort and rights evidence. Review taxonomy and proposed category allocations before expanding.
3. Produce and review small batches using [[RECIPE-STANDARDS]]. Capture provenance and rights for text and images separately; resolve ambiguous rights before approval. Review quantities, steps, safety, allergens, distinctness, image match and attribution. Record kitchen-test results separately when performed.
4. Build automated validation for required fields, stable unique IDs, references, quantities, units, image readability, alt text and provenance. Produce versioned static assets and a manifest with hashes and sizes. Measure real-device download, storage and upgrade headroom; decide budgets in [[DECISIONS]].
5. Preserve IDs and references through catalog updates. Select only approved content and fail the release build on invalid records, missing rights, broken assets or references, and a count other than exactly 600. Produce the 600-ID approval and asset report.

**Milestone 3 gate:** exactly 600 complete approved recipes and 600 usable recipe-to-image associations, with a passing manifest and reviewer ledger. Proposed allocations are not a release count.

## 6. Harden offline setup and updates

1. Implement the full-release inventory: manifest compatibility, schema, 600 unique approved records, required local images and checksums. Download with bounded concurrency and resumable retries, then switch the active catalog pointer atomically only after verification.
2. Show download size, progress, readiness, repair and storage failure guidance. Use storage estimates as guidance, handle actual quota failures, and recheck inventory after interrupted setup or repair. Explain the device and storage-context limits of guest data.
3. Stage updates while serving the active release. Protect ongoing writes and cooking sessions, offer a safe reload point, handle blocked schema upgrades and incompatible versions, and retain assets needed by existing clients or pinned content. Clean old assets only when safe.
4. Test failed writes, low storage, interrupted downloads, partial repair, concurrent tabs, populated old database migrations, catalog upgrades and app upgrades. Confirm failures preserve healthy guest data and leave actionable feedback.

**Check:** a verified production build supports the complete offline core loop after cold launch, with every required image reachable. Readiness is downgraded when required assets are missing; an installed icon alone is not proof.

## 7. Validate and release the PWA

1. Resolve the supported browser and OS versions, record the build and test matrix, and test at minimum physical iPhone Safari tab and Home Screen, Android Chrome tab and installed app, and desktop Chromium browser and installed mode. Include setup, offline deep links, storage clearing, upgrades and concurrent tabs.
2. Run all feature scenarios, content gates, accessibility checks and production-build offline checks. Test the full manifest and sample complete cooking flows across recipe categories. Run the usability sessions in [[PRODUCT-VISION]] and record findings outside the app.
3. Verify static HTTPS deployment, immutable release paths, manifest and cache contents, required old assets and a rollback compatible with persisted data. Check installation guidance, including the iPhone Safari Share → Add to Home Screen path, and readiness in each actual launch context.
4. Review open defects, release blockers, device coverage and evidence against [[MVP-SCOPE]] and [[OFFLINE-STRATEGY]]. Publish only when the release gates pass. Keep release and rollback evidence with the build.

**Milestone 4 gate:** supported matrix and all MVP exit criteria pass, including offline cold launch, interrupted setup recovery, storage failure messaging, catalog update preserving guest work, and a verified rollback.

## 8. After PWA validation: native discovery

Evaluate Capacitor and alternatives in a separate Android/iOS proposal. Prototype native packaging, asset loading, first-launch content and persistence or restoration independently on real devices. Record findings, constraints and a new decision before scheduling native delivery. Accounts, cloud sync, online AI and collaboration remain outside the MVP; local backup and restore remains an open decision.

**Milestone 5 gate:** a separate native proposal backed by prototypes and device results.
