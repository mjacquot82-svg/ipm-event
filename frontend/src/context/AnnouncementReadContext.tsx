import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Announcement } from '../services/spreadsheetDataService';

const LAST_READ_ANNOUNCEMENT_KEY = 'lastReadAnnouncementId';
const READ_ANNOUNCEMENTS_KEY = 'readAnnouncementIds';
const DISMISSED_ANNOUNCEMENTS_KEY = 'dismissedAnnouncementIds';

type AnnouncementReadContextValue = {
  hydrated: boolean;
  lastReadAnnouncementId: string | null;
  readAnnouncementIds: Set<string>;
  dismissedAnnouncementIds: Set<string>;
  markAnnouncementRead: (announcementId: string) => Promise<void>;
  dismissAnnouncement: (announcementId: string) => Promise<void>;
};

const AnnouncementReadContext = createContext<AnnouncementReadContextValue | null>(null);

export function AnnouncementReadProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lastReadAnnouncementId, setLastReadAnnouncementId] = useState<string | null>(null);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(new Set());
  const readAnnouncementIdsRef = useRef<Set<string>>(new Set());
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(LAST_READ_ANNOUNCEMENT_KEY),
      AsyncStorage.getItem(READ_ANNOUNCEMENTS_KEY),
      AsyncStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY),
    ])
      .then(([storedId, storedReadIds, storedDismissedIds]) => {
        if (!active) return;
        setLastReadAnnouncementId(storedId);
        if (storedReadIds) {
          const parsed = JSON.parse(storedReadIds);
          if (Array.isArray(parsed)) {
            const ids = new Set(parsed.filter((id): id is string => typeof id === 'string'));
            readAnnouncementIdsRef.current = ids;
            setReadAnnouncementIds(ids);
          }
        }
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
    const next = new Set(readAnnouncementIdsRef.current);
    next.add(announcementId);
    readAnnouncementIdsRef.current = next;
    setReadAnnouncementIds(next);
    try {
      await Promise.all([
        AsyncStorage.setItem(LAST_READ_ANNOUNCEMENT_KEY, announcementId),
        AsyncStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify([...next])),
      ]);
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
    readAnnouncementIds,
    dismissedAnnouncementIds,
    markAnnouncementRead,
    dismissAnnouncement,
  }), [dismissAnnouncement, dismissedAnnouncementIds, hydrated, lastReadAnnouncementId, markAnnouncementRead, readAnnouncementIds]);
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

export function getUnreadAnnouncementIds(
  announcements: Announcement[],
  readAnnouncementIds: Set<string>,
  lastReadAnnouncementId: string | null,
) {
  const newestFirst = [...announcements].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unreadIds = new Set(newestFirst.filter((announcement) => !readAnnouncementIds.has(announcement.id)).map((announcement) => announcement.id));
  if (!lastReadAnnouncementId) return unreadIds;
  const lastReadIndex = newestFirst.findIndex((announcement) => announcement.id === lastReadAnnouncementId);
  if (lastReadIndex < 0) return unreadIds;
  newestFirst.slice(lastReadIndex).forEach((announcement) => unreadIds.delete(announcement.id));
  return unreadIds;
}
