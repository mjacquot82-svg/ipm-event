import type { InstallEnvironment } from './installEnvironment';

/** Display-only guidance. Never requests permission, loads a SDK, or enrolls a device. */
export function notificationHelp(environment: InstallEnvironment, state: string): string {
  if (state === 'denied') {
    if (environment.platform === 'ios') return 'Open Settings on your iPhone or iPad, then Notifications → IPM. Allow notifications, return to IPM, and check again.';
    if (environment.browser === 'safari') return 'In Safari, open Settings → Websites → Notifications and allow IPM. Also check your Mac’s notification settings, then return here.';
    if (environment.browser === 'chrome' || environment.browser === 'edge') return 'Open the site controls beside the address bar, then Site settings or Permissions. Allow notifications for IPM, then return here.';
    return 'Open your browser’s site permissions and allow notifications for IPM. Check your device’s notification settings too, then return here.';
  }
  if (environment.platform === 'ios' && environment.installState !== 'installed') {
    return 'On iPhone and iPad, notifications need iOS or iPadOS 16.4 or later and IPM opened from your Home Screen. Use the optional Home Screen help below, then open IPM from its icon. You can browse IPM here without doing this.';
  }
  return 'Notifications aren’t available in this browser or device setup. You can still use IPM and read announcements here.';
}
