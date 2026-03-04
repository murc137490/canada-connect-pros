import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a Canadian home services search assistant. Given a user's input, provide:
1. A corrected/improved version of their query
2. Up to 5 relevant service suggestions from these categories:
- Home Improvement (plumbing, electrical, HVAC, roofing, painting, flooring, etc.)
- Outdoor & Seasonal (snow removal, landscaping, pool services, etc.)
- Cleaning (house cleaning, carpet cleaning, etc.)
- Business Services (legal, accounting, IT, marketing, etc.)
- Events & Entertainment (photography, catering, DJs, etc.)
- Lessons & Tutoring (music, language, sports, academic)
- Pets (grooming, sitting, training)
- Wellness (fitness, coaching, spa)
- Moving & Storage
- Home Security & Inspection

Return JSON only: {"corrected": "...", "suggestions": ["service 1", "service 2", ...]}`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { suggestions: [] };
    }

    return new Response(
      JSON.stringify({
        corrected: parsed.corrected || query,
        suggestions: parsed.suggestions || []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search suggestions error:", error);
    return new Response(
      JSON.stringify({ error: error.message, suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
