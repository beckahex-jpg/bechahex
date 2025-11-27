/*
  # Create Notifications System

  ## New Tables
  
  ### `notifications`
  - `id` (uuid, primary key) - Unique notification identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `type` (text) - Notification type (order_update, submission_approved, submission_rejected, etc.)
  - `title` (text) - Notification title
  - `message` (text) - Notification message content
  - `data` (jsonb) - Additional data (order_id, submission_id, etc.)
  - `read` (boolean) - Whether the notification has been read
  - `created_at` (timestamptz) - When notification was created
  
  ## Security
  - Enable RLS on `notifications` table
  - Users can only view their own notifications
  - Users can update read status of their own notifications
  - System can insert notifications for any user
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update read status of their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System/Admin can insert notifications
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);