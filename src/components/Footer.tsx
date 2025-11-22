import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="hidden lg:block bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex flex-col leading-none mb-4">
              <span className="text-xl font-bold text-white">BECKAH</span>
              <span className="text-sm font-semibold text-amber-600">EXCHANGE</span>
            </div>
            <p className="text-sm leading-relaxed">
              A charitable marketplace by Beckah Foundation where every purchase makes a difference. Shop quality items and support our mission for a sustainable future.
            </p>
            <div className="flex gap-3">
              <button className="bg-gray-800 hover:bg-emerald-600 p-2 rounded-lg transition">
                <Facebook className="w-5 h-5" />
              </button>
              <button className="bg-gray-800 hover:bg-emerald-500 p-2 rounded-lg transition">
                <Twitter className="w-5 h-5" />
              </button>
              <button className="bg-gray-800 hover:bg-emerald-600 p-2 rounded-lg transition">
                <Instagram className="w-5 h-5" />
              </button>
              <button className="bg-gray-800 hover:bg-emerald-700 p-2 rounded-lg transition">
                <Youtube className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Shop</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition">All Products</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Featured Items</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Daily Deals</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">New Arrivals</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Categories</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Get Involved</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition">Donate Items</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Sell to Us</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Make a Donation</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Our Mission</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition">Impact Stories</a></li>
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
              <a href="#" className="hover:text-emerald-400 transition">Privacy Policy</a>
              <a href="#" className="hover:text-emerald-400 transition">Terms of Service</a>
              <a href="#" className="hover:text-emerald-400 transition">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
