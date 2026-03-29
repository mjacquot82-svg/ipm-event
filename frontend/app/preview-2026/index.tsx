import { Redirect } from 'expo-router';

export default function PreviewRedirect() {
  // This sends anyone who hits /preview/ straight to your 2026 preview content
  return <Redirect href="/preview-2026" />;
}
