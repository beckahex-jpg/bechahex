import { Facebook, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCookieConsent } from '../contexts/CookieConsentContext';

export default function Footer() {
  const navigate = useNavigate();
  const { openPreferencesModal } = useCookieConsent();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <footer className="hidden lg:block bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div
              onClick={() => { navigate('/'); scrollToTop(); }}
              className="flex flex-col leading-none mb-4 cursor-pointer hover:opacity-80 transition"
            >
              <span className="text-xl font-bold text-white">BECKAH</span>
              <span className="text-sm font-semibold text-amber-600">EXCHANGE</span>
            </div>
            <p className="text-sm leading-relaxed">
              A charitable marketplace by Beckah Foundation where every purchase makes a difference. Shop quality items and support our mission for a sustainable future.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/people/Beckah-foundation/61570981000570/?rdid=avyt8FdXJncKhMSw&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1GdYsaveqL%2F"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-blue-600 p-2 rounded-lg transition"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://x.com/intent/post?text=Beckah%20Foundation%20-%20https%3A%2F%2Ftr.ee%2FSFD9SaPm6n"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-black p-2 rounded-lg transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@beckah.foundation"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-pink-600 p-2 rounded-lg transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@beckahfoundation"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-red-600 p-2 rounded-lg transition"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Shop</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <button
                  onClick={() => { navigate('/products'); scrollToTop(); }}
                  className="hover:text-emerald-400 transition"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  onClick={() => { navigate('/'); scrollToTop(); }}
                  className="hover:text-emerald-400 transition"
                >
                  Featured Items
                </button>
              </li>
              <li>
                <button
                  onClick={() => { navigate('/'); scrollToTop(); }}
                  className="hover:text-emerald-400 transition"
                >
                  New Arrivals
                </button>
              </li>
              <li>
                <button
                  onClick={() => { navigate('/products'); scrollToTop(); }}
                  className="hover:text-emerald-400 transition"
                >
                  Categories
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Get Involved</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <button
                  onClick={() => { navigate('/submit-product'); scrollToTop(); }}
                  className="hover:text-emerald-400 transition"
                >
                  Donate Items
                </button>
              </li>
              <li>
                <a
                  href="https://www.beckah.org/donate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition"
                >
                  Make a Donation
                </a>
              </li>
              <li>
                <a
                  href="https://www.beckah.org/about"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition"
                >
                  Our Mission
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>United States of America</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                <a href="tel:+18446444434" className="hover:text-emerald-400 transition">+1 (844) 644-4434</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
                <a href="mailto:beckahex@beckah.org" className="hover:text-emerald-400 transition">beckahex@beckah.org</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-center md:text-left">
              © 2024 Beckah Foundation. All rights reserved. Supporting sustainable living and eco-friendly initiatives.
            </p>
            <div className="flex gap-6 text-sm">
              <button
                onClick={openPreferencesModal}
                className="hover:text-emerald-400 transition"
              >
                Cookie Settings
              </button>
              <a
                href="https://www.beckah.org/about-1"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition"
              >
                Privacy Policy
              </a>
              <a
                href="https://www.beckah.org/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition"
              >
                Terms & Conditions
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
