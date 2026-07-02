# Architectural Decisions

This document records important platform decisions. Dates use the date the decision is known or documented in this repository when the original decision date is not explicitly available.

| Date | Decision | Reason | Impact |
| --- | --- | --- | --- |
| Known by 2026-07-02 | Removed `Entry_Type` as a schedule requirement. | The current backend only requires `Name`, `Start Date`, `Event Start`, and `Event End`, which makes Google Sheets data entry simpler and avoids rejecting otherwise useful rows. | Schedule ingestion is less brittle. Rows with core timing/name fields are accepted even if type/category metadata is incomplete. |
| Known by 2026-07-02 | Google Sheets retained as the current storage layer. | Sheets are already the source of truth for schedule and vendor data and remain easy for early event operations. | Backend reads public CSV exports. Future editors should treat Sheets as an implementation detail rather than the organizer-facing UI. |
| Known by 2026-07-02 | Organizer Portal should become the editing interface instead of requiring organizers to use Sheets directly. | Organizer workflows should be simpler, role-aware, and purpose-built. | Roadmap includes schedule, vendor, and news editors. Current portal already handles auth, users, and communications. |
| Known by 2026-07-02 | Production branch changed back to `main`. | The current deployment flow expects production changes from the main branch. | Documentation and deployment references use `main` as the production branch. |
| Known by 2026-07-02 | Backend moved to Render. | The working production backend is `https://ipm-backend-eoiw.onrender.com`; the previous Railway URL was stale/nonresponsive. | Netlify builds must embed the Render URL through `EXPO_PUBLIC_BACKEND_URL`. |
| Known by 2026-07-02 | Communications foundation built before full push notification delivery. | Broadcast creation, permissions, and history can be stabilized before delivery-provider integration. | Current broadcasts are stored and returned in history. A backend delivery boundary exists for future push integration. |
| Known by 2026-07-02 | Expo Web embeds backend URL at build time. | Expo replaces `EXPO_PUBLIC_*` values during export. Runtime environment changes do not update an already-generated JavaScript bundle. | Wrong backend values require rebuilding and redeploying the web export. `netlify.toml` now pins the Render backend URL. |
| Known by 2026-07-02 | Organizer sessions use HttpOnly cookies. | Session tokens should not be accessible to frontend JavaScript. | Admin fetch calls use `credentials: 'include'`; backend CORS must allow credentials from production and development origins. |

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Deployment](./DEPLOYMENT.md)
- [Roadmap](./ROADMAP.md)
