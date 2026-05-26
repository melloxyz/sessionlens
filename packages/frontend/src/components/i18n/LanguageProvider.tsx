import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Locale = 'en' | 'pt-BR';

const STORAGE_KEY = 'aimeter-locale';

const dictionaries = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.sessions': 'Sessions',
    'nav.projects': 'Projects',
    'nav.models': 'Models',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'topbar.dashboard.title': 'Dashboard',
    'topbar.dashboard.subtitle': 'Overview of your AI CLI usage',
    'topbar.sessions.title': 'Sessions',
    'topbar.sessions.subtitle': 'Explore prompts, costs, tokens and timelines',
    'topbar.projects.title': 'Projects',
    'topbar.projects.subtitle': 'Understand AI spend and usage per workspace',
    'topbar.analytics.title': 'Analytics',
    'topbar.analytics.subtitle': 'Compare providers, models, projects and burn-rate',
    'topbar.models.title': 'Models',
    'topbar.models.subtitle': 'Reference pricing table for estimation',
    'topbar.settings.title': 'Settings',
    'topbar.settings.subtitle': 'Local preferences, privacy and integrations',
    'common.last30': 'Last 30 days',
    'common.last7': 'Last 7 days',
    'common.last90': 'Last 90 days',
    'common.allTime': 'All time',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.privacy': 'Privacy & Data',
    'settings.integrations': 'Integrations',
    'settings.ingestion': 'Ingestion',
  },
  'pt-BR': {
    'nav.dashboard': 'Dashboard',
    'nav.sessions': 'Sessões',
    'nav.projects': 'Projetos',
    'nav.models': 'Modelos',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Configurações',
    'topbar.dashboard.title': 'Dashboard',
    'topbar.dashboard.subtitle': 'Visão geral do uso dos seus AI CLIs',
    'topbar.sessions.title': 'Sessões',
    'topbar.sessions.subtitle': 'Explore prompts, custos, tokens e timelines',
    'topbar.projects.title': 'Projetos',
    'topbar.projects.subtitle': 'Entenda gasto e uso por workspace',
    'topbar.analytics.title': 'Analytics',
    'topbar.analytics.subtitle': 'Compare providers, modelos, projetos e burn-rate',
    'topbar.models.title': 'Modelos',
    'topbar.models.subtitle': 'Tabela de preços usada para estimativas',
    'topbar.settings.title': 'Configurações',
    'topbar.settings.subtitle': 'Preferências locais, privacidade e integrações',
    'common.last30': 'Últimos 30 dias',
    'common.last7': 'Últimos 7 dias',
    'common.last90': 'Últimos 90 dias',
    'common.allTime': 'Todo período',
    'settings.appearance': 'Aparência',
    'settings.language': 'Idioma',
    'settings.privacy': 'Privacidade e Dados',
    'settings.integrations': 'Integrações',
    'settings.ingestion': 'Ingestão',
  },
} as const;

type DictionaryKey = keyof typeof dictionaries.en;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'pt-BR') return stored;
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (key) => dictionaries[locale][key] ?? key,
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}
