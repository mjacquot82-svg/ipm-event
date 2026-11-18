import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formatDollars, orderTotalCents, submitManualGlassesOrder } from '../services/volunteerGlassesService';

const STYLES = { colored_logo: 'Colored Logo', large_etched: 'Large Etched', short_etched: 'Short Etched' };
const STORAGE_KEY = 'volunteer-glasses-pending-manual-order-v1';
type PendingOrder = Parameters<typeof submitManualGlassesOrder>[1];

// Keep the exact request through a lost response or a page reload. Never store the password.
function persist(order: PendingOrder | null) {
  if (Platform.OS === 'web') {
    if (order) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export default function ManualGlassesOrderForm({ password, onSaved, styles }: {
  password: string; onSaved: () => Promise<void>; styles: any;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({ colored_logo: '0', large_etched: '0', short_etched: '0' });
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);

  useEffect(() => {
    try {
      const raw = Platform.OS === 'web' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved: PendingOrder = JSON.parse(raw);
        setPending(saved); setName(saved.name); setContact(saved.contact); setNotes(saved.notes || '');
        setQuantities(Object.fromEntries(Object.entries(saved.quantities).map(([id, q]) => [id, String(q)])));
        setMessage('An order is awaiting confirmation. Retry it to safely check or complete the save.');
      }
      setReady(true);
    } catch { setError('Browser storage is unavailable. Enable it before adding an order.'); }
  }, []);

  const save = async () => {
    if (saving.current || !ready) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    let request = pending;
    try {
      if (!request) {
        const clean = Object.fromEntries(Object.entries(quantities).map(([id, q]) => [id, Number(q)]));
        if (!name.trim() || contact.trim().length < 3) throw new Error('Enter a name and contact information.');
        if (Object.values(quantities).some(q => !/^\d+$/.test(q)) || Object.values(clean).some(q => q > 50) || !Object.values(clean).some(q => q > 0)) {
          throw new Error('Choose at least one set. Each style must be a whole number from 0 to 50.');
        }
        // This screen is served over HTTPS; use the browser's UUID generator.
        request = { request_id: globalThis.crypto.randomUUID(), name: name.trim(), contact: contact.trim(), notes: notes.trim(), quantities: clean };
        persist(request); // If storage fails, do not send a request that cannot be safely retried.
        setPending(request);
      }
      const result = await submitManualGlassesOrder(password, request);
      persist(null);
      setPending(null); setName(''); setContact(''); setNotes('');
      setQuantities({ colored_logo: '0', large_etched: '0', short_etched: '0' });
      setMessage(`Order saved: ${result.total_sets} sets, ${formatDollars(result.total_cents)}. Cash payment at pickup.`);
      try { await onSaved(); }
      catch { setError('Order saved, but the list could not refresh. Reload the page to view it.'); }
    } catch (e) {
      const failure = e as Error & { status?: number };
      // Validation is definitive: nothing was inserted. All uncertain failures retain the request.
      if (failure.status === 422) {
        try { persist(null); setPending(null); } catch { /* retain for a safe retry */ }
      }
      setError(request && failure.status !== 422
        ? 'Save not confirmed. Retry this same order; it will not be added twice. ' + failure.message
        : failure.message);
    } finally { saving.current = false; setBusy(false); }
  };

  const locked = busy || !!pending || !ready;
  const total = orderTotalCents(Object.fromEntries(Object.entries(quantities).map(([id, q]) => [id, Number(q)])));
  return <View style={styles.row}>
    <Text style={styles.total}>Add a late order</Text>
    <Text style={styles.body}>Owner entry only. Public ordering stays closed. $16 per set of two; cash payment at pickup.</Text>
    <TextInput style={styles.input} accessibilityLabel="Order name" placeholder="Name" value={name} onChangeText={setName} maxLength={120} editable={!locked} />
    <TextInput style={styles.input} accessibilityLabel="Order contact" placeholder="Email or phone" value={contact} onChangeText={setContact} maxLength={160} editable={!locked} />
    {Object.entries(STYLES).map(([id, label]) => <View key={id}>
      <Text style={styles.body}>{label} sets (0–50)</Text>
      <TextInput style={styles.input} accessibilityLabel={`${label} sets`} value={quantities[id]} onChangeText={q => setQuantities(previous => ({ ...previous, [id]: q }))} keyboardType="number-pad" maxLength={2} editable={!locked} />
    </View>)}
    <TextInput style={styles.input} accessibilityLabel="Order notes" placeholder="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={500} editable={!locked} />
    <Text style={styles.total}>Order total: {formatDollars(total)}</Text>
    <TouchableOpacity style={[styles.button, (busy || !ready) && { opacity: 0.5 }]} accessibilityRole="button" disabled={busy || !ready} onPress={save}>
      <Text style={styles.buttonText}>{busy ? 'Saving…' : pending ? 'Retry same order' : 'Save order'}</Text>
    </TouchableOpacity>
    {message ? <Text style={styles.body} accessibilityLiveRegion="polite">{message}</Text> : null}
    {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
  </View>;
}
