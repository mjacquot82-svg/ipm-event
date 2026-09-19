export const SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY = '@ipm_schedule_itinerary_onboarding_v1';

type OnboardingStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};

export async function hasAcknowledgedScheduleOnboarding(storage: OnboardingStorage) {
  return await storage.getItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY) === 'true';
}

export async function acknowledgeScheduleOnboarding(storage: OnboardingStorage) {
  await storage.setItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY, 'true');
}

export async function resetScheduleOnboarding(storage: OnboardingStorage) {
  await storage.removeItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY);
}
