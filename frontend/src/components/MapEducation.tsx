import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EDUCATION_KEYS, MAP_TOUR_STEPS, type EducationKind } from '../services/mapEducationState';

export const ContextualEducationReplay = createContext<{ pending: Set<EducationKind> } | null>(null);

type Anchor = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };
type Rect = { x: number; y: number; width: number; height: number };
export const MapEducationMode = createContext('');
export const MapEducationReplay = createContext<React.MutableRefObject<(() => void) | null> | null>(null);
export const MapEducationAnchors = createContext<React.MutableRefObject<Record<string, Anchor | null>> | null>(null);
export function useMapEducationAnchor(name: string) {
  const anchors = useContext(MapEducationAnchors);
  return React.useCallback((node: Anchor | null) => { if (anchors) anchors.current[name] = node; }, [anchors, name]);
}
// A single lease prevents competing directory cards / screens from opening two tips.
let owner: object | null = null;
const remembered = new Set<EducationKind>();
function useEducation(kind: EducationKind, eligible: boolean, autoStart = true) {
  const requestedReplay = useContext(ContextualEducationReplay);
  const pathname = usePathname();
  const focused = pathname.endsWith(kind === 'mapsTourSeen' ? '/map' : kind.startsWith('schedule') ? '/schedule' : '/vendors');
  const token = useRef({}).current;
  const [visible, setVisible] = useState<'automatic' | 'manual' | null>(null);
  useEffect(() => {
    if (!eligible || !focused) { setVisible(null); return; }
    if (!autoStart) {
      setVisible(null);
      // Manual Help can still acquire the lease during a deferred visit.
      return () => { if (owner === token) owner = null; };
    }
    let live = true;
    const check = async () => {
      try {
        if (live && requestedReplay?.pending.has(kind) && (!owner || owner === token)) {
          requestedReplay.pending.delete(kind); owner = token; setVisible('manual'); return;
        }
        const seen = remembered.has(kind) || await AsyncStorage.getItem(EDUCATION_KEYS[kind]) === 'true';
        if (live && !seen && (!owner || owner === token)) { owner = token; setVisible('automatic'); }
      } catch { /* Unavailable storage must never block the underlying app. */ }
    };
    void check();
    const timer = setInterval(() => void check(), 700);
    return () => { live = false; clearInterval(timer); if (owner === token) owner = null; };
  }, [eligible, focused, kind, token, autoStart, requestedReplay]);
  const dismiss = () => {
    remembered.add(kind);
    void AsyncStorage.setItem(EDUCATION_KEYS[kind], 'true').catch(() => {});
    setVisible(null);
    if (owner === token) owner = null;
  };
  const replay = () => { if (!owner || owner === token) { owner = token; setVisible('manual'); } };
  // Gate automatic visibility during render as well: destination arrivals must never flash a tour.
  return { visible: focused && eligible && (visible === 'manual' || (autoStart && visible === 'automatic')), dismiss, replay };
}

