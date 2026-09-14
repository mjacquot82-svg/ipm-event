import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

// Whole-artwork percentages, reconciled against production's 1344 × 2006 JPEG.
export const GROUNDS_TRAFFIC_ARROWS = [
  { id: 'TRAFFIC-01', start: [24.12, 76.50], end: [37.63, 74.94] },
  { id: 'TRAFFIC-02', start: [36.45, 72.96], end: [34.23, 64.50] },
  { id: 'TRAFFIC-03', start: [90.50, 68.21], end: [41.28, 74.23] },
] as const;
export const GROUNDS_TRAFFIC_NOTICE = 'Durham Road is barricaded at Huron Tractor to control traffic arriving from the east.';

function RoadLabel({ text, x, y, rotation, width, height, scale, zoomOnly = false, offsetY = 0 }: {
  text: string; x: number; y: number; rotation: number; width: number; height: number;
  scale: SharedValue<number>; zoomOnly?: boolean; offsetY?: number;
}) {
  const visibility = useAnimatedStyle(() => ({ opacity: zoomOnly && scale.value < 1.5 ? 0 : 1 }));
  return <Animated.View pointerEvents="none" testID={`grounds-road-${text.replaceAll(' ', '-')}`}
    style={[styles.label, { left: x * width / 100 - 75, top: y * height / 100 - 10 + offsetY, transform: [{ rotate: `${rotation}deg` }] }, visibility]}>
    <Text style={styles.labelText}>{text}</Text>
  </Animated.View>;
}

/** Passive geometry shares the artwork's camera; never registers gesture handlers or requests artwork. */
export function GroundsTrafficOverlay({ width, height, scale, showTraffic = true }: { width: number; height: number; scale: SharedValue<number>; showTraffic?: boolean }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="grounds-traffic-overlay">
    {showTraffic && GROUNDS_TRAFFIC_ARROWS.map(({ id, start, end }) => {
      const x = start[0] * width / 100, y = start[1] * height / 100;
      const dx = (end[0] - start[0]) * width / 100, dy = (end[1] - start[1]) * height / 100;
      const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return <View key={id} pointerEvents="none" testID={id} style={{ position: 'absolute', left: x, top: y - 6, width: length, height: 12, transformOrigin: 'left center', transform: [{ rotate: `${angle}deg` }] }}>
        <View style={[styles.casing, { width: Math.max(0, length - 8) }]} />
        <View style={[styles.shaft, { width: Math.max(0, length - 8) }]} />
        <View style={[styles.head, { right: 0 }]} />
        <View style={[styles.headFill, { right: 2 }]} />
      </View>;
    })}
    {showTraffic && <View pointerEvents="none" testID="grounds-flow-caption" style={[styles.label, { left: width * .215 - 75, top: height * .73 - 10 }]}>
      <Text style={styles.flowCaption}>Flow of traffic</Text>
    </View>}
    <View pointerEvents="none" testID="grounds-horse-plowing-label" style={{ position: 'absolute', left: width * .222 - width * .0435, top: height * .453 - height * .0225, width: width * .087, height: height * .045, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[styles.horseText, { fontSize: Math.min(12, width * .019), lineHeight: Math.min(14, width * .023) }]}>{'Horse\nPlowing'}</Text>
    </View>
    {showTraffic && <View pointerEvents="none" testID="grounds-traffic-notice" style={[styles.notice, { right: width * .08, top: height * .165, width: Math.min(180, width * .46) }]}>
      <Text style={[styles.noticeText, { fontSize: width < 360 ? 10 : 11, lineHeight: width < 360 ? 12 : 14 }]}>{GROUNDS_TRAFFIC_NOTICE}</Text>
    </View>}
    <RoadLabel text="Durham Rd" x={41.5} y={82} rotation={90} width={width} height={height} scale={scale} />
    <RoadLabel text="Greenock-Brant" x={65} y={71.33} offsetY={24} rotation={0} width={width} height={height} scale={scale} />
    <RoadLabel text="Bruce Road 2" x={24.9} y={19.42} rotation={90} width={width} height={height} scale={scale} zoomOnly />
    <RoadLabel text="Bruce Road 3" x={56} y={34.5} rotation={0} width={width} height={height} scale={scale} />
    <RoadLabel text="Highway 9" x={87.5} y={48} rotation={90} width={width} height={height} scale={scale} />
    <View pointerEvents="none" testID="grounds-walkerton" style={[styles.label, { left: width * .205 - 75, top: height * .16 - 10 }]}>
      <Text style={[styles.labelText, styles.orientation]}>↑ Walkerton</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  casing: { position: 'absolute', left: 0, top: 3.5, height: 5, backgroundColor: '#252525' },
  shaft: { position: 'absolute', left: 0, top: 4.5, height: 3, backgroundColor: '#FFE600' },
  head: { position: 'absolute', top: 0, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 13, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#252525' },
  headFill: { position: 'absolute', top: 2, width: 0, height: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFE600' },
  label: { position: 'absolute', width: 150, height: 20, alignItems: 'center', justifyContent: 'center' },
  labelText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#20252B', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 3, borderRadius: 3 },
  flowCaption: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#252525', backgroundColor: '#FFE600', paddingHorizontal: 4, borderColor: '#252525', borderWidth: 1, borderRadius: 3 },
  horseText: { fontWeight: '800', color: '#20252B', textAlign: 'center' },
  notice: { position: 'absolute', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: 'rgba(255,255,255,0.96)' },
  noticeText: { color: '#334155' },
  orientation: { color: '#334155', borderColor: '#64748B', borderWidth: 1 },
});
