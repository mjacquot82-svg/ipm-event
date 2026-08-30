# Roadmap

This roadmap separates implemented functionality from planned work. It is not a substitute for issue tracking; it summarizes platform direction for future development.

## Completed

- Google Sheets integration for schedule data.
- Google Sheets integration for vendor data.
- Organizer authentication.
- Owner bootstrap flow.
- Organizer roles: Owner, Communications, Schedule.
- Organizer user listing and creation.
- Communications foundation.
- Broadcast creation and broadcast history.
- Schedule refresh and invalid-row handling improvements.
- Cached attendee data behavior for schedule and vendor APIs.
- PWA improvements, including manifest and app icon work.
- Production frontend/backend URL correction for Render.
- Backend migration to Render.

## In Progress

- Correcting cache-first PWA frontend updates so installed production apps cannot remain on a
  stale JavaScript bundle after a deployment; required before event rollout.
- Organizer Portal expansion beyond authentication and communications.
- Moving organizer workflows away from direct Google Sheets editing.
- Stabilizing deployment documentation and long-term architecture references.
- Connecting existing push-token infrastructure to higher-level event communication workflows.

## Next Milestones

- Schedule editor.
- Vendor editor.
- News editor.
- Push notifications for communications broadcasts.
- Announcement feed.
- Event analytics.
- Organizer dashboard.
- More complete role-specific Organizer Portal navigation.
- Safer operational tooling for production deployments.

## Future Ideas

- Volunteer portal.
- Sponsor management.
- Multiple events.
- Developer Portal.
- Audit history.
- Event health dashboard.
- Offline support.
- QR management.
- Ticketing integration as a future consideration.
- Richer announcement targeting.
- Import/export tools for event setup.
- Multi-tenant event configuration.

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Deployment](./DEPLOYMENT.md)
- [API](./API.md)
- [Decisions](./DECISIONS.md)
