# Beckah Platform - Architecture & Developer Guide

## Table of Contents
1. [Directory Structure in Detail](#directory-structure-in-detail)
2. [Data Flow Diagrams](#data-flow-diagrams)
3. [Component Architecture](#component-architecture)
4. [State Management Architecture](#state-management-architecture)
5. [Database Query Patterns](#database-query-patterns)
6. [API Integration Patterns](#api-integration-patterns)
7. [Authentication Flow](#authentication-flow)
8. [Error Handling Strategy](#error-handling-strategy)

---

## Directory Structure in Detail

### `/src/components`

#### Admin Components (`/src/components/admin`)
```
admin/
├── AddProduct.tsx           # Form to add products directly
├── AdminSettingsModal.tsx   # Configure site settings
├── CategoryManager.tsx      # Manage product categories
├── OrderManagement.tsx      # View and manage all orders
├── PaymentManagement.tsx    # Payment tracking and reconciliation
├── PaymentsSection.tsx      # Payment details display
├── ProductList.tsx          # Display all products
├── ProductSubmissions.tsx   # Review user submissions
├── QuickActionsMenu.tsx     # Admin quick action buttons
├── Sidebar.tsx              # Admin sidebar navigation
├── TopBar.tsx               # Admin top navigation
└── UserManagement.tsx       # Manage user accounts and roles
```

**Responsibilities**:
- Only accessible to users with `role = 'admin'`
- Each component handles one admin function
- Uses AuthContext to verify admin status

#### Public Components (`/src/components`)
```
├── Header.tsx               # Main navigation header
├── Footer.tsx               # Footer with links
├── BottomNavBar.tsx         # Mobile bottom navigation
├── Hero.tsx                 # Homepage hero section
├── ProductCard.tsx          # Reusable product card component
├── ProductGrid.tsx          # Grid of products
├── CartDrawer.tsx           # Shopping cart side drawer
├── CheckoutForm.tsx         # Not shown, part of CheckoutPage
├── NotificationDropdown.tsx # User notifications dropdown
├── OrderStatusBadge.tsx     # Order status indicator
├── PasswordStrengthMeter.tsx # Password validation UI
├── AuthModal.tsx            # Login/signup modal
├── ConfirmationModal.tsx    # Generic confirmation modal
├── EmptyStateDisplay.tsx    # Empty state fallback UI
├── ImpactSection.tsx        # Company impact display
├── MultiPaymentOptions.tsx  # Payment method selector
├── ToastContainer.tsx       # Toast notification container
├── CookieConsentBanner.tsx  # Cookie consent UI
├── CookiePreferencesModal.tsx # Cookie preferences
├── NotificationMessage.tsx  # Individual notification
├── AuthRedirect.tsx         # Handle auth redirects
├── AIProductAssistant.tsx   # Chat-like AI assistant
├── AISmartProductUpload.tsx # AI-powered product upload
├── SmartProductAnalyzer.tsx # Product analysis display
├── QuickProductAnalyzer.tsx # Quick analysis widget
└── QuickStatsCard.tsx       # Dashboard stat card
```

**Design Principles**:
- Single Responsibility: Each component does one thing
- Props over global state when possible
- Reusable across multiple pages
- Composition over inheritance

### `/src/pages`

Each page corresponds to a route and represents a full screen/view:

```
pages/
├── HomePage.tsx             # GET /          - Main landing page
├── AllProductsPage.tsx      # GET /products  - All products with filters
├── ProductDetailPage.tsx    # GET /product/:id - Individual product
├── UserDashboard.tsx        # GET /dashboard - User's personal dashboard
├── MyProductsPage.tsx       # GET /my-products - User's selling products
├── SubmitProduct.tsx        # GET /submit-product - Submit new product
├── CheckoutPage.tsx         # GET /checkout - Shopping cart & payment
├── OrderConfirmationPage.tsx # GET /order-confirmation/:id - Order success
├── OrderHistoryPage.tsx     # GET /orders - User's order history
├── SellerOrdersPage.tsx     # GET /seller-orders - Incoming orders
├── BuyerOrdersPage.tsx      # GET /buyer-orders - Received orders
├── FavoritesPage.tsx        # GET /favorites - Wishlist
├── ProfilePage.tsx          # GET /profile - User profile
├── SettingsPage.tsx         # GET /settings - User settings
├── AdminDashboard.tsx       # GET /admin-old - Legacy admin panel
└── NewAdminDashboard.tsx    # GET /admin - New admin panel
```

### `/src/contexts`

Global state management using React Context API:

```
contexts/
├── AuthContext.tsx          # User authentication state
├── CartContext.tsx          # Shopping cart state
├── NotificationContext.tsx  # User notifications
├── FilterContext.tsx        # Product filter state
├── FavoritesContext.tsx     # Favorite products
├── ToastContext.tsx         # Toast messages
├── CookieConsentContext.tsx # Cookie preferences
```

**Context Pattern**:
```typescript
// Standard context structure
export interface ContextType {
  // State
  value: Type;

  // Actions
  setValue: (value: Type) => void;
  action: () => Promise<void>;
}

export const Context = createContext<ContextType | undefined>(undefined);

export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<Type>(initialValue);

  useEffect(() => {
    // Load initial data
  }, []);

  return (
    <Context.Provider value={{ value, setValue, action }}>
      {children}
    </Context.Provider>
  );
};

export const useContext = () => {
  const context = useContext(Context);
  if (!context) throw new Error('useContext must be used within ContextProvider');
  return context;
};
```

### `/src/hooks`

Custom React hooks for reusable logic:

```
hooks/
├── useAuthGuard.ts          # Protect routes requiring authentication
└── useProducts.ts           # Fetch and manage products
```

**Custom Hook Pattern**:
```typescript
// Standard hook structure
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (filters?: ProductFilters) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'published')
        .range(0, 19);

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { products, loading, error, fetchProducts };
};
```

### `/src/lib`

Core library setup and utilities:

```
lib/
└── supabase.ts              # Supabase client initialization
```

**Supabase Client Pattern**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

### `/supabase/migrations`

Database schema versions (60+ files):

```
migrations/
├── 20251118*.sql        # Initial schema (profiles, categories, products)
├── 20251119*.sql        # Site settings and RLS fixes
├── 20251120*.sql        # Profile enhancements and cart
├── 20251121*.sql        # Admin policies
├── 20251122*.sql        # Role management
├── 20251123*.sql        # AI features
├── 20251201*.sql        # Shipping and payment
├── 20251205*.sql        # Email preferences
├── 20251208*.sql        # Email system
├── 20251209*.sql        # Transfer notes
├── 20251213*.sql        # Product submissions
└── 20251218*.sql        # Final configurations
```

**Migration Pattern**:
```sql
/*
  # Migration Title

  1. New Tables/Changes
    - table_name: Description

  2. Security
    - RLS enabled/policies

  3. Notes
    - Important context
*/

CREATE TABLE IF NOT EXISTS table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns
);

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### `/supabase/functions`

Edge Functions (Deno serverless):

```
functions/
├── send-email/
│   └── index.ts             # Generic email sender
├── send-order-confirmation/
│   └── index.ts             # Order confirmation email
├── send-new-order-to-seller/
│   └── index.ts             # Seller notification
├── send-product-status-notification/
│   └── index.ts             # Product approval/rejection
├── send-shipping-notification/
│   └── index.ts             # Shipping update
├── send-delivery-confirmation/
│   └── index.ts             # Delivery confirmation
├── send-abandoned-cart/
│   └── index.ts             # Cart recovery email
├── send-review-request/
│   └── index.ts             # Review request
├── ai-product-assistant/
│   └── index.ts             # AI chat assistant
├── analyze-product/
│   └── index.ts             # Product analysis
├── analyze-product-image/
│   └── index.ts             # Image analysis
├── deepseek-analyze/
│   └── index.ts             # DeepSeek AI analysis
├── gemini-analyze-image/
│   └── index.ts             # Gemini image analysis
├── groq-analyze-image/
│   └── index.ts             # Groq image analysis
├── auto-validate-product/
│   └── index.ts             # Auto-validate submissions
├── process-new-submission/
│   └── index.ts             # Process submissions
└── email-templates.ts       # Shared email templates
```

---

## Data Flow Diagrams

### User Registration Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. User enters email & password
       │
       ▼
┌──────────────────┐
│   AuthModal      │ User fills registration form
└──────┬───────────┘
       │
       │ 2. Submit form
       ▼
┌──────────────────┐
│  AuthContext     │ Call supabase.auth.signUp()
└──────┬───────────┘
       │
       │ 3. POST to Supabase Auth
       ▼
┌──────────────────┐
│  Supabase Auth   │
└──────┬───────────┘
       │
       │ 4. Create auth.users entry
       │ 5. Trigger profile creation
       ▼
┌──────────────────┐
│  Database        │
│  - auth.users    │
│  - profiles      │ (auto-created via trigger)
└──────┬───────────┘
       │
       │ 6. Return JWT token
       ▼
┌──────────────────┐
│  Browser         │ Store JWT in localStorage
│  (Storage)       │ Update AuthContext
└──────────────────┘
```

### Product Purchase Flow

```
┌──────────────────┐
│  Product Detail  │ User views product
└────────┬─────────┘
         │
         │ Click "Add to Cart"
         ▼
┌──────────────────┐
│  CartContext     │ Add item to state
└────────┬─────────┘
         │
         │ Update DB
         ▼
┌──────────────────┐
│   Supabase DB    │ INSERT INTO cart_items
│  cart_items      │
└────────┬─────────┘
         │
         │ User navigates to /checkout
         ▼
┌──────────────────┐
│  CheckoutPage    │ Display cart + shipping form
└────────┬─────────┘
         │
         │ User submits payment
         ▼
┌──────────────────┐
│  PayPal SDK      │ PayPal payment authorization
└────────┬─────────┘
         │
         │ On approval
         ▼
┌──────────────────┐
│  CheckoutPage    │ Create order in Supabase
└────────┬─────────┘
         │
         │ INSERT INTO orders
         │ INSERT INTO order_items (from cart)
         │ DELETE FROM cart_items
         ▼
┌──────────────────┐
│   Supabase DB    │
└────────┬─────────┘
         │
         │ Trigger: call send-order-confirmation
         │ Trigger: call send-new-order-to-seller
         ▼
┌──────────────────┐
│  Edge Function   │ Send confirmation email to buyer
└────────┬─────────┘
         │
         │ Call Resend API
         ▼
┌──────────────────┐
│  Resend Service  │ Send email
└────────┬─────────┘
         │
         │ Log in email_logs table
         ▼
┌──────────────────┐
│  Order Complete  │ Redirect to confirmation page
└──────────────────┘
```

### Product Submission Review Flow

```
┌──────────────────┐
│  User            │ Seller submits product
│  SubmitProduct   │
└────────┬─────────┘
         │
         │ INSERT INTO product_submissions
         ▼
┌──────────────────┐
│  Supabase DB     │ status = 'pending'
└────────┬─────────┘
         │
         │ Trigger: send notification to admin
         ▼
┌──────────────────┐
│  Admin Dashboard │ Admin sees submission
└────────┬─────────┘
         │
         │ Admin reviews details
         │ Admin clicks approve/reject
         ▼
┌──────────────────┐
│  Supabase DB     │ UPDATE product_submissions
│                  │ If approved: CREATE product
└────────┬─────────┘
         │
         │ Trigger: send notification to seller
         ▼
┌──────────────────┐
│  Edge Function   │ send-product-status-notification
└────────┬─────────┘
         │
         │ Send email
         ▼
┌──────────────────┐
│  Seller Email    │ "Your product was approved"
└──────────────────┘
```

---

## Component Architecture

### Presentational vs Container Pattern

**Presentational Components** (UI-focused):
```typescript
// ProductCard.tsx - Pure UI, receives data via props
interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
  onToggleFavorite: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleFavorite,
}) => {
  return (
    <div className="card">
      <img src={product.images[0]} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={onAddToCart}>Add to Cart</button>
      <button onClick={onToggleFavorite}>❤️</button>
    </div>
  );
};
```

**Container Components** (Logic-focused):
```typescript
// ProductGridContainer.tsx - Handles data fetching and state
export const ProductGrid: React.FC = () => {
  const { products, loading, fetchProducts } = useProducts();
  const { addToCart } = useCart();
  const { toggleFavorite } = useFavorites();

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="grid">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={() => addToCart(product.id)}
          onToggleFavorite={() => toggleFavorite(product.id)}
        />
      ))}
    </div>
  );
};
```

### Component Hierarchy Example

```
App
├── BrowserRouter
│   └── FilterProvider
│       └── AppContent
│           ├── Header
│           │   ├── Logo
│           │   ├── SearchBar
│           │   └── UserMenu
│           ├── Routes
│           │   ├── HomePage
│           │   │   ├── Hero
│           │   │   └── ProductGrid
│           │   ├── ProductDetailPage
│           │   │   ├── ProductImages
│           │   │   ├── ProductInfo
│           │   │   └── ReviewsSection
│           │   └── CheckoutPage
│           │       ├── OrderSummary
│           │       ├── ShippingForm
│           │       └── PaymentMethod
│           ├── Footer
│           ├── BottomNavBar
│           └── ToastContainer
```

---

## State Management Architecture

### Context Hierarchy

```
AuthContext (Top-level)
├── Provides: user, isAdmin, loading
├── Used by: All protected pages and components
└── Persists: Via Supabase session

CartContext
├── Provides: items, total, addItem, removeItem
├── Used by: Header, ProductCard, CartDrawer, CheckoutPage
└── Persists: Via Supabase cart_items table

NotificationContext
├── Provides: notifications, markAsRead
├── Used by: NotificationDropdown, Dashboard
└── Real-time: Supabase subscriptions

FilterContext
├── Provides: filters, setFilter
├── Used by: ProductGrid, ProductSearch
└── Persists: Via URL query params

ToastContext
├── Provides: showToast
├── Used by: All pages for temporary alerts
└── Duration: Auto-dismisses after 3-5 seconds
```

### Local Component State vs Global State

**Use Local State For**:
- Form input values
- Loading states
- Modal visibility
- Component-specific UI state

**Use Global State For**:
- Current user information
- Shopping cart (multi-page)
- Global notifications
- User preferences

**Example**:
```typescript
export const SubmitProductPage: React.FC = () => {
  // Local state for form
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Global state for user
  const { user } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      // Submit logic
      showToast('Product submitted successfully!', 'success');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    // JSX using both local and global state
  );
};
```

---

## Database Query Patterns

### Pattern 1: Fetch with Filters

```typescript
const fetchProducts = async (filters: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}) => {
  let query = supabase
    .from('products')
    .select('*')
    .eq('status', 'published');

  if (filters.category) {
    query = query.eq('category_id', filters.category);
  }

  if (filters.minPrice) {
    query = query.gte('price', filters.minPrice);
  }

  if (filters.maxPrice) {
    query = query.lte('price', filters.maxPrice);
  }

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
};
```

### Pattern 2: Create with Relations

```typescript
const createOrder = async (cartItems: CartItem[], shippingInfo: ShippingInfo) => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Calculate total
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      seller_id: cartItems[0].seller_id, // Assuming single seller for simplicity
      total_amount: total,
      payment_method: 'paypal',
      shipping_address: shippingInfo,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(
      cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
      }))
    );

  if (itemsError) throw itemsError;

  // Clear cart
  const { error: clearError } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', user.id);

  if (clearError) throw clearError;

  return order;
};
```

### Pattern 3: Real-time Subscriptions

```typescript
// Listen to order updates in real-time
export const subscribeToOrders = (userId: string, callback: (order: Order) => void) => {
  const subscription = supabase
    .from(`orders:buyer_id=eq.${userId}`)
    .on('*', (payload) => {
      callback(payload.new);
    })
    .subscribe();

  return subscription;
};

// Usage
useEffect(() => {
  const subscription = subscribeToOrders(user.id, (updatedOrder) => {
    setOrders(prev =>
      prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)
    );
  });

  return () => subscription.unsubscribe();
}, [user.id]);
```

### Pattern 4: Update with RLS Check

```typescript
const updateProduct = async (productId: string, updates: Partial<Product>) => {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    // RLS automatically checks if user is seller or admin
    .select()
    .single();

  if (error) {
    // Likely RLS violation (user not authorized)
    if (error.code === 'PGRST116') {
      throw new Error('You do not have permission to update this product');
    }
    throw error;
  }
};
```

---

## API Integration Patterns

### Pattern 1: Edge Function Call with Error Handling

```typescript
const callEdgeFunction = async (
  functionName: string,
  payload: any
): Promise<any> => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Function call failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Edge function ${functionName} failed:`, error);
    throw error;
  }
};

// Usage
const analyzeProduct = async (productData: Product) => {
  try {
    const analysis = await callEdgeFunction('analyze-product', {
      product_id: productData.id,
      description: productData.description,
    });
    return analysis;
  } catch (error) {
    showToast('Product analysis failed', 'error');
    throw error;
  }
};
```

### Pattern 2: PayPal Integration

```typescript
// Configure PayPal client
<PayPalScriptProvider options={{
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
  currency: 'USD',
}}>
  <PayPalButtons
    createOrder={(data, actions) => {
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: totalAmount.toString(),
          },
          description: `Order from Beckah - ${items.length} items`,
        }],
      });
    }}
    onApprove={async (data, actions) => {
      const order = await actions.order.capture();
      // Create order in our database
      await createOrder(items, order.id);
    }}
    onError={(error) => {
      showToast('Payment failed', 'error');
      console.error('PayPal error:', error);
    }}
  />
