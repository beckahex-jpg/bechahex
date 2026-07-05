import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: string | number;
  original_price: string | number | null;
  condition: string;
  category_id: string | null;
  image_url: string | null;
  images?: string[];
  status: string;
  seller_id: string | null;
  created_at: string;
  updated_at: string;
  listing_type?: 'fixed_price' | 'auction';
  submission_type?: 'donation' | 'symbolic_sale' | 'public_sale';
  rating_avg?: string | number;
  rating_count?: number;
  auctions?: Auction | Auction[] | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export function useProducts(categoryId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Realtime/broadcast refetches must not flash the loading spinner: the
    // grid would unmount (killing any open modal) on every remote bid.
    async function fetchProducts(silent = false) {
      try {
        if (!silent) setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);

          if (expiresAt && expiresAt < now) {
            console.log('Token expired, signing out...');
            await supabase.auth.signOut();
          }
        }

        let query = supabase
          .from('products')
          .select('*, auctions(*)')
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (categoryId) {
          query = query.eq('category_id', categoryId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setProducts(((data || []) as Product[]).filter((product) => {
          if (product.listing_type !== 'auction') return true;
          const auction = getProductAuction(product);
          return Boolean(auction && ['active', 'scheduled'].includes(auction.status));
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();

    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Products change detected:', payload);
          fetchProducts(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions'
        },
        () => {
          fetchProducts(true);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    const handleProductsRefresh = () => {
      console.log('Manual products refresh triggered');
      fetchProducts(true);
    };

    window.addEventListener('products-updated', handleProductsRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('products-updated', handleProductsRefresh);
    };
  }, [categoryId]);

  return { products, loading, error };
}

export function getProductAuction(product: Product): Auction | null {
  if (Array.isArray(product.auctions)) return product.auctions[0] || null;
  return product.auctions || null;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;

        setCategories(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  return { categories, loading, error };
}
