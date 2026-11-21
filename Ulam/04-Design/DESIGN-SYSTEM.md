# Design system

Ulam? and Saan? share a short Filipino word and the question mark as a brand device. Ulam? should feel at home in a kitchen and a market. Treat the values below as proposed design tokens.

| Token | Starting value | Use |
|---|---|---|
| Canvas / surface | #FAF7EF / #FFFFFF | Warm background and readable cards |
| Ink / muted ink | #242722 / #52584E | Recipe text, labels and secondary details |
| Primary / on primary | #205C43 / #FFFFFF | Main actions and active selection |
| Accent | #F0B75B | Highlights paired with dark text |
| Critical | #9C302B | Errors with icon and explanatory text |
| Space and radius | 4, 8, 12, 16, 24, 32 px / 12 px | Predictable rhythm and consistent cards |

## Layout and components

Offer Recipes, Plan and Groceries as primary destinations. Access Settings through the header. On narrow screens show a day-by-day plan with a seven-day picker. On wider screens a week grid may show the same features. Every drag interaction needs a button-based path. Recipe cards show the dish name, time, image and add-to-plan action. Use local assets and a system font stack initially.

In cooking mode give the step and quantities visual priority. Keep navigation and timer controls reachable, with a visible progress label. On grocery rows separate ingredient name and quantity, use a labeled checkbox and keep checked text readable. In the template preview, show incoming meals and affected existing entries before confirmation.

## States and accessibility

Design setup, partial download, ready offline, repair needed, empty, no results, write failure and missing image states. Keep readiness visible in Settings and surface it elsewhere when it affects a task. Use plain copy such as “Downloading recipes for offline use” and “Ready offline.” Use “Anong ulam?” as a friendly prompt where it supports the task. Keep functional labels consistent.

Target WCAG 2.2 AA. Verify text contrast, keyboard focus, names for icon actions and predictable focus return from dialogs. Use at least 44 × 44 CSS px for primary touch controls where practical. Support text zoom, reduced motion and screen-reader announcements for important state changes. Reserve image dimensions to avoid layout shifts. Test the key screens under high text scaling with both keyboard and screen reader.

See [[PRODUCT-VISION]], [[FEATURE-REQUIREMENTS]] and [[INSPIRATION]].
