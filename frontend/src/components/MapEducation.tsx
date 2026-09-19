import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CUE_ARROW, placeTutorialCue } from '../services/tutorialCueLayout';
import { EDUCATION_KEYS, MAP_TOUR_STEPS, type EducationKind } from '../services/mapEducationState';

// Manual Help is the only replay override in this production candidate.
export function useWalkthroughPreview() { return false; }

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
  const preview = useWalkthroughPreview();
  const previewStarted = useRef(false);
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
        if (kind === 'mapsTourSeen' && preview && !previewStarted.current && live && !owner) {
          previewStarted.current = true; owner = token; setVisible('manual'); return;
        }
        // Schedule/Vendors launch a section sequence. Their individual tips only
        // consume queued steps, so completion/skip cannot leave a surprise tip.
        if (requestedReplay) return;
        const seen = remembered.has(kind) || await AsyncStorage.getItem(EDUCATION_KEYS[kind]) === 'true';
        if (live && !seen && (!owner || owner === token)) { owner = token; setVisible('automatic'); }
      } catch { /* Unavailable storage must never block the underlying app. */ }
    };
    void check();
    const timer = setInterval(() => void check(), 700);
    return () => { live = false; clearInterval(timer); if (owner === token) owner = null; };
  }, [eligible, focused, kind, token, autoStart, requestedReplay, preview]);
  const dismiss = () => {
    remembered.add(kind);
    void AsyncStorage.setItem(EDUCATION_KEYS[kind], 'true').catch(() => {});
    setVisible(null);
    if (owner === token) owner = null;
  };
  const replay = () => { if (!owner || owner === token) { owner = token; setVisible('manual'); } };
  // Gate automatic visibility during render as well: destination arrivals must never flash a tour.
  return { visible: focused && eligible && (visible === 'manual' || (autoStart && visible === 'automatic')), dismiss, replay, skip: () => { requestedReplay?.pending.clear(); dismiss(); } };
}

