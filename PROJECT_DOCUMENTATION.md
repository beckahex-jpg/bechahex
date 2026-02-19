# Beckah E-Commerce Platform - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Design](#database-design)
5. [Frontend Structure](#frontend-structure)
6. [Backend & Edge Functions](#backend--edge-functions)
7. [Authentication & Security](#authentication--security)
8. [Deployment Guide](#deployment-guide)
9. [Development Setup](#development-setup)
10. [Features & User Flows](#features--user-flows)

---

## Project Overview

**Beckah** is a comprehensive e-commerce platform designed for buying and selling products with advanced features including:

- **Multi-user Support**: Buyers, sellers, and administrators with distinct roles and permissions
- **Product Management**: Users can submit products for review, manage their listings, and track sales
- **Smart Product Analysis**: AI-powered product analysis using multiple APIs (OpenAI, DeepSeek, Gemini)
- **Order Management**: Complete order lifecycle management from creation to delivery
- **Email Notifications**: Automated email systems for orders, shipping, and user communications
- **Admin Dashboard**: Comprehensive admin panel for managing users, products, orders, and payments
- **Shopping Cart & Favorites**: Full e-commerce experience with cart and wishlist features
- **Multiple Payment Methods**: Integrated PayPal payment system
- **Product Categories**: Organized product browsing and filtering
- **Image Management**: Product image storage and management

---

## Technology Stack

### Frontend
- **React 18.3.1**: UI library with hooks and functional components
- **TypeScript 5.5.3**: Type-safe JavaScript
- **Vite 5.4.21**: Modern build tool and dev server
- **React Router 7.9.6**: Client-side routing
- **Tailwind CSS 3.4.1**: Utility-first CSS framework
- **Lucide React 0.344.0**: Icon library
- **PayPal React SDK 8.9.2**: Payment integration

### Backend & Database
- **Supabase**: PostgreSQL database with real-time capabilities and authentication
- **PostgreSQL**: Relational database with RLS (Row Level Security)
- **Supabase Edge Functions**: Serverless functions for backend logic

### External APIs & Services
- **OpenAI**: AI product analysis and recommendations
- **DeepSeek**: Alternative AI analysis
- **Google Gemini**: Image analysis capabilities
- **Resend**: Email delivery service
- **PayPal**: Payment processing
- **Firebase**: (Available for future use)

### DevOps & Deployment
- **Vercel**: Frontend hosting and deployment
- **Supabase Cloud**: Database and authentication hosting
- **GitHub**: Version control and repository

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  React App (Vite) + TypeScript + Tailwind CSS               │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐      ┌──────▼──────────┐
│   Supabase Auth  │      │ Edge Functions  │
│   (JWT Tokens)   │      │   (Deno)        │
└──────────────────┘      └────────┬────────┘
        │                          │
        │                  ┌───────▼────────┐
        │                  │ External APIs  │
        │                  │ (OpenAI, etc)  │
        │                  └────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│        Supabase Database (PostgreSQL)         │
│  - Authentication (auth.users)               │
│  - Data Tables (RLS Enabled)                 │
│  - Real-time Subscriptions                   │
│  - File Storage (Product Images)             │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│         Hosting & Deployment                  │
│  Frontend: Vercel                            │
│  Backend: Supabase Cloud                     │
│  Version Control: GitHub                     │
└──────────────────────────────────────────────┘
```

### Project Structure

```
project-root/
├── src/
│   ├── components/           # React UI components
│   │   ├── admin/           # Admin-specific components
│   │   ├── Header.tsx       # Navigation header
│   │   ├── Footer.tsx       # Footer component
│   │   └── ...              # Other UI components
│   ├── pages/               # Page components (routes)
│   │   ├── HomePage.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── CheckoutPage.tsx
│   │   ├── ProductDetailPage.tsx
│   │   └── ...              # Other pages
│   ├── contexts/            # React Context for state management
│   │   ├── AuthContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── NotificationContext.tsx
│   │   └── ...              # Other contexts
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuthGuard.ts
│   │   └── useProducts.ts
│   ├── lib/                 # Utility libraries
│   │   └── supabase.ts      # Supabase client setup
│   ├── utils/               # Utility functions
│   └── index.css            # Global styles
├── supabase/
│   ├── migrations/          # Database schema migrations (60+ files)
│   └── functions/           # Edge Functions (19 functions)
│       ├── send-email/
│       ├── send-order-confirmation/
│       ├── ai-product-assistant/
│       └── ...              # Other functions
├── public/                  # Static assets (images, logos)
├── .env                     # Environment variables
├── vite.config.ts           # Vite configuration
├── vercel.json              # Vercel deployment config
├── package.json             # npm dependencies
└── tailwind.config.js       # Tailwind CSS configuration
```

---

## Database Design

### Core Tables Overview

#### 1. **auth.users** (Supabase Built-in)
- Managed by Supabase
- Stores user credentials (email, password, etc.)
- Connected to profiles via UUID

#### 2. **profiles**
- Extends auth.users with additional user information
- Stores user preferences, notification settings, and role
- RLS policies ensure users can only view/edit their own profile

```sql
Fields:
- id (UUID, PK) - Links to auth.users
- email (TEXT)
- full_name (TEXT)
- phone, address, city, state, postal_code, country (TEXT)
- role (TEXT) - 'user' or 'admin'
- notification_* (BOOLEAN) - Email notification preferences
- created_at, updated_at (TIMESTAMPTZ)
```

#### 3. **categories**
- Product categories for organization
- Accessible by all users

```sql
Fields:
- id (UUID, PK)
- name (TEXT) - Category name
- description (TEXT)
- created_at (TIMESTAMPTZ)
```

#### 4. **products**
- Available products for purchase
- Created by sellers via admin approval
- RLS allows public viewing of approved products

```sql
Fields:
- id (UUID, PK)
- name, description (TEXT)
- price (DECIMAL)
- category_id (FK to categories)
- seller_id (FK to profiles)
- images (JSONB/TEXT[]) - Array of image URLs
- status (TEXT) - 'draft', 'published', 'archived'
- created_at, updated_at (TIMESTAMPTZ)
```

#### 5. **orders**
- Customer orders
- Tracks order status and payment info
- Links buyer and seller

```sql
Fields:
- id (UUID, PK)
- buyer_id (FK to profiles)
- seller_id (FK to profiles)
- status (TEXT) - 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
- total_amount (DECIMAL)
- payment_method (TEXT) - 'paypal', 'credit_card', etc.
- shipping_address (JSONB) - Structured address data
- created_at, updated_at (TIMESTAMPTZ)
```

#### 6. **order_items**
- Individual items within an order
- Links to products with quantity and price

```sql
Fields:
- id (UUID, PK)
- order_id (FK to orders)
- product_id (FK to products)
- quantity (INTEGER)
- price (DECIMAL) - Price at time of purchase
- created_at (TIMESTAMPTZ)
```

#### 7. **product_submissions**
- User-submitted products awaiting admin approval
- Sellers submit products for review

```sql
Fields:
- id (UUID, PK)
- user_id (FK to profiles) - Submitter
- product_id (FK to products) - Linked after approval
- name, description (TEXT)
- price (DECIMAL)
- category_id (FK to categories)
- status (TEXT) - 'pending', 'approved', 'rejected'
- admin_notes (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

#### 8. **cart_items**
- Shopping cart persistence
- User-specific cart entries

```sql
Fields:
- id (UUID, PK)
- user_id (FK to profiles)
- product_id (FK to products)
- quantity (INTEGER)
- created_at (TIMESTAMPTZ)
```

#### 9. **notifications**
- In-app notifications for users
- Tracks email sent status and delivery

```sql
Fields:
- id (UUID, PK)
- user_id (FK to profiles)
- type (TEXT) - 'order', 'product', 'promotion', etc.
- subject, message (TEXT)
- read (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### 10. **favorites**
- User's favorite/wishlist products

```sql
Fields:
- id (UUID, PK)
- user_id (FK to profiles)
- product_id (FK to products)
- created_at (TIMESTAMPTZ)
```

#### 11. **email_logs**
- Tracks all sent emails
- For debugging and compliance

```sql
Fields:
- id (UUID, PK)
- user_id (FK to profiles)
- recipient_email (TEXT)
- subject, body (TEXT)
- status (TEXT) - 'sent', 'failed', 'bounced'
- created_at (TIMESTAMPTZ)
```

#### Additional Tables
- **site_settings**: Configuration values
- **cart_abandonment_tracking**: For recovery campaigns
- **review_requests**: For requesting customer reviews
- **email_config**: Email service configuration
- **ai_product_assistant**: AI-generated product insights

### Security: Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:

1. **Users can only access their own data** (except public products)
2. **Admins can access all data** for management
3. **Anonymous users can view** products and categories
4. **Sellers can view their own submissions and products**

Example RLS Policy:
```sql
-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Database Migrations

Over 60 database migrations manage schema evolution:
- **Initial schema**: 20251118 - Core tables (profiles, categories, products, orders)
- **Profile enhancements**: 20251120 - Additional fields and triggers
- **Shipping integration**: 20251201 - Shipping address and payment tracking
- **Email system**: 20251208 - Email logs and preferences
- **AI features**: 20251123 - AI assistant table
- **Fixes & refinements**: Various migrations for policy fixes and optimizations

---

## Frontend Structure

### Routing

Application routes defined in `src/App.tsx`:

```
/                          - Home page with featured products
/products                  - All products page with filters
/product/:id              - Individual product detail
/dashboard                - User dashboard
/my-products              - User's submitted/selling products
/submit-product           - Submit new product
/checkout                 - Shopping cart and checkout
/order-confirmation/:id   - Order confirmation page
/orders                   - Buyer order history
/seller-orders            - Seller's incoming orders
/buyer-orders             - Buyer's received orders
/favorites                - Wishlist/favorites page
/profile                  - User profile management
/settings                 - User settings
/admin                    - Admin dashboard (new)
/admin-old                - Admin dashboard (legacy)
```

### State Management

**React Context API** is used for global state:

1. **AuthContext** (`src/contexts/AuthContext.tsx`)
   - Current user authentication state
   - Login/logout functionality
   - User role management

2. **CartContext** (`src/contexts/CartContext.tsx`)
   - Shopping cart items
   - Add/remove/update cart operations
   - Cart persistence

3. **NotificationContext** (`src/contexts/NotificationContext.tsx`)
   - User notifications
   - Real-time notification updates
   - Mark as read functionality

4. **FilterContext** (`src/contexts/FilterContext.tsx`)
   - Product filter states
   - Category and search filters
   - Sort options

5. **FavoritesContext** (`src/contexts/FavoritesContext.tsx`)
   - User's favorite products
   - Add/remove favorites

6. **ToastContext** (`src/contexts/ToastContext.tsx`)
   - Toast notifications (temporary alerts)
   - Success/error/info messages

7. **CookieConsentContext** (`src/contexts/CookieConsentContext.tsx`)
   - Cookie consent management
   - GDPR compliance

### Key Components

#### Layout Components
- **Header**: Navigation bar, search, user menu
- **Footer**: Company info, links, social media
- **BottomNavBar**: Mobile navigation bar

#### Product Components
- **ProductCard**: Individual product display
- **ProductGrid**: Grid layout of products
- **ProductDetailPage**: Full product information
- **QuickProductAnalyzer**: AI product analysis widget

#### Shopping Components
- **CartDrawer**: Side drawer for shopping cart
- **CheckoutPage**: Payment and shipping form
- **OrderConfirmationPage**: Order confirmation display

#### User Components
- **AuthModal**: Login/registration modal
- **ProfilePage**: User profile and settings
- **UserDashboard**: User's personal dashboard

#### Admin Components
- **AdminDashboard**: Admin management interface
- **ProductSubmissions**: Review user-submitted products
- **OrderManagement**: Manage all orders
- **UserManagement**: Manage user accounts
- **PaymentManagement**: Track payments

#### AI Components
- **AIProductAssistant**: Chat-like product assistant
- **SmartProductAnalyzer**: Detailed product analysis
- **AISmartProductUpload**: AI-powered product submission

---

## Backend & Edge Functions

### Supabase Edge Functions

Edge Functions are serverless functions running on Supabase infrastructure (Deno runtime).

#### 1. **Email Functions** (Most Critical)

**send-email** (`supabase/functions/send-email/index.ts`)
- Generic email sending function
- Supports templates and dynamic content
- Integrates with Resend email service

**send-order-confirmation**
- Sends order confirmation to buyer
- Triggered after successful order creation

**send-new-order-to-seller**
- Notifies seller of new order
- Includes order details and customer info

**send-product-status-notification**
- Notifies user when product is approved/rejected

**send-shipping-notification**
- Notifies buyer of shipping updates

**send-delivery-confirmation**
- Confirms successful delivery to buyer

**send-abandoned-cart**
- Recovery email for abandoned carts

**send-review-request**
- Requests customer review after delivery

#### 2. **AI Analysis Functions**

**ai-product-assistant** (`supabase/functions/ai-product-assistant/index.ts`)
- Interactive assistant for product questions
- Uses OpenAI API

**analyze-product**
- Analyzes product details and suggestions

**analyze-product-image**
- AI image analysis for product images

**deepseek-analyze**
- Alternative AI analysis using DeepSeek API

**gemini-analyze-image**
- Google Gemini image analysis

**groq-analyze-image**
- Groq API image analysis

#### 3. **Automation Functions**

**auto-validate-product**
- Automatically validates submitted products

**process-new-submission**
- Processes newly submitted products

#### Function Pattern

All Edge Functions follow this CORS-safe pattern:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Function logic here
    const result = await processRequest(req);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
```

### Calling Edge Functions from Frontend

```typescript
const callEdgeFunction = async (functionName: string, payload: any) => {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
};
```

---

## Authentication & Security

### Supabase Authentication

The application uses **Supabase Email/Password Authentication**:

1. **Registration**
   - User creates account with email and password
   - Supabase handles user creation and JWT token
   - Profile is automatically created via trigger

2. **Login**
   - Email and password authentication
   - JWT token issued and stored in browser
   - Session persists across page reloads

3. **Logout**
   - Clears session and local storage
   - JWT token invalidated

### AuthContext Implementation

```typescript
// src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Row Level Security (RLS)

All database tables have RLS policies ensuring:

- **Unauthenticated users**: Can only view public data (products, categories)
- **Authenticated users**: Can access their own data
- **Admins**: Can access and modify all data

Example:
```sql
-- Only admins can modify products
CREATE POLICY "Only admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Environment Variables Security

Sensitive keys are stored in `.env` file and never committed to git:

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ... (Backend only)
VITE_PAYPAL_CLIENT_ID=...
FROM_EMAIL=...
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...
RESEND_API_KEY=...
```

**Never commit `.env` to version control!**

---

## Deployment Guide

### Prerequisites

1. **GitHub Repository**: Code pushed to GitHub
2. **Supabase Project**: Database and authentication setup
3. **Vercel Account**: For frontend hosting
4. **PayPal Developer Account**: For payment processing
5. **API Keys**: OpenAI, Resend, etc.

### Step 1: Deploy Backend (Supabase)

#### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region (recommended: US for faster US users)
4. Get connection details from project settings

#### 1.2 Set Up Database

1. Go to Supabase Dashboard → SQL Editor
2. Run all migrations from `supabase/migrations/` in order:
   ```bash
   # Migrations are applied in chronological order automatically
   # Just ensure your .env has correct Supabase credentials
   ```

#### 1.3 Deploy Edge Functions

Edge functions are deployed using the MCP tools:

```bash
# Each function must be deployed individually
supabase functions deploy send-email
supabase functions deploy send-order-confirmation
supabase functions deploy ai-product-assistant
# ... deploy all 19 functions
```

#### 1.4 Configure Environment Variables

In Supabase Dashboard → Project Settings → Environment Variables:

```
RESEND_API_KEY=re_...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
PAYPAL_CLIENT_ID=...
FROM_EMAIL=info@yourcompany.com
```

### Step 2: Deploy Frontend (Vercel)

#### 2.1 Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import GitHub repository
4. Select repository and branch

#### 2.2 Configure Build Settings

```
Build Command: npm run build
Output Directory: dist
```

#### 2.3 Add Environment Variables

In Vercel Project Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PAYPAL_CLIENT_ID=...
```

#### 2.4 Deploy

1. Vercel automatically deploys on git push to main branch
2. Wait for build to complete
3. View deployment at `your-project.vercel.app`

### Step 3: Configure Domain

#### 3.1 Add Custom Domain (Optional)

1. In Vercel Project Settings → Domains
2. Add your custom domain
3. Update DNS records at domain registrar

#### 3.2 SSL Certificate

- Vercel automatically provisions SSL certificate
- HTTPS enabled for all deployments

### Step 4: Monitor Deployment

#### Vercel Monitoring
- Build logs: Deployments → select deployment → Logs
- Runtime logs: Deployments → Logs
- Analytics: Analytics tab shows performance metrics
- Environment variables verification

#### Supabase Monitoring
- Database logs: Logs tab
- Function execution: Edge Functions → Logs
- Performance metrics: Monitoring

### Production Checklist

- [ ] All environment variables configured
- [ ] Database RLS policies reviewed
- [ ] Edge functions deployed and tested
- [ ] CORS headers configured correctly
- [ ] Email service (Resend) verified
- [ ] Payment processing (PayPal) configured
- [ ] API rate limits set appropriately
- [ ] Error monitoring enabled
- [ ] Backup strategy in place
- [ ] Domain configured and SSL active
- [ ] Analytics and monitoring enabled

---

## Development Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git installed
- GitHub account
- Supabase account

### Local Development

#### 1. Clone Repository

```bash
git clone https://github.com/beckahex-jpg/bechahex.git
cd bechahex
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment Variables

Create `.env` file in project root (copy from example):

```
VITE_SUPABASE_URL=https://moiddznrwcazaupspuxt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PAYPAL_CLIENT_ID=...
```

#### 4. Start Development Server

```bash
npm run dev
```

This starts Vite dev server at `http://localhost:5173`

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### Debugging Tips

#### Browser DevTools
- F12 to open DevTools
- Console tab for JavaScript errors
- Network tab to inspect API calls
- Application tab to view localStorage/sessionStorage

#### Supabase Real-time Debugging
```typescript
// Listen to real-time database changes
supabase
  .from('products')
  .on('*', (payload) => {
    console.log('Product changed:', payload);
  })
  .subscribe();
```

#### Edge Function Testing
```bash
# Test function locally
supabase functions serve send-email --env-file .env

# Test with curl
curl -X POST http://localhost:54321/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "subject": "Test"}'
```

---

## Features & User Flows

### 1. User Registration & Authentication

**Flow**:
1. User navigates to app
2. Sees "Sign Up" button in AuthModal
3. Enters email and password
4. Supabase creates auth user
5. Profile automatically created via trigger
6. User redirected to dashboard

**Components Involved**:
- AuthModal, AuthContext, supabase.ts

**Database Changes**:
- `auth.users` table gets new user
- `profiles` table auto-populated via trigger

### 2. Product Discovery

**Flow**:
1. User browses home page or /products
2. Products loaded from database
3. User can filter by category, price, search
4. Click product to view details
5. See reviews, images, seller info

**Components Involved**:
- HomePage, AllProductsPage, ProductCard, ProductDetailPage
- FilterContext, useProducts hook

**Database Queries**:
```sql
SELECT * FROM products WHERE status = 'published'
ORDER BY created_at DESC LIMIT 20;
```

### 3. Add to Cart

**Flow**:
1. User views product
2. Click "Add to Cart"
3. CartContext updates
4. Item stored in database via cart_items table
5. Cart count updated in header

**Components Involved**:
- CartContext, CartDrawer, ProductDetailPage

**Database Changes**:
```sql
INSERT INTO cart_items (user_id, product_id, quantity)
VALUES (auth.uid(), $1, $2);
```

### 4. Checkout & Order Creation

**Flow**:
1. User clicks checkout
2. Enters shipping address
3. Selects PayPal payment
4. PayPal popup opens
5. After payment approval:
   - Order created in database
   - Cart cleared
   - Order confirmation email sent
   - Seller notification email sent

**Components Involved**:
- CheckoutPage, MultiPaymentOptions, PayPal integration

**Database Changes**:
```sql
-- Create order
INSERT INTO orders (buyer_id, seller_id, total_amount, payment_method, shipping_address)
VALUES ($1, $2, $3, $4, $5);

-- Create order items from cart
INSERT INTO order_items (order_id, product_id, quantity, price)
SELECT $1, product_id, quantity, (SELECT price FROM products WHERE id = product_id)
FROM cart_items WHERE user_id = auth.uid();

-- Clear cart
DELETE FROM cart_items WHERE user_id = auth.uid();
```

**Email Triggered**:
- send-order-confirmation to buyer
- send-new-order-to-seller to seller

### 5. Product Submission by Seller

**Flow**:
1. User navigates to /submit-product
2. Fills product details (name, description, price, images)
3. Optional: Uses AI product assistant for suggestions
4. Submits for review
5. Admin receives notification
6. Admin reviews in admin dashboard
7. Admin approves or rejects with notes
8. Seller notified of decision
9. If approved, product appears in marketplace

**Components Involved**:
- SubmitProduct, AIProductAssistant, AdminDashboard

**Database Changes**:
```sql
-- Create submission
INSERT INTO product_submissions (user_id, name, description, price, category_id, status)
VALUES (auth.uid(), $1, $2, $3, $4, 'pending');

-- After admin approval, create product
INSERT INTO products (name, description, price, category_id, seller_id, status)
VALUES ($1, $2, $3, $4, $5, 'published');

-- Update submission to link product
UPDATE product_submissions SET product_id = $1 WHERE id = $2;
```

### 6. Admin Dashboard Operations

**Features**:
- View all users with their roles
- Manage products (create, edit, delete, archive)
- Review product submissions
- Manage orders (change status, track shipments)
- View payment information
- Manage categories
- Send notifications to users

**Role Check**:
```typescript
// Only users with role = 'admin' can access
const isAdmin = userProfile?.role === 'admin';
```

### 7. Order Management (Seller View)

**Seller Orders Flow**:
1. Seller views /seller-orders
2. See all incoming orders for their products
3. Can mark as shipped with tracking number
4. Can view buyer information
5. Buyer automatically notified when status changes

**Database**:
```sql
SELECT * FROM orders WHERE seller_id = auth.uid();
```

### 8. Order Management (Buyer View)

**Buyer Orders Flow**:
1. Buyer views /orders
2. See all purchases with status
3. Track shipment status
4. Can leave review after delivery
5. Can request refund

**Database**:
```sql
SELECT * FROM orders WHERE buyer_id = auth.uid();
```

### 9. Favorites/Wishlist

**Flow**:
1. User clicks heart icon on product
2. Added to favorites table
3. Viewable at /favorites page
4. Can remove from favorites
5. Sorted by most recent

**Components Involved**:
- ProductCard, FavoritesPage, FavoritesContext

**Database**:
```sql
INSERT INTO favorites (user_id, product_id) VALUES (auth.uid(), $1);
```

### 10. Email Notifications

**Triggered Events**:
- Order confirmation → buyer + seller
- Order status update → buyer
- Shipping notification → buyer
- Delivery confirmation → buyer
- Product approval/rejection → seller
- Review request → buyer (after delivery)
- Abandoned cart recovery → buyer

**Implementation**:
- Database triggers → call Edge Function
- Edge Function processes → sends via Resend API
- Email logged in email_logs table

---

## Key Technologies Explained

### Vite vs Other Build Tools
- **Vite**: Extremely fast build and reload for development
- Uses ES modules natively in development
- Optimized production builds with rollup
- Better than Create React App for modern projects

### React Context vs Redux
- Context is simpler for medium-sized apps
- No additional dependencies
- Good for themes, auth, user preferences
- Could upgrade to Redux for very large apps

### Tailwind CSS Benefits
- Utility-first approach (more efficient than traditional CSS)
- No unused CSS in production (tree-shaking)
- Consistent design system
- Responsive design with breakpoints (sm, md, lg, xl)

### Supabase vs Firebase
- PostgreSQL is more powerful than Firebase Realtime DB
- Better for complex queries
- RLS provides built-in authorization
- More cost-effective at scale

### Edge Functions vs Traditional Backend
- No servers to manage
- Scales automatically
- Fast execution (within region)
- Pay only for usage
- Perfect for background jobs and integrations

---

## Troubleshooting Common Issues

### Issue: "Missing Supabase environment variables"
**Solution**: Ensure `.env` file exists with correct keys
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Issue: "User not authenticated"
**Solution**: Check session persistence
- Clear browser cache
- Check DevTools → Application → Cookies
- Verify VITE_SUPABASE_ANON_KEY is correct

### Issue: "Orders not appearing in Supabase"
**Solution**: Check RLS policies
```sql
-- Verify policy exists
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

### Issue: "Email not sending"
**Solution**: Check Resend API key and verify sender email
```typescript
// Test email function
console.log('Resend API Key:', process.env.RESEND_API_KEY);
```

### Issue: "PayPal payment failing"
**Solution**:
- Verify PayPal CLIENT_ID is correct
- Check payment mode (sandbox vs live)
- Review PayPal transaction logs

### Issue: "AI product analysis not working"
**Solution**:
- Verify API keys (OpenAI, DeepSeek, Gemini)
- Check API usage limits
- Review Edge Function logs

---

## Performance Optimization

### Frontend
- Lazy load routes with React.lazy()
- Image optimization with compression
- Cache busting with Vite hash versioning
- Tailwind purging unused CSS

### Database
- Indexes on frequently queried columns
- Query optimization with LIMIT and WHERE clauses
- Connection pooling via Supabase

### Edge Functions
- Keep functions small and focused
- Use caching for API responses
- Batch operations where possible
- Set appropriate timeouts

---

## Security Best Practices

1. **Never commit `.env` file** to git
2. **Use strong passwords** for database users
3. **Enable RLS** on all tables (required!)
4. **Validate input** on both client and server
5. **HTTPS only** in production (Vercel auto-enables)
6. **Regular backups** of database
7. **Monitor logs** for suspicious activity
8. **Keep dependencies updated** (npm audit)

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Documentation**: https://react.dev
- **Vite Guide**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com
- **TypeScript**: https://www.typescriptlang.org
- **Vercel Documentation**: https://vercel.com/docs

---

## Summary

This Beckah e-commerce platform is a complete, production-ready solution built with modern technologies. It demonstrates:

- Clean React architecture with hooks and context
- Secure database design with RLS
- Scalable backend with Edge Functions
- Professional deployment workflow
- Comprehensive feature set

The platform is designed to handle real business operations with proper authentication, data validation, error handling, and scalability considerations.

**Next Steps for New Developers**:
1. Clone the repository
2. Set up local environment with `.env`
3. Run `npm install && npm run dev`
4. Explore the codebase starting from `src/App.tsx`
5. Review database schema in `supabase/migrations/`
6. Check Edge Functions in `supabase/functions/`
7. Read inline code comments for context-specific details

---

**Project Last Updated**: February 2026
**Current Version**: 1.0.0
**License**: Proprietary
**Maintained By**: Beckah Development Team
