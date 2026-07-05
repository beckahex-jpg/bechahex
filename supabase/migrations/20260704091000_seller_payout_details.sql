/*
  # Seller Payout Details

  Sellers are promised transfers to their "registered bank account", but there
  was nowhere to register one. This table stores where the admin should send
  manual payouts.

  Deliberately a separate table (NOT columns on profiles): profiles are
  publicly readable, bank details must never be.

  Security:
    - RLS: owner can read/insert/update their own row; admins can read all
      rows (to perform the transfer from the Payments section).
    - No DELETE policy for owners; clearing fields is enough and history of
      where money was sent stays intact.
*/

CREATE TABLE IF NOT EXISTS seller_payout_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'paypal')),
  bank_name text CHECK (bank_name IS NULL OR char_length(bank_name) <= 120),
  account_holder_name text CHECK (account_holder_name IS NULL OR char_length(account_holder_name) <= 120),
  iban text CHECK (iban IS NULL OR char_length(iban) <= 64),
  paypal_email text CHECK (paypal_email IS NULL OR char_length(paypal_email) <= 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_payout_details_user ON seller_payout_details(user_id);

ALTER TABLE seller_payout_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own payout details" ON seller_payout_details;
CREATE POLICY "Owners read own payout details"
  ON seller_payout_details FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all payout details" ON seller_payout_details;
CREATE POLICY "Admins read all payout details"
  ON seller_payout_details FOR SELECT TO authenticated
  USING (auction_current_user_is_admin());

DROP POLICY IF EXISTS "Owners insert own payout details" ON seller_payout_details;
CREATE POLICY "Owners insert own payout details"
  ON seller_payout_details FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update own payout details" ON seller_payout_details;
CREATE POLICY "Owners update own payout details"
  ON seller_payout_details FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON seller_payout_details FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON seller_payout_details TO authenticated;

CREATE TRIGGER trigger_seller_payout_details_updated_at
  BEFORE UPDATE ON seller_payout_details
  FOR EACH ROW EXECUTE FUNCTION set_auction_updated_at();

COMMENT ON TABLE seller_payout_details IS
  'Where the admin sends manual seller payouts (bank transfer or PayPal). Kept out of profiles because profiles are publicly readable.';
