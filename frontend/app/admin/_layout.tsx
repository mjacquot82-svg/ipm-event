// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="plowing-results" />
    </Stack>
  );
}
