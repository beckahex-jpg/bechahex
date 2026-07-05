import { useState, useEffect } from 'react';
import { Sparkles, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AISmartProductUpload from '../AISmartProductUpload';
import AuctionFields from '../auction/AuctionFields';
import ListingTypeSelector from '../auction/ListingTypeSelector';
import { auctionValuesAreValid, createDefaultAuctionValues, type ListingType } from '../../types/auctionForm';

interface Category {
  id: string;
  name: string;
}

interface AIProductData {
  title: string;
  description: string;
  category_id?: string;
  condition?: string;
  price: string | number;
  original_price?: string | number;
  image_url?: string;
  images?: Array<File | string>;
  features?: string[];
  tags?: string[];
}

export default function AddProduct() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAIUpload, setShowAIUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listingType, setListingType] = useState<ListingType>('fixed_price');
  const [auction, setAuction] = useState(createDefaultAuctionValues);

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

  const handleAIComplete = async (productData: AIProductData) => {
    try {
      setSubmitting(true);

      const files = (productData.images || []).filter((image: unknown): image is File => image instanceof File);
      if (listingType === 'auction') {
        if (!user || files.length === 0) throw new Error('An auction requires at least one product image.');
        const reviewImagePaths: string[] = [];
        for (const file of files) {
          const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from('auction-review-images').upload(path, file, { contentType: file.type });
          if (uploadError) throw uploadError;
          reviewImagePaths.push(path);
        }

        const { data, error } = await supabase.functions.invoke('create-auction', {
          body: {
            title: productData.title,
            description: productData.description,
            categoryId: productData.category_id || null,
            condition: productData.condition || 'Like New',
            reviewImagePaths,
            startingPrice: Number(auction.startingPrice),
            minimumBidIncrement: Number(auction.minimumBidIncrement),
            shippingCost: Number(auction.shippingCost),
            startsAt: new Date(auction.startsAt).toISOString(),
            endsAt: new Date(auction.endsAt).toISOString(),
            winnerPaymentWindowHours: Number(auction.winnerPaymentWindowHours),
            submissionType: 'public_sale',
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
        alert(data?.moderation?.status === 'blocked'
          ? `Auction was not published: ${data.moderation.reason || 'AI safety review rejected the product.'}`
          : data?.moderation?.approved
            ? 'Auction published successfully.'
            : 'The auction was saved, but AI review needs to be retried from Auction Management.');
        setShowAIUpload(false);
        window.dispatchEvent(new CustomEvent('products-updated'));
        return;
      }

      const imageUrls: string[] = [];
      for (const file of files) {
        const path = `${user?.id || 'admin'}/${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        imageUrls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
      }

      const { error } = await supabase
        .from('products')
        .insert({
          title: productData.title,
          description: productData.description,
          price: Number(productData.price),
          original_price: productData.original_price ? Number(productData.original_price) : null,
          condition: productData.condition || 'Like New',
          category_id: productData.category_id,
          image_url: imageUrls[0] || productData.image_url || '',
          images: imageUrls.length ? imageUrls : (productData.images || (productData.image_url ? [productData.image_url] : [])),
          status: 'available',
          listing_type: 'fixed_price',
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

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-black text-[#0b2e20]">Choose how this product will be sold</h2>
        <ListingTypeSelector value={listingType} onChange={setListingType} />
        {listingType === 'auction' && <AuctionFields value={auction} onChange={setAuction} />}
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
            disabled={submitting || (listingType === 'auction' && !auctionValuesAreValid(auction))}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:from-emerald-700 hover:to-blue-700 transition shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="w-6 h-6" />
            {submitting ? 'Publishing product...' : listingType === 'auction' && !auctionValuesAreValid(auction) ? 'Complete auction settings first' : 'Start AI Product Upload'}
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
