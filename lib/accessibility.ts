// lib/accessibility.ts
import { useSyncExternalStore } from 'react';

export const STORAGE_KEYS = {
  themeSession: 'nj_theme_session',
  theme: 'nj_theme',
  fontSize: 'nj_font_size',
  bookmarks: 'nj_news_bookmarks',
  cookieConsent: 'nj_cookie_consent',
} as const;

export type FontSizeLevel = 'normal' | 'large' | 'xlarge';

export function getStoredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const sessionVal = sessionStorage.getItem(STORAGE_KEYS.themeSession);
    if (sessionVal === 'dark' || sessionVal === 'light') return sessionVal;

    const localVal = localStorage.getItem(STORAGE_KEYS.theme);
    if (localVal === 'dark' || localVal === 'light') return localVal;
  } catch {}
  return 'light'; // Light is always the default
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.themeSession, theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    window.dispatchEvent(new CustomEvent('nj_theme_change', { detail: { theme } }));
  } catch {}
}

export function getStoredFontSize(): FontSizeLevel {
  if (typeof window === 'undefined') return 'normal';
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.fontSize);
    if (stored === 'large' || stored === 'xlarge') return stored;
  } catch {}
  return 'normal';
}

export function setStoredFontSize(size: FontSizeLevel): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.fontSize, size);
    document.documentElement.setAttribute('data-font-size', size);
    window.dispatchEvent(new CustomEvent('nj_font_size_change', { detail: { size } }));
  } catch {}
}

const SERVER_EMPTY_BOOKMARKS: string[] = [];
const getServerBookmarks = (): string[] => SERVER_EMPTY_BOOKMARKS;
const getServerBookmarksCount = (): number => 0;
const getServerFalse = (): boolean => false;
const getServerTrue = (): boolean => true;
const getServerTheme = (): 'light' | 'dark' => 'light';
const getServerFontSize = (): FontSizeLevel => 'normal';
const emptySubscribe = () => () => {};

let cachedBookmarksRaw = '[]';
let cachedBookmarksList: string[] = [];

export function getStoredBookmarks(): string[] {
  if (typeof window === 'undefined') return SERVER_EMPTY_BOOKMARKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bookmarks) || '[]';
    if (raw !== cachedBookmarksRaw) {
      cachedBookmarksRaw = raw;
      const parsed = JSON.parse(raw);
      cachedBookmarksList = Array.isArray(parsed) ? parsed : [];
    }
    return cachedBookmarksList;
  } catch {}
  return SERVER_EMPTY_BOOKMARKS;
}

export function toggleStoredBookmark(id: string): { isBookmarked: boolean; count: number } {
  if (typeof window === 'undefined') return { isBookmarked: false, count: 0 };
  try {
    const current = getStoredBookmarks();
    let updated: string[];
    let isBookmarked: boolean;

    if (current.includes(id)) {
      updated = current.filter(item => item !== id);
      isBookmarked = false;
    } else {
      updated = [...current, id];
      isBookmarked = true;
    }

    const raw = JSON.stringify(updated);
    cachedBookmarksRaw = raw;
    cachedBookmarksList = updated;
    localStorage.setItem(STORAGE_KEYS.bookmarks, raw);
    window.dispatchEvent(new CustomEvent('nj_bookmarks_change', { detail: { bookmarks: updated, count: updated.length } }));
    return { isBookmarked, count: updated.length };
  } catch {
    return { isBookmarked: false, count: 0 };
  }
}

const subscribeTheme = (callback: () => void) => {
  window.addEventListener('nj_theme_change', callback);
  return () => window.removeEventListener('nj_theme_change', callback);
};

const subscribeFontSize = (callback: () => void) => {
  window.addEventListener('nj_font_size_change', callback);
  return () => window.removeEventListener('nj_font_size_change', callback);
};

const subscribeBookmarks = (callback: () => void) => {
  window.addEventListener('nj_bookmarks_change', callback);
  return () => window.removeEventListener('nj_bookmarks_change', callback);
};

const getBookmarksCountSnapshot = (): number => getStoredBookmarks().length;

// React 19 Sync External Store hooks to eliminate hydration mismatch and cascading renders
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    getServerTrue,
    getServerFalse
  );
}

export function useTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    getServerTheme
  );
}

export function useFontSize(): FontSizeLevel {
  return useSyncExternalStore(
    subscribeFontSize,
    getStoredFontSize,
    getServerFontSize
  );
}

export function useBookmarksCount(): number {
  return useSyncExternalStore(
    subscribeBookmarks,
    getBookmarksCountSnapshot,
    getServerBookmarksCount
  );
}

export function useIsBookmarked(id: string): boolean {
  return useSyncExternalStore(
    subscribeBookmarks,
    () => getStoredBookmarks().includes(id),
    getServerFalse
  );
}

export function useAllBookmarks(): string[] {
  return useSyncExternalStore(
    subscribeBookmarks,
    getStoredBookmarks,
    getServerBookmarks
  );
}
