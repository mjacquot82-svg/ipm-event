export type OfflineShellStatus = {
  bundleIdentity: string;
  cachedShellVersions: string[];
  controllingShellVersion: string;
  updateWaiting: boolean;
};

const unsupported: OfflineShellStatus = {
  bundleIdentity: 'native',
  cachedShellVersions: [],
  controllingShellVersion: 'native',
  updateWaiting: false,
};

export async function getOfflineShellStatus() { return unsupported; }
export async function checkForOfflineShellUpdate() { return unsupported; }
export async function applyWaitingOfflineShellUpdate() { return false; }
