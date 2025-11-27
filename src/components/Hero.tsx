import { Heart, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string;
  images?: string[];
}

export default function Hero() {
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, title, price, image_url, images')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(2);

    if (data) {
      setFeaturedProducts(data);
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-gray-900 via-emerald-800 to-green-700 text-white overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-white/20">
              <Heart className="w-4 h-4 text-red-300" fill="currentColor" />
              Every purchase supports our mission
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              Discover Unique Items,
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Make a Difference
              </span>
            </h1>

            <p className="text-lg text-gray-100 leading-relaxed">
              Shop quality pre-owned and donated items. All proceeds support our charitable mission to make a positive impact in the community.
            </p>

            <div className="mt-6 relative z-10">
              <a
                href="https://www.beckah.org/donate"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer"
              >
                Donate Now
              </a>
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="flex gap-4 justify-center">
              {featuredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="bg-white rounded-xl p-5 shadow-2xl transform hover:scale-105 transition cursor-pointer group w-64"
                >
                  <div className="w-full h-40 rounded-lg mb-4 overflow-hidden bg-gray-100">
                    {(() => {
                      let images = product.images;
                      if (typeof images === 'string') {
                        try {
                          images = JSON.parse(images);
                        } catch {
                          images = [];
                        }
                      }
                      const imageUrl = (images && images.length > 0 ? images[0] : product.image_url) || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';

                      return (
                        <img
                          src={imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-gray-900 truncate">{product.title}</p>
                    <p className="text-xl font-bold text-emerald-600">${product.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute -top-4 -right-4 bg-emerald-400 text-gray-900 px-5 py-2 rounded-full font-bold shadow-xl animate-pulse">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                New Arrivals!
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
        </svg>
      </div>
    </section>
  );
}
