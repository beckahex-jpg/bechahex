/*
  # Create AI Product Assistant Tables

  1. New Tables
    - `ai_product_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `conversation_data` (jsonb) - stores the full conversation
      - `product_suggestions` (jsonb) - AI suggested product details
      - `status` (text) - draft, completed, submitted
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `ai_product_conversations` table
    - Add policies for authenticated users to manage their own conversations
*/

CREATE TABLE IF NOT EXISTS ai_product_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_data jsonb DEFAULT '[]'::jsonb,
  product_suggestions jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'submitted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_product_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON ai_product_conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON ai_product_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_product_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_product_conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_product_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_product_conversations(status);
