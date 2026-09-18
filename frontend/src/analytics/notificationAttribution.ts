const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type HistoryStore = { state: any; replaceState: (state: any, unused: string) => void };
type NavigationStorage = Pick<Storage, 'getItem' | 'setItem'>;

// Expo Router preserves history.state.id across reload/back, but may replace
// other history fields. Keep the random visit identity in tab-scoped storage,
// keyed by that navigation entry and opaque delivery UUID. No device identifiers.
export function notificationNavigationId(deliveryRef: string | undefined,
  historyStore: HistoryStore | undefined = typeof window === 'undefined' ? undefined : window.history,
  uuid = () => globalThis.crypto.randomUUID(), storage?: NavigationStorage): string | null {
  if (!deliveryRef || !UUID.test(deliveryRef) || !historyStore) return null;
  try {
    const entryId = historyStore.state?.id;
    const saved = historyStore.state?.ipmNotificationVisit;
    if (typeof entryId === 'string' && entryId) {
      const persistent = storage ?? (typeof window === 'undefined' ? undefined : window.sessionStorage);
      if (!persistent) return null;
      const key = `ipm.notification-visit:${entryId}:${deliveryRef}`;
      const existing = persistent.getItem(key);
      if (existing && UUID.test(existing)) return existing;
      const navigation = uuid();
      persistent.setItem(key, navigation);
      return navigation;
    }
    // Non-router navigation entries can preserve the marker directly.
    if (saved?.delivery === deliveryRef && UUID.test(saved.navigation)) return saved.navigation;
    const navigation = uuid();
    historyStore.replaceState({ ...historyStore.state, ipmNotificationVisit: { delivery: deliveryRef, navigation } }, '');
    return navigation;
  } catch { return null; } // No durable identity means unavailable, never inflated.
}
