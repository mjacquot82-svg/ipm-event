# API Reference

Base URL:

```text
https://ipm-backend-eoiw.onrender.com
```

Most API routes are mounted under `/api`. Some utility routes are mounted at the root.

This document reflects routes implemented in `backend/server.py`. Planned endpoints are listed separately and should not be treated as available.

## Authentication

### POST `/api/admin/bootstrap`

Creates the first Owner account for an event. Fails if organizer users already exist for that event.

Request:

```json
{
  "username": "owner",
  "password": "at-least-10-characters",
  "display_name": "Event Owner",
  "event_id": "ipm-2026"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "username": "owner",
    "display_name": "Event Owner",
    "role": "Owner",
    "event_id": "ipm-2026",
    "is_active": true,
    "created_at": "2026-07-02T00:00:00",
    "updated_at": "2026-07-02T00:00:00",
    "last_login_at": "2026-07-02T00:00:00"
  }
}
```

Also sets an HttpOnly session cookie.

### POST `/api/admin/auth/login`

Authenticates an organizer and sets a session cookie.

Request:

```json
{
  "username": "owner",
  "password": "password",
  "event_id": "ipm-2026"
}
```

Response shape is the same as `/api/admin/bootstrap`.

### POST `/api/admin/auth/logout`

Deletes the current session and clears the session cookie.

Response:

```json
{"status": "success"}
```

### GET `/api/admin/auth/me`

Returns the authenticated organizer user.

Requires a valid admin session cookie.

Response:

```json
{
  "user": {
    "id": "uuid",
    "username": "owner",
    "display_name": "Event Owner",
    "role": "Owner",
    "event_id": "ipm-2026",
    "is_active": true,
    "created_at": "2026-07-02T00:00:00",
    "updated_at": "2026-07-02T00:00:00",
    "last_login_at": "2026-07-02T00:00:00"
  }
}
```

### GET `/api/admin/users`

Lists organizer users for the authenticated user's event.

Requires a valid admin session cookie.

Response:

```json
{
  "users": [],
  "total_count": 0
}
```

### POST `/api/admin/users`

Creates an organizer user.

Requires a valid admin session cookie.

Request:

```json
{
  "username": "schedule-editor",
  "password": "at-least-10-characters",
  "display_name": "Schedule Editor",
  "role": "Schedule",
  "event_id": "ipm-2026"
}
```

Response is an organizer user object.

## Schedule

### GET `/api/schedule`

Fetches schedule events from Google Sheets and returns normalized event data.

Response:

```json
{
  "events": [
    {
      "id": "gs_0_example_event",
      "title": "Example Event",
      "description": "Event details",
      "start_date": "2026-09-22",
      "start_time": "10:00 AM",
      "end_time": "11:00 AM",
      "category": "Event",
      "latitude": 43.0,
      "longitude": -80.0,
      "days_active": "Tuesday",
      "location_name": "Main Stage"
    }
  ],
  "last_updated": "2026-07-02T00:00:00",
  "total_count": 1
}
```

### GET `/api/vendors`

Fetches vendors from Google Sheets and returns normalized vendor data sorted by priority.

Response:

```json
{
  "vendors": [
    {
      "id": "vendor_0_example_vendor",
      "name": "Example Vendor",
      "type": "Food",
      "location": "Vendor Row",
      "hours_of_operation": "9 AM - 5 PM",
      "days_of_operation": "All Days",
      "priority": 1
    }
  ],
  "last_updated": "2026-07-02T00:00:00",
  "total_count": 1
}
```

## Communications

### POST `/api/admin/broadcasts`

Creates a broadcast.

Requires a valid admin session cookie. The authenticated organizer must have role `Owner` or `Communications`.

Request:

```json
{
  "title": "Schedule Update",
  "message": "The afternoon schedule has changed.",
  "priority": "Important"
}
```

Response:

```json
{
  "id": "uuid",
  "event_id": "ipm-2026",
  "title": "Schedule Update",
  "message": "The afternoon schedule has changed.",
  "priority": "Important",
  "sender_username": "owner",
  "sender_role": "Owner",
  "created_at": "2026-07-02T00:00:00",
  "sent_at": "2026-07-02T00:00:00",
  "status": "sent",
  "audience": "Everyone"
}
```

### GET `/api/admin/broadcasts`

Lists recent broadcasts for the authenticated user's event.

Requires a valid admin session cookie.

Response:

```json
{
  "broadcasts": [],
  "total_count": 0
}
```

## Announcements and Webpushr

