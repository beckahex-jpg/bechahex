import { Heart, Users, Globe, TrendingUp } from 'lucide-react';

export default function ImpactSection() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Your Purchase Makes a Difference</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every item you buy supports our mission to create positive change in communities around the world
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="text-center space-y-4 p-6 rounded-xl hover:bg-blue-50 transition">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
            <div className="text-3xl font-bold text-gray-900">$500K+</div>
            <div className="text-gray-600 font-medium">Total Funds Raised</div>
          </div>

          <div className="text-center space-y-4 p-6 rounded-xl hover:bg-green-50 transition">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900">15K+</div>
            <div className="text-gray-600 font-medium">People Helped</div>
          </div>

          <div className="text-center space-y-4 p-6 rounded-xl hover:bg-purple-50 transition">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-500 rounded-2xl shadow-lg">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900">25+</div>
            <div className="text-gray-600 font-medium">Countries Reached</div>
          </div>

          <div className="text-center space-y-4 p-6 rounded-xl hover:bg-orange-50 transition">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900">10K+</div>
            <div className="text-gray-600 font-medium">Items Donated</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-8 md:p-12 text-white text-center shadow-2xl">
          <h3 className="text-3xl font-bold mb-4">Want to Make an Even Bigger Impact?</h3>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Donate directly to our cause and help us reach more communities in need
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.beckah.org/donate"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition shadow-lg hover:shadow-xl text-center cursor-pointer"
            >
              Make a Donation
            </a>
            <a
              href="https://www.beckah.org/about"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/20 transition text-center cursor-pointer"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
