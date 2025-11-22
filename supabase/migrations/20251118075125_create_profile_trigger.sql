/*
  # Create Profile Trigger for Auto-Creation

  ## Purpose
  Automatically create a profile when a new user signs up in auth.users

  ## Changes
  1. Create a trigger function that runs when a new user is created
  2. The function automatically inserts a row into the profiles table
  3. This bypasses RLS because triggers run with elevated privileges

  ## Security
  - Trigger runs at database level with SECURITY DEFINER
  - Ensures every new user gets a profile automatically
  - No manual intervention needed
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
