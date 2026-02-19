import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, Shield, User, Save, Mail, MessageSquare, Package, Cookie, Trash2, Loader2, ShoppingBag, Truck, Star, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import ConfirmationModal from '../components/ConfirmationModal';

interface NotificationSettings {
  email_notifications: boolean;
  order_updates: boolean;
  submission_updates: boolean;
  marketing_emails: boolean;
  product_sold: boolean;
}

interface EmailPreferences {
  order_updates: boolean;
  shipping_updates: boolean;
  marketing_emails: boolean;
  review_requests: boolean;
  abandoned_cart_reminders: boolean;
}

export default function SettingsPage() {
  const { user, openAuthModal, signOut } = useAuth();
  const { openPreferencesModal, preferences: cookiePreferences, consentTimestamp } = useCookieConsent();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    order_updates: true,
    submission_updates: true,
    marketing_emails: false,
    product_sold: true,
  });

  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    order_updates: true,
    shipping_updates: true,
    marketing_emails: true,
    review_requests: true,
    abandoned_cart_reminders: true,
  });

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to view settings');
      navigate('/');
      return;
    }
    loadSettings();
  }, [user, navigate]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (data?.notification_settings) {
        setNotificationSettings(data.notification_settings);
      }
      if (data?.email_notifications_enabled !== undefined) {
        setEmailNotificationsEnabled(data.email_notifications_enabled);
      }
      if (data?.email_preferences) {
        setEmailPreferences(data.email_preferences);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_settings: notificationSettings,
          email_notifications_enabled: emailNotificationsEnabled,
          email_preferences: emailPreferences,
        })
        .eq('id', user?.id);

      if (error) throw error;
      showSuccess('Notification settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

      if (authError) {
        console.error('Error deleting auth user:', authError);
      }

      await signOut();
      showSuccess('Your account has been permanently deleted.');

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error deleting account:', error);
      showError('Failed to delete account. Please contact support.');
      throw error;
    }
  };

  const enabledNotificationsCount = Object.values(notificationSettings).filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account preferences and notifications</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl">
                    <Bell className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
                    <p className="text-sm text-gray-600">
                      {enabledNotificationsCount} of {Object.keys(notificationSettings).length} enabled
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-blue-50 hover:to-cyan-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-600">Receive notifications via email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.email_notifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          email_notifications: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Order Updates</p>
                      <p className="text-sm text-gray-600">Get notified about order status changes</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.order_updates}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          order_updates: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <MessageSquare className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Product Submission Updates</p>
                      <p className="text-sm text-gray-600">Get notified about submission reviews</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.submission_updates}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          submission_updates: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Product Sold</p>
                      <p className="text-sm text-gray-600">Get notified when someone buys your product</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.product_sold}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          product_sold: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-purple-50 hover:to-pink-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Marketing Emails</p>
                      <p className="text-sm text-gray-600">Receive updates about new features and offers</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.marketing_emails}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          marketing_emails: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={handleSaveNotifications}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <Mail className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Email Preferences</h2>
                    <p className="text-sm text-gray-600">Manage which emails you receive</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Master Email Toggle</p>
                      <p className="text-sm text-gray-600">Turn all email notifications on or off</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailNotificationsEnabled}
                      onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>
              </div>

              <div className={`space-y-3 transition-opacity ${!emailNotificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-blue-50 hover:to-cyan-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Order Confirmation Emails</p>
                      <p className="text-sm text-gray-600">Receive emails when orders are placed</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.order_updates}
                      onChange={(e) =>
                        setEmailPreferences({
                          ...emailPreferences,
                          order_updates: e.target.checked,
                        })
                      }
                      disabled={!emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Truck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Shipping Notifications</p>
                      <p className="text-sm text-gray-600">Get notified when items are shipped</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.shipping_updates}
                      onChange={(e) =>
                        setEmailPreferences({
                          ...emailPreferences,
                          shipping_updates: e.target.checked,
                        })
                      }
                      disabled={!emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-yellow-50 hover:to-amber-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Review Requests</p>
                      <p className="text-sm text-gray-600">Receive requests to review your purchases</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.review_requests}
                      onChange={(e) =>
                        setEmailPreferences({
                          ...emailPreferences,
                          review_requests: e.target.checked,
                        })
                      }
                      disabled={!emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-orange-50 hover:to-red-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <ShoppingCart className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Abandoned Cart Reminders</p>
                      <p className="text-sm text-gray-600">Get reminded about items left in cart</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.abandoned_cart_reminders}
                      onChange={(e) =>
                        setEmailPreferences({
                          ...emailPreferences,
                          abandoned_cart_reminders: e.target.checked,
                        })
                      }
                      disabled={!emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-purple-50 hover:to-pink-50 rounded-xl transition-all duration-200 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Marketing & Promotions</p>
                      <p className="text-sm text-gray-600">Receive special offers and updates</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.marketing_emails}
                      onChange={(e) =>
                        setEmailPreferences({
                          ...emailPreferences,
                          marketing_emails: e.target.checked,
                        })
                      }
                      disabled={!emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl">
                  <Cookie className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Cookie Preferences</h2>
                  <p className="text-sm text-gray-600">Manage how we use cookies on your device</p>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Current Cookie Settings
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">Your active cookie preferences:</p>
                  <div className="flex flex-wrap gap-2">
                    {cookiePreferences.essential && (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-red-100 to-red-50 text-red-800 text-xs rounded-full font-semibold border border-red-200 shadow-sm">
                        Essential Cookies
                      </span>
                    )}
                    {cookiePreferences.functional && (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 text-xs rounded-full font-semibold border border-blue-200 shadow-sm">
                        Functional Cookies
                      </span>
                    )}
                    {cookiePreferences.analytics && (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-green-50 text-green-800 text-xs rounded-full font-semibold border border-green-200 shadow-sm">
                        Analytics Cookies
                      </span>
                    )}
                    {cookiePreferences.marketing && (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800 text-xs rounded-full font-semibold border border-purple-200 shadow-sm">
                        Marketing Cookies
                      </span>
                    )}
                  </div>
                  {consentTimestamp && (
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      Last updated: {new Date(consentTimestamp).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={openPreferencesModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <Settings className="w-5 h-5" />
                  Manage Cookie Preferences
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Privacy & Security</h2>
                  <p className="text-sm text-gray-600">Manage your account security settings</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/profile')}
                className="w-full p-4 bg-gradient-to-r from-gray-50 to-gray-50 hover:from-red-50 hover:to-pink-50 rounded-xl text-left transition-all duration-200 flex items-center justify-between border border-gray-100 hover:border-red-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                    <User className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 block">Change Password</span>
                    <span className="text-sm text-gray-600">Update your account password</span>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-red-600 transition-colors text-xl">→</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-gradient-to-br from-red-100 to-red-200 rounded-xl">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Account Management</h2>
                  <p className="text-sm text-gray-600">Permanently delete your account and data</p>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                <div className="mb-4">
                  <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
                  <p className="text-sm text-red-800 leading-relaxed mb-3">
                    Once you delete your account, there is no going back. All your data, including products, orders, and profile information will be permanently removed.
                  </p>
                  <ul className="text-sm text-red-700 space-y-1 mb-4">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      All your products will be removed from the marketplace
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      Your order history will be deleted
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      This action cannot be undone
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete My Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account Permanently"
        description="This action cannot be undone. All your data will be permanently deleted from our servers. Please type DELETE below to confirm."
        confirmText="Permanently Delete Account"
        cancelText="Cancel"
        requiresTyping={true}
        typingConfirmation="DELETE"
        isDangerous={true}
      />
    </div>
  );
}
