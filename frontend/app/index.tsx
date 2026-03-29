// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Root index - Redirects to Coming Soon page

import { Redirect } from 'expo-router';

export default function Index() {
  // This is the "Front Door" that bounces users to your actual content
  return <Redirect href="/preview-2026" />;
}
