import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GROUNDS_VIEWS, type GroundsView } from '../config/groundsParking';

export function GroundsViewSelector({ value, onChange, compact = false }: { value: GroundsView; onChange: (view: GroundsView) => void; compact?: boolean }) {
  return <View style={[styles.control, compact && { padding: 3 }]} testID="grounds-view-selector" accessibilityLabel="Grounds view">
    <Text style={styles.caption}>Grounds view</Text>
    <View style={styles.options} accessibilityRole="tablist">
      {GROUNDS_VIEWS.map(view => <TouchableOpacity
        key={view} testID={`grounds-view-${view}`} accessibilityRole="tab"
        accessibilityLabel={`${view[0].toUpperCase() + view.slice(1)} Grounds view`}
        accessibilityState={{ selected: value === view }} aria-selected={value === view} onPress={() => onChange(view)}
        style={[styles.option, compact && { minHeight: 28 }, value === view && styles.selected]}>
        <Text style={[styles.label, value === view && styles.selectedLabel]}>{view[0].toUpperCase() + view.slice(1)}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  control: { backgroundColor: 'rgba(255,255,255,0.97)', padding: 4, borderRadius: 12, borderWidth: 1, borderColor: '#D9D1BE' },
  caption: { fontSize: 10, lineHeight: 12, fontWeight: '600', color: '#62645C', marginLeft: 5 },
  options: { flexDirection: 'row', backgroundColor: '#EAE5D9', borderRadius: 8, padding: 2 },
  option: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  selected: { backgroundColor: '#B91C2D' },
  label: { fontSize: 12, fontWeight: '600', color: '#535B68' },
  selectedLabel: { color: '#FFFFFF' },
});
