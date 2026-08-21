export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';
export type InstallBrowser = 'safari' | 'chrome' | 'samsung_internet' | 'edge' | 'firefox' | 'other';
export type InstallState = 'installed' | 'install_prompt_available' | 'manual_install_required' | 'unsupported_or_unknown';
export type DeviceFamily = 'samsung' | null;

export type InstallEnvironment = {
  platform: InstallPlatform;
  browser: InstallBrowser;
  installState: InstallState;
  deviceFamily: DeviceFamily;
};

export type InstallGuidance = {
  heading: string;
  intro: string;
  steps: InstallStep[];
  primaryLabel: string | null;
};

export type InstallStepCue = 'more_vertical' | 'menu' | 'share' | 'add_home' | 'install' | 'safari' | 'address_bar';
export type InstallStep = { cue: InstallStepCue; title: string; hint: string };

export const INSTALL_DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type InstallGatewayDecisionInput = {
  environment: InstallEnvironment;
  initialPath: string;
  installedHint: boolean;
  returningVisitor: boolean;
  dismissedAt: string | null;
  now: number;
  storageReadable: boolean;
};

export function isOrdinaryInstallEntryPath(pathname: string): boolean {
  return pathname === '' || pathname === '/';
}

export function detectStandaloneSignals({
  displayModeStandalone = false,
  navigatorStandalone = false,
  referrer = '',
} = {}): boolean {
  return displayModeStandalone || navigatorStandalone || referrer.startsWith('android-app://');
}

export function shouldShowInstallGateway({
  environment,
  initialPath,
  installedHint,
  returningVisitor,
  dismissedAt,
  now,
  storageReadable,
}: InstallGatewayDecisionInput): boolean {
  if (!storageReadable) return false;
  if (environment.installState === 'installed' || installedHint) return false;
  if (!isOrdinaryInstallEntryPath(initialPath)) return false;
  if (environment.installState === 'unsupported_or_unknown') return false;
  if (returningVisitor) return false;
  return isInstallGuidanceEligible(dismissedAt, now);
}

export function isInstallGuidanceEligible(dismissedAt: string | null, now: number): boolean {
  if (dismissedAt === null) return true;
  const dismissedTime = Number(dismissedAt);
  if (!Number.isFinite(dismissedTime) || dismissedTime <= 0) return true;
  return now - dismissedTime >= INSTALL_DISMISS_COOLDOWN_MS;
}

