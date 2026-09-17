import React, { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import type { EventImage } from '../services/spreadsheetDataService';

export function safeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/\s/.test(value);
  } catch { return false; }
}

export function EventDetailMedia({ image }: { image?: EventImage | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = image && image.url !== failedUrl && safeExternalUrl(image.url) && image.alt?.trim() && image.width > 0 && image.height > 0;
  if (!showImage) return null;
  const width = showImage ? Math.min(240, image.width, 260 * image.width / image.height) : 0;
  const portrait = showImage && (Platform.OS === 'web' ? (
        <img src={image.url} alt={image.alt} loading="lazy" decoding="async"
          width={image.width} height={image.height} onError={() => setFailedUrl(image.url)}
          style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto', borderRadius: 8, alignSelf: 'center' }} />
      ) : (
        <Image source={{ uri: image.url }} accessible accessibilityLabel={image.alt}
          resizeMode="contain" onError={() => setFailedUrl(image.url)}
          style={{ width: '100%', maxWidth: width, aspectRatio: image.width / image.height, alignSelf: 'center', borderRadius: 8 }} />
      ));
  return (
    <View style={styles.container}>
      {showImage && image.crop === 'top-square' ? (
        <View testID="event-image-top-crop" style={{ width: '100%', maxWidth: width, aspectRatio: 1, overflow: 'hidden', alignSelf: 'center', borderRadius: 8 }}>
          {portrait}
        </View>
      ) : portrait}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8, gap: 12 },
});
