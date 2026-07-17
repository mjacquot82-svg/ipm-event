import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import { ATTENDEE_CARD_RADIUS } from '../theme/attendeePageLayout';
import { Announcement } from '../services/spreadsheetDataService';

const PRIORITY_ORDER: Record<Announcement['priority'], number> = {
  Emergency: 0,
  Important: 1,
  Information: 2,
};

export function getVisibleAnnouncements(announcements: Announcement[], now = Date.now()) {
  return announcements
    .filter((announcement) => {
      if (announcement.status !== 'published') return false;
      if (!announcement.expires_at) return true;
      const expiry = new Date(announcement.expires_at).getTime();
      return !Number.isNaN(expiry) && expiry > now;
    })
    .sort((a, b) => {
      const priorityDifference = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return priorityDifference || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function formatAnnouncementTime(value: string, includeDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Posted recently';
  if (includeDate) {
    return `Posted ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  }
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Posted just now';
  if (elapsedMinutes < 60) return `Posted ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Posted ${elapsedHours}h ago`;
  return `Posted ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export default function AnnouncementCard({
  announcement,
  preview = false,
  onPress,
  unread = false,
}: {
  announcement: Announcement;
  preview?: boolean;
  onPress?: () => void;
  unread?: boolean;
}) {
  const isEmergency = announcement.priority === 'Emergency';
  const isImportant = announcement.priority === 'Important';
  const content = (
    <>
      <View style={styles.headingRow}>
        <View style={styles.badgeGroup}>
          {unread && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
          <View style={[styles.badge, isEmergency && styles.emergencyBadge, isImportant && styles.importantBadge]}>
            <Feather name={isEmergency ? 'alert-triangle' : isImportant ? 'alert-circle' : 'info'} size={13} color={isEmergency ? '#FFFFFF' : colors.textPrimary} />
            <Text style={[styles.badgeText, isEmergency && styles.emergencyBadgeText]}>{announcement.priority}</Text>
          </View>
        </View>
        <Text style={styles.posted}>{formatAnnouncementTime(announcement.created_at, !preview)}</Text>
      </View>
      <Text style={styles.title}>{announcement.title}</Text>
      <Text style={styles.message} numberOfLines={preview ? 3 : undefined}>{announcement.message}</Text>
      {preview && <Feather name="chevron-right" size={20} color={colors.textMuted} style={styles.chevron} />}
    </>
  );

  const cardStyle = [styles.card, unread && styles.unreadCard, isEmergency && styles.emergencyCard, isImportant && styles.importantCard];
  return onPress ? <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity> : <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: ATTENDEE_CARD_RADIUS, borderWidth: 1, padding: 16, position: 'relative' },
  unreadCard: { backgroundColor: '#FFFCF3', borderColor: '#D8B866' },
  emergencyCard: { backgroundColor: '#FFF5F5', borderColor: colors.error, borderLeftWidth: 5 },
  importantCard: { backgroundColor: '#FFFBEB', borderColor: '#D97706', borderLeftWidth: 4 },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  badgeGroup: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 7 },
  newBadge: { backgroundColor: '#EFE4C3', borderColor: '#D8B866', borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  newBadgeText: { color: '#735B1B', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  badge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surfaceHighlight, borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  emergencyBadge: { backgroundColor: colors.error },
  importantBadge: { backgroundColor: '#FDE68A' },
  badgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  emergencyBadgeText: { color: '#FFFFFF' },
  posted: { color: colors.textMuted, fontSize: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', paddingRight: 20 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 7 },
  chevron: { position: 'absolute', right: 12, top: 52 },
});
