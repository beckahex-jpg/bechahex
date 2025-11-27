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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Either imageUrl or imageBase64 is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let imagePart;
    if (imageBase64) {
      imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: "image/jpeg"
        }
      };
    } else {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      };
    }

    const prompt = `Analyze this product. Return ONLY this JSON structure:
{
  "productName": "name",
  "description": "40-60 word description",
  "features": ["3-4 key features"],
  "material": "material type",
  "targetAudience": "target",
  "suggestedCategories": ["2 categories"],
  "colors": ["main colors"],
  "brandInfo": "brand if visible",
  "tags": ["5-7 tags"]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                imagePart
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 10,
            topP: 0.7,
            maxOutputTokens: 500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.candidates[0]?.content?.parts[0]?.text || "";

    let analysis;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = {
          productName: "Unknown Product",
          description: textContent,
          features: [],
          material: "",
          targetAudience: "",
          suggestedCategories: [],
          colors: [],
          brandInfo: "",
          tags: []
        };
      }
    } catch (e) {
      analysis = {
        productName: "Unknown Product",
        description: textContent,
        features: [],
        material: "",
        targetAudience: "",
        suggestedCategories: [],
        colors: [],
        brandInfo: "",
        tags: []
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to analyze image",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});