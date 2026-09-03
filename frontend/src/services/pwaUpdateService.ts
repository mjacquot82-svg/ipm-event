export type PwaUpdateListener = (available: boolean) => void;

export function startPwaUpdateFlow(_registration: ServiceWorkerRegistration) {}
export function subscribeToPwaUpdates(_listener: PwaUpdateListener) {
  return () => undefined;
}
export function activatePwaUpdate() {}
