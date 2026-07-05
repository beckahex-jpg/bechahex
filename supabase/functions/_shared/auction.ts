import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.84.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requireEnvironment() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase function environment is incomplete");
  }

  return { url, anonKey, serviceRoleKey };
}

export function serviceClient(): SupabaseClient {
  const { url, serviceRoleKey } = requireEnvironment();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticatedClient(req: Request): Promise<{
  client: SupabaseClient;
  user: User;
  token: string;
}> {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");

  const { url, anonKey } = requireEnvironment();
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid or expired session");

  return { client, user: data.user, token };
}

export function parseMoney(value: unknown, field: string, allowZero = false): number {
  const amount = typeof value === "number" ? value : Number(value);
  const minimum = allowZero ? 0 : 0.01;
  // Compare in cents with a float-noise tolerance: 19.99 * 100 === 1998.9999999999998
  // in IEEE-754, so a strict equality check rejects ~9% of legal USD amounts.
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < minimum || Math.abs(amount * 100 - cents) > 1e-6) {
    throw new Error(`${field} must be a valid USD amount with at most two decimals`);
  }
  return cents / 100;
}

export function suggestedIncrement(startingPrice: number): number {
  if (startingPrice < 100) return 1;
  if (startingPrice < 500) return 5;
  if (startingPrice < 1000) return 10;
  if (startingPrice < 5000) return 25;
  return 50;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
