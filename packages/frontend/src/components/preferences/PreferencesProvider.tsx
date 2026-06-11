import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setFormatPreferences } from '../../lib/format.js';

type PreferenceKey = keyof UiPreferences;

interface UiPreferences {
  subtleAnimations: boolean;
  compactTypography: boolean;
  externalLinksInBrowser: boolean;
  checkUpdatesOnStartup: boolean;
  dateFormat: string;
  currency: string;
  timeZone: string;
}

interface UpdateCheckState {
  checkedAt: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  error: string | null;
}

interface PreferencesContextValue {
  preferences: UiPreferences;
  updateCheck: UpdateCheckState | null;
  setPreference: <K extends PreferenceKey>(key: K, value: UiPreferences[K]) => void;
  checkForUpdates: () => Promise<void>;
}

const STORAGE_KEY = 'sessionlens-ui-preferences';
const UPDATE_CHECK_KEY = 'sessionlens-update-check';
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 12;
const RELEASE_URL = 'https://api.github.com/repos/melloxyz/sessionlens/releases/latest';

const defaultPreferences: UiPreferences = {
  subtleAnimations: true,
  compactTypography: false,
  externalLinksInBrowser: true,
  checkUpdatesOnStartup: true,
  dateFormat: 'dd/MM/yyyy',
  currency: 'USD',
  timeZone: 'America/Sao_Paulo',
};

const allowedDateFormats = new Set(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']);
const allowedCurrencies = new Set(['USD', 'BRL', 'EUR']);
const allowedTimeZones = new Set(['America/Sao_Paulo', 'America/New_York', 'Europe/London']);

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    return { ...fallback, ...JSON.parse(stored) } as T;
  } catch {
    return fallback;
  }
}

function getInitialPreferences() {
  return normalizePreferences(readJson(STORAGE_KEY, defaultPreferences));
}

function getInitialUpdateCheck() {
  return readJson<UpdateCheckState | null>(UPDATE_CHECK_KEY, null);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UiPreferences>(getInitialPreferences);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckState | null>(getInitialUpdateCheck);

  setFormatPreferences({
    dateFormat: preferences.dateFormat,
    currency: preferences.currency,
    timeZone: preferences.timeZone,
  });

  const setPreference = useCallback(<K extends PreferenceKey>(key: K, value: UiPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const checkForUpdates = useCallback(async () => {
    const checkedAt = new Date().toISOString();

    try {
      const response = await fetch(RELEASE_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);

      const payload = (await response.json()) as {
        tag_name?: string;
        html_url?: string;
      };
      const nextState: UpdateCheckState = {
        checkedAt,
        latestVersion: payload.tag_name ?? null,
        releaseUrl: payload.html_url ?? null,
        error: null,
      };
      setUpdateCheck(nextState);
      window.localStorage.setItem(UPDATE_CHECK_KEY, JSON.stringify(nextState));
    } catch (error) {
      const nextState: UpdateCheckState = {
        checkedAt,
        latestVersion: null,
        releaseUrl: null,
        error: error instanceof Error ? error.message : String(error),
      };
      setUpdateCheck(nextState);
      window.localStorage.setItem(UPDATE_CHECK_KEY, JSON.stringify(nextState));
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('sessionlens-no-motion', !preferences.subtleAnimations);
    root.classList.toggle('sessionlens-compact-type', preferences.compactTypography);
    setFormatPreferences({
      dateFormat: preferences.dateFormat,
      currency: preferences.currency,
      timeZone: preferences.timeZone,
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.href);
      const isExternal =
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.origin !== window.location.origin;
      if (!isExternal) return;

      event.preventDefault();
      if (preferences.externalLinksInBrowser) {
        window.open(url.href, '_blank', 'noopener,noreferrer');
        return;
      }

      window.location.assign(url.href);
    }

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [preferences.externalLinksInBrowser]);

  useEffect(() => {
    if (!preferences.checkUpdatesOnStartup) return;

    const lastCheckedAt = updateCheck?.checkedAt ? Date.parse(updateCheck.checkedAt) : 0;
    if (Number.isFinite(lastCheckedAt) && Date.now() - lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) {
      return;
    }

    void checkForUpdates();
  }, [checkForUpdates, preferences.checkUpdatesOnStartup, updateCheck?.checkedAt]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      updateCheck,
      setPreference,
      checkForUpdates,
    }),
    [checkForUpdates, preferences, setPreference, updateCheck],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}

function normalizePreferences(preferences: UiPreferences): UiPreferences {
  return {
    ...defaultPreferences,
    ...preferences,
    dateFormat: allowedDateFormats.has(preferences.dateFormat)
      ? preferences.dateFormat
      : defaultPreferences.dateFormat,
    currency: allowedCurrencies.has(preferences.currency)
      ? preferences.currency
      : defaultPreferences.currency,
    timeZone: allowedTimeZones.has(preferences.timeZone)
      ? preferences.timeZone
      : defaultPreferences.timeZone,
  };
}
