# Deployment

This document describes the current production deployment setup. For the full architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Production URLs

- Frontend: `https://theipm.ca`
- Backend: `https://ipm-backend-eoiw.onrender.com`

## Frontend

- Provider: Netlify
- Source branch: `main`
- Base directory: `frontend`
- Publish directory: `dist`
- Framework: Expo Web / Expo Router

Current Netlify build command:

```sh
npm install && EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com npx expo export --platform web
```

Current production frontend environment variable:

```sh
EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com
```

Current `netlify.toml` behavior:

- Builds from `frontend`.
- Publishes `frontend/dist`.
- Forces the Render backend URL into the Expo export command.
- Defines `EXPO_PUBLIC_BACKEND_URL` in `[build.environment]`.
- Redirects all frontend routes to `/index.html` for Expo Router.

## Backend

- Provider: Render
- Framework: FastAPI
- Backend URL: `https://ipm-backend-eoiw.onrender.com`
- API prefix: `/api`

The backend should run with MongoDB configured for organizer auth, sessions, broadcasts, push token storage, starred-event tracking, and SOS features.

Important backend environment variables:

```sh
MONGODB_URL=<mongodb connection string>
DB_NAME=ipm2026
ENVIRONMENT=production
DEFAULT_EVENT_ID=ipm-2026
PUBLIC_APP_URL=https://theipm.ca
WEBPUSHR_API_KEY=<Webpushr REST API key>
WEBPUSHR_AUTH_TOKEN=<Webpushr REST authentication token>
WEBPUSHR_TEST_SUBSCRIBER_IDS=<comma-separated Webpushr subscriber IDs>
ADMIN_SESSION_COOKIE_NAME=ipm_admin_session
ADMIN_SESSION_DAYS=7
ADMIN_COOKIE_SECURE=true
CORS_ORIGINS=https://theipm.ca,https://www.theipm.ca,http://localhost:8081,http://localhost:19006,http://localhost:3000
CORS_ORIGIN_REGEX=https://.*\.netlify\.app
ADMIN_PIN=2026
```

`MONGO_URL` is also supported as an alternative to `MONGODB_URL`.

`ENVIRONMENT` defaults to `development`, which keeps `/docs`, `/redoc`, and
`/openapi.json` available locally. Set it to `production` on Render to disable
all three documentation endpoints.

## Deployment Flow

1. Merge or push changes to `main`.
2. Netlify builds the frontend using `netlify.toml`.
3. Expo exports the web app into `frontend/dist`.
4. Netlify serves the generated static app.
5. The generated frontend bundle calls the backend URL embedded during `expo export`.
6. Render serves the FastAPI backend.

## Verification

After frontend deployment, verify the generated app points at Render:

```sh
grep -R "ipm-event-production.up.railway.app" frontend/dist
grep -R "ipm-backend-eoiw.onrender.com" frontend/dist
```

The Railway URL should not appear. The Render URL should appear in generated bundles that call backend APIs.

Backend health checks:

```sh
curl -i https://ipm-backend-eoiw.onrender.com/api/
curl -i https://ipm-backend-eoiw.onrender.com/api/schedule
```

Expected root response:

```json
{"message":"Hello World"}
```

## Common Deployment Mistakes

### Wrong Backend URL Embedded in Frontend

Problem: The PWA calls a stale backend such as:

```text
https://ipm-event-production.up.railway.app
```

Cause: Expo embeds `EXPO_PUBLIC_BACKEND_URL` at build time.

Fix:

1. Set `EXPO_PUBLIC_BACKEND_URL=https://ipm-backend-eoiw.onrender.com`.
2. Rebuild the Expo web export.
3. Redeploy Netlify.
4. Verify the generated bundle no longer contains the stale URL.

### Updating Netlify Environment Without Rebuilding

Problem: The deployed PWA keeps calling the old backend after an environment variable is changed.

Cause: Existing generated JavaScript bundles are static files.

Fix: Trigger a new Netlify build or rebuild `frontend/dist` and redeploy.

### Backend Route Exists Locally but Fails in Production

Problem: A route exists in `backend/server.py`, but browser calls fail.

Checks:

- Confirm the frontend is calling the correct host.
- Confirm the backend production service is responding.
- Confirm CORS preflight succeeds for `https://theipm.ca`.
- Confirm MongoDB is configured if the route requires persistence.

### Cookie Auth Fails

Problem: Organizer login succeeds but later admin requests appear unauthenticated.

Checks:

- Frontend requests must include `credentials: 'include'`.
- Backend CORS must allow credentials.
- Cookie must be Secure and `SameSite=None` for production cross-origin requests.
- Browser must not block third-party/cross-site cookies in a way that prevents the session flow.

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [API](./API.md)
- [Decisions](./DECISIONS.md)
