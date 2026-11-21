# Recipe standards

Every release recipe must be usable from start to finish without visiting another site. Apply this standard to each of the 600 records in [[RECIPE-CATALOG]].

## Editorial contract

- Use the recognized dish name, a short description, useful regional or ingredient aliases, serving yield, prep and cook times, plus resting or marinating time where material. Use specific regional claims only when supported.
- List every ingredient used in the method, with number or range, unit, preparation state and optionality. Allow qualitative amounts only when appropriate, such as salt to taste. Specify an amount for cooking oil, water or garnish when the result depends on it.
- Write numbered steps in sequence. Give equipment or pan size when consequential, heat level, approximate time and a visible or measurable doneness cue. State when to reserve or discard ingredients. Include reviewed safety guidance where a method requires it. Tie any timer to its step and keep timed intervals consistent with stated durations.
- Mark substitutions and optional ingredients clearly. Review allergen metadata against ingredients, including compound ingredients, and record unknowns. Scale ingredient quantities while keeping cooking durations and heat instructions unchanged unless editorial guidance says otherwise.
- Supply an image of the finished dish with useful alt text. Publish a consistent crop in a supported compressed format and measure the whole bundle on real devices. Proposed starting target is up to 960 px on the long edge and 80 KiB median per primary image. Review quality and package size before locking the budget.

## Provenance and rights

For recipe text and image separately capture creator, internal source ID, original URL or file identifier, acquisition date, rights basis, license name/version and link, attribution text, modifications, review date and evidence location. Prefer commissioned or project-owned content or material with verified redistribution and adaptation permission as needed. Preserve written permissions and attribution notices. Record transformations such as cropping and recompression. Quarantine ambiguous rights and replace assets when the needed rights cannot be established.

## QA gate

Automate required fields, unique IDs, ingredient-step references, units, serving/time sanity, asset readability, alt text, provenance completeness and bundle count. A human editor reviews quantities, steps, consistency, safety notes, distinctness and the photo match. A rights reviewer approves evidence for both text and photo. Record kitchen-test status separately with date, reviewer and outcome when performed. Reject steps that rely on guessing essential quantities or undocumented prep. Check local file display and offline availability in the release build. Only approved records count toward the target.

See [[DATA-MODELS]] and [[RECIPE-CATALOG]].
