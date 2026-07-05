import { Heart, Users, Globe, TrendingUp } from 'lucide-react';

export default function ImpactSection() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Your Purchase Makes a Difference</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every item you buy supports our mission to create positive change in communities around the world
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="space-y-4 rounded-xl border border-emerald-100 p-6 text-center transition hover:bg-[#F2FAE8]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#064735] to-[#075D43] shadow-lg">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
            <div className="text-3xl font-bold text-gray-900">$500K+</div>
            <div className="text-gray-600 font-medium">Total Funds Raised</div>
          </div>

          <div className="space-y-4 rounded-xl border border-emerald-100 p-6 text-center transition hover:bg-[#F2FAE8]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#07513B] to-[#0B7654] shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900">15K+</div>
            <div className="text-gray-600 font-medium">People Helped</div>
          </div>

          <div className="space-y-4 rounded-xl border border-emerald-100 p-6 text-center transition hover:bg-[#F2FAE8]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B7654] to-[#1A936A] shadow-lg">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900">25+</div>
            <div className="text-gray-600 font-medium">Countries Reached</div>
          </div>

          <div className="space-y-4 rounded-xl border border-emerald-100 p-6 text-center transition hover:bg-[#F2FAE8]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#63A91F] to-[#9BEC2D] shadow-lg">
              <TrendingUp className="h-8 w-8 text-[#032F24]" />
            </div>
            <div className="text-3xl font-bold text-gray-900">10K+</div>
            <div className="text-gray-600 font-medium">Items Donated</div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#032F24] to-[#07513B] p-8 text-center text-white shadow-2xl md:p-12">
          <h3 className="text-3xl font-bold mb-4">Want to Make an Even Bigger Impact?</h3>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-emerald-100">
            Donate directly to our cause and help us reach more communities in need
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.beckah.org/donate"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer rounded-lg bg-[#9BEC2D] px-8 py-4 text-center font-semibold text-[#032F24] shadow-lg transition hover:bg-[#B8F653] hover:shadow-xl"
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
