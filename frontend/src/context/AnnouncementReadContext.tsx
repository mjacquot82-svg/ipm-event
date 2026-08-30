import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Announcement } from '../services/spreadsheetDataService';

const LAST_READ_ANNOUNCEMENT_KEY = 'lastReadAnnouncementId';
const DISMISSED_ANNOUNCEMENTS_KEY = 'dismissedAnnouncementIds';

type AnnouncementReadContextValue = {
  hydrated: boolean;
  lastReadAnnouncementId: string | null;
  dismissedAnnouncementIds: Set<string>;
  markAnnouncementRead: (announcementId: string) => Promise<void>;
  dismissAnnouncement: (announcementId: string) => Promise<void>;
};

const AnnouncementReadContext = createContext<AnnouncementReadContextValue | null>(null);

export function AnnouncementReadProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lastReadAnnouncementId, setLastReadAnnouncementId] = useState<string | null>(null);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(LAST_READ_ANNOUNCEMENT_KEY),
      AsyncStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY),
    ])
      .then(([storedId, storedDismissedIds]) => {
        if (!active) return;
        setLastReadAnnouncementId(storedId);
        if (storedDismissedIds) {
          const parsed = JSON.parse(storedDismissedIds);
          if (Array.isArray(parsed)) {
            setDismissedAnnouncementIds(new Set(parsed.filter((id): id is string => typeof id === 'string')));
          }
        }
      })
      .catch((error) => console.warn('Unable to load announcement read state:', error))
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  const markAnnouncementRead = useCallback(async (announcementId: string) => {
    setLastReadAnnouncementId(announcementId);
    try {
      await AsyncStorage.setItem(LAST_READ_ANNOUNCEMENT_KEY, announcementId);
    } catch (error) {
      console.warn('Unable to save announcement read state:', error);
    }
  }, []);

  const dismissAnnouncement = useCallback(async (announcementId: string) => {
    const next = new Set(dismissedAnnouncementIds);
    next.add(announcementId);
    setDismissedAnnouncementIds(next);
    try {
      await AsyncStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify([...next]));
    } catch (error) {
      console.warn('Unable to save dismissed announcement state:', error);
    }
  }, [dismissedAnnouncementIds]);

  const value = useMemo(() => ({
    hydrated,
    lastReadAnnouncementId,
    dismissedAnnouncementIds,
    markAnnouncementRead,
    dismissAnnouncement,
  }), [dismissAnnouncement, dismissedAnnouncementIds, hydrated, lastReadAnnouncementId, markAnnouncementRead]);
  return <AnnouncementReadContext.Provider value={value}>{children}</AnnouncementReadContext.Provider>;
}

export function excludeDismissedAnnouncements(announcements: Announcement[], dismissedIds: Set<string>) {
  return announcements.filter((announcement) => !dismissedIds.has(announcement.id));
}

export function useAnnouncementReadState() {
  const value = useContext(AnnouncementReadContext);
  if (!value) throw new Error('useAnnouncementReadState must be used inside AnnouncementReadProvider');
  return value;
}

export function getUnreadAnnouncementIds(announcements: Announcement[], lastReadAnnouncementId: string | null) {
  const newestFirst = [...announcements].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (!lastReadAnnouncementId) return new Set(newestFirst.map((announcement) => announcement.id));
  const lastReadIndex = newestFirst.findIndex((announcement) => announcement.id === lastReadAnnouncementId);
  if (lastReadIndex < 0) return new Set(announcements.map((announcement) => announcement.id));
  return new Set(newestFirst.slice(0, lastReadIndex).map((announcement) => announcement.id));
}
