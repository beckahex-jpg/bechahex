/*
  # حذف قاعدة البيانات بالكامل
  
  1. الإجراءات
    - حذف جميع الجداول الموجودة
    - حذف جميع السياسات (RLS Policies)
    - حذف جميع الفهارس (Indexes)
    - حذف جميع الدوال (Functions)
  
  2. الجداول المحذوفة
    - donations
    - product_submissions
    - order_items
    - orders
    - products
    - categories
    - profiles
*/

-- حذف الجداول بالترتيب الصحيح (من التابعة إلى الرئيسية)
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS product_submissions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- حذف أي دوال مخصصة
DROP FUNCTION IF EXISTS generate_sku() CASCADE;
