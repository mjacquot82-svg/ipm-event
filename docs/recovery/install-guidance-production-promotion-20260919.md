# Approved install guidance — narrow production promotion

Marc physically approved staging SHA `95adaab5e9199d2c5e51d971016bb8d887bd9ec0`, Build 376926, Netlify `6aaecefbedbd3c0008267d59`. Automatic guidance appeared on his Android phone. No further private-browser behavior changes are part of this promotion.

Production baseline freshly verified: main/frontend `75afa1ed3e04eb3bed5841f5a00a31db2ba30005`, Build 376815, Netlify `6aaeb4f53a945798bddd3d08`. Backend remains `167469920e267951e8143324e20a22e069861db1`, Render `dep-dan9pun40ujc73b6pm1g` LIVE. Production operations reports scheduler false and delivery kill switch true.

The candidate starts from production main, not a staging merge. Only four runtime files change:

- `PWAInstallPrompt.tsx` and `installEnvironment.ts` are byte-for-byte identical to approved staging.
- Home receives exactly the approved pathname check and automatic component mount.
- About receives the same manual component, directly accessible using the existing production section layout.

Production's other Home/About content is retained. In particular, no staging notification controls, AppStatus diagnostics, announcement presentation changes, navigation changes or removed Emergency Services control are copied. No backend, environment, dependencies, migrations, data, maps, notification registration/reconciliation or T-30 files change. Test fixtures remain test-only and are not imported by runtime code. No preview/test query controls are added.

The approved behavior remains: first eligible Home browser visit → optional device-aware guidance; native browser action when available; installed-mode suppression; remembered dismissal; About → Install App replay. Direct links and contextual tutorials retain their production behavior, including inert historical preview query parameters. No attendee data is reset.

Validation before merge: 111 focused tests pass; TypeScript passes; production-style build passes; approved component/detector equality and diff checks pass. Browser install, Home and complete tutorial matrices use isolated state and block provider calls/API writes. Published deployment identity and final live results are recorded in `.artifacts/install-production/`.

Publication follows the normal reviewed PR merge, with automatic Netlify/Render deployment skipped on the merge commit, then one explicit production Netlify build of verified main. No backend deployment, production data write, notification send or configuration change is included. Previous Netlify deployment is the frontend rollback target.

Stop for Marc's final production check after publication and verification.
