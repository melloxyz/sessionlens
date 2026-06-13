import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PrivacyContextValue {
  isPrivate: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

const STORAGE_KEY = 'sessionlens-privacy';

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    if (isPrivate) {
      document.documentElement.setAttribute('data-private', 'true');
    } else {
      document.documentElement.removeAttribute('data-private');
    }
    localStorage.setItem(STORAGE_KEY, String(isPrivate));
  }, [isPrivate]);

  const togglePrivacy = () => setIsPrivate((prev) => !prev);

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used inside PrivacyProvider');
  return ctx;
}
