export type WorkerStartupDiagnostic = {
  workerBootStarted?: number;
  wonderPushImportStarted?: number;
  wonderPushImportFinished?: number | null;
  lastNavigation?: {
    receivedAt: number;
    selectedAt: number;
    respondedAt: number;
    strategy: string;
    cacheHit: boolean;
  } | null;
};

export type OfflineShellStatus = {
  bundleIdentity: string;
  cachedShellVersions: string[];
  controllingShellVersion: string;
  updateWaiting: boolean;
  startupTimings: { name: string; milliseconds: number }[];
  workerStartupDiagnostic: WorkerStartupDiagnostic | null;
};

const unsupported: OfflineShellStatus = {
  bundleIdentity: 'native',
  cachedShellVersions: [],
  controllingShellVersion: 'native',
  updateWaiting: false,
  startupTimings: [],
  workerStartupDiagnostic: null,
};

export async function getOfflineShellStatus() { return unsupported; }
export async function checkForOfflineShellUpdate() { return unsupported; }
export async function applyWaitingOfflineShellUpdate() { return false; }
