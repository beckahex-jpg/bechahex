import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    if (!DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    const { action, data } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "research_price":
        systemPrompt = "You are a pricing expert. Respond ONLY with valid JSON, no extra text.";
        userPrompt = `Quick price analysis for: ${data.productName}
Category: ${data.category || "General"}

Respond with ONLY this JSON:
{
  "marketAnalysis": "1 sentence",
  "pricePoints": {
    "budget": { "price": 10, "reasoning": "1 sentence" },
    "competitive": { "price": 20, "reasoning": "1 sentence" },
    "premium": { "price": 35, "reasoning": "1 sentence" }
  },
  "recommendedPrice": 20,
  "pricingStrategy": "1 sentence"
}`;
        break;

      case "enhance_description":
        systemPrompt = "You are a professional copywriter specializing in e-commerce product descriptions.";
        userPrompt = `Enhance this product description to be more engaging, SEO-friendly, and conversion-focused:

Product: ${data.productName}
Current Description: ${data.description}
Features: ${data.features?.join(", ") || "N/A"}
Target Audience: ${data.targetAudience || "General consumers"}

Provide an enhanced description (150-200 words) that:
- Highlights key benefits
- Uses persuasive language
- Includes relevant keywords
- Has clear structure with paragraphs

Return as JSON:
{
  "enhancedDescription": "string",
  "highlights": ["string"],
  "seoKeywords": ["string"]
}`;
        break;

      case "suggest_tags":
        systemPrompt = "You are an SEO and categorization expert.";
        userPrompt = `Generate relevant tags and keywords for this product:

Product: ${data.productName}
Description: ${data.description}
Category: ${data.category || "General"}

Provide 10-15 relevant tags for search optimization and categorization.

Return as JSON:
{
  "tags": ["string"],
  "primaryKeywords": ["string"],
  "secondaryKeywords": ["string"]
}`;
        break;

      case "chat_assistant":
        systemPrompt = "You are a helpful AI assistant for sellers. Help them improve their product listings, answer questions about best practices, and provide actionable advice.";
        userPrompt = data.message;
        break;

      case "complete_product":
        systemPrompt = "You are a product listing expert. Help complete missing product information.";
        userPrompt = `Based on this product information, fill in any missing details:

${JSON.stringify(data.productInfo, null, 2)}

Provide complete product details in JSON format:
{
  "title": "string",
  "description": "string (150-200 words)",
  "category": "string",
  "price": number,
  "comparePrice": number,
  "features": ["string"],
  "tags": ["string"],
  "targetAudience": "string",
  "suggestions": ["improvement suggestions"]
}`;
        break;

      default:
        throw new Error("Invalid action");
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("DeepSeek API error:", errorData);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content || "";

    let parsedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        parsedContent = { response: content };
      }
    } catch (e) {
      parsedContent = { response: content };
    }

    return new Response(
      JSON.stringify({ result: parsedContent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error with DeepSeek:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to process request",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});