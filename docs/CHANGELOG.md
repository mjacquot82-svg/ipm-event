# Changelog

This changelog summarizes meaningful platform progress. It intentionally does not duplicate commit history.

## Platform Foundation

- Established the Expo Web / Expo Router frontend structure.
- Established the FastAPI backend structure.
- Added public attendee routes for core event experiences.
- Added static PWA assets, manifest, icons, and web export support.

## Google Sheets Integration

- Added Google Sheets CSV integration for schedule data.
- Added Google Sheets CSV integration for vendor data.
- Simplified schedule ingestion by relying on core required fields rather than extra entry-type metadata.
- Added normalization for schedule and vendor API responses.

## Public Attendee App Improvements

- Added schedule, map, vendor, itinerary, and event information surfaces.
- Added cached schedule/vendor data handling in frontend services.
- Improved schedule refresh behavior.
- Added PWA install and icon-related improvements.
- Added attendee SOS/reporting flows and backend support endpoints.

## Organizer Authentication

- Added Organizer Portal routes under `/admin`.
- Added first Owner account bootstrap.
- Added organizer login/logout/session lookup.
- Added PBKDF2 password hashing.
- Added HttpOnly cookie session authentication.
- Added organizer roles: Owner, Communications, Schedule.
- Added organizer user listing and creation.

## Communications Module

- Added broadcast creation.
- Added broadcast history.
- Added broadcast priorities.
- Added backend role checks so only Owners and Communications users can send broadcasts.
- Added a backend boundary for future push notification delivery from broadcasts.

## Push and Alert Infrastructure

- Added push-token registration.
- Added starred-event tracking for change notifications.
- Added background schedule-change detection.
- Added Expo push notification sending for starred event updates and SOS flows.

## Deployment Stabilization

- Moved production backend usage to Render at `https://ipm-backend-eoiw.onrender.com`.
- Corrected the production frontend backend environment variable.
- Documented that Expo embeds `EXPO_PUBLIC_BACKEND_URL` at build time.
- Updated Netlify configuration to pin the Render backend URL during web export.

## Documentation

- Added root system architecture overview.
- Added long-term documentation under `docs/` for architecture, roadmap, decisions, deployment, API, and platform changelog.

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)
- [Decisions](./DECISIONS.md)
- [Deployment](./DEPLOYMENT.md)
- [API](./API.md)
