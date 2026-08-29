const requiredEnvironment = [
  'EXPO_PUBLIC_BACKEND_URL',
  'EXPO_PUBLIC_EVENT_ID',
  'EXPO_PUBLIC_WONDERPUSH_WEB_KEY',
];

const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name]?.trim()
);

if (missingEnvironment.length > 0) {
  console.error(
    `Frontend build aborted: missing required deployment environment variable(s): ${missingEnvironment.join(', ')}`
  );
  process.exit(1);
}

let backendUrl;
try {
  backendUrl = new URL(process.env.EXPO_PUBLIC_BACKEND_URL);
} catch {
  console.error('Frontend build aborted: EXPO_PUBLIC_BACKEND_URL must be a valid absolute URL.');
  process.exit(1);
}

if (!['http:', 'https:'].includes(backendUrl.protocol)) {
  console.error('Frontend build aborted: EXPO_PUBLIC_BACKEND_URL must use http or https.');
  process.exit(1);
}
