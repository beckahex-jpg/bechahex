import { Cookie, Settings } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useState, useEffect } from 'react';

export default function CookieConsentBanner() {
  const { showBanner, acceptAll, rejectAll, openPreferencesModal } = useCookieConsent();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showBanner) {
      setTimeout(() => setIsVisible(true), 500);
    } else {
      setIsVisible(false);
    }
  }, [showBanner]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="border-t border-gray-200 bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
        <div className="market-container py-4 sm:py-5">
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto lg:max-h-none lg:flex-row lg:items-center lg:gap-6 lg:overflow-visible">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="shrink-0 rounded-xl bg-emerald-50 p-2.5 sm:p-3">
                <Cookie className="h-5 w-5 text-emerald-700 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                  We Value Your Privacy
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-600 sm:text-sm sm:leading-relaxed">
                  We use cookies to enhance your browsing experience, provide personalized content, and analyze our traffic.
                  By clicking "Accept All", you consent to our use of cookies. You can manage your preferences at any time.
                </p>
              </div>
            </div>

            <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:gap-3">
              <button
                onClick={rejectAll}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 sm:px-5 sm:py-3"
              >
                Essential only
              </button>
              <button
                onClick={openPreferencesModal}
                className="flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-200 sm:px-5 sm:py-3"
              >
                <Settings className="w-4 h-4" />
                Preferences
              </button>
              <button
                onClick={acceptAll}
                className="col-span-2 rounded-lg bg-[#07513B] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#032F24] sm:col-auto sm:py-3"
              >
                Accept All Cookies
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
