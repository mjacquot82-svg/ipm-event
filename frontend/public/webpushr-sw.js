try {
  const webKey = new URL(self.location.href).searchParams.get('webKey');
  if (!webKey) throw new Error('Missing WonderPush Web Key');

  importScripts('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js');
  self.WonderPush = self.WonderPush || [];
  self.WonderPush.push(['init', { webKey }]);
} catch (error) {
  console.error('WonderPush service worker initialization failed:', error);
}
