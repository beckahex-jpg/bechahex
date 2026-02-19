import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { submission_id } = await req.json();

    if (!submission_id) {
      throw new Error('submission_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: submission, error: fetchError } = await supabase
      .from('product_submissions')
      .select('*, categories(name)')
      .eq('id', submission_id)
      .single();

    if (fetchError || !submission) {
      throw new Error('Submission not found');
    }

    const contentToCheck = `${submission.title} ${submission.description} ${submission.categories?.name || ''}`.toLowerCase();
    const isProhibited = PROHIBITED_ITEMS.some(item => contentToCheck.includes(item));

    if (isProhibited) {
      await supabase
        .from('product_submissions')
        .update({
          ai_validation_status: 'flagged',
          ai_validation_notes: `Product contains prohibited items and requires admin review. Detected: ${PROHIBITED_ITEMS.filter(item => contentToCheck.includes(item)).join(', ')}`,
          requires_manual_review: true,
          status: 'pending'
        })
        .eq('id', submission_id);

      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map(admin => ({
            user_id: admin.id,
            type: 'warning',
            title: 'Product Requires Review',
            message: `Product "${submission.title}" requires manual review. Flagged by AI for prohibited items.`,
            link: '/admin/submissions'
          }))
        );
      }

      await supabase.from('notifications').insert({
        user_id: submission.user_id,
        type: 'info',
        title: 'Product Under Review',
        message: `Your product "${submission.title}" is being reviewed by our team. We will notify you once it is approved.`,
        link: '/dashboard'
      });

      return new Response(
        JSON.stringify({ success: true, approved: false, requires_review: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pricingData = {
      suggested_price: submission.price || 10,
      reasoning: "Price based on user suggestion",
      confidence: "medium"
    };

    if (geminiApiKey) {
      try {
        const prompt = `You are a product pricing expert. Analyze this product and suggest a fair market price in USD.

Product Details:
- Title: ${submission.title}
- Description: ${submission.description}
- Category: ${submission.categories?.name || 'Unknown'}
- Condition: ${submission.condition}
- User suggested price: $${submission.price}

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
              }
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const aiResponse = geminiData.candidates[0].content.parts[0].text;
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            pricingData = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiError) {
        console.error('AI pricing error:', aiError);
      }
    }

    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        title: submission.title,
        description: submission.description,
        category_id: submission.category_id,
        condition: submission.condition,
        price: pricingData.suggested_price,
        original_price: submission.original_price,
        stock: 1,
        images: submission.images,
        status: 'available'
      })
      .select()
      .single();

    if (productError) throw productError;

    await supabase
      .from('product_submissions')
      .update({
        ai_validation_status: 'approved',
        ai_suggested_price: pricingData.suggested_price,
        ai_validation_notes: pricingData.reasoning,
        requires_manual_review: false,
        auto_published: true,
        status: 'approved',
        final_price: pricingData.suggested_price,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', submission_id);

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map(admin => ({
          user_id: admin.id,
          type: 'system',
          title: 'Auto-Published Product',
          message: `Product "${submission.title}" was automatically validated and published. AI suggested price: $${pricingData.suggested_price}`,
          link: '/admin/products'
        }))
      );
    }

    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      type: 'success',
      title: 'Product Published!',
      message: `Your product "${submission.title}" has been automatically approved and published at $${pricingData.suggested_price}.`,
      link: '/dashboard'
    });

    return new Response(
      JSON.stringify({
        success: true,
        approved: true,
        product_id: newProduct.id,
        suggested_price: pricingData.suggested_price
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error processing submission:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});