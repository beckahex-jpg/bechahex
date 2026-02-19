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
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured in Supabase secrets");
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY is not configured"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { imageBase64, mimeType } = await req.json();

    console.log("Request received:", {
      hasImageBase64: !!imageBase64,
      mimeType: mimeType || "not provided",
    });

    if (!imageBase64) {
      console.error("Missing image data in request");
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

    const prompt = `Analyze this product image and identify what product it is. Return ONLY valid JSON.

Available categories (choose the MOST RELEVANT one):
- Electronics (phones, computers, cameras, gadgets, tech accessories)
- Fashion (clothing, shoes, bags, accessories, jewelry, watches)
- Home & Garden (furniture, decor, kitchenware, bedding, plants, tools)
- Sports & Outdoors (sports equipment, camping gear, fitness, bikes)
- Books & Media (books, magazines, CDs, DVDs, vinyl records)
- Toys & Games (children's toys, board games, video games, puzzles)
- Automotive (car parts, accessories, tools, motorcycle items)
- Tools & Hardware (power tools, hand tools, construction equipment)

Return ONLY this JSON structure:
{
  "productName": "specific product name",
  "description": "detailed 40-60 word product description with key selling points",
  "features": ["list 3-5 key features or benefits"],
  "material": "primary material or construction",
  "targetAudience": "who would buy this",
  "suggestedCategories": ["EXACTLY ONE category from the list above that best matches"],
  "colors": ["visible colors in the product"],
  "brandInfo": "brand name if visible or recognizable",
  "tags": ["5-7 relevant search keywords"]
}`;

    console.log("Sending request to Groq API...");

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.2-90b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl
                  }
                }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      }
    );

    console.log("Groq API response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API error details:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      let userFriendlyMessage = "فشل تحليل الصورة";

      if (response.status === 400) {
        userFriendlyMessage = "مفتاح API غير صالح أو منتهي الصلاحية";
      } else if (response.status === 401) {
        userFriendlyMessage = "مفتاح API غير صالح";
      } else if (response.status === 403) {
        userFriendlyMessage = "ليس لديك إذن لاستخدام هذا API";
      } else if (response.status === 429) {
        userFriendlyMessage = "تم تجاوز حد الاستخدام. حاول مرة أخرى لاحقاً";
      } else if (response.status === 500) {
        userFriendlyMessage = "خطأ في خادم Groq. حاول مرة أخرى";
      }

      return new Response(
        JSON.stringify({
          error: userFriendlyMessage,
          statusCode: response.status,
          details: errorData
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("Groq API response received:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0
    });

    const textContent = data.choices[0]?.message?.content || "";
    console.log("Extracted text content length:", textContent.length);

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
        description: textContent || "Could not analyze product",
        features: [],
        material: "",
        targetAudience: "",
        suggestedCategories: [],
        colors: [],
        brandInfo: "",
        tags: []
      };
    }

    console.log("Returning analysis:", {
      hasProductName: !!analysis.productName,
      hasDescription: !!analysis.description
    });

    return new Response(
      JSON.stringify({ analysis }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});