import React, { useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventImage, EventExternalLink } from '../services/spreadsheetDataService';

export function safeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/\s/.test(value);
  } catch { return false; }
}

export function EventDetailMedia({ image, links = [] }: { image?: EventImage | null; links?: EventExternalLink[] }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const showImage = image && image.url !== failedUrl && safeExternalUrl(image.url) && image.alt?.trim() && image.width > 0 && image.height > 0;
  const validLinks = links.filter(link => link.label?.trim() && safeExternalUrl(link.url));
  if (!showImage && !validLinks.length) return null;
  const width = showImage ? Math.min(240, image.width, 260 * image.width / image.height) : 0;
  return (
    <View style={styles.container}>
      {showImage && (Platform.OS === 'web' ? (
        <img src={image.url} alt={image.alt} loading="lazy" decoding="async"
          width={image.width} height={image.height} onError={() => setFailedUrl(image.url)}
          style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto', borderRadius: 8, alignSelf: 'center' }} />
      ) : (
        <Image source={{ uri: image.url }} accessible accessibilityLabel={image.alt}
          resizeMode="contain" onError={() => setFailedUrl(image.url)}
          style={{ width: '100%', maxWidth: width, aspectRatio: image.width / image.height, alignSelf: 'center', borderRadius: 8 }} />
      ))}
      {validLinks.map(link => Platform.OS === 'web' ? (
        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
          aria-label={`${link.label} (opens in a new tab)`}
          style={{ color: '#155e45', fontSize: 16, lineHeight: '24px', padding: '12px 0', overflowWrap: 'anywhere', textDecoration: 'underline' }}>
          {link.label} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <Pressable key={link.url} accessibilityRole="link" accessibilityLabel={link.label}
          accessibilityHint="Opens in your browser" style={styles.link}
          onPress={() => { setLinkError(false); Linking.openURL(link.url).catch(() => setLinkError(true)); }}>
          <Text style={styles.linkText}>{link.label} ↗</Text>
        </Pressable>
      ))}
      {linkError && <Text accessibilityRole="alert">The link could not be opened. Please try again.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8, gap: 12 },
  link: { paddingVertical: 12, minHeight: 48 },
  linkText: { color: '#155e45', fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' },
});
