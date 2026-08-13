import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { queenOfTheFurrowEntries, QueenOfTheFurrowEntry } from '../../src/data/queenOfTheFurrow';
import colors from '../../src/theme/colors';
import {
  ATTENDEE_DESKTOP_BREAKPOINT,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';

export default function QueenOfTheFurrowScreen() {
  usePageAnalytics('queen_archive', 'home_quick_action', 'queen_archive_opened');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sectionStyle } = useAttendeeLayout();
  const isDesktop = width >= ATTENDEE_DESKTOP_BREAKPOINT;
  const mobilePhotoWidth = Math.min(Math.max(width - 42, 0), 280);

  const renderQueen = useCallback<ListRenderItem<QueenOfTheFurrowEntry>>(({ item }) => (
    <View style={[styles.card, isDesktop && styles.cardDesktop]}>
      <View style={[styles.imagePanel, isDesktop && styles.imagePanelDesktop]}>
        <Image
          source={item.image}
          style={[
            styles.photo,
            isDesktop
              ? styles.photoDesktop
              : { width: mobilePhotoWidth, height: mobilePhotoWidth / item.imageAspectRatio },
          ]}
          resizeMode="contain"
          accessible
          accessibilityLabel={`Photograph of ${item.name}${item.year ? `, Queen of the Furrow ${item.year}` : ''}`}
        />
      </View>
      <View style={[styles.details, isDesktop && styles.detailsDesktop]}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="crown-outline" size={24} color={colors.accentDark} />
          <View style={styles.titleText}>
            <Text style={styles.name}>{item.name}</Text>
            {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
          </View>
        </View>
        <View style={styles.rule} />
        <Text style={styles.blurb}>{item.blurb}</Text>
      </View>
    </View>
  ), [isDesktop, mobilePhotoWidth]);

  return (
    <View style={styles.container}>
      <FlatList
        data={queenOfTheFurrowEntries}
        renderItem={renderQueen}
        keyExtractor={(item) => item.name}
        contentContainerStyle={[attendeePageContent, styles.list]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={(
          <View style={sectionStyle}>
            <View style={styles.navigationRow}>
              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => router.push('/')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Return to Home"
              >
                <Feather name="arrow-left" size={19} color={colors.primary} />
                <Text style={styles.homeButtonText}>Home</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="crown-outline" size={34} color={colors.accentDark} />
              </View>
              <Text style={styles.eyebrow}>IPM ARCHIVE</Text>
              <Text style={styles.pageTitle}>Queen of the Furrow</Text>
            </View>
          </View>
        )}
        ListHeaderComponentStyle={styles.headerSpacing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20 },
  headerSpacing: { marginBottom: 20 },
  navigationRow: { paddingTop: 10, alignItems: 'flex-start' },
  homeButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4D6',
    marginBottom: 12,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  pageTitle: { color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  card: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardDesktop: { flexDirection: 'row', minHeight: 420, marginBottom: 20 },
  imagePanel: { width: '100%', backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' },
  imagePanelDesktop: { width: '42%', minWidth: 320 },
  photo: { width: '100%' },
  photoDesktop: { height: '100%' },
  details: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  detailsDesktop: { flex: 1, paddingHorizontal: 30, paddingVertical: 28, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleText: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  year: { color: colors.accentDark, fontSize: 15, fontWeight: '700', marginTop: 3 },
  rule: { width: 48, height: 3, borderRadius: 2, backgroundColor: colors.accent, marginVertical: 16 },
  blurb: { color: colors.textSecondary, fontSize: 16, lineHeight: 26 },
});
