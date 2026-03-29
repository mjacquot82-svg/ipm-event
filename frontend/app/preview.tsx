import { Redirect } from 'expo-router';

export default function PreviewPage() {
  // This sends anyone at /preview straight to the 2026 content
  return <Redirect href="/preview-2026" />;
}
