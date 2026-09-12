export type PwaUpdateListener = (available: boolean) => void;

export function startPwaUpdateFlow(_registration: ServiceWorkerRegistration) {
  return () => undefined;
}

export function setPwaUpdateSafeState(_isSafe: boolean) {}

export function holdPwaUpdate() {
  return () => undefined;
}

export function subscribeToPwaUpdates(_listener: PwaUpdateListener) {
  return () => undefined;
}

export function dismissPwaUpdate() {}

export function activatePwaUpdate() {}
