import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { GROUNDS_PARKING_POIS, type GroundsParkingPoi } from '../config/groundsParking';

function ParkingMarker({ poi, width, height, scale, selected, onSelect }: {
  poi: GroundsParkingPoi; width: number; height: number; scale: SharedValue<number>;
  selected: boolean; onSelect: (poi: GroundsParkingPoi) => void;
}) {
  const [dx, dy] = poi.offset;
  const markerStyle = useAnimatedStyle(() => ({ transform: [
    { translateX: dx / scale.value }, { translateY: dy / scale.value }, { scale: 1 / scale.value },
  ] }));
  const lineStyle = useAnimatedStyle(() => ({ width: Math.hypot(dx, dy) / scale.value, height: 1.5 / scale.value }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  return <React.Fragment>
    <Animated.View pointerEvents="none" style={[styles.leader, { left: poi.x * width / 100, top: poi.y * height / 100, transformOrigin: 'left center', transform: [{ rotate: `${Math.atan2(dy, dx) * 180 / Math.PI}deg` }] }, lineStyle]} />
    <Animated.View pointerEvents="none" style={[styles.dot, { left: poi.x * width / 100 - 2, top: poi.y * height / 100 - 2 }, dotStyle]} />
    <Animated.View style={[styles.marker, { left: poi.x * width / 100 - 14, top: poi.y * height / 100 - 14 }, markerStyle]}>
      <TouchableOpacity testID={`grounds-parking-${poi.id}`} accessibilityRole="button"
        accessibilityLabel={`${poi.id === 'accessible' ? '' : '#' + poi.id + ' '}${poi.label}${poi.detail ? ', ' + poi.detail : ''}`}
        accessibilityState={{ selected }} onPress={() => onSelect(poi)}
        style={[styles.button, selected && styles.selected]}>
        {poi.id === 'accessible' ? <MaterialIcons name="accessible" size={18} color="#FFFFFF" /> : <Text style={styles.number}>{poi.id}</Text>}
      </TouchableOpacity>
    </Animated.View>
  </React.Fragment>;
}

export function GroundsParkingOverlay({ width, height, scale, selected, onSelect }: {
  width: number; height: number; scale: SharedValue<number>; selected: string | null;
  onSelect: (poi: GroundsParkingPoi) => void;
}) {
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="grounds-parking-overlay">
    {GROUNDS_PARKING_POIS.map(poi => <ParkingMarker key={poi.id} poi={poi} width={width} height={height} scale={scale} selected={selected === poi.id} onSelect={onSelect} />)}
  </View>;
}
const styles = StyleSheet.create({
  leader: { position: 'absolute', backgroundColor: '#FFFFFF', borderColor: '#173F70' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#174B7D', borderColor: '#FFFFFF', borderWidth: 1 },
  marker: { position: 'absolute', width: 28, height: 28 },
  button: { flex: 1, borderRadius: 14, backgroundColor: '#174B7D', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#B91C2D', borderColor: '#FFD600' },
  number: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
