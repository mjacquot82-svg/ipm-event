export type ScheduleCategoryStyle = {
  primary: string;
  tint: string;
  tintForeground: string;
  strongForeground: '#FFFFFF' | '#2D2926';
};

export const SCHEDULE_CATEGORY_STYLES: Record<string, ScheduleCategoryStyle> = {
  'MNP Lifestyles Tent Events': { primary: '#00573D', tint: '#E5F1ED', tintForeground: '#00573D', strongForeground: '#FFFFFF' },
  'CKNX Centennial Pavilion (GFO Stage) Lounge': { primary: '#826D40', tint: '#F2EEE5', tintForeground: '#5B4B2A', strongForeground: '#2D2926' },
  'Ontario Mutuals Main Stage - In the Britespan Building': { primary: '#043969', tint: '#E6EDF4', tintForeground: '#043969', strongForeground: '#FFFFFF' },
  'Parade Week': { primary: '#BF202E', tint: '#F9E8EA', tintForeground: '#9D1723', strongForeground: '#FFFFFF' },
  'The Bruce RV Park - Nightly Entertainment': { primary: '#FAA31B', tint: '#FFF1D9', tintForeground: '#704000', strongForeground: '#2D2926' },
};

export const NEUTRAL_SCHEDULE_CATEGORY_STYLE: ScheduleCategoryStyle = {
  primary: '#6B7280',
  tint: '#F1F3F5',
  tintForeground: '#4B5563',
  strongForeground: '#FFFFFF',
};

export function getScheduleCategoryStyle(category?: string | null): ScheduleCategoryStyle {
  if (!category) return NEUTRAL_SCHEDULE_CATEGORY_STYLE;
  return SCHEDULE_CATEGORY_STYLES[category] || NEUTRAL_SCHEDULE_CATEGORY_STYLE;
}