function EducationCallout({ title, body, progress, target, fallback, onNext, onDismiss, onTargetPress }: {
  title: string; body: string; progress?: string; target?: Anchor | null; fallback?: Anchor | null;
  onNext?: () => void; onDismiss: () => void; onTargetPress?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(210);
  const card = useRef<View>(null);
  const next = useRef<View>(null);
  const dismissRef = useRef(onDismiss); dismissRef.current = onDismiss;
  useEffect(() => {
    const measure = () => (target || fallback)?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0 && y >= insets.top && y + h <= height - insets.bottom) {
        setRect({ x, y, width: w, height: h });
      } else setRect(null);
    });
    setRect(null); measure(); const timer = setInterval(measure, 250);
    return () => clearInterval(timer);
  }, [target, fallback, width, height, insets.top, insets.bottom]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => (next.current as unknown as HTMLElement)?.focus(), 80);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
      if (event.key === 'Tab') {
        const buttons = (card.current as unknown as HTMLElement)?.querySelectorAll<HTMLElement>('[role="button"]');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !Array.from(buttons).includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    // RN Web closes modals on keyup. Consume that same event before the parent detail modal.
    const keyup = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); dismissRef.current(); } };
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('keydown', keydown, true);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  const margin = 12, gap = 12, cardWidth = Math.min(340, width - margin * 2);
  const minTop = Math.max(margin, insets.top + margin), maxBottom = height - Math.max(margin, insets.bottom + margin);
  const below = rect ? maxBottom - (rect.y + rect.height + gap) : maxBottom - minTop;
  const above = rect ? rect.y - gap - minTop : 0;
  const useBelow = !rect || below >= cardHeight || below >= above;
  const maxHeight = Math.max(80, rect ? (useBelow ? below : above) : maxBottom - minTop);
  const shownHeight = Math.min(cardHeight, maxHeight);
  const top = rect ? (useBelow ? rect.y + rect.height + gap : rect.y - gap - shownHeight) : minTop;
  const left = Math.max(margin, Math.min(width - cardWidth - margin, rect ? rect.x + rect.width / 2 - cardWidth / 2 : (width - cardWidth) / 2));
  return <Modal transparent animationType="none" visible onRequestClose={onDismiss}>
    <View style={StyleSheet.absoluteFill} testID="map-education-overlay">
      {rect ? <>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: rect.y }]} />
        <View style={[styles.dim, { top: rect.y, left: 0, width: rect.x, height: rect.height }]} />
        <View style={[styles.dim, { top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height }]} />
        <View style={[styles.dim, { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 }]} />
        <View testID="map-education-spotlight" style={[styles.spotlight, { top: rect.y - 3, left: rect.x - 3, width: rect.width + 6, height: rect.height + 6 }]} />
      </> : <View style={[StyleSheet.absoluteFill, styles.dim]} />}
      {rect && onTargetPress ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open highlighted event details"
        testID="schedule-education-open-event" onPress={onTargetPress}
        style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.width, height: rect.height }} /> : null}
      <View ref={card} role="dialog" accessibilityLabel={title} accessibilityViewIsModal testID="map-education-card"
        style={[styles.card, { top, left, width: cardWidth, maxHeight }]}>
        <ScrollView onContentSizeChange={(_, h) => setCardHeight(h)} contentContainerStyle={styles.content}>
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            {onNext ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip Maps tour" style={styles.secondary} onPress={onDismiss}><Text style={styles.secondaryText}>Skip</Text></TouchableOpacity> : null}
            <TouchableOpacity ref={next} accessibilityRole="button" style={styles.primary} onPress={onNext || onDismiss}>
              <Text style={styles.primaryText}>{onNext ? 'Next' : 'Got it'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

// Reuse the original contextual callout and Help styling; no new tour engine or storage keys.
export function ContextualHelpButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} style={[styles.help, { width: 'auto', paddingHorizontal: 12, alignSelf: 'flex-start' }]} onPress={onPress}><Text style={styles.helpText}>{label}</Text></TouchableOpacity>;
}
export function VendorHelpReplay({ onDismiss }: { onDismiss: () => void }) {
  return <EducationCallout title="Find this vendor" body="Browse or search vendors; each card shows the available details. Use Find on Map to jump directly to a mapped vendor’s location." onDismiss={onDismiss} />;
}

export function MapEducationHelpButton({ mode }: { mode: string }) {
  const replay = useContext(MapEducationReplay);
  const activeMode = useContext(MapEducationMode);
  if (!replay || mode !== activeMode) return null;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Map Help, replay Maps tour" testID="maps-help" style={styles.help} onPress={() => replay.current?.()}><Text style={styles.helpText}>Map Help</Text></TouchableOpacity>;
}

