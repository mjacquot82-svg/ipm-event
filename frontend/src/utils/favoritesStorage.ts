// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@event_navigator_favorites';

export interface FavoritesState {
  sessionIds: string[];
}

// Get all favorite session IDs
export const getFavorites = async (): Promise<string[]> => {
  try {
    const stored = await AsyncStorage.getItem(FAVORITES_KEY);
    if (stored) {
      const parsed: FavoritesState = JSON.parse(stored);
      return parsed.sessionIds || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
};

// Add a session to favorites
export const addFavorite = async (sessionId: string): Promise<string[]> => {
  try {
    const current = await getFavorites();
    if (!current.includes(sessionId)) {
      const updated = [...current, sessionId];
      await AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify({ sessionIds: updated })
      );
      return updated;
    }
    return current;
  } catch (error) {
    console.error('Error adding favorite:', error);
    return [];
  }
};

// Remove a session from favorites
export const removeFavorite = async (sessionId: string): Promise<string[]> => {
  try {
    const current = await getFavorites();
    const updated = current.filter((id) => id !== sessionId);
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify({ sessionIds: updated })
    );
    return updated;
  } catch (error) {
    console.error('Error removing favorite:', error);
    return [];
  }
};

// Toggle favorite status
export const toggleFavorite = async (sessionId: string): Promise<{ favorites: string[]; isFavorite: boolean }> => {
  const current = await getFavorites();
  const isFavorite = current.includes(sessionId);
  
  if (isFavorite) {
    const updated = await removeFavorite(sessionId);
    return { favorites: updated, isFavorite: false };
  } else {
    const updated = await addFavorite(sessionId);
    return { favorites: updated, isFavorite: true };
  }
};

// Check if a session is favorited
export const isFavorite = async (sessionId: string): Promise<boolean> => {
  const favorites = await getFavorites();
  return favorites.includes(sessionId);
};

// Clear all favorites
export const clearFavorites = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FAVORITES_KEY);
  } catch (error) {
    console.error('Error clearing favorites:', error);
  }
};
