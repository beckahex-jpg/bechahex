import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROHIBITED_ITEMS = [
  'weapon', 'gun', 'rifle', 'firearm', 'ammunition', 'explosive',
  'drug', 'narcotic', 'marijuana', 'cocaine', 'heroin',
  'alcohol', 'beer', 'wine', 'liquor', 'vodka', 'whiskey',
  'cigarette', 'tobacco', 'vape',
  'counterfeit', 'fake', 'replica',
];

interface ValidationRequest {
  submission_id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  user_price?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { submission_id, title, description, category, images, user_price } = await req.json() as ValidationRequest;

    // Step 1: Check for prohibited items
    const contentToCheck = `${title} ${description} ${category}`.toLowerCase();
    const isProhibited = PROHIBITED_ITEMS.some(item => contentToCheck.includes(item));

    if (isProhibited) {
      return new Response(
        JSON.stringify({
          approved: false,
          requires_manual_review: true,
          reason: "Product contains prohibited items and requires admin review",
          flagged_keywords: PROHIBITED_ITEMS.filter(item => contentToCheck.includes(item)),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Step 2: Use AI to determine appropriate price
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }

    const prompt = `You are a product pricing expert. Analyze this product and suggest a fair market price in USD.

Product Details:
- Title: ${title}
- Description: ${description}
- Category: ${category}
${user_price ? `- User suggested price: $${user_price}` : ''}

Based on similar products in the market, what would be a fair selling price? Consider:
1. Product condition
2. Market value
3. Similar products pricing
4. Category standards

Respond ONLY with a JSON object in this format:
{
  "suggested_price": <number>,
  "reasoning": "<brief explanation>",
  "confidence": "<high/medium/low>"
}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates[0].content.parts[0].text;

    // Extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    let pricingData;

    if (jsonMatch) {
      pricingData = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback pricing
      pricingData = {
        suggested_price: user_price || 10,
        reasoning: "Default pricing applied",
        confidence: "low"
      };
    }

    return new Response(
      JSON.stringify({
        approved: true,
        requires_manual_review: false,
        suggested_price: pricingData.suggested_price,
        pricing_reasoning: pricingData.reasoning,
        pricing_confidence: pricingData.confidence,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error('Error in auto-validate-product:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        approved: false,
        requires_manual_review: true,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