</PayPalScriptProvider>
```

### Pattern 3: External API Integration (OpenAI)

```typescript
// In Edge Function (Deno)
const analyzeProductWithAI = async (productDescription: string) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'You are a product expert. Analyze the product and suggest improvements.',
      }, {
        role: 'user',
        content: productDescription,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
```

---

## Authentication Flow

### Session Management

```typescript
// In App initialization
useEffect(() => {
  // Check if user has active session
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setUser({
        ...session.user,
        profile,
      });

      // Refresh token before expiry
      if (session.expires_at) {
        const expiresIn = session.expires_at - Math.floor(Date.now() / 1000);
        setTimeout(() => {
          supabase.auth.refreshSession();
        }, expiresIn * 1000 - 60000); // Refresh 1 minute before expiry
      }
    } else {
      setUser(null);
    }
  });
}, []);
```

### Protected Route Pattern

```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/'); // Redirect to home if not authenticated
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

// Usage
<Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
```

---

## Error Handling Strategy

### Frontend Error Handling

```typescript
// useAsyncOperation hook
const useAsyncOperation = <T,>(
  operation: () => Promise<T>
) => {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
    data: T | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const result = await operation();
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState({ loading: false, error: err, data: null });
      throw err;
    }
  }, [operation]);

  return { ...state, execute };
};

