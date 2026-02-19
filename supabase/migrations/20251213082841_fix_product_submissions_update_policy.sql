/*
  # Fix Product Submissions Update Policy

  1. Changes
    - Drop the restrictive UPDATE policy that only allows pending submissions
    - Add a new UPDATE policy that allows users to update their own submissions regardless of status
    - This enables sellers to edit their approved products through My Products page

  2. Security
    - Users can only update their own submissions (checked via user_id)
    - Admin update policy remains unchanged
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can update their pending submissions" ON product_submissions;

-- Create new policy that allows users to update their own submissions
CREATE POLICY "Users can update their own submissions"
  ON product_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
