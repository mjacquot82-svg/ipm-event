import { Alert, Linking } from 'react-native';

export function openExternalLink(url: string) {
  return Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', 'Please try again later.');
  });
}
