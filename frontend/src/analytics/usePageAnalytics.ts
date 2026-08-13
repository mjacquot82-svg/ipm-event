import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { pageNavigationProperties, queueAnalyticsEvent } from './analyticsClient';
import { PageFocusDeduplicator } from './analyticsCore';

const focusDeduplicator = new PageFocusDeduplicator();

export function usePageAnalytics(pageId: string, source?: string, openEvent?: string, openProperties: Record<string, string | number | boolean | null> = {}) {
  const propertiesRef = useRef(openProperties);
  propertiesRef.current = openProperties;

  useFocusEffect(useCallback(() => {
    if (!focusDeduplicator.begin(pageId)) return undefined;
    void queueAnalyticsEvent('page_viewed', pageNavigationProperties(pageId, source));
    if (openEvent) void queueAnalyticsEvent(openEvent, { source: source || 'other', ...propertiesRef.current });
    return () => {
      focusDeduplicator.end(pageId);
    };
  }, [pageId, source, openEvent]));
}
