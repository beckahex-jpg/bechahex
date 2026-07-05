interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookId?: string;
}

export function paypalConfig(): PayPalConfig {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const environment = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID") || undefined;
  if (!clientId || !clientSecret) throw new Error("PayPal server credentials are not configured");
  return {
    clientId,
    clientSecret,
    webhookId,
    baseUrl: environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  };
}

export async function paypalAccessToken(config = paypalConfig()): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`PayPal authentication failed with status ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("PayPal returned no access token");
  return String(data.access_token);
}

export function paypalMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid PayPal amount");
  return amount.toFixed(2);
}

