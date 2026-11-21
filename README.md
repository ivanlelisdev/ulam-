# Ulam?

Ulam? is an offline-first meal planning PWA in early development. The current screen is a provisional scaffold; offline features and recipes are not implemented yet.

Requires Node.js `^20.19.0` or `>=22.12.0` and npm (the versions tested were Node.js 24.4.1 and npm 11.4.2). From the project root:

```powershell
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

`npm ci` installs the locked dependencies. `npm run dev` starts the local development server; `npm run check` runs the TypeScript check; `npm run build` creates static files in `dist/`; and `npm run preview` serves that build locally.

Read the [vault source of truth](Ulam/00-SOURCE-OF-TRUTH.md) and [development guide](Ulam/05-Development/DEVELOPMENT-GUIDE.md) before implementation. Setup status is recorded in [phase 1 evidence](docs/evidence/phase-1.md); device coverage is tracked in the [device test log](docs/evidence/device-test-log.md).
