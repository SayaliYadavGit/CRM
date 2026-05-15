import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  company_name: z.string(),
  location: z.string().nullable().optional(),
  industry_hint: z.string().nullable().optional(),
});

const SCHEMA = {
  type: "object",
  properties: {
    industry: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    digital_maturity_rating: { type: "string", enum: ["Early", "Developing", "Established", "Advanced"] },
    relevant_products: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    industry_profile: { type: "string" },
    process_assessment: { type: "string" },
    digital_maturity: { type: "string" },
    ai_readiness: { type: "string" },
    problem_statements: { type: "string" },
    top_fits: { type: "string" },
    ai_recommendation: { type: "string" },
    product_mapping_table: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product: { type: "string" },
          problem: { type: "string" },
          how: { type: "string" },
          relevance: { type: "string", enum: ["High", "Medium", "Low"] },
          starter: { type: "string" },
        },
        required: ["product", "problem", "how", "relevance", "starter"],
      },
    },
  },
  required: [
    "industry", "confidence", "digital_maturity_rating", "relevant_products",
    "industry_profile", "process_assessment", "digital_maturity", "ai_readiness",
    "problem_statements", "top_fits", "ai_recommendation", "product_mapping_table",
  ],
} as const;

export const researchCompany = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a senior B2B account researcher for QITT Solutions, an AI/automation vendor selling NIZARA Ops, NIZARA Shield, NIZARA Build, Spectra (CAD2Quote), and Custom AI Automation to industrial operators (oil & gas, EPC, manufacturing, facilities, utilities) primarily in the UAE/GCC. Be specific, evidence-based, and avoid generic fluff. Output strictly the JSON tool call.`;

    const user = `Research target: ${data.company_name}${data.location ? ` (${data.location})` : ""}${data.industry_hint ? ` — sector hint: ${data.industry_hint}` : ""}.

Produce a complete sales-research dossier:
- industry (best-guess sector label)
- confidence (0-100, your honest signal strength)
- digital_maturity_rating + a paragraph
- 2-4 relevant_products from QITT's catalog
- industry_profile, process_assessment, ai_readiness paragraphs
- problem_statements: 4-6 bullet items each formatted "• <problem>\\n   Evidence: <e>\\n   Impact: <i>", separated by blank lines
- product_mapping_table: one row per relevant product
- top_fits + ai_recommendation summary paragraphs`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{ type: "function", function: { name: "submit_research", description: "Return the research dossier", parameters: SCHEMA } }],
        tool_choice: { type: "function", function: { name: "submit_research" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable Cloud.");
      throw new Error(`AI gateway ${res.status}`);
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no tool call");
    const parsed = JSON.parse(call.function.arguments);
    return parsed as {
      industry: string;
      confidence: number;
      digital_maturity_rating: string;
      relevant_products: string[];
      industry_profile: string;
      process_assessment: string;
      digital_maturity: string;
      ai_readiness: string;
      problem_statements: string;
      top_fits: string;
      ai_recommendation: string;
      product_mapping_table: Array<{ product: string; problem: string; how: string; relevance: string; starter: string }>;
    };
  });
