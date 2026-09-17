import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

// Approved traffic-flow geometry from 0c1b1d8a; percentages of grounds-site-map.jpg.
export const GROUNDS_TRAFFIC_ARROWS = [
  { id: 'TRAFFIC-01', start: [24.12, 76.50], end: [37.63, 74.94] },
  { id: 'TRAFFIC-02', start: [36.45, 72.96], end: [34.23, 64.50] },
  { id: 'TRAFFIC-03', start: [90.50, 68.21], end: [41.28, 74.23] },
] as const;
export const GROUNDS_TRAFFIC_NOTICE = 'Durham Road is barricaded at Huron Tractor to control traffic arriving from the east.';
function RoadLabel({ text, x, y, rotation, width, height, scale, zoomOnly = false }: { text: string; x: number; y: number; rotation: number; width: number; height: number; scale: SharedValue<number>; zoomOnly?: boolean }) {
  const visibility = useAnimatedStyle(() => ({ opacity: zoomOnly && scale.value < 1.5 ? 0 : 1 }));
  return <Animated.View pointerEvents="none" testID={`grounds-road-${text.replaceAll(' ', '-')}`} style={[styles.label, { left: x * width / 100 - 75, top: y * height / 100 - 10, transform: [{ rotate: `${rotation}deg` }] }, visibility]}><Text style={styles.labelText}>{text}</Text></Animated.View>;
}
export function GroundsTrafficOverlay({ width, height, scale }: { width: number; height: number; scale: SharedValue<number> }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="grounds-traffic-overlay">
    {GROUNDS_TRAFFIC_ARROWS.map(({ id, start, end }) => { const x = start[0] * width / 100, y = start[1] * height / 100; const dx = (end[0] - start[0]) * width / 100, dy = (end[1] - start[1]) * height / 100; const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI; return <View key={id} pointerEvents="none" testID={id} style={{ position: 'absolute', left: x, top: y - 6, width: length, height: 12, transformOrigin: 'left center', transform: [{ rotate: `${angle}deg` }] }}><View style={[styles.casing, { width: Math.max(0, length - 8) }]} /><View style={[styles.shaft, { width: Math.max(0, length - 8) }]} /><View style={[styles.head, { right: 0 }]} /><View style={[styles.headFill, { right: 2 }]} /></View>; })}
    <RoadLabel text="Durham Rd" x={27} y={66.5} rotation={80} width={width} height={height} scale={scale} /><RoadLabel text="Greenock-Brant" x={65} y={75.5} rotation={-10} width={width} height={height} scale={scale} zoomOnly={width < 350} /><RoadLabel text="Bruce Road 2" x={24.9} y={19.42} rotation={80} width={width} height={height} scale={scale} zoomOnly /><RoadLabel text="Bruce Road 3" x={53.13} y={32.4} rotation={-10} width={width} height={height} scale={scale} zoomOnly /><View pointerEvents="none" testID="grounds-walkerton" style={[styles.label, { left: width * .205 - 75, top: height * .115 - 10 }]}><Text style={[styles.labelText, styles.orientation]}>↑ Walkerton</Text></View>
  </View>;
}
const styles = StyleSheet.create({ casing: { position: 'absolute', left: 0, top: 3.5, height: 5, backgroundColor: '#252525' }, shaft: { position: 'absolute', left: 0, top: 4.5, height: 3, backgroundColor: '#FFE600' }, head: { position: 'absolute', top: 0, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 13, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#252525' }, headFill: { position: 'absolute', top: 2, width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFE600' }, label: { position: 'absolute', width: 150, height: 20, alignItems: 'center', justifyContent: 'center' }, labelText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#20252B', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 3, borderRadius: 3 }, orientation: { color: '#334155', borderColor: '#64748B', borderWidth: 1 } });
