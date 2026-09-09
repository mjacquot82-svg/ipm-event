export const IPM_SHARE_PAYLOAD = Object.freeze({
  title: 'International Plowing Match 2026',
  text: 'Get schedules, maps, announcements and event information in the official IPM app.',
  url: 'https://theipm.ca',
});

type ShareBrowser = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};
export type ShareIpmResult = 'native' | 'cancelled' | 'copied' | 'manual';

// No route, account information, network request or recipient data is needed.
export async function shareIpm(
  browser: ShareBrowser = typeof navigator === 'undefined' ? {} : navigator,
): Promise<ShareIpmResult> {
  if (typeof browser.share === 'function') {
    try {
      await browser.share({ ...IPM_SHARE_PAYLOAD });
      // Resolution has platform-dependent semantics; never claim completion.
      return 'native';
    } catch (error) {
      if (error instanceof Object && 'name' in error && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    if (typeof browser.clipboard?.writeText === 'function') {
      await browser.clipboard.writeText(IPM_SHARE_PAYLOAD.url);
      return 'copied';
    }
  } catch {
    // Clipboard access can fail after native sharing consumes user activation.
  }
  return 'manual';
}
