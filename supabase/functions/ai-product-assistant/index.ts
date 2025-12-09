import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  message: string;
  conversationHistory: Message[];
  currentStep: 'start' | 'category' | 'title' | 'condition' | 'submission_type' | 'price' | 'description' | 'images' | 'review';
  productData?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { message, conversationHistory, currentStep, productData }: RequestBody = await req.json();

    const systemPrompt = `أنت مساعد ذكي متخصص في مساعدة البائعين على إضافة منتجاتهم لمنصة خيرية.

🌟 **معلومات مهمة عن المنصة:**
هذه منصة خيرية تهدف لمساعدة المحتاجين. لديك 3 خيارات:
1. **التبرع** - أفضل خيار! تبرع بالمنتج مجاناً وساعد من يحتاجه
2. **البيع الرمزي** - بيع المنتج بسعر رمزي للمنصة الخيرية ($1-$5)
3. **البيع العام** - بيع المنتج بسعر السوق

**دورك المهم:**
- شجع البائع على التبرع أو البيع الرمزي بأسلوب ودود وغير مباشر
- وضح له الأثر الإيجابي لتبرعه
- اذكر أن التبرع يساعد المحتاجين مباشرة
- إذا اختار البيع العام، احترم قراره

**المراحل:**
- start: رحب بالبائع واسأله عن نوع المنتج، اذكر أنها منصة خيرية
- category: ساعده في اختيار الفئة المناسبة
- title: اقترح عنواناً جذاباً للمنتج
- condition: اسأل عن حالة المنتج
- submission_type: **مرحلة مهمة!** اشرح الخيارات الثلاثة وشجعه على التبرع أو البيع الرمزي
- price: إذا اختار بيع، ساعده في تحديد السعر المناسب
- description: ساعده في كتابة وصف احترافي
- images: اطلب صور المنتج
- review: راجع المعلومات واشكره على مساهمته الخيرية

**أسلوبك:**
- ودود ومحفز
- مختصر وواضح
- ركز على الأثر الإيجابي
- لا تضغط بشدة، فقط وجه بلطف

**أمثلة على الرسائل المشجعة:**
- "رائع! هل تعلم أن تبرعك سيساعد عائلة محتاجة؟"
- "البيع الرمزي ($1-$5) يساعدنا في دعم المحتاجين"
- "اختيار ممتاز! مساهمتك ستحدث فرقاً كبيراً"

كن ودوداً، مهنياً، ومحفزاً في إجاباتك.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${errorData}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    let suggestions = {};
    if (currentStep === 'title' && productData?.category) {
      suggestions = {
        suggestedTitle: extractSuggestion(aiResponse, ['اقترح', 'العنوان', 'يمكن'])
      };
    } else if (currentStep === 'submission_type') {
      suggestions = {
        recommendDonation: aiResponse.includes('تبرع') || aiResponse.includes('مجاناً')
      };
    } else if (currentStep === 'price') {
      suggestions = {
        suggestedPrice: extractPrice(aiResponse)
      };
    } else if (currentStep === 'description') {
      suggestions = {
        suggestedDescription: extractSuggestion(aiResponse, ['الوصف', 'يمكن كتابة', 'مثال'])
      };
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        suggestions: suggestions,
        nextStep: determineNextStep(currentStep, message),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in ai-product-assistant:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
        response: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.',
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

function extractPrice(text: string): number | null {
  const priceMatch = text.match(/\d+(\.\d+)?/);
  return priceMatch ? parseFloat(priceMatch[0]) : null;
}

function extractSuggestion(text: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      const parts = text.split(keyword);
      if (parts.length > 1) {
        const suggestion = parts[1].split(/[.،\n]/)[0].trim();
        if (suggestion.length > 5 && suggestion.length < 200) {
          return suggestion;
        }
      }
    }
  }
  return null;
}

function determineNextStep(
  currentStep: string,
  userMessage: string
): string {
  const steps = ['start', 'category', 'title', 'condition', 'submission_type', 'price', 'description', 'images', 'review'];
  const currentIndex = steps.indexOf(currentStep);
  
  if (currentStep === 'submission_type') {
    if (userMessage.includes('تبرع') || userMessage.includes('مجان')) {
      return 'description';
    }
  }
  
  if (currentIndex < steps.length - 1) {
    return steps[currentIndex + 1];
  }
  
  return 'review';
}
