# MVP scope

**Release surface** · Mobile-first web app with PWA installation where supported. Browser-mode offline use is valid after setup when the browser supports the required storage and service worker features.

| Required | Release outcome |
|---|---|
| Guest onboarding and settings | Start immediately, set a default serving count and inspect offline readiness and local storage information. |
| Bundled library | 600 approved recipes with local optimized images and offline browse, search and filtering. |
| Suggestions | Local shortlist for empty meal slots, with transparent reasons and user confirmation. |
| Weekly planner and templates | Assign meals to breakfast, lunch and dinner, change portions, navigate weeks and reuse a saved layout. |
| Groceries | Generate a consolidated list from a selected week and preserve shopping progress when safe. |
| Recipe create and remix | Add or edit local recipes and fork a bundled recipe into an independent copy. |
| Cooking mode | Ordered steps, progress and optional step timers, including offline resume. |

## Later releases

Native Android and iOS delivery comes after PWA validation. Accounts, authentication, backend endpoints, hosted databases, cloud sync, online AI and household collaboration are outside MVP. Local backup and restore is an open follow-up decision. A deployment serves static release files over HTTPS.

## Exit criteria

Ship only when the complete catalog passes [[RECIPE-STANDARDS]] and the feature scenarios in [[FEATURE-REQUIREMENTS]] pass on the supported device matrix. Verify an offline cold launch, interrupted setup recovery, storage failure messaging and a catalog update that preserves guest work. See [[OFFLINE-STRATEGY]] and [[ROADMAP]].
