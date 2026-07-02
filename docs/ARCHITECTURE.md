# Architecture

This document describes the current Event Platform architecture and deployment model. For endpoint details, see [API.md](./API.md). For deployment operations, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Overall Platform Architecture

The Event Platform is a reusable event application platform currently serving IPM 2026. It has three intended surfaces:

- Public Attendee App: public PWA for attendees.
- Organizer Portal: authenticated admin surface for event staff.
- Future Developer Portal: planned technical operations surface for configuration, monitoring, integrations, and multi-event management.

Current production is a Netlify-hosted Expo Web frontend calling a Render-hosted FastAPI backend. Google Sheets remains the current storage source for schedule and vendor data. MongoDB is used by backend features that need server-side persistence, including organizer accounts, sessions, broadcasts, push tokens, starred-event tracking, and SOS reports.

```text
Attendee browser/PWA
        |
        v
Netlify static frontend (Expo Web / Expo Router)
        |
        v
Render FastAPI backend
        |
        +--> Google Sheets CSV exports (schedule, vendors)
        |
        +--> MongoDB (auth, sessions, broadcasts, push tokens, SOS)
        |
        +--> Expo push service (implemented for SOS and event-change notifications)
```

## Public Attendee App

The public attendee app is the main event-facing experience. It includes routes for the home screen, schedule, map, vendors, itinerary, leaderboard, about content, preview surfaces, PWA install behavior, and alert/SOS flows.

Implemented attendee-facing backend integrations include:

- Schedule data from `GET /api/schedule`.
- Vendor data from `GET /api/vendors`.
- Push-token registration through `POST /api/register-push-token`.
- Starred-event sync for notification tracking through `POST /api/update-starred-events`.
- SOS report and alert endpoints under `/api/sos/*`.

## Organizer Portal

The Organizer Portal lives under `/admin` in the Expo Router app. It is authenticated against backend session endpoints and currently supports:

- First owner bootstrap.
- Organizer login/logout.
- Current-session lookup.
- Organizer user listing and creation.
- Broadcast creation and broadcast history.

Organizer roles currently implemented:

- Owner
- Communications
- Schedule

Owners and Communications users can create broadcasts. Schedule users can authenticate and use the portal, but broadcast sending is restricted by backend role checks.

## Future Developer Portal

The Developer Portal is planned, not implemented. It is intended to become the technical operations surface for:

- Multi-event configuration.
- Integration management.
- Analytics and audit history.
- Event health monitoring.
- Deployment and environment checks.
- Developer-facing tools for future event rollouts.

## Frontend

- Location: `frontend/`
- Framework: Expo Web / Expo Router
- Hosting: Netlify
- Production URL: `https://theipm.ca`
- Production branch: `main`
- Build output: `frontend/dist/`

The frontend uses `EXPO_PUBLIC_BACKEND_URL` for backend API calls. Expo embeds this variable into the generated JavaScript bundle at build time.

Current production backend value:

```sh
EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com
```

## Backend

- Location: `backend/`
- Framework: FastAPI
- Hosting: Render
- Production URL: `https://ipm-backend-eoiw.onrender.com`
- API prefix: `/api`

The backend responsibilities include:

- Google Sheets CSV fetching and normalization.
- Organizer authentication and session handling.
- Organizer user management.
- Communications and broadcast history.
- Schedule and vendor APIs.
- Push-token and starred-event tracking.
- SOS reporting and notification flows.
- Service worker helper endpoint for Webpushr.

## Google Sheets

Google Sheets is the current source of truth for event schedule and vendor data. The backend reads public CSV exports from configured sheet IDs and returns normalized API responses.

Current schedule required fields:

- `Name`
- `Start Date`
- `Event Start`
- `Event End`

Current vendor parsing reads:

- `Name`
- `Type`
- `Location`
- `Hours of Operation`
- `Days of Operation`
- `priority`

Google Sheets is currently the storage layer. The product direction is for the Organizer Portal to become the editing interface, so organizers do not need to work directly in Sheets long term.

## Authentication

Organizer authentication is implemented on the backend.

