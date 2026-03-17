// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
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
  hasUserLocation?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  location,
  onGetDirections,
  hasUserLocation = false,
}) => {
  if (!location) return null;

  const vendor = getVendorByLocationId(location.id);
  const sessions = getSessionsByLocationId(location.id);
  const typeColor = getLocationTypeColor(location.type);
  const typeIcon = getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTypeLabel = (type: string, utilitySubtype?: string, fieldSubtype?: string) => {
    if (type === 'utility' && utilitySubtype) {
      switch (utilitySubtype) {
        case 'food':
          return 'Food & Drinks';
        case 'restroom':
          return 'Restrooms';
        case 'info':
          return 'Information';
        case 'medical':
          return 'First Aid';
        case 'parking':
          return 'Parking';
        default:
          return 'Utility';
      }
    }
    if (type === 'field' && fieldSubtype) {
      switch (fieldSubtype) {
        case 'plowing':
          return 'Plowing Field';
        case 'demo':
          return 'Demonstration Area';
        case 'competition':
          return 'Competition Arena';
        default:
          return 'Field';
      }
    }
    switch (type) {
      case 'stage':
        return 'Stage';
      case 'vendor':
        return 'Exhibitor';
      case 'field':
        return 'Field';
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
                    {getTypeLabel(location.type, location.utilitySubtype, location.fieldSubtype)}
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
                <Text style={styles.sectionTitle}>Scheduled Events</Text>
                {sessions.map((session) => (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionTime}>
                      <Feather name="clock" size={14} color={colors.accent} />
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
                style={[
                  styles.directionsButton,
                  !hasUserLocation && styles.directionsButtonDisabled,
                ]}
                onPress={onGetDirections}
                activeOpacity={0.8}
              >
                <Feather name="navigation" size={20} color="#FFFFFF" />
                <Text style={styles.directionsButtonText}>Take Me There</Text>
              </TouchableOpacity>
              {!hasUserLocation && (
                <Text style={styles.locationHint}>
                  Enable location services for directions
                </Text>
              )}
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
    borderRadius: 28,
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
    color: colors.accent,
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
    borderRadius: 50,
  },
  directionsButtonDisabled: {
    backgroundColor: colors.surfaceHighlight,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default BottomSheet;
