export type TutorialRect = { x: number; y: number; width: number; height: number };
export type CueSide = 'above' | 'below' | 'left' | 'right';
export type TutorialCue = TutorialRect & { side: CueSide; arrowX: number; arrowY: number };
export const CUE_ARROW = 10;
const clearance = 6;
const gap = CUE_ARROW + clearance;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const overlaps = (a: TutorialRect, b: TutorialRect) => a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;

// All coordinates come from the same measured viewport as the existing spotlight.
// Try every side; never cover the target or the explanatory tutorial card.
export function placeTutorialCue(target: TutorialRect, safe: TutorialRect, card: TutorialRect, size: { width: number; height: number }): TutorialCue | null {
  const { width, height } = size;
  const centerX = target.x + target.width / 2, centerY = target.y + target.height / 2;
  const x = clamp(centerX - width / 2, safe.x, safe.x + safe.width - width);
  const y = clamp(centerY - height / 2, safe.y, safe.y + safe.height - height);
  const candidates: Array<TutorialRect & { side: CueSide }> = [
    { side: 'above', x, y: target.y - gap - height, width, height },
    { side: 'below', x, y: target.y + target.height + gap, width, height },
    { side: 'left', x: target.x - gap - width, y, width, height },
    { side: 'right', x: target.x + target.width + gap, y, width, height },
  ];
  for (const candidate of candidates) {
    if (candidate.x < safe.x || candidate.y < safe.y || candidate.x + width > safe.x + safe.width || candidate.y + height > safe.y + safe.height || overlaps(candidate, card) || overlaps(candidate, target)) continue;
    const vertical = candidate.side === 'above' || candidate.side === 'below';
    const arrowX = vertical ? clamp(centerX, candidate.x + 12, candidate.x + width - 12) : candidate.side === 'left' ? candidate.x + width : candidate.x - CUE_ARROW;
    const arrowY = !vertical ? clamp(centerY, candidate.y + 12, candidate.y + height - 12) : candidate.side === 'above' ? candidate.y + height : candidate.y - CUE_ARROW;
    return { ...candidate, arrowX, arrowY };
  }
  return null;
}
