export type OfflineShellStatus = {
  bundleIdentity: string;
  cachedShellVersions: string[];
  controllingShellVersion: string;
  updateWaiting: boolean;
  startupTimings: { name: string; milliseconds: number }[];
};

const unsupported: OfflineShellStatus = {
  bundleIdentity: 'native',
  cachedShellVersions: [],
  controllingShellVersion: 'native',
  updateWaiting: false,
  startupTimings: [],
};

export async function getOfflineShellStatus() { return unsupported; }
export async function checkForOfflineShellUpdate() { return unsupported; }
export async function applyWaitingOfflineShellUpdate() { return false; }
