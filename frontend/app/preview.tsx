import { Redirect } from 'expo-router';

export default function Index() {
  // This bounces the user from the "Front Door" to the 2026 page
  return <Redirect href="/preview-2026" />;
}
