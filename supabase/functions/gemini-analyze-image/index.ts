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
      console.error("GEMINI_API_KEY is not configured in Supabase secrets");
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured. Please add it to Supabase Dashboard > Project Settings > Edge Functions > Secrets"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { imageUrl, imageBase64, mimeType } = await req.json();

    console.log("Request received:", {
      hasImageUrl: !!imageUrl,
      hasImageBase64: !!imageBase64,
      mimeType: mimeType || "not provided",
    });

    if (!imageUrl && !imageBase64) {
      console.error("Missing image data in request");
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
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const detectedMimeType = mimeType || (imageBase64.includes('data:') ? imageBase64.split(';')[0].split(':')[1] : 'image/jpeg');

      console.log("Processing base64 image:", {
        dataLength: base64Data.length,
        mimeType: detectedMimeType,
      });

      imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: detectedMimeType
        }
      };
    } else {
      console.log("Fetching image from URL:", imageUrl);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error("Failed to fetch image:", imageResponse.status);
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      const detectedMimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      console.log("Image fetched successfully:", {
        bufferSize: imageBuffer.byteLength,
        mimeType: detectedMimeType,
      });

      imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: detectedMimeType
        }
      };
    }

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

    console.log("Sending request to Gemini API...");

    const requestBody = {
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
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error details:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      let userFriendlyMessage = "فشل تحليل الصورة";

      if (response.status === 400) {
        userFriendlyMessage = "مفتاح API غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح في Supabase Dashboard";
      } else if (response.status === 403) {
        userFriendlyMessage = "ليس لديك إذن لاستخدام هذا API. تحقق من صلاحيات المفتاح";
      } else if (response.status === 429) {
        userFriendlyMessage = "تم تجاوز حد الاستخدام. حاول مرة أخرى لاحقاً";
      } else if (response.status === 500) {
        userFriendlyMessage = "خطأ في خادم Gemini. حاول مرة أخرى";
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
    console.log("Gemini API response received:", {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length || 0
    });

    const textContent = data.candidates[0]?.content?.parts[0]?.text || "";
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
    console.error("Error analyzing image:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    let userMessage = "حدث خطأ غير متوقع أثناء تحليل الصورة";

    if (error.message?.includes("GEMINI_API_KEY")) {
      userMessage = "مفتاح API غير موجود. يرجى التواصل مع الدعم الفني";
    } else if (error.message?.includes("fetch")) {
      userMessage = "فشل الاتصال بخدمة التحليل. تحقق من الإنترنت";
    } else if (error.message?.includes("JSON")) {
      userMessage = "خطأ في معالجة استجابة التحليل";
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
        technicalDetails: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});