export function detectInstallEnvironment({
  userAgent = '', platformHint = '', maxTouchPoints = 0, standalone = false, nativePromptAvailable = false,
}: {
  userAgent?: string; platformHint?: string; maxTouchPoints?: number; standalone?: boolean; nativePromptAvailable?: boolean;
}): InstallEnvironment {
  const ua = userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (platformHint === 'MacIntel' && maxTouchPoints > 1);
  const android = /android/.test(ua);
  const platform: InstallPlatform = ios ? 'ios' : android ? 'android' : ua ? 'desktop' : 'unknown';
  let browser: InstallBrowser = 'other';
  if (/samsungbrowser\//.test(ua)) browser = 'samsung_internet';
  else if (/edgios|edga|edg\//.test(ua)) browser = 'edge';
  else if (/fxios|firefox\//.test(ua)) browser = 'firefox';
  else if (/crios|chrome\//.test(ua)) browser = 'chrome';
  else if (ios && /safari\//.test(ua)) browser = 'safari';
  else if (!ios && /safari\//.test(ua) && !/chromium|opr\//.test(ua)) browser = 'safari';

  const deviceFamily: DeviceFamily = android && /\b(?:samsung|sm-[a-z0-9]+)/.test(ua) ? 'samsung' : null;
  const installState: InstallState = standalone
    ? 'installed'
    : nativePromptAvailable
      ? 'install_prompt_available'
      : platform === 'unknown'
        ? 'unsupported_or_unknown'
        : 'manual_install_required';
  return { platform, browser, installState, deviceFamily };
}

export function getInstallGuidance(environment: InstallEnvironment): InstallGuidance {
  if (environment.installState === 'installed') return { heading: '', intro: '', steps: [], primaryLabel: null };
  if (environment.installState === 'install_prompt_available') {
    const browserName = environment.browser === 'samsung_internet' ? 'Samsung Internet' : environment.browser === 'edge' ? 'Edge' : environment.browser === 'chrome' ? 'Chrome' : null;
    return {
      heading: environment.platform === 'desktop' && browserName ? `Install the IPM App in ${browserName}` : 'Install the IPM App',
      intro: 'Tap the button below. Your browser will do the rest—no menus needed.', steps: [], primaryLabel: 'Install IPM App',
    };
  }
  if (environment.platform === 'ios' && environment.browser === 'safari') {
    return { heading: 'Install the IPM App on your iPhone', intro: 'Follow these three taps in Safari.', steps: [
      { cue: 'share', title: 'Tap the Share button', hint: 'Look for the box with the arrow pointing up. If it is hidden, tap •••, then “Share.”' },
      { cue: 'add_home', title: 'Tap “Add to Home Screen”', hint: 'Scroll down the list. If it is missing, tap “Edit Actions” to add it.' },
      { cue: 'install', title: 'Tap “Add”', hint: 'If “Open as Web App” appears, leave it on. The IPM App will appear on your Home Screen.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'ios') {
    const browserName = environment.browser === 'chrome' ? 'Chrome' : environment.browser === 'edge' ? 'Edge' : environment.browser === 'firefox' ? 'Firefox' : 'this browser';
    return { heading: 'Open IPM in Safari to install it', intro: `iPhone installation works reliably from Safari, not ${browserName}.`, steps: [
      { cue: 'safari', title: 'Open this page in Safari', hint: 'Copy this page’s address, open Safari, and paste it into the address bar.' },
      { cue: 'share', title: 'Tap the Share button', hint: 'In Safari, look for the box with the arrow pointing up.' },
      { cue: 'add_home', title: 'Choose “Add to Home Screen,” then confirm', hint: 'Tap “Add” to put the IPM App on your Home Screen.' },
    ], primaryLabel: null };
  }
  if (environment.browser === 'samsung_internet') {
    return { heading: 'Install the IPM App on your Samsung', intro: 'Follow these steps in Samsung Internet.', steps: [
      { cue: 'menu', title: 'Tap the Menu button', hint: 'Look for ☰ at the bottom-right of Samsung Internet.' },
      { cue: 'add_home', title: 'Tap “Add page to”', hint: 'On some versions, you may see “Add to” instead.' },
      { cue: 'install', title: 'Tap “Home screen”', hint: 'Confirm if Samsung asks. The IPM App will appear with your other apps.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'android' && environment.browser === 'chrome') {
    return { heading: 'Install the IPM App in Chrome', intro: 'Follow these three taps in Chrome.', steps: [
      { cue: 'more_vertical', title: 'Tap the three dots', hint: 'Look for ⋮ in the top-right corner of Chrome.' },
      { cue: 'add_home', title: 'Tap “Add to Home screen”', hint: 'Chrome may show “Install app” directly instead—choose that if you see it.' },
      { cue: 'install', title: 'Tap “Install app,” then “Install”', hint: 'The IPM App will appear on your phone like your other apps.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'android') {
    return { heading: 'Install the IPM App on Android', intro: 'Your browser may support adding the app to your phone.', steps: [
      { cue: 'more_vertical', title: 'Find your browser’s menu', hint: 'Look for ⋮ near the top or ☰ near the bottom of the screen.' },
      { cue: 'add_home', title: 'Look for an install choice', hint: 'Tap “Install app” or “Add to Home screen.”' },
      { cue: 'install', title: 'Follow the confirmation', hint: 'If no install choice appears, open this page in Chrome and try again.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'desktop' && environment.browser === 'chrome') {
    return { heading: 'Install the IPM App in Chrome', intro: 'Add IPM 2026 to your computer in three clicks.', steps: [
      { cue: 'more_vertical', title: 'Click the three dots', hint: 'They’re in the top-right corner of Chrome.' },
      { cue: 'add_home', title: 'Open “Cast, save, and share”', hint: 'Then click “Install page as app…” You may also see an install icon in the address bar.' },
      { cue: 'install', title: 'Click “Install”', hint: 'The IPM App will open and be available like your other computer apps.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'desktop' && environment.browser === 'edge') {
    return { heading: 'Install the IPM App in Edge', intro: 'Add IPM 2026 to your computer in three clicks.', steps: [
      { cue: 'more_vertical', title: 'Click the three dots', hint: 'Look for … in the top-right corner of Edge.' },
      { cue: 'add_home', title: 'Open “More tools,” then “Apps”', hint: 'Click “Install this site as an app.”' },
      { cue: 'install', title: 'Click “Install”', hint: 'The IPM App will be available like your other computer apps.' },
    ], primaryLabel: null };
  }
  if (environment.platform === 'desktop') {
    return { heading: 'Install the IPM App on your computer', intro: 'Your browser may support installing this app.', steps: [
      { cue: 'more_vertical', title: 'Find your browser’s menu', hint: 'Look for ⋮ or ☰ near the top-right corner.' },
      { cue: 'add_home', title: 'Look for an install choice', hint: 'Choose “Install app” or “Add to Home screen.”' },
      { cue: 'install', title: 'Follow the confirmation', hint: 'Your browser will tell you when the app is ready.' },
    ], primaryLabel: null };
  }
  return { heading: 'Welcome to the IPM App', intro: 'You can use the app now. Installation is optional.', steps: [
    { cue: 'more_vertical', title: 'Find your browser’s menu', hint: 'Look for ⋮ or ☰ near the top or bottom of the screen.' },
    { cue: 'add_home', title: 'Look for an install choice', hint: 'It may say “Install app” or “Add to Home screen.”' },
    { cue: 'install', title: 'Follow the confirmation', hint: 'If you do not see an install choice, simply continue to the app below.' },
  ], primaryLabel: null };
}
