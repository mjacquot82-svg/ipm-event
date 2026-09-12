export const BACKGROUND_THRESHOLD_MS = 10 * 60 * 1000;
export const startPwaUpdateFlow = (_registration: unknown) => () => undefined;
export const disposePwaUpdateFlow = () => undefined;
export const setPwaUpdateSafeState = (_safe: boolean) => undefined;
export const holdPwaUpdate = () => () => undefined;
export const activatePwaUpdate = async () => undefined;
export const dismissPwaUpdate = () => undefined;
export const subscribePwaUpdate = (_listener: (state: { visible: boolean; refreshing: boolean }) => void) => () => undefined;