export function MapsEducation({ mode, onShowMap, autoStart = true }: { mode: 'grounds' | 'tented' | 'rv' | 'entrances'; onShowMap: (mode: 'grounds' | 'tented' | 'rv' | 'entrances') => void; autoStart?: boolean }) {
  const replay = useContext(MapEducationReplay)!;
  const anchors = useContext(MapEducationAnchors)!;
  const state = useEducation('mapsTourSeen', true, autoStart);
  const [step, setStep] = useState(0);
  const startingMode = useRef(mode);
  const wasVisible = useRef(false);
  const definition = MAP_TOUR_STEPS[step];
  useEffect(() => {
    if (state.visible) {
      if (!wasVisible.current) startingMode.current = mode;
      onShowMap(definition.map);
    }
    wasVisible.current = state.visible;
  }, [state.visible, definition.map, mode, onShowMap]);
  const dismiss = () => { state.dismiss(); onShowMap(startingMode.current); setStep(0); };
  replay.current = () => { setStep(0); state.replay(); };
  return <>
    {state.visible ? <EducationCallout title={definition.title} body={definition.body}
      progress={`${step + 1} of ${MAP_TOUR_STEPS.length}`} target={mode === definition.map ? anchors.current[definition.target] : null}
      fallback={anchors.current[definition.map]} onNext={step < MAP_TOUR_STEPS.length - 1 ? () => setStep(step + 1) : undefined} onDismiss={dismiss} /> : null}
  </>;
}

export function FindOnMapTip({ kind, eligible, children }: { kind: 'scheduleFindOnMapTipSeen' | 'vendorFindOnMapTipSeen'; eligible: boolean; children: React.ReactNode }) {
  const anchor = useRef<View>(null);
  const { height } = useWindowDimensions();
  const pathname = usePathname();
  const focused = pathname.endsWith(kind === 'scheduleFindOnMapTipSeen' ? '/schedule' : '/vendors');
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!eligible || !focused) { setInView(false); return; }
    const check = () => anchor.current?.measureInWindow((x, y, w, h) => setInView(w > 0 && h > 0 && y >= 0 && y + h < height - 60));
    check(); const timer = setInterval(check, 400); return () => clearInterval(timer);
  }, [eligible, height, focused]);
  const state = useEducation(kind, eligible && inView);
  const event = kind === 'scheduleFindOnMapTipSeen';
  return <View ref={anchor} collapsable={false}>
    {children}
    {state.visible ? <EducationCallout target={anchor.current} title={event ? 'Find this event' : 'Find this vendor'}
      body={event ? 'Tap here to see exactly where this event is on the map.' : "Tap here to jump directly to this vendor’s location on the map."} onDismiss={state.dismiss} /> : null}
  </View>;
}
// Schedule-only bridge between the introduction and the existing location education.
export function ScheduleEventDetailsTip({ eligible, onOpen, children }: {
  eligible: boolean; onOpen: () => void; children: React.ReactNode;
}) {
  const anchor = useRef<View>(null);
  const { height } = useWindowDimensions();
  const [stable, setStable] = useState(false);
  useEffect(() => {
    setStable(false);
    if (!eligible) return;
    // Wait beyond the introduction's fade, then require a fully visible card.
    const timer = setTimeout(() => anchor.current?.measureInWindow((x, y, w, h) => {
      setStable(w > 0 && h > 0 && y >= 0 && y + h < height - 60);
    }), 500);
    return () => clearTimeout(timer);
  }, [eligible, height]);
  const state = useEducation('scheduleEventDetailsTipSeen', eligible && stable);
  return <View ref={anchor} collapsable={false}>
    {children}
    {state.visible ? <EducationCallout target={anchor.current} title="View event details"
      body="Tap an event to see its time, description and location." onDismiss={state.dismiss}
      onTargetPress={() => { state.dismiss(); onOpen(); }} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(15,23,42,0.48)' },
  spotlight: { position: 'absolute', borderWidth: 3, borderColor: '#FBBF24', borderRadius: 10 },
  card: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', overflow: 'hidden' },
  content: { padding: 18, gap: 10 },
  progress: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  body: { fontSize: 16, lineHeight: 23, color: '#374151' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  primary: { minHeight: 44, minWidth: 80, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B1538', borderRadius: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondary: { minHeight: 44, padding: 12, justifyContent: 'center' },
  secondaryText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  help: { flexShrink: 0, width: 94, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#8B1538', alignItems: 'center', justifyContent: 'center' },
  helpText: { color: '#8B1538', fontWeight: '700', fontSize: 14 },
});
