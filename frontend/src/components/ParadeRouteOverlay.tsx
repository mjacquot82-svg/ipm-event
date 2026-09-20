import React from 'react';
import { useMapEducationAnchor } from './MapEducation';
import { Feather } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { PARADE_ROUTES, PARADE_VIEWBOX, PARADE_ASSEMBLY, paradePath, type ParadeRouteId } from '../config/tentedCityParadeRoutes';
const BLUE = '#0078BD';
const rotation = { east: 0, south: 90, west: 180, north: 270 };
export function ParadeRouteOverlay({ routeId }: { routeId: ParadeRouteId | null }) {
  if (!routeId) return null;
  const route = PARADE_ROUTES[routeId];
  // Like the existing map artwork, this is SVG rendered as an image. No new
  // renderer/dependency; both images share the same transformed map layer.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PARADE_VIEWBOX}">
    <polygon points="${PARADE_ASSEMBLY.outline}" fill="#E6F4FA" fill-opacity="0.8" stroke="${BLUE}" stroke-width="1" stroke-dasharray="3 2"/>
    <text transform="translate(${PARADE_ASSEMBLY.label.join(' ')}) rotate(-90)" text-anchor="middle" font-family="sans-serif" font-size="6" font-weight="bold" fill="#004B76">Parade Assembly Area</text>
    ${route.paths.map(points => `<path d="${paradePath(points)}" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><path d="${paradePath(points)}" fill="none" stroke="${BLUE}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
    ${route.arrows.map(({at:[x,y],direction}) => `<g transform="translate(${x} ${y}) rotate(${rotation[direction]})"><path d="M -3 -3 L 1 0 L -3 3" fill="none" stroke="white" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M -3 -3 L 1 0 L -3 3" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`).join('')}
    ${route.labels.map(({text,at:[x,y],angle=0}) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${angle} ${x} ${y})" font-family="sans-serif" font-size="10" font-weight="700" fill="white" stroke="#003B5C" stroke-width="1.25" stroke-linejoin="round" paint-order="stroke" letter-spacing="0.05">${text}</text>`).join('')}
  </svg>`;
  return <View pointerEvents="none" testID={`parade-route-${routeId}`} style={StyleSheet.absoluteFill} accessibilityLabel={`${route.label} parade route`}>
    <Image source={{uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}} style={StyleSheet.absoluteFill} resizeMode="stretch" />
  </View>;
}
export function ParadeRouteControls({ value, onChange }: { value: ParadeRouteId | null; onChange: (id: ParadeRouteId | null) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const educationAnchor = useMapEducationAnchor('parade-routes');
  return <View style={styles.controls}>
    <TouchableOpacity ref={educationAnchor} testID="parade-routes-control" accessibilityRole="button" accessibilityLabel={`Parade Routes · ${value ? PARADE_ROUTES[value].label : 'Off'} · ${expanded ? 'Collapse' : 'Choose a day'}`} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[styles.toggle, (expanded || value !== null) && styles.toggleActive]}>
      <Feather name="map" size={18} color="#004B76" />
      <View style={styles.toggleLabel}>
        <Text style={styles.heading}>Parade Routes</Text>
        <Text style={styles.status}>{value ? PARADE_ROUTES[value].label : 'Off · Choose a day'}</Text>
      </View>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#004B76" />
    </TouchableOpacity>
    {expanded && <View style={styles.options}>
      {([{ id: null, label: 'Off' }, ...Object.values(PARADE_ROUTES)]).map(item => <TouchableOpacity key={item.id || 'off'} accessibilityRole="radio" accessibilityLabel={`Parade route: ${item.label}`} aria-checked={value === item.id} accessibilityState={{ checked: value === item.id }} onPress={() => onChange(item.id)} style={[styles.option, value === item.id && styles.selected]}>
        <Text style={[styles.text, value === item.id && styles.selectedText]}>{value === item.id ? '✓ ' : ''}{item.label}</Text>
      </TouchableOpacity>)}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  controls: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, padding: 0 },
  toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#7AAAC4', borderRadius: 10, backgroundColor: '#F0F8FC' },
  toggleActive: { borderColor: '#005F96', backgroundColor: '#DDEFF9' },
  toggleLabel: { flexShrink: 1 },
  status: { color: '#365B70', fontSize: 12, marginTop: 2 },
  heading: { color: '#004B76', fontSize: 13, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4 },
  option: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  selected: { backgroundColor: '#005F96', borderColor: '#005F96' },
  text: { color: '#334155', fontSize: 13 }, selectedText: { color: 'white', fontWeight: '700' },
});
