# Ulam? — Source of truth

**Status** · Confirmed product baseline. Engineering details marked proposed are starting points for validation.

Ulam? answers “Anong ulam?” and belongs to the same Filipino question-mark brand family as Saan?, the travel-management app. Ship the offline-first PWA first. Native Android and iOS are follow-on releases.

## Confirmed constraints

| Area | Requirement |
|---|---|
| Catalog | Exactly 600 bundled recipes at MVP release. Every recipe has complete quantified ingredients, detailed directions and an optimized, properly licensed local image. All content must be available offline after setup. |
| Core loop | Browse, search and get suggestions, plan the week, apply reusable templates, consolidate groceries, create or remix recipes and cook step by step. |
| Identity | Guest mode is the default and only MVP mode. Local work persists in the current storage context. |
| Runtime | No accounts, backend, hosted database, application API, cloud sync or online AI. Static HTTPS hosting may deliver the PWA and release assets. |
| Implementation | React, Vite, TypeScript, Dexie, IndexedDB, Workbox and Capacitor are candidates. Validate choices and record outcomes in [[DECISIONS]]. |

## Release interpretation

An online setup prepares the complete release. An installed icon alone proves nothing about catalog readiness. A verified setup followed by an airplane-mode cold launch must support the entire core loop, including all 600 images and persistence across restarts. Browser storage can be lost, so the UI must communicate readiness and recovery accurately. See [[OFFLINE-STRATEGY]].

The 600-recipes requirement is a release target. This vault contains specifications and a production process. Content completion needs actual per-recipe evidence in the application repository. See [[RECIPE-CATALOG]].

## Document authority

Use this note for confirmed scope, [[MVP-SCOPE]] for release boundaries and [[FEATURE-REQUIREMENTS]] for observable behavior. Read [[DATA-MODELS]] and [[ARCHITECTURE]] before changing persistence. Use [[RECIPE-STANDARDS]] for editorial gates and [[ROADMAP]] for sequencing. Update the baseline only when the product owner changes a confirmed decision. Record the date, reason and affected notes in [[DECISIONS]] and reconcile downstream criteria in the same change.
