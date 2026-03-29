// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Root index - Redirects to Coming Soon page
import { Redirect } from 'expo-router';

export default function RootIndex() {
  // This sends everyone straight to the 2026 content
  return <Redirect href="/preview-2026" />;
}
