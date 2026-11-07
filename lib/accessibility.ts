import { useState, useEffect, useSyncExternalStore } from 'react';

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
  return 'light';
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

let cachedBookmarksRaw = '';
let cachedBookmarksList: string[] = [];

export function getStoredBookmarks(): string[] {
  if (typeof window === 'undefined') return SERVER_EMPTY_BOOKMARKS;
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.bookmarks);
    // Check fallback legacy keys if main key is unset
    if (!raw) {
      raw = localStorage.getItem('nj_bookmarks') || localStorage.getItem('bookmarks') || '[]';
    }
    if (raw !== cachedBookmarksRaw) {
      cachedBookmarksRaw = raw;
      const parsed = JSON.parse(raw);
      cachedBookmarksList = Array.isArray(parsed) ? parsed.map(String) : [];
    }
    return cachedBookmarksList;
  } catch {
    return SERVER_EMPTY_BOOKMARKS;
  }
}

export function toggleStoredBookmark(id: string): { isBookmarked: boolean; count: number } {
  if (typeof window === 'undefined' || !id) return { isBookmarked: false, count: 0 };
  try {
    const cleanId = String(id).trim();
    const current = getStoredBookmarks();
    let updated: string[];
    let isBookmarked: boolean;

    if (current.includes(cleanId)) {
      updated = current.filter(item => item !== cleanId);
      isBookmarked = false;
    } else {
      updated = [...current, cleanId];
      isBookmarked = true;
    }

    const raw = JSON.stringify(updated);
    cachedBookmarksRaw = raw;
    cachedBookmarksList = updated;
    localStorage.setItem(STORAGE_KEYS.bookmarks, raw);
    // Also sync to legacy keys for compatibility
    localStorage.setItem('nj_bookmarks', raw);

    window.dispatchEvent(
      new CustomEvent('nj_bookmarks_change', { detail: { bookmarks: updated, count: updated.length } })
    );
    return { isBookmarked, count: updated.length };
  } catch {
    return { isBookmarked: false, count: 0 };
  }
}

const subscribeTheme = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('nj_theme_change', callback);
  return () => window.removeEventListener('nj_theme_change', callback);
};

const subscribeFontSize = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('nj_font_size_change', callback);
  return () => window.removeEventListener('nj_font_size_change', callback);
};

const subscribeBookmarks = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('nj_bookmarks_change', callback);
  window.addEventListener('storage', callback);
  window.addEventListener('focus', callback);
  return () => {
    window.removeEventListener('nj_bookmarks_change', callback);
    window.removeEventListener('storage', callback);
    window.removeEventListener('focus', callback);
  };
};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    getServerTrue,
    getServerFalse
  );
}

export function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const sync = () => {
      setTheme(getStoredTheme());
    };
    const timer = setTimeout(sync, 0);
    const unsub = subscribeTheme(sync);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return theme;
}

export function useFontSize(): FontSizeLevel {
  const [fontSize, setFontSize] = useState<FontSizeLevel>('normal');

  useEffect(() => {
    const sync = () => {
      setFontSize(getStoredFontSize());
    };
    const timer = setTimeout(sync, 0);
    const unsub = subscribeFontSize(sync);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return fontSize;
}

export function useBookmarksCount(): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      setCount(getStoredBookmarks().length);
    };
    const timer = setTimeout(update, 0);
    const unsub = subscribeBookmarks(update);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return count;
}

export function useIsBookmarked(id: string): boolean {
  const [bookmarked, setBookmarked] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      if (!id) return;
      const list = getStoredBookmarks();
      setBookmarked(list.includes(String(id)));
    };
    const timer = setTimeout(update, 0);
    const unsub = subscribeBookmarks(update);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [id]);

  return bookmarked;
}

export function useAllBookmarks(): string[] {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    const update = () => {
      setBookmarks([...getStoredBookmarks()]);
    };
    const timer = setTimeout(update, 0);
    const unsub = subscribeBookmarks(update);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return bookmarks;
}
