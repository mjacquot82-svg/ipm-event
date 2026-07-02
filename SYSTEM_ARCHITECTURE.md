# Event Platform Overview

The Event Platform is a web and mobile-ready event operations platform for IPM 2026 and future events. It currently serves public attendees through a PWA-style Expo Web app and gives organizers a protected portal for account management and communications.

The platform is intentionally separated into three surfaces:

- Public Attendee App: the attendee-facing PWA for schedule, map, vendors, itinerary, alerts, and event information.
- Organizer Portal: the authenticated administrative surface under `/admin` for event operations. It currently supports organizer authentication, user management, and communications.
- Future Developer Portal: a planned technical/admin surface for event configuration, integrations, analytics, deployment health, and reusable platform tooling across events.

# Current Architecture

## Frontend

- Hosting: Netlify
- Framework: Expo Web with Expo Router
- Production branch: `main`
- Build command: `npm install && EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com npx expo export --platform web`
- Production URL: `https://theipm.ca`

The frontend lives in `frontend/`. Expo Router defines public attendee routes, preview routes, and Organizer Portal routes. The production web export is emitted to `frontend/dist/` and served by Netlify.

## Backend

- Hosting: Render
- Backend URL: `https://ipm-backend-eoiw.onrender.com`

The backend lives in `backend/` and is a FastAPI application. Its current responsibilities include:

- Google Sheets integration for schedule and vendor data.
- Organizer authentication and session management.
- Communications API for organizer broadcasts.
- Schedule API for attendee-facing schedule data.

## Data

Google Sheets is the current event data source for schedule and vendor information. The backend reads public CSV exports and normalizes them into API responses for the frontend.

Google Sheets is currently the storage layer. The Organizer Portal is becoming the editing interface, so organizers should increasingly work in the portal rather than directly in the spreadsheet. Over time, the spreadsheet should become an implementation detail rather than the primary user interface.

## Authentication

The Organizer Portal uses backend-managed session authentication.

Organizer roles:

- Owner
- Communications
- Schedule

Authentication details in the current implementation:

- Organizer users are stored in MongoDB when MongoDB is configured on the backend.
- Passwords are hashed with PBKDF2-SHA256.
- Sessions are stored server-side and referenced by a random session token.
- The session token is sent to the browser as an HttpOnly cookie.
- Production cookies are configured as secure cookies with `SameSite=None`.
- Frontend admin requests use `credentials: 'include'` so cookies are sent with API requests.

## Communications

Current capabilities:

- Owners and Communications users can create broadcasts.
- Broadcasts store title, message, priority, sender metadata, status, audience, and timestamps.
- Broadcast history is available through the Organizer Portal.

Planned communications work:

- Connect saved broadcasts to a push notification provider.
- Support richer targeting and delivery visibility.
- Expand broadcast history into an operational audit trail.

# Deployment

## Frontend

The frontend is deployed to Netlify from the `main` branch. Netlify uses `netlify.toml` at the repository root:

```toml
[build]
  base = "frontend"
  publish = "dist"
  command = "npm install && EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com npx expo export --platform web"

[build.environment]
  EXPO_PUBLIC_BACKEND_URL = "https://ipm-backend-eoiw.onrender.com"
```

Current production backend environment variable:

```sh
EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com
```

Expo embeds `EXPO_PUBLIC_BACKEND_URL` at build time. If the value is wrong during `expo export`, the generated JavaScript bundle will keep calling the wrong backend until the web export is rebuilt and redeployed.

## Backend

The backend is deployed to Render at:

```text
https://ipm-backend-eoiw.onrender.com
```

The frontend should use that URL for all production API requests.

# Repository Structure

- `frontend/`: Expo Web / Expo Router app, including the public attendee app, Organizer Portal, assets, services, and generated web export.
- `backend/`: FastAPI backend API, including Google Sheets readers, organizer authentication, broadcasts, schedule, vendors, SOS, and push-token related endpoints.
- `frontend/dist/`: generated production web export served by Netlify.
- `frontend/assets/`: app images, fonts, icons, banners, map assets, and other bundled media.
- `frontend/public/`: static public web files copied into the Expo web output, including PWA files and service worker assets.

# Roadmap

## Completed

- Google Sheets integration
- Organizer authentication
- Communications module
- Schedule refresh improvements
- PWA improvements

## Planned

- Organizer dashboard
- Schedule editor
- Vendor editor
- News editor
- Communications with push notifications
- Developer Portal
- Analytics
- Audit history
- Event health monitoring

# Design Philosophy

- Keep the Organizer Portal simple.
- One page should have one primary purpose.
- Prefer progressive disclosure over clutter.
- Build reusable features for all future events.
- Treat Google Sheets as an implementation detail, not the user interface.
- Scale the platform to multiple events without redesign.
