import { MapEducationAnchors } from './MapEducation';
// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';

export type MapMode = 'grounds' | 'tented' | 'rv' | 'entrances';

export const MAP_MODE_OPTIONS: { id: MapMode; label: string; accessibilityLabel: string }[] = [
  { id: 'grounds', label: 'Grounds', accessibilityLabel: 'Show grounds map' },
  { id: 'tented', label: 'Tented City', accessibilityLabel: 'Show tented city map' },
  { id: 'rv', label: 'Camping Map', accessibilityLabel: 'Show camping map' },
  { id: 'entrances', label: 'Entrances / Parking', accessibilityLabel: 'Show entrances and parking map' },
];

export default function MapModeSelector({
  mode,
  onChange,
  desktop = false,
  testID = 'map-mode-selector',
}: {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
  testID?: string;
  desktop?: boolean;
}) {
  const educationAnchors = React.useContext(MapEducationAnchors);
  return (
    <View style={[styles.wrap, { width: '100%' }]} testID={testID} accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { width: '100%', minWidth: 0, flexGrow: 1 }]}
        style={[styles.scroll, { width: '100%' }]}
        keyboardShouldPersistTaps="handled"
      >
        {MAP_MODE_OPTIONS.map((option) => {
          const on = mode === option.id;
          return (
            <TouchableOpacity
              ref={node => { if (educationAnchors) educationAnchors.current[option.id] = node; }}
              key={option.id}
              style={[styles.btn, { flex: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 2, paddingVertical: 4 }, on && styles.btnOn]}
              onPress={() => onChange(option.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option.accessibilityLabel}
              testID={`map-mode-${option.id}`}
            >
              <Text style={[styles.text, on && styles.textOn]} numberOfLines={2}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    maxWidth: '100%',
    backgroundColor: 'rgba(232,228,218,0.95)',
    borderRadius: 12,
    padding: 3,
  },
  scroll: { maxWidth: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 0,
    minWidth: 300,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  btnOn: { backgroundColor: '#FFFFFF' },
  text: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#6B7280' },
  textOn: { color: colors.primary },
});
