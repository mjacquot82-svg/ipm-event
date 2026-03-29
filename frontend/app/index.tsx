// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Root index - Redirects to Coming Soon page

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/home" />; // Or whatever your main page is named
}
