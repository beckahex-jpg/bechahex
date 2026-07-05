export interface StripeConfig {
  secretKey: string;
}

export function stripeConfig(): StripeConfig {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return { secretKey };
}

export function stripeWebhookSecret(): string {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

/* Stripe expects application/x-www-form-urlencoded with bracket notation
   for nested params (metadata[payment_id]=...). */
export async function stripeRequest(
  config: StripeConfig,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  idempotencyKey?: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Authorization": `Basic ${btoa(`${config.secretKey}:`)}`,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let url = `https://api.stripe.com/v1${path}`;
  let body: string | undefined;
  const encoded = params ? new URLSearchParams(params).toString() : "";
  if (method === "GET") {
    if (encoded) url += `?${encoded}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encoded;
  }

  const response = await fetch(url, { method, headers, body });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body: json as Record<string, unknown> };
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/* Verify a Stripe-Signature header against the RAW request body. */
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = new Map<string, string[]>();
  for (const piece of signatureHeader.split(",")) {
    const [key, value] = piece.split("=", 2);
    if (!key || !value) continue;
    const list = parts.get(key.trim()) || [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") || [];
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}
