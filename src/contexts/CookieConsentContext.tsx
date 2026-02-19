import { createContext, useContext, useEffect, useState } from 'react';

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentContextType {
  hasConsent: boolean;
  showBanner: boolean;
  showPreferencesModal: boolean;
  preferences: CookiePreferences;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: CookiePreferences) => void;
  openPreferencesModal: () => void;
  closePreferencesModal: () => void;
  resetConsent: () => void;
  consentTimestamp: number | null;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

const STORAGE_KEY = 'cookie_consent';
const CONSENT_EXPIRY_DAYS = 365;

const defaultPreferences: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [hasConsent, setHasConsent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [consentTimestamp, setConsentTimestamp] = useState<number | null>(null);

  useEffect(() => {
    loadConsent();
  }, []);

  const loadConsent = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const timestamp = data.timestamp;
        const now = Date.now();
        const daysSinceConsent = (now - timestamp) / (1000 * 60 * 60 * 24);

        if (daysSinceConsent > CONSENT_EXPIRY_DAYS) {
          localStorage.removeItem(STORAGE_KEY);
          setShowBanner(true);
          return;
        }

        setPreferences(data.preferences);
        setConsentTimestamp(timestamp);
        setHasConsent(true);
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Error loading cookie consent:', error);
      setShowBanner(true);
    }
  };

  const saveConsent = (prefs: CookiePreferences) => {
    const timestamp = Date.now();
    const data = {
      preferences: prefs,
      timestamp,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setPreferences(prefs);
    setConsentTimestamp(timestamp);
    setHasConsent(true);
    setShowBanner(false);
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    saveConsent(allAccepted);
    setShowPreferencesModal(false);
  };

  const rejectAll = () => {
    saveConsent(defaultPreferences);
    setShowPreferencesModal(false);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    saveConsent({ ...prefs, essential: true });
    setShowPreferencesModal(false);
  };

  const openPreferencesModal = () => {
    setShowPreferencesModal(true);
    setShowBanner(false);
  };

  const closePreferencesModal = () => {
    setShowPreferencesModal(false);
    if (!hasConsent) {
      setShowBanner(true);
    }
  };

  const resetConsent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences(defaultPreferences);
    setHasConsent(false);
    setConsentTimestamp(null);
    setShowBanner(true);
  };

  const value = {
    hasConsent,
    showBanner,
    showPreferencesModal,
    preferences,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferencesModal,
    closePreferencesModal,
    resetConsent,
    consentTimestamp,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
}
