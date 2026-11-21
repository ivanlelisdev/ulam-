# Decisions

Record decision date, owner, status, rationale, consequences and links. Use **Confirmed**, **Proposed**, **Open** or **Superseded**. Confirmed scope originates in [[00-SOURCE-OF-TRUTH]].

| ID | Status | Decision and consequences |
|---|---|---|
| D-001 | Confirmed | Use Ulam? beside Saan? in the Filipino question-mark brand family. Use filesystem-safe names for paths. |
| D-002 | Confirmed | Deliver the PWA first, with native Android and iOS later. Guests use local storage. Static hosting delivers files and core features run without application services. |
| D-003 | Confirmed | Bundle exactly 600 complete illustrated recipes. Release preparation includes text and image rights review and a complete offline asset manifest. |
| D-004 | Proposed | React, Vite, TypeScript, Dexie/IndexedDB and Workbox for the PWA. Choose after the milestone 1 device and migration spike. Capacitor remains a native candidate. |
| D-005 | Proposed | Use a versioned catalog snapshot and separate guest stores. Stage assets before swapping the catalog pointer. Verify recovery across interrupted installs, compatibility failures and blocked migrations. |
| D-006 | Proposed | Use an explainable deterministic suggestion model ranked by time, ingredient overlap and variety. Tune with real planning tests and keep exclusions explicit. |
| D-007 | Open | Set catalog download and offline footprint budgets after measuring the pilot on representative devices, including temporary headroom during upgrades. |
| D-008 | Open | Decide whether to add local manual export/import after testing data-loss messaging. No cloud dependency is in scope. |
| D-009 | Open | Confirm minimum supported browser and OS versions with the release matrix. |

## Record a change

Add a dated entry with the options considered, chosen behavior, impact on existing plans and assets, and verification evidence. Mark old decisions as superseded and link their replacement. Update the affected notes in the same change. See [[OFFLINE-STRATEGY]], [[DATA-MODELS]] and [[ROADMAP]].

## 2026-11-22 — Initial browser evaluation

**Status:** Proposed (D-004). **Owner:** project team. Continue with the existing React, Vite and TypeScript scaffold for the next development step. A Chrome mobile-emulation spike exercised Dexie transactions and upgrades from populated records, and an isolated Workbox test served a precached page offline. Native IndexedDB and a custom service worker remain alternatives. These checks do not confirm the release architecture: blocked upgrades, staged catalog activation, update safety and physical devices remain to be evaluated in milestone 1. The spike used disposable data; no existing plans or release assets were changed. See the phase 1 evidence in the application repository.
