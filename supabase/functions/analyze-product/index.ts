import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  description: string;
}

interface PriceSuggestion {
  symbolic: number;
  fair: number;
  market: number;
}

interface AnalysisResult {
  productName: string;
  description: string;
  category: string;
  condition: string;
  priceSuggestions: PriceSuggestion;
  charityMessage: string;
  confidence: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: AnalyzeRequest = await req.json();

    if (!body.description || body.description.trim().length === 0) {
      throw new Error('يجب تقديم وصف للمنتج');
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `أنت خبير في تحليل المنتجات لمنصة خيرية. حلل هذا المنتج:

"${body.description}"

**مهمتك:**
1. اقتراح اسم جذاب ومحترف (بالعربية)
2. كتابة وصف تسويقي منسق (بالعربية، 2-3 جمل)
3. تحديد الفئة المناسبة من القائمة أدناه
4. تقييم حالة المنتج
5. اقتراح 3 أسعار بالدولار:
   - رمزي ($1-$5): للتبرع للمنصة
   - عادل (40-60% من سعر السوق): سعر منصف
   - سوق (70-90% من سعر السوق): سعر عالي
6. رسالة تشجيعية لطيفة للتبرع (جملة واحدة)

**الفئات المتاحة:**
furniture, electronics, clothing, books, toys, sports, home, other

**حالات المنتج:**
Brand New, Like New, Good, Fair

**أرجع النتيجة فقط بصيغة JSON بهذا الشكل بالضبط (بدون markdown أو نص إضافي):**
{
  "productName": "الاسم بالعربي",
  "description": "وصف مختصر وجذاب",
  "category": "electronics",
  "condition": "Like New",
  "priceSuggestions": {
    "symbolic": 3,
    "fair": 25,
    "market": 50
  },
  "charityMessage": "رسالة تشجيعية",
  "confidence": 0.9
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].content.parts[0].text;

    let analysis: AnalysisResult;
    try {
      const cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      analysis = JSON.parse(cleanedResponse);

      if (!analysis.productName || !analysis.description || !analysis.category) {
        throw new Error('Invalid response structure');
      }

      if (!analysis.condition) {
        analysis.condition = 'Like New';
      }

      if (!analysis.priceSuggestions ||
          typeof analysis.priceSuggestions.symbolic !== 'number' ||
          typeof analysis.priceSuggestions.fair !== 'number' ||
          typeof analysis.priceSuggestions.market !== 'number') {
        analysis.priceSuggestions = {
          symbolic: 2,
          fair: 15,
          market: 30
        };
      }

      if (!analysis.charityMessage) {
        analysis.charityMessage = '💚 تبرعك سيساعد عائلة محتاجة';
      }

      if (!analysis.confidence) {
        analysis.confidence = 0.8;
      }

    } catch (e) {
      console.error('JSON parse error:', e, 'Response:', aiResponse);
      throw new Error('فشل تحليل استجابة الذكاء الاصطناعي');
    }

    return new Response(
      JSON.stringify(analysis),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-product:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'حدث خطأ في التحليل',
        productName: '',
        description: '',
        category: 'other',
        condition: 'Like New',
        priceSuggestions: { symbolic: 2, fair: 10, market: 20 },
        charityMessage: '💚 تبرعك سيساعد عائلة محتاجة',
        confidence: 0
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
