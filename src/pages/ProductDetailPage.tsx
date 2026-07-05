import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AuctionDetailPage from '../components/auction/AuctionDetailPage';
import FixedPriceDetailPage from '../components/FixedPriceDetailPage';
import type { FixedPriceProduct } from '../components/FixedPriceDetailPage';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';

interface Product extends FixedPriceProduct {
  created_at: string;
  seller_id: string;
  listing_type?: 'fixed_price' | 'auction';
  auctions?: Auction | Auction[] | null;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          auctions(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProduct(data as Product | null);
    } catch (error) {
      console.error('Error loading product:', error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-red-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <Package className="mb-4 h-20 w-20 text-gray-300" />
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Product Not Found</h2>
        <p className="mb-6 text-gray-600">This product may be unavailable or has been removed.</p>
        <button type="button" onClick={() => navigate('/products')} className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700">Back to Products</button>
      </div>
    );
  }

  const auction = product.listing_type === 'auction'
    ? (Array.isArray(product.auctions) ? product.auctions[0] : product.auctions) || null
    : null;

  if (auction) return <AuctionDetailPage product={product} auction={auction} />;
  return <FixedPriceDetailPage product={product} />;
}
