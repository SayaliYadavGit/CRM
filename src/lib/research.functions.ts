import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import { z } from "zod";
import { SYSTEM_PROMPT, buildUserMessage, DOSSIER_SCHEMA, type Dossier } from "./research-prompt";
import { QITT_PROFILE, QITT_PRODUCTS } from "./qitt-data";

const Input = z.object({
  company_name: z.string().min(1),
  location: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * The validated research engine.
 *
 * Calls OpenAI's Responses API with GPT-5.5 + web search + structured outputs.
 * Returns a rich, evidence-led dossier matching the 7-rule prompt validated on
 * Häfele Middle East. The caller (mock-pipeline.ts) is responsible for
 * translating this rich output into the database schema.
 *
 * Cost: ~$1.50-2 per call. Time: 2-4 minutes.
 */
export const researchCompany = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<Dossier> => {
     // ─────────────────────────────────────────────────────────────
    // BRIDGE MODE FLAG
    // ─────────────────────────────────────────────────────────────
    // During the cost-saving bridge (May 2026 — ~3 weeks), research
    // is performed by Cowork on Minakshi's Mac, not by this server-side
    // OpenAI engine. This function is preserved untouched so we can
    // restore it instantly by setting RESEARCH_MODE=openai.
    //
    // To switch back: change RESEARCH_MODE in deployment env vars and
    // redeploy. No code changes needed. See BRIDGE_MODE.md.
    // ─────────────────────────────────────────────────────────────
    const researchMode = process.env.RESEARCH_MODE ?? "openai";
    if (researchMode === "cowork") {
      throw new Error(
        "BRIDGE_MODE: OpenAI engine is paused. Research happens via Cowork on Minakshi's Mac. " +
          "This function should not be called while RESEARCH_MODE=cowork. " +
          "To re-enable: set RESEARCH_MODE=openai in deployment env vars.",
      );
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY not configured. Add it to .env (local) and to your deploy host secrets.",
      );
    }

    const openai = new OpenAI({ apiKey });

    const userMessage = buildUserMessage(
      {
        company_name: data.company_name,
        location: data.location ?? null,
        contact_name: data.contact_name ?? null,
        contact_title: data.contact_title ?? null,
        notes: data.notes ?? null,
      },
      QITT_PROFILE,
      QITT_PRODUCTS,
    );

    console.log(
      `[research] Starting analysis: ${data.company_name} (${data.location ?? "no location"})`,
    );
    const startTime = Date.now();

    let response;
    try {
      response = await openai.responses.create({
        model: "gpt-5.5",
        instructions: SYSTEM_PROMPT,
        input: userMessage,
        tools: [{ type: "web_search" }],
        text: {
          format: {
            type: "json_schema",
            name: "dossier",
            schema: DOSSIER_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      console.error("[research] OpenAI API error:", e.status, e.message);
      if (e.status === 401) throw new Error("OpenAI API key invalid or missing.");
      if (e.status === 429) throw new Error("OpenAI rate limit hit. Try again in a moment.");
      if (e.status === 402 || e.status === 403)
        throw new Error("OpenAI billing/access issue. Check your account.");
      throw new Error(`OpenAI API error: ${e.message ?? "unknown"}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[research] Response received in ${elapsed}s`);

    const outputText = response.output_text;
    if (!outputText) {
      console.error("[research] Empty output_text. Full response:", JSON.stringify(response));
      throw new Error("OpenAI returned an empty response.");
    }

    let dossier: Dossier;
    try {
      dossier = JSON.parse(outputText) as Dossier;
    } catch (err) {
      console.error("[research] JSON parse failed. Raw output:", outputText.slice(0, 500));
      throw new Error("OpenAI returned malformed JSON.");
    }

    // Defensive post-validation: enforce Rule 2 + Rule 5 server-side even if the model slipped.
    sanitiseDossier(dossier);

    console.log(
      `[research] Dossier complete. Confidence: ${dossier.overall_confidence}, Contacts: ${dossier.contacts.length}, Problems: ${dossier.problem_statements.length}`,
    );

    return dossier;
  });

/**
 * Server-side guardrails. If the model slipped on Rule 2 or Rule 5, we clean it up
 * before the data reaches the database.
 */
function sanitiseDossier(d: Dossier): void {
  const validLinkedIn = /^https?:\/\/([a-z]{2}\.)?linkedin\.com\/in\//i;
  const productNames = ["NIZARA Ops", "NIZARA Shield", "NIZARA Build", "Spectra", "CAD2Quote"];

  // Rule 2: nullify any LinkedIn URL that isn't a real /in/ profile
  for (const c of d.contacts) {
    if (c.linkedin_url && !validLinkedIn.test(c.linkedin_url)) {
      console.warn(`[research] Invalid LinkedIn URL for ${c.name}, nulling: ${c.linkedin_url}`);
      c.linkedin_url = null;
      if (c.confidence > 50) c.confidence = 50;
    }
    if (c.source_url && c.source_url.includes("prospeo.io")) c.source_url = null;
    if (c.source_url && c.source_url.includes("zoominfo.com")) c.source_url = null;
    if (c.source_url && c.source_url.includes("rocketreach.co")) c.source_url = null;
  }

  // Rule 5: warn if product names leaked into outreach (do not auto-rewrite, but log)
  for (const o of d.outreach_drafts) {
    const allText = [o.linkedin_connect, o.linkedin_followup, o.email_subject, o.email_body].join(
      " ",
    );
    const leaks = productNames.filter((p) => allText.includes(p));
    if (leaks.length > 0) {
      console.warn(
        `[research] Rule 5 violation: product names ${JSON.stringify(leaks)} leaked into outreach for ${o.contact_name}`,
      );
    }
  }
}