export function EducationCallout({ title, body, progress, target, fallback, onNext, onDismiss, onTargetPress, onSkip, targetLabel = 'Open highlighted event details', targetTestID = 'schedule-education-open-event' }: {
  title: string; body: string; progress?: string; target?: Anchor | null; fallback?: Anchor | null;
  onNext?: () => void; onDismiss: () => void; onTargetPress?: () => void; onSkip?: () => void; targetLabel?: string; targetTestID?: string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(210);
  const [cueSize, setCueSize] = useState({ width: 112, height: 34 });
  const card = useRef<View>(null);
  const overlay = useRef<View>(null);
  const targetControl = useRef<View>(null);
  const next = useRef<View>(null);
  const dismissRef = useRef(onSkip || onDismiss); dismissRef.current = onSkip || onDismiss;
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
    const timer = setTimeout(() => ((onTargetPress ? targetControl.current || next.current : next.current) as unknown as HTMLElement)?.focus(), 80);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
      if (event.key === 'Tab') {
        const buttons = ((onTargetPress ? overlay.current : card.current) as unknown as HTMLElement)?.querySelectorAll<HTMLElement>('[role="button"]');
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
  const margin = 12, cardWidth = Math.min(340, width - margin * 2);
  const minTop = Math.max(margin, insets.top + margin), maxBottom = height - Math.max(margin, insets.bottom + margin);
  const layoutCard = (gap: number) => {
    const below = rect ? maxBottom - (rect.y + rect.height + gap) : maxBottom - minTop;
    const above = rect ? rect.y - gap - minTop : 0;
    const useBelow = !rect || below >= cardHeight || below >= above;
    const maxHeight = Math.max(80, rect ? (useBelow ? below : above) : maxBottom - minTop);
    const shownHeight = Math.min(cardHeight, maxHeight);
    const top = rect ? (useBelow ? rect.y + rect.height + gap : rect.y - gap - shownHeight) : minTop;
    const left = Math.max(margin, Math.min(width - cardWidth - margin, rect ? rect.x + rect.width / 2 - cardWidth / 2 : (width - cardWidth) / 2));
    return { top, left, maxHeight, bounds: { x: left, y: top, width: cardWidth, height: shownHeight } };
  };
  const safe = { x: insets.left + margin, y: minTop, width: width - insets.left - insets.right - margin * 2, height: maxBottom - minTop };
  let layout = layoutCard(12);
  let cue = rect && onTargetPress ? placeTutorialCue(rect, safe, layout.bounds, cueSize) : null;
  if (rect && onTargetPress && !cue) {
    // On tight phones reserve a strip between the target and the scrollable card.
    layout = layoutCard(cueSize.height + CUE_ARROW + 22);
    cue = placeTutorialCue(rect, safe, layout.bounds, cueSize);
  }
  const { top, left, maxHeight } = layout;
  return <Modal transparent animationType="none" visible onRequestClose={onSkip || onDismiss}>
    <View ref={overlay} accessibilityViewIsModal={Boolean(onTargetPress)} style={StyleSheet.absoluteFill} testID="map-education-overlay">
      {rect ? <>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: rect.y }]} />
        <View style={[styles.dim, { top: rect.y, left: 0, width: rect.x, height: rect.height }]} />
        <View style={[styles.dim, { top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height }]} />
        <View style={[styles.dim, { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 }]} />
        <View testID="map-education-spotlight" style={[styles.spotlight, { top: rect.y - 3, left: rect.x - 3, width: rect.width + 6, height: rect.height + 6 }]} />
      </> : <View style={[StyleSheet.absoluteFill, styles.dim]} />}
      {rect && onTargetPress ? <TouchableOpacity ref={targetControl} accessibilityRole="button" accessibilityLabel={targetLabel}
        testID={targetTestID} onPress={onTargetPress}
        style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.width, height: rect.height }} /> : null}
      {cue ? <View pointerEvents="none" aria-hidden={true} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <View testID="tutorial-click-cue" onLayout={({ nativeEvent: { layout: measured } }) => {
          if (measured.width !== cueSize.width || measured.height !== cueSize.height) setCueSize({ width: measured.width, height: measured.height });
        }} style={[styles.clickCue, { left: cue.x, top: cue.y }]}>
          <Text style={styles.clickCueText}>Click here</Text>
        </View>
        <View testID={`tutorial-click-arrow-${cue.side}`} style={[
          styles.clickArrow,
          cue.side === 'above' || cue.side === 'below'
            ? { left: cue.arrowX - 7, top: cue.arrowY, borderLeftWidth: 7, borderRightWidth: 7, ...(cue.side === 'above' ? { borderTopWidth: CUE_ARROW, borderTopColor: '#FBBF24' } : { borderBottomWidth: CUE_ARROW, borderBottomColor: '#FBBF24' }) }
            : { left: cue.arrowX, top: cue.arrowY - 7, borderTopWidth: 7, borderBottomWidth: 7, ...(cue.side === 'left' ? { borderLeftWidth: CUE_ARROW, borderLeftColor: '#FBBF24' } : { borderRightWidth: CUE_ARROW, borderRightColor: '#FBBF24' }) },
        ]} />
      </View> : null}
      <View ref={card} role="dialog" accessibilityLabel={title} accessibilityViewIsModal={!onTargetPress} testID="map-education-card"
        style={[styles.card, { top, left, width: cardWidth, maxHeight }]}>
        <ScrollView onContentSizeChange={(_, h) => setCardHeight(h)} contentContainerStyle={styles.content}>
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            {onNext || onSkip || onTargetPress ? <TouchableOpacity ref={onTargetPress ? next : undefined} accessibilityRole="button" accessibilityLabel="Skip tutorial" style={styles.secondary} onPress={onSkip || onDismiss}><Text style={styles.secondaryText}>Skip tutorial</Text></TouchableOpacity> : null}
            {!onTargetPress ? <TouchableOpacity ref={next} accessibilityRole="button" style={styles.primary} onPress={onNext || onDismiss}>
              <Text style={styles.primaryText}>{onNext ? 'Next' : 'Got it'}</Text>
            </TouchableOpacity> : null}
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

