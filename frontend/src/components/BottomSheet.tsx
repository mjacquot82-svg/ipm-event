import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Location,
  getLocationTypeColor,
  getLocationTypeIcon,
  getVendorByLocationId,
  getSessionsByLocationId,
} from '../data/mockData';
import colors from '../theme/colors';

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  location: Location | null;
  onGetDirections: () => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  location,
  onGetDirections,
}) => {
  if (!location) return null;

  const vendor = getVendorByLocationId(location.id);
  const sessions = getSessionsByLocationId(location.id);
  const typeColor = getLocationTypeColor(location.type);
  const typeIcon = getLocationTypeIcon(location.type);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stage':
        return 'Stage';
      case 'vendor':
        return 'Vendor Booth';
      case 'utility':
        return 'Utility';
      default:
        return 'Location';
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: typeColor }]}>
                <Feather name={typeIcon as any} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.locationName}>{location.name}</Text>
                <View style={styles.typeTag}>
                  <Text style={[styles.typeText, { color: typeColor }]}>
                    {getTypeLabel(location.type)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Vendor Info */}
            {vendor && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.description}>{vendor.description}</Text>
              </View>
            )}

            {/* Upcoming Sessions */}
            {sessions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
                {sessions.map((session) => (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionTime}>
                      <Feather name="clock" size={14} color={colors.primary} />
                      <Text style={styles.sessionTimeText}>
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </Text>
                    </View>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Coordinates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Coordinates</Text>
              <Text style={styles.coordinates}>
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.directionsButton}
                onPress={onGetDirections}
                activeOpacity={0.8}
              >
                <Feather name="navigation" size={20} color="#FFFFFF" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 16,
  },
  locationName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sessionCard: {
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  sessionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sessionTimeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  sessionTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  coordinates: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BottomSheet;
