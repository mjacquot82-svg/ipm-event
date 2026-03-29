import { Redirect } from 'expo-router';

export default function Index() {
  // This sends the user directly into your (tabs) folder
  // where your real home bar and ads are located.
  return <Redirect href="/(tabs)" />;
}
