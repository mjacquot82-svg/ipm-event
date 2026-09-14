import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';
import { prioritizeArtwork, type MapArtworkKey } from '../services/mapArtwork';

/** An image lifecycle gate, not a guarantee that every compositor tile has painted. */
export function useArtworkReveal(map: MapArtworkKey) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const generation = useRef(0);
  const activeAttempt = useRef(attempt);
  activeAttempt.current = attempt;
  const handlers = useRef<{ loaded: () => void; failed: () => void }>({ loaded() {}, failed() {} });
  useEffect(() => {
    const current = ++generation.current;
    let frame = 0;
    let settled = false;
    setState('loading');
    prioritizeArtwork(map);
    const fail = () => {
      if (generation.current !== current || settled) return;
      settled = true;
      cancelAnimationFrame(frame);
      setState('error');
    };
    const timer = setTimeout(fail, 15000);
    handlers.current = {
      loaded: () => {
        if (generation.current !== current || settled) return;
        // RN Web's onLoad follows its decode attempt. Give its image-state commit
        // a frame before revealing the containing map layer.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (generation.current !== current || settled) return;
            settled = true;
            clearTimeout(timer);
            setState('ready');
          });
        });
      },
      failed: fail,
    };
    return () => { generation.current++; clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [map, attempt]);
  // Capture this attempt: callbacks from an old/retried Image cannot reveal the new one.
  const onLoad = useCallback(() => { if (activeAttempt.current === attempt) handlers.current.loaded(); }, [attempt]);
  const onError = useCallback(() => { if (activeAttempt.current === attempt) handlers.current.failed(); }, [attempt]);
  const retry = () => { generation.current++; setState('loading'); setAttempt(n => n + 1); };
  return { state, attempt, onLoad, onError, retry };
}

export function MapArtworkLoading({ artwork, map }: { artwork: ReturnType<typeof useArtworkReveal>; map: MapArtworkKey }) {
  if (artwork.state === 'ready') return null;
  return <View style={styles.cover} testID={`map-artwork-${map}-${artwork.state}`} pointerEvents="box-none">
    <View style={styles.message} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{artwork.state === 'loading' ? 'Loading map…' : 'Map image unavailable. Connect to the internet and try again.'}</Text>
      {artwork.state === 'error' ? <TouchableOpacity onPress={artwork.retry} accessibilityRole="button" style={styles.retry}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { maxWidth: 320, alignItems: 'center', backgroundColor: colors.background, padding: 16, borderRadius: 12 },
  text: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  retry: { padding: 12, marginTop: 8 },
  retryText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
