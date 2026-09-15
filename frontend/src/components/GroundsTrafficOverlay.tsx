import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

// Whole-artwork percentages, reconciled against production's 1344 × 2006 JPEG.
export const GROUNDS_TRAFFIC_ARROWS = [
  { id: 'TRAFFIC-01', start: [24.12, 76.50], end: [37.63, 74.94] },
  { id: 'TRAFFIC-02', start: [36.45, 72.96], end: [34.23, 64.50] },
  { id: 'TRAFFIC-03', start: [90.50, 68.21], end: [41.28, 74.23] },
] as const;

// Continuous shafts in whole-artwork coordinates. Endpoint heads show the two
// junction exits, without extra standalone direction markers.
export const GROUNDS_BRUCE_TRAFFIC_LINES = [
  { id: 'grounds-bruce-3-line', start: [19, 39.1], end: [80, 32.35], bothEnds: true },
  { id: 'grounds-bruce-2-line', start: [32.4, 57], end: [29.1, 41.3], bothEnds: false },
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
  // Start at the notice's actual left edge, including its desktop width cap.
  // Bend through open artwork north of the bus area to the incoming lane.
  const noticeWidth = Math.min(180, width * .46);
  const signX = width * .299, signY = height * .391;
  const leaderPoints = [
    [width * .92 - noticeWidth, height * .165 + 18],
    [width * .31, height * .285],
    [width * .315, height * .365],
    [signX, signY],
  ];
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="grounds-traffic-overlay">
    <View pointerEvents="none" testID="grounds-notice-leader" style={StyleSheet.absoluteFill}>
      {leaderPoints.slice(1).map(([endX, endY], i) => {
        const [x, y] = leaderPoints[i];
        const dx = endX - x, dy = endY - y;
        return <View key={i} style={{ position: 'absolute', left: x, top: y - 1.5,
          width: Math.hypot(dx, dy), height: 3, backgroundColor: '#FFFFFF',
          transformOrigin: 'left center', transform: [{ rotate: `${Math.atan2(dy, dx) * 180 / Math.PI}deg` }] }}>
          <View style={{ position: 'absolute', top: .75, left: 0, right: 0, height: 1.5, backgroundColor: '#B91C1C' }} />
        </View>;
      })}
    </View>
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
    {showTraffic && GROUNDS_BRUCE_TRAFFIC_LINES.map(({ id, start, end, bothEnds }) => {
      const x = start[0] * width / 100, y = start[1] * height / 100;
      const dx = (end[0] - start[0]) * width / 100, dy = (end[1] - start[1]) * height / 100;
      const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
      // Heads overlap a single unbroken shaft; there are no detached arrows.
      const heads = bothEnds
        ? [{ tip: 0, reverse: true }, { tip: length, reverse: false }]
        : [{ tip: length, reverse: false }];
      return <View key={id} pointerEvents="none" testID={id} style={{ position: 'absolute', left: x, top: y - 6,
        width: length, height: 12, transformOrigin: 'left center', transform: [{ rotate: `${angle}deg` }] }}>
        <View testID={`${id}-casing`} style={[styles.casing, { left: bothEnds ? 8 : 0, width: Math.max(0, length - (bothEnds ? 16 : 8)) }]} />
        {heads.map(({ tip, reverse }, i) => <View key={i} testID={`${id}-head-${i}`} style={{ position: 'absolute',
          left: reverse ? tip : tip - 13, top: 0, width: 13, height: 12,
          transform: [{ rotate: reverse ? '180deg' : '0deg' }] }}>
          <View style={[styles.head, { right: 0 }]} />
        </View>)}
        {/* Paint all dark edging first so a head's base cannot cut a dark seam
            across the yellow shaft. The yellow fills overlap at each join. */}
        <View testID={`${id}-shaft`} style={[styles.shaft, { left: bothEnds ? 8 : 0, width: Math.max(0, length - (bothEnds ? 16 : 8)) }]} />
        {heads.map(({ tip, reverse }, i) => <View key={i} style={{ position: 'absolute',
          left: reverse ? tip : tip - 13, top: 0, width: 13, height: 12,
          transform: [{ rotate: reverse ? '180deg' : '0deg' }] }}>
          <View style={[styles.headFill, { right: 2 }]} />
        </View>)}
      </View>;
    })}
    <View pointerEvents="none" testID="grounds-no-entry" accessibilityLabel="No entry for incoming traffic south of Bruce Road 3"
      style={{ position: 'absolute', left: signX - 9, top: signY - 9, width: 18, height: 18,
        borderRadius: 9, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#DC2626',
        alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 11, height: 3, backgroundColor: '#FFFFFF' }} />
    </View>
    {showTraffic && <View pointerEvents="none" testID="grounds-flow-caption" style={[styles.label, { left: width * .215 - 75, top: height * .73 - 10 }]}>
      <Text style={styles.flowCaption}>Flow of traffic</Text>
    </View>}
    <View pointerEvents="none" testID="grounds-horse-plowing-label" style={{ position: 'absolute', left: width * .222 - width * .0435, top: height * .453 - height * .0225, width: width * .087, height: height * .045, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[styles.horseText, { fontSize: Math.min(12, width * .019), lineHeight: Math.min(14, width * .023) }]}>{'Horse\nPlowing'}</Text>
    </View>
    {<View pointerEvents="none" testID="grounds-traffic-notice" style={[styles.notice, { right: width * .08, top: height * .165, width: Math.min(180, width * .46) }]}>
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
