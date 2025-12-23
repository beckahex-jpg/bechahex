/*
  # Add User Delete Policy for Product Submissions

  1. Changes
    - Add policy allowing users to delete their own product submissions
    - Users can only delete submissions they created (user_id = auth.uid())
  
  2. Security
    - Users can only delete their own submissions
    - Admin delete policy remains unchanged
*/

CREATE POLICY "Users can delete their own submissions"
  ON product_submissions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
