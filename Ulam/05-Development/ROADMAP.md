# Roadmap

Milestones are gated by evidence. The PWA and content tracks can progress together after the format is established.

| Milestone | Work | Exit evidence |
|---|---|---|
| 1 · Offline vertical slice | Build a static shell, load a small fixture catalog and image set, search, add to a week and persist one guest edit. Spike candidate tools and define device coverage. | Airplane-mode cold launch on physical iOS and Android, plus interrupted setup retry and a recorded architecture decision. |
| 2 · Complete core loop | Implement suggestion ranking, templates, grocery consolidation, recipe create/remix, cooking mode and settings. Add regression checks for date boundaries, unit merging, timers and older records. | [[FEATURE-REQUIREMENTS]] scenarios pass on the slice build and failure states are exercised. |
| 3 · Catalog production | Pilot authoring and review. Finalize taxonomy and rights workflow, then run editorial batches and measure image and catalog budgets. | Manifest and reviewer ledger show exactly 600 approved complete recipes. Build fails on missing rights, broken assets or invalid references. |
| 4 · Release candidate | Exercise full-catalog readiness, old-to-new upgrades, low storage, assistive technology, real-device timings and offline assets. Publish static files with immutable release paths and keep previous assets needed by existing clients. | QA report covers the supported matrix and every launch gate in [[MVP-SCOPE]]. Rollback procedure is verified with compatible data versions. |
| 5 · Native discovery | Evaluate Capacitor and alternatives, local storage restoration, first-launch bundled content and native platform behavior. | A separate Android/iOS proposal backed by prototypes and device results. |

## First work items

Create an initial catalog schema and one complete development fixture from a source with documented rights. Build offline setup and a single planner write before investing in visual polish. Add a deterministic fixture that catches a broken update or invalid catalog. Review the content pilot before committing to the proposed allocation in [[RECIPE-CATALOG]].

Track dates and owners in the project tracker when staffing is known. Record proof for each gate and reflect approved deviations in [[DECISIONS]].