// Usage
const { loading, error, data, execute } = useAsyncOperation(() =>
  supabase.from('products').select('*')
);

const handleFetch = async () => {
  try {
    await execute();
  } catch (error) {
    showToast(error.message, 'error');
  }
};
```

### Server Error Handling

```typescript
// In Edge Function
Deno.serve(async (req: Request) => {
  try {
    // Main logic
    const result = await processRequest(req);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error('Function error:', message, error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### API Error Classification

```typescript
const classifyError = (error: any): {
  type: 'auth' | 'validation' | 'server' | 'network' | 'unknown';
  message: string;
  recoverable: boolean;
} => {
  if (error.status === 401) {
    return {
      type: 'auth',
      message: 'Please sign in again',
      recoverable: true,
    };
  }

  if (error.status === 422) {
    return {
      type: 'validation',
      message: 'Invalid input. Please check your data.',
      recoverable: true,
    };
  }

  if (error.status >= 500) {
    return {
      type: 'server',
      message: 'Server error. Please try again later.',
      recoverable: false,
    };
  }

  if (!navigator.onLine) {
    return {
      type: 'network',
      message: 'No internet connection',
      recoverable: true,
    };
  }

  return {
    type: 'unknown',
    message: 'Something went wrong',
    recoverable: false,
  };
};
```

---

## Summary

This architecture guide provides the foundational patterns and principles used throughout the Beckah platform. Understanding these patterns will help developers:

1. **Navigate the codebase** efficiently
2. **Maintain consistency** when adding features
3. **Implement best practices** for state management and data fetching
4. **Handle errors** appropriately
5. **Integrate external services** safely and reliably

The modular component structure and clear separation of concerns make the application scalable and maintainable as it grows.

---

**Document Version**: 1.0
**Last Updated**: February 2026
