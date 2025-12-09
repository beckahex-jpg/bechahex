import { Cookie, Settings, X } from 'lucide-react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useState, useEffect } from 'react';

export default function CookieConsentBanner() {
  const { showBanner, acceptAll, openPreferencesModal } = useCookieConsent();
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
      <div className="bg-white border-t-2 border-gray-200 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shrink-0">
                <Cookie className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We use cookies to enhance your browsing experience, provide personalized content, and analyze our traffic.
                  By clicking "Accept All", you consent to our use of cookies. You can manage your preferences at any time.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={openPreferencesModal}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-semibold transition shadow-sm hover:shadow-md whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                Manage Preferences
              </button>
              <button
                onClick={acceptAll}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition shadow-md hover:shadow-lg whitespace-nowrap"
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
