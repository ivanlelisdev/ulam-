# Offline strategy

Installability, offline readiness and storage durability are different states. A first visit needs a connection to the static HTTPS origin. After setup, the core loop in [[MVP-SCOPE]] must work with connectivity disabled.

## Setup and readiness

1. Load a manifest with stable app identity, scoped start URL, standalone display and regular and maskable icons. Register the service worker and confirm the running page is controlled before marking the shell ready.
2. Fetch the versioned catalog manifest. Show download size and progress. Use storage estimates where available as guidance and handle quota exceptions during actual writes. Stage the catalog, index and all required images under immutable release URLs with bounded downloads and resumable retries.
3. Verify schema, exactly 600 unique approved records, expected assets and checksums. Validate catalog–shell compatibility. Commit the active catalog pointer only once required files and records are accessible. Recheck inventory when resuming after a storage failure and downgrade readiness if assets are missing.
4. Offer an installation affordance where supported and browser-specific guidance otherwise. On iPhone, include the Safari Share → Add to Home Screen path. Verify readiness in the actual launched context. A browser tab and a Home Screen app may have different storage contexts.

## Caching and updates

Precache the shell and route assets for offline navigation, including deep links within the app scope. Cache versioned catalog assets separately, with explicit inventory and cleanup. Keep runtime requests same-origin. Stage new releases while serving the active one. Avoid forced activation during a write or cooking session. Defer reload to a user-visible safe point and prevent an incompatible shell from reopening the database. Retain needed assets across releases and collect old unreferenced assets only after activation and old-client retirement.

## Failure and recovery

Consider `navigator.storage.persist()` where available. Persistence is browser-controlled. Storage pressure, user clearing, private browsing, browser profile changes and origin changes can affect availability. Explain that guest data lives on this device and storage context. Cache repair can redownload bundled content when online. Cleared guest data can only be recovered from a separately retained copy if backup support is added. If writes fail, keep the form open and show retry guidance. Preserve healthy data during partial repairs.

## Device matrix

Define supported versions at release. At minimum test physical iPhone Safari tab and Home Screen app, Android Chrome tab and installed app, and desktop Chromium browser and installed mode. Exercise clean setup, reload offline, deep links, all image keys reachable offline, interrupted downloads, quota errors, data clearing, old-to-new app and catalog upgrades, and concurrent tabs. Log browser/OS, build, setup state, and pass or fail.

See [[ARCHITECTURE]], [[ROADMAP]] and [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) and [MDN PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing).
