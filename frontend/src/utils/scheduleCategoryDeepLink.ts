// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

export const MNP_LIFESTYLES_CATEGORY = 'MNP Lifestyles Tent Events';
export const MNP_LIFESTYLES_CATEGORY_SLUG = 'mnp-lifestyles';

const permanentCategorySlugs: Readonly<Record<string, string>> = {
  [MNP_LIFESTYLES_CATEGORY_SLUG]: MNP_LIFESTYLES_CATEGORY,
};

export function getScheduleCategorySlug(category: string): string {
  const permanentSlug = Object.entries(permanentCategorySlugs)
    .find(([, canonicalCategory]) => canonicalCategory === category)?.[0];

  return permanentSlug || category
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveScheduleCategory(
  queryValue: string | string[] | undefined,
  availableCategories: readonly string[],
): string | null {
  if (typeof queryValue !== 'string' || !queryValue) return null;

  const permanentCategory = permanentCategorySlugs[queryValue];
  if (permanentCategory) {
    return availableCategories.includes(permanentCategory) ? permanentCategory : null;
  }

  return availableCategories.find((category) => getScheduleCategorySlug(category) === queryValue) || null;
}
