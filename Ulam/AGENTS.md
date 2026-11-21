# AGENTS.md — Ulam? contributor instructions

1. Read [[00-SOURCE-OF-TRUTH]] first. Read the relevant feature, architecture or recipe note before implementing. Confirm the actual repository root, existing instructions, tooling, migrations, scripts and current behavior. The vault can live separately from the app. Resolve its location from workspace context.
2. Trace one requested change from UI through domain logic and persistence. Reuse existing code and follow existing repository conventions. Keep candidate technologies provisional until a decision is recorded. Where implementation differs from the notes, surface the conflict and use the authoritative scope to resolve it.
3. Preserve local guest data across restart, interrupted operations and upgrades. Group related writes in transactions. Validate at file and persistence boundaries. Keep the offline path free from remote fonts, images, analytics, API calls and AI services.
4. Use clearly identified fixtures in development. Keep fixtures out of production counts. Recipe changes require source and image-rights records, schema validation and the review evidence in [[RECIPE-STANDARDS]]. Preserve recipe IDs and plan references through catalog updates.
5. Run the repository's relevant checks and a production-build offline check when changing caching or core flows. For persistence changes verify with an older local database fixture and test a failed write or migration. Report checks actually performed and device coverage still pending.
6. Update affected criteria and [[DECISIONS]] when approved behavior or an architectural decision changes. Keep changes narrow. In your handoff, state what changed, how it was verified and any remaining release blockers.

Use [[FEATURE-REQUIREMENTS]] for test IDs, [[DATA-MODELS]] for invariants and [[ROADMAP]] for the next unblocked milestone.
