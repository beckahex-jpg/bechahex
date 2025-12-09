import { X, Cookie, ShoppingCart, BarChart3, Megaphone, Shield } from 'lucide-react';
import { useCookieConsent, CookiePreferences } from '../contexts/CookieConsentContext';
import { useState, useEffect } from 'react';

export default function CookiePreferencesModal() {
  const { showPreferencesModal, closePreferencesModal, preferences, savePreferences, acceptAll } = useCookieConsent();
  const [localPreferences, setLocalPreferences] = useState<CookiePreferences>(preferences);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (showPreferencesModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPreferencesModal]);

  if (!showPreferencesModal) return null;

  const handleToggle = (key: keyof CookiePreferences) => {
    if (key === 'essential') return;
    setLocalPreferences({
      ...localPreferences,
      [key]: !localPreferences[key],
    });
  };

  const handleSave = () => {
    savePreferences(localPreferences);
  };

  const cookieCategories = [
    {
      key: 'essential' as keyof CookiePreferences,
      icon: Shield,
      title: 'Essential Cookies',
      description: 'These cookies are necessary for the website to function and cannot be disabled. They enable core functionality such as security, authentication, and shopping cart features.',
      required: true,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      key: 'functional' as keyof CookiePreferences,
      icon: ShoppingCart,
      title: 'Functional Cookies',
      description: 'These cookies enable enhanced functionality like remembering your preferences, favorites, and shopping cart items across sessions for a better user experience.',
      required: false,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      key: 'analytics' as keyof CookiePreferences,
      icon: BarChart3,
      title: 'Analytics Cookies',
      description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously to improve our services.',
      required: false,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      key: 'marketing' as keyof CookiePreferences,
      icon: Megaphone,
      title: 'Marketing Cookies',
      description: 'These cookies track your online activity to help deliver more relevant advertising and measure the effectiveness of our marketing campaigns.',
      required: false,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={closePreferencesModal}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
              <Cookie className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Cookie Preferences</h2>
              <p className="text-sm text-gray-600">Manage your cookie settings</p>
            </div>
          </div>
          <button
            onClick={closePreferencesModal}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed">
              We respect your privacy and want to be transparent about the cookies we use.
              You can customize your preferences below or accept all cookies for the best experience.
            </p>
          </div>

          <div className="space-y-4">
            {cookieCategories.map((category) => {
              const Icon = category.icon;
              const isEnabled = localPreferences[category.key];

              return (
                <div
                  key={category.key}
                  className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 ${category.bgColor} rounded-lg shrink-0`}>
                          <Icon className={`w-5 h-5 ${category.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{category.title}</h3>
                            {category.required && (
                              <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full font-medium">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {category.description}
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleToggle(category.key)}
                          disabled={category.required}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 rounded-full peer transition-colors ${
                          category.required
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gray-300 peer-checked:bg-blue-600'
                        } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white`}></div>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={closePreferencesModal}
            className="flex-1 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold transition shadow-md hover:shadow-lg"
          >
            Save Preferences
          </button>
          <button
            onClick={acceptAll}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition shadow-md hover:shadow-lg"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