export function FindOnMapTip({ kind, eligible, children, onOpen }: { kind: 'scheduleFindOnMapTipSeen' | 'vendorFindOnMapTipSeen'; eligible: boolean; children: React.ReactNode; onOpen?: () => void }) {
  const anchor = useRef<View>(null);
  const requestedReplay = useContext(ContextualEducationReplay);
  const { height } = useWindowDimensions();
  const pathname = usePathname();
  const focused = pathname.endsWith(kind === 'scheduleFindOnMapTipSeen' ? '/schedule' : '/vendors');
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!eligible || !focused) { setInView(false); return; }
    const check = () => anchor.current?.measureInWindow((x, y, w, h) => {
      const visible = w > 0 && h > 0 && y >= 0 && y + h < height - 60;
      setInView(visible);
      if (!visible && requestedReplay?.pending.has(kind) && kind === 'scheduleFindOnMapTipSeen' && Platform.OS === 'web') {
        (anchor.current as unknown as HTMLElement)?.scrollIntoView?.({ block: 'center' });
      }
    });
    check(); const timer = setInterval(check, 400); return () => clearInterval(timer);
  }, [eligible, height, focused, kind, requestedReplay]);
  const state = useEducation(kind, eligible && inView);
  const event = kind === 'scheduleFindOnMapTipSeen';
  return <View ref={anchor} collapsable={false}>
    {children}
    {state.visible ? <EducationCallout target={anchor.current} title={event ? 'View event details' : 'Find this vendor'}
      body={event ? 'Here are the event’s time, date and location. Tap the highlighted location to find this event on the map.' : "Tap here to jump directly to this vendor’s location on the map."} onDismiss={state.dismiss}
      targetLabel={event ? 'Open highlighted event on map' : undefined} targetTestID={event ? 'schedule-education-open-map' : undefined}
      onTargetPress={event && onOpen ? () => { state.dismiss(); onOpen(); } : undefined} /> : null}
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
    if (Platform.OS === 'web') {
      (anchor.current as unknown as HTMLElement)?.scrollIntoView?.({ block: 'center' });
    }
    // Measure current cards rather than retaining a virtualized-list item ID.
    // Search/filter changes and scrolling can move a target after the intro fades.
    const measure = () => anchor.current?.measureInWindow((x, y, w, h) => {
      setStable(w > 0 && h > 0 && y >= 0 && y + h < height - 60);
    });
    const timer = setTimeout(measure, 500);
    const interval = setInterval(measure, 700);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [eligible, height]);
  const state = useEducation('scheduleEventDetailsTipSeen', eligible && stable);
  return <View ref={anchor} collapsable={false}>
    {children}
    {state.visible ? <EducationCallout target={anchor.current} title="Tap an event"
      body="Tap the highlighted event to see its time, description and location." onDismiss={state.skip}
      onTargetPress={() => { state.dismiss(); onOpen(); }} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  clickCue: { position: 'absolute', width: 112, minHeight: 34, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#FBBF24' },
  clickCueText: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  clickArrow: { position: 'absolute', width: 0, height: 0, borderColor: 'transparent', borderStyle: 'solid' },
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

// Schedule arrival guidance is separate from the approved Maps tour and its completion state.
export function ScheduleMapArrival({ token, title, onComplete }: { token?: string; title?: string; onComplete: () => void }) {
  const pathname = usePathname();
  const [completed, setCompleted] = useState<string>();
  if (!token || completed === token || !pathname.endsWith('/map')) return null;
  return <EducationCallout title="Find this event"
    body={`${title || 'Your event'} is highlighted on the map. Use the map to find its location.`}
    onDismiss={() => { setCompleted(token); onComplete(); }} />;
}
