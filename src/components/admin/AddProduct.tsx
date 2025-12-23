import { useState, useEffect } from 'react';
import { Sparkles, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AISmartProductUpload from '../AISmartProductUpload';

interface Category {
  id: string;
  name: string;
}

export default function AddProduct() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAIUpload, setShowAIUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true });

      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleAIComplete = async (productData: any) => {
    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('products')
        .insert({
          title: productData.title,
          description: productData.description,
          price: parseFloat(productData.price),
          original_price: productData.original_price ? parseFloat(productData.original_price) : null,
          condition: productData.condition || 'Like New',
          category_id: productData.category_id,
          image_url: productData.image_url,
          images: productData.images || [productData.image_url],
          status: 'available',
          seller_id: user?.id,
          features: productData.features || [],
          tags: productData.tags || []
        });

      if (error) throw error;

      alert('✅ Product added successfully with AI assistance!');
      setShowAIUpload(false);

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error('Error adding product:', error);
      alert('❌ Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Product</h1>
        <p className="text-sm text-gray-500">Dashboard &gt; Ecommerce &gt; Add product</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl border-2 border-emerald-200 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            AI-Powered Product Upload
          </h2>

          <p className="text-lg text-gray-600 mb-8">
            Upload a product image and let our AI automatically generate descriptions,
            suggest pricing, and recommend categories in seconds!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Analysis</h3>
              <p className="text-sm text-gray-600">
                AI analyzes your product image and generates detailed descriptions
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Category Detection</h3>
              <p className="text-sm text-gray-600">
                Automatically suggests the best category for your product
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Price Suggestion</h3>
              <p className="text-sm text-gray-600">
                Get intelligent pricing recommendations based on market data
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAIUpload(true)}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:from-emerald-700 hover:to-blue-700 transition shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
          >
            <Sparkles className="w-6 h-6" />
            Start AI Product Upload
          </button>

          <p className="text-xs text-gray-500 mt-4">
            Powered by Google Gemini AI & DeepSeek
          </p>
        </div>
      </div>

      {showAIUpload && (
        <AISmartProductUpload
          categories={categories}
          onComplete={handleAIComplete}
          onClose={() => setShowAIUpload(false)}
        />
      )}
    </div>
  );
}
