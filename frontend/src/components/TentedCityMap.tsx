// Staging Tented City map: search a vendor or stage, highlight the plot.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import tentedCityVendors from '../data/tentedCityVendors.json';
import { findTentedCityVenue, tentedCityVenues, TentedCityVenue } from '../config/tentedCityVenues';
import { getScheduleData, ScheduleEvent } from '../services/spreadsheetDataService';

type VendorHit = {
  name: string;
  category: string;
  tent: string | null;
  locationLabel: string;
  booths: string[];
  rect: { x: number; y: number; w: number; h: number } | null;
};

type Hit =
  | { kind: 'vendor'; vendor: VendorHit }
  | { kind: 'stage'; venue: TentedCityVenue };

const vendors = tentedCityVendors as VendorHit[];

function norm(s: string) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokensMatch(hay: string, needle: string) {
  const h = ` ${norm(hay)} `;
  const n = norm(needle);
  if (!n) return true;
  if (n.length <= 3) return h.includes(` ${n} `) || h.includes(` ${n}-`) || h.endsWith(` ${n} `);
  return norm(hay).includes(n);
}

export default function TentedCityMap({
  initialQuery = '',
}: {
  initialQuery?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [selected, setSelected] = useState<Hit | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    if (initialQuery) {
      const venue = findTentedCityVenue(initialQuery);
      if (venue) {
        setSelected({ kind: 'stage', venue });
        setQuery(venue.label);
        return;
      }
      const vendor = vendors.find((v) => tokensMatch(v.name, initialQuery) || tokensMatch(v.locationLabel, initialQuery));
      if (vendor) setSelected({ kind: 'vendor', vendor });
    }
  }, [initialQuery]);

  useEffect(() => {
    let alive = true;
    void getScheduleData({ preferCache: true })
      .then((result) => {
        if (alive) setEvents(result.data.events || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    const hits: Hit[] = [];
    for (const venue of tentedCityVenues) {
      if (!q || venue.names.some((n) => tokensMatch(n, q)) || tokensMatch(venue.label, q)) {
        hits.push({ kind: 'stage', venue });
      }
    }
    for (const vendor of vendors) {
      if (!q || tokensMatch(vendor.name, q) || tokensMatch(vendor.locationLabel, q) || vendor.booths.some((b) => tokensMatch(b, q))) {
        hits.push({ kind: 'vendor', vendor });
      }
    }
    return hits.slice(0, 40);
  }, [query]);

  const highlightRect =
    selected?.kind === 'vendor'
      ? selected.vendor.rect
      : selected?.kind === 'stage'
        ? selected.venue.rect
        : null;

  const stageEvents = useMemo(() => {
    if (selected?.kind !== 'stage') return [];
    const names = new Set(selected.venue.names.map(norm));
    return events.filter((e) => e.location_name && names.has(norm(e.location_name))).slice(0, 8);
  }, [events, selected]);

  const title =
    selected?.kind === 'vendor'
      ? selected.vendor.name
      : selected?.kind === 'stage'
        ? selected.venue.label
        : 'Tented City';
  const subtitle =
    selected?.kind === 'vendor'
      ? `${selected.vendor.locationLabel} · ${selected.vendor.category}`
      : selected?.kind === 'stage'
        ? selected.venue.note || 'Stage'
        : 'Search a vendor, booth, or stage';

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search vendors, booths, or stages"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (results[0]) {
              setSelected(results[0]);
              Keyboard.dismiss();
            }
          }}
        />
      </View>

      {query.trim().length > 0 && (
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {results.map((hit, i) => {
            const key = hit.kind === 'vendor' ? hit.vendor.name + i : hit.venue.id;
            const name = hit.kind === 'vendor' ? hit.vendor.name : hit.venue.label;
            const meta = hit.kind === 'vendor' ? hit.vendor.locationLabel : 'Stage';
            return (
              <TouchableOpacity
                key={key}
                style={styles.resultRow}
                onPress={() => {
                  setSelected(hit);
                  setQuery(name);
                  Keyboard.dismiss();
                }}
              >
                <Feather name={hit.kind === 'stage' ? 'mic' : 'shopping-bag'} size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.resultMeta}>{meta}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {results.length === 0 ? <Text style={styles.empty}>No matching vendors or stages.</Text> : null}
        </ScrollView>
      )}

      <View style={styles.mapFrame}>
        <Image
          source={{ uri: 'https://raw.githubusercontent.com/mjacquot82-svg/ipm-event/add-tented-city-map/tented-city/map.png' }}
          style={styles.mapImage}
          resizeMode="contain"
        />
        {highlightRect ? (
          <View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                left: `${highlightRect.x}%`,
                top: `${highlightRect.y}%`,
                width: `${highlightRect.w}%`,
                height: `${highlightRect.h}%`,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
        {stageEvents.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.eventsHeader}>On the schedule</Text>
            {stageEvents.map((e) => (
              <Text key={e.id} style={styles.eventLine} numberOfLines={1}>
                {e.start_time ? `${e.start_time} · ` : ''}{e.title}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 10 },
  results: { maxHeight: 160, marginHorizontal: 16, marginTop: 6, backgroundColor: '#FFF', borderRadius: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6B7280' },
  empty: { padding: 12, color: '#6B7280' },
  mapFrame: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#C9B896' },
  mapImage: { width: '100%', height: '100%' },
  highlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#F5C518',
    backgroundColor: 'rgba(166,38,45,0.35)',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  eventsHeader: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  eventLine: { fontSize: 13, color: '#374151', marginTop: 2 },
});
