// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Root index - Redirects to Coming Soon page

import { Redirect, useSegments } from 'expo-router';

export default function RootIndex() {
  const segments = useSegments();
  
  // This captures anyone coming in from /preview or the main root
  // and sends them straight to your 2026 Preview content.
  return <Redirect href="/preview-2026" />;
}
