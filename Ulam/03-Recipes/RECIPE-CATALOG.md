# Recipe catalog

**Production target** · Exactly 600 approved bundled recipes with 600 usable recipe-to-image associations at MVP release. Completion is unverified. This note defines production tracking and does not report an authored recipe count.

## Proposed coverage targets

Each recipe gets one primary planning category for counting and may carry multiple discovery tags. Adjust allocations during editorial planning and keep the total fixed.

| Primary category | Target |
|---|---:|
| Filipino chicken, pork and beef mains | 150 |
| Filipino fish and seafood | 80 |
| Filipino vegetable, tofu and legume dishes | 95 |
| Filipino soups, stews and noodle dishes | 85 |
| Breakfast, eggs and rice dishes | 65 |
| Sides and snacks | 45 |
| Everyday international recipes | 80 |
| **Total** | **600** |

## Production ledger in the app repository

Keep one row per stable recipe ID. Track working title, primary category, search aliases, author, recipe source IDs, image asset ID, image-rights status, editorial reviewer, kitchen-test status, validation report and release revision. Use Draft → Editorial review → Rights review → Approved → Bundled. Reopen the relevant reviews when text, sourcing or photos change. Do not reuse retired IDs. Development fixtures live in a separate dataset.

## Batch and release gates

Pilot a diverse batch of roughly 20 to validate the format, photo compression, sourcing effort and search vocabulary. Work in small reviewable batches and keep approved counts by category, duplicate candidates and unresolved rights visible. Review title similarity and method overlap before counting variants. A variant earns a distinct ID when it delivers a materially different dish or method.

At build time select only approved records, assert count and stable-ID uniqueness, join image and attribution manifests, generate hashes and fail on broken or extra record references. Produce a QA report listing the 600 IDs, bytes, manifest revision and approvals. Test the finalized build offline over the complete manifest and sample full cooking flows across categories. See [[RECIPE-STANDARDS]], [[DATA-MODELS]] and [[ROADMAP]].
