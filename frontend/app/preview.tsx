import { Redirect } from 'expo-router';

export default function PreviewRoot() {
  // This handles the theipm.ca/preview URL and sends it to the folder
  return <Redirect href="/preview-2026" />;
}