### GET `/api/announcements/{announcement_id}`

Returns one published, unexpired announcement for the requested event. Draft,
archived, expired, deleted, missing, and wrong-event IDs return `404`.

### POST `/api/admin/announcements/{announcement_id}/notify/test`

Sends a published, unexpired announcement only to the subscriber IDs configured
in `WEBPUSHR_TEST_SUBSCRIBER_IDS`. Requires an Owner or Communications session.

### POST `/api/admin/announcements/{announcement_id}/notify/everyone`

Sends a published, unexpired announcement to all Webpushr subscribers. Requires
an Owner or Communications session. An active or successful everyone delivery
for the same event and announcement returns `409`.

Both notification endpoints persist the provider result in Supabase.

## Google Sheets and Data Utilities

### GET `/api/`

Basic API root check.

Response:

```json
{"message": "Hello World"}
```

### POST `/api/status`

Creates a status check document in MongoDB.

Request:

```json
{"client_name": "test-client"}
```

Response:

```json
{
  "id": "uuid",
  "client_name": "test-client",
  "timestamp": "2026-07-02T00:00:00"
}
```

### GET `/api/status`

Returns status check documents.

### POST `/api/register-push-token`

Registers or updates a device push token.

Request:

```json
{
  "push_token": "ExponentPushToken[...]",
  "device_id": "device-id"
}
```

Response:

```json
{"status": "success", "message": "Push token registered"}
```

### POST `/api/update-starred-events`

Stores starred event IDs for a push token so the backend can notify users when starred events change.

Request:

```json
{
  "push_token": "ExponentPushToken[...]",
  "starred_event_ids": ["gs_0_example_event"]
}
```

Response:

```json
{"status": "success", "message": "Starred events updated"}
```

### GET `/api/webpushr-sw.js`

Returns the Webpushr service worker script content under the API prefix.

### GET `/webpushr-sw.js`

Returns the Webpushr service worker script content from the root path.

### GET `/api/download-dist`

Downloads `dist.zip` from the backend directory if present.

### GET `/api/dist.zip`

Downloads `dist.zip` from the backend directory if present.

### GET `/download`

Root-level download route for `dist.zip` if present.

## SOS and Push-Related Endpoints

These endpoints are implemented and used by attendee alert flows. They depend on MongoDB and Expo push tokens.

### POST `/api/sos/report`

Creates an active SOS missing-person report and sends push notifications to registered devices.

Request:

```json
{
  "name": "Jane Doe",
  "sex": "Female",
  "age": "10",
  "height": "4 ft",
  "hair_color": "Brown",
  "glasses": false,
  "shirt_color": "Red",
  "pants_color": "Blue",
  "last_location": "Main Entrance",
  "description": "",
  "reporter_name": "Parent",
  "reporter_phone": "555-0100",
  "reporter_token": "optional-token"
}
```

### GET `/api/sos/active`

Returns active SOS reports. Returns an empty list on errors for graceful degradation.

### POST `/api/sos/cancel/{report_id}`

Marks an SOS report as resolved and sends a found/cancelled notification.

### POST `/api/sos/resolve/{report_id}`

Resolves an SOS report with admin PIN verification.

Request:

```json
{"pin": "2026"}
```

### POST `/api/sos/archive/{report_id}`

Archives an SOS report with admin PIN verification.

Request:

```json
{"pin": "2026"}
```

### GET `/api/sos/resolved`

Returns resolved SOS reports.

### GET `/api/sos/archived`

Returns archived SOS reports.

### POST `/api/sos/test-alert`

Creates a test SOS alert.

### DELETE `/api/sos/test-alert/{alert_id}`

Deletes a test SOS alert.

### POST `/api/sos/admin/{report_id}`

Returns full SOS report details, including reporter contact fields, with admin PIN verification.

Request:

```json
{"pin": "2026"}
```

## Future Endpoints

The following endpoint groups are planned, not currently implemented as stable API routes:

- Schedule editor API.
- Vendor editor API.
- News editor API.
- Broadcast push delivery API.
- Analytics API.
- Audit history API.
- Event health API.
- Developer Portal API.

## Error Behavior

Common errors:

- `400`: invalid input such as missing title/message or short password.
- `401`: missing or invalid admin session.
- `403`: authenticated organizer lacks permission.
- `404`: requested report or artifact not found.
- `409`: duplicate organizer user or owner bootstrap attempted after users exist.
- `422`: request body failed FastAPI/Pydantic validation.
- `500`: server-side processing or database failure.
- `502`: upstream Google Sheets fetch failure.
