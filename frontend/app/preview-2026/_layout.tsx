// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Preview Mode Layout

import React from 'react';
import { Stack } from 'expo-router';
import colors from '../../src/theme/colors';

export default function PreviewLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
