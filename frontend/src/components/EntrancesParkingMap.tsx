import { MapEducationHelpButton } from './MapEducation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { attachWebMapGestures, createMapNativeGestures, resetMapCamera, resolveDomNode, WEB_TOUCH_LOCK, type MapCameraShared } from '../config/mapInteraction';
import { mapLayerLayout, mapPaintViewport } from '../config/staticMapLayout';

const MAP_SOURCE = require('../../assets/images/entrances-parking-map.png');

export default function EntrancesParkingMap() {
  const ref = useRef<View>(null); const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const viewport = mapPaintViewport(measured, windowSize); const layer = useMemo(() => mapLayerLayout(viewport), [viewport.width, viewport.height]);
  const scale = useSharedValue(1), tx = useSharedValue(0), ty = useSharedValue(0);
  const startScale = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0), startFocalX = useSharedValue(0), startFocalY = useSharedValue(0);
  const viewW = useSharedValue(1), viewH = useSharedValue(1), mapW = useSharedValue(1), mapH = useSharedValue(1), originX = useSharedValue(0), originY = useSharedValue(0);
  const cam = useMemo<MapCameraShared>(() => ({ scale, tx, ty, startScale, startX, startY, startFocalX, startFocalY, viewW, viewH, mapW, mapH, originX, originY }), []);
  useEffect(() => { viewW.value = viewport.width; viewH.value = viewport.height; mapW.value = layer.width; mapH.value = layer.height; originX.value = layer.left; originY.value = layer.top; }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);
  useEffect(() => { if (Platform.OS !== 'web') return undefined; const node = resolveDomNode(ref.current); return node ? attachWebMapGestures(node, cam) : undefined; }, [cam, viewport.width, viewport.height]);
  const gestures = useMemo(() => createMapNativeGestures(cam), [cam]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width > 1 && height > 1) setMeasured({ width, height }); };
  const map = <Animated.View testID="entrances-map-layer" style={[styles.gesture, WEB_TOUCH_LOCK, style]}><Animated.View style={[styles.layer, { width: layer.width, height: layer.height, left: layer.left, top: layer.top }]}><Image source={MAP_SOURCE} resizeMode="contain" style={styles.image} accessibilityLabel="Official entrances and parking map" /></Animated.View></Animated.View>;
  return <View style={styles.root}><View ref={ref} testID="entrances-map-viewport" style={styles.viewport} onLayout={onLayout} accessibilityLabel="Entrances and parking map">{Platform.OS === 'web' ? map : <GestureDetector gesture={gestures}>{map}</GestureDetector>}</View><View style={styles.help}><MapEducationHelpButton mode="entrances" /></View><TouchableOpacity style={styles.reset} onPress={() => resetMapCamera(cam)} accessibilityLabel="Fit entrances and parking map"><Feather name="maximize-2" size={18} color="#263238" /></TouchableOpacity></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, overflow: 'hidden', backgroundColor: '#f7f5ef' }, viewport: { position: 'absolute', top: 116, left: 12, right: 12, bottom: 76, overflow: 'hidden' }, help: { position: 'absolute', top: 64, right: 12 }, gesture: { ...StyleSheet.absoluteFillObject }, layer: { position: 'absolute' }, image: { width: '100%', height: '100%' }, reset: { position: 'absolute', right: 14, bottom: 76, padding: 12, borderRadius: 20, backgroundColor: '#fff' } });
