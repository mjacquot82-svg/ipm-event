export type StartupTiming = { name: string; milliseconds: number };

export function markStartupStage(_name: string) {}
export function getStartupTimings(): StartupTiming[] { return []; }
export function runAfterFirstPaint(task: () => void) {
  const timer = setTimeout(task, 0);
  return () => clearTimeout(timer);
}
export function runOnlineAfterFirstPaint(task: () => void) { return runAfterFirstPaint(task); }
