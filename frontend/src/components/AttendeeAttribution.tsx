import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { openTrackedLink } from '../analytics/trackedLinks';
import colors from '../theme/colors';

export function AttendeeAttribution({ source }: { source: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>Jacquot Digital Solutions</Text>
      <Text style={styles.location}>Walkerton, Ont.</Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Visit Jacquot Digital Solutions website"
        activeOpacity={0.7}
        onPress={() => { void openTrackedLink('jds_studio', source); }}
        style={styles.linkTarget}
      >
        <Text style={styles.link}>jdsstudio.ca</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', alignSelf: 'center', marginTop: 28, paddingBottom: 12, paddingHorizontal: 20, width: '100%' },
  name: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  location: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: 'center' },
  linkTarget: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  link: { color: colors.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
