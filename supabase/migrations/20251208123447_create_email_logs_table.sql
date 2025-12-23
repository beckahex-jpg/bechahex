/*
  # Email Logs Table

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key) - Unique identifier for each email log
      - `user_id` (uuid, foreign key) - References auth.users, nullable for system emails
      - `email_type` (text) - Type of email (welcome, order_confirmation, shipping_notification, etc.)
      - `recipient_email` (text) - Email address where the email was sent
      - `subject` (text) - Email subject line
      - `status` (text) - Status of email (pending, sent, failed, bounced)
      - `error_message` (text, nullable) - Error details if email failed
      - `sent_at` (timestamptz) - When the email was sent
      - `metadata` (jsonb, nullable) - Additional data (order_id, product_id, etc.)
      - `created_at` (timestamptz) - When the log entry was created

  2. Security
    - Enable RLS on `email_logs` table
    - Admin users can view all email logs
    - Regular users can view their own email logs
    
  3. Indexes
    - Index on user_id for fast user lookups
    - Index on email_type for filtering by type
    - Index on status for filtering by status
    - Index on sent_at for date range queries
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

CREATE POLICY "Admin users can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