Current behavior:

- Organizer accounts are stored in MongoDB.
- Passwords are hashed with PBKDF2-SHA256.
- Sessions are stored server-side in MongoDB.
- The browser receives an HttpOnly session cookie.
- Production cookies are secure and use `SameSite=None`.
- Frontend admin requests use `credentials: 'include'`.
- CORS allows the production domains and local development origins.

Relevant endpoints:

- `POST /api/admin/bootstrap`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`
- `GET /api/admin/users`
- `POST /api/admin/users`

## Communications

The communications module currently supports organizer-created broadcasts:

- Broadcast title.
- Broadcast message.
- Priority: `Normal`, `Important`, or `Emergency`.
- Sender metadata.
- Audience: currently `Everyone`.
- Status: currently `sent`.
- Broadcast history.

The backend currently stores broadcasts and queues them through a placeholder boundary for future push delivery. Full broadcast-to-push delivery is planned.

## Deployment

Frontend deployment:

- Provider: Netlify
- Build base: `frontend`
- Publish directory: `dist`
- Build command: `npm install && EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com npx expo export --platform web`

Backend deployment:

- Provider: Render
- Backend URL: `https://ipm-backend-eoiw.onrender.com`
- FastAPI app served by Uvicorn on Render.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment flow and common mistakes.

## Environment Variables

Frontend:

- `EXPO_PUBLIC_BACKEND_URL`: public API base URL embedded into the Expo Web bundle at build time.
- `EXPO_PUBLIC_EVENT_ID`: optional event ID override; defaults to `ipm-2026` in current frontend services.

Backend:

- `MONGODB_URL` or `MONGO_URL`: MongoDB connection string.
- `DB_NAME`: MongoDB database name, defaulting to `ipm2026`.
- `DEFAULT_EVENT_ID`: backend event ID default, currently `ipm-2026`.
- `ADMIN_SESSION_COOKIE_NAME`: session cookie name, defaulting to `ipm_admin_session`.
- `ADMIN_SESSION_DAYS`: session duration in days, defaulting to `7`.
- `ADMIN_COOKIE_SECURE`: whether admin cookies are secure, defaulting to `true`.
- `CORS_ORIGINS`: comma-separated allowed origins.
- `CORS_ORIGIN_REGEX`: regex for allowed origins, defaulting to Netlify preview domains.
- `ADMIN_PIN`: PIN for SOS admin actions, defaulting to `2026`.

## Data Flow Diagrams

### Schedule Data

```text
Google Sheets CSV
        |
        v
Render backend: GET /api/schedule
        |
        v
Netlify frontend schedule service
        |
        v
Attendee schedule UI
```

### Organizer Login

```text
Organizer Portal login form
        |
        v
POST /api/admin/auth/login
        |
        v
Verify PBKDF2 password hash in MongoDB
        |
        v
Create server-side session
        |
        v
Set HttpOnly cookie
```

### Broadcast Creation

```text
Organizer Portal Communications panel
        |
        v
POST /api/admin/broadcasts
        |
        v
Role check: Owner or Communications
        |
        v
Save broadcast in MongoDB
        |
        v
Return broadcast history record
```

### Event Change Notification Tracking

```text
Background backend scheduler
        |
        v
Fetch schedule CSV and compute hash
        |
        v
Compare with cached events in MongoDB
        |
        v
Find users with changed starred events
        |
        v
Send Expo push notification
```

## Repository Structure

- `frontend/`: Expo Web / Expo Router app.
- `frontend/app/`: route files for public app, preview surfaces, and Organizer Portal.
- `frontend/src/`: services, components, context, data, theme, and utilities.
- `frontend/assets/`: images, icons, banners, fonts, and app media.
- `frontend/public/`: static web/PWA files copied into the export.
- `frontend/dist/`: generated production web export served by Netlify.
- `backend/`: FastAPI backend application and Python dependencies.
- `docs/`: long-term project documentation.
- `netlify.toml`: Netlify frontend build and routing configuration.
- `SYSTEM_ARCHITECTURE.md`: root-level architecture overview.
