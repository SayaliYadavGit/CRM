import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Stage } from "./types";
import type { Dossier } from "./research-prompt";

// ─────────────────────────────────────────────────────────────
// COWORK BRIDGE ENDPOINT
// ─────────────────────────────────────────────────────────────
// During the 3-week cost-saving bridge, Cowork on Minakshi's Mac
// performs the AI research (consuming her Max plan tokens, not
// the OpenAI API). When done, Cowork POSTs the rich dossier here.
//
// This endpoint:
//   1. Verifies the shared-secret token
//   2. Validates the dossier shape against the existing JSON schema
//   3. Translates the rich dossier into Minakshi's DB schema
//      (REUSING the same formatters as mock-pipeline.ts)
//   4. Writes companies / contacts / outreach / outreach_order rows
//   5. Marks the queue row as 'done'
//   6. Logs the activity
//
// When the bridge ends, this file can be deleted — no migration
// needed. The rows it writes are identical in shape to the rows
// that the OpenAI path writes, so the team's data is consistent
// across the switch.
// ─────────────────────────────────────────────────────────────

// Input schema: queue_id + the full Dossier shape from research-prompt.ts
const ContactSchema = z.object({
  name: z.string(),
  title: z.string(),
  department: z.string(),
  linkedin_url: z.string().nullable(),
  twitter: z.string().nullable(),
  found_on: z.string(),
  profile: z.string(),
  recent_activity: z.string().nullable(),
  why_this_person: z.string(),
  outreach_angle: z.string(),
  source_url: z.string().nullable(),
  confidence: z.number().int().min(0).max(100),
});

const ProblemSchema = z.object({
  title: z.string(),
  evidence: z.string(),
  impact: z.string(),
});

const ProductMappingSchema = z.object({
  problem: z.string(),
  product_name: z.string(),
  relevance: z.enum(["High", "Medium", "Low"]),
  how_it_solves: z.string(),
});

const TopFitSchema = z.object({
  rank: z.number().int().min(1).max(3),
  product_name: z.string(),
  problem: z.string(),
  narrative: z.string(),
});

const OutreachDraftSchema = z.object({
  contact_name: z.string(),
  linkedin_connect: z.string(),
  linkedin_followup: z.string(),
  email_subject: z.string(),
  email_body: z.string(),
});

const OutreachOrderSchema = z.object({
  rank: z.number().int().min(1),
  name: z.string(),
  reason: z.string(),
});

const DossierSchema = z.object({
  industry: z.string(),
  company_overview: z.object({
    narrative: z.string(),
    size_summary: z.string(),
    key_clients: z.string(),
    recent_news: z.string(),
    certifications: z.string(),
    confidence: z.number().int().min(0).max(100),
  }),
  process_assessment: z.object({
    core_processes: z.string(),
    manual_process_areas: z.array(z.string()),
    regulatory_frameworks: z.string(),
    confidence: z.number().int().min(0).max(100),
  }),
  digital_maturity: z.object({
    rating: z.enum(["Nascent", "Developing", "Established", "Advanced", "Unknown"]),
    narrative: z.string(),
    confidence: z.number().int().min(0).max(100),
  }),
  ai_readiness: z.object({
    appetite: z.enum(["Low", "Low-Medium", "Medium", "Medium-High", "High", "Unknown"]),
    narrative: z.string(),
    confidence: z.number().int().min(0).max(100),
  }),
  problem_statements: z.array(ProblemSchema),
  product_mapping: z.array(ProductMappingSchema),
  top_fits: z.array(TopFitSchema),
  contacts: z.array(ContactSchema),
  outreach_drafts: z.array(OutreachDraftSchema),
  outreach_order: z.array(OutreachOrderSchema),
  relevant_products: z.array(z.string()),
  overall_confidence: z.number().int().min(0).max(100),
  priority_recommendation: z.number().int().min(1).max(10),
  gaps: z.string(),
});

const SubmitInputSchema = z.object({
  // The queue row this dossier corresponds to
  queue_id: z.string().uuid(),
  // The full research dossier from Cowork
  dossier: DossierSchema,
  // Shared secret token for auth (Cowork must include this)
  token: z.string(),
});

// ─────────────────────────────────────────────────────────────
// Formatters: rich Dossier → DB string shape
// (These match mock-pipeline.ts so output is identical whether
//  OpenAI or Cowork did the research.)
// ─────────────────────────────────────────────────────────────

function formatProblemsForDb(problems: Dossier["problem_statements"]): string {
  return problems
    .map((p) => `• ${p.title}\n   Evidence: ${p.evidence}\n   Impact: ${p.impact}`)
    .join("\n\n");
}

function formatTopFitsForDb(fits: Dossier["top_fits"]): string {
  return fits
    .map((f) => `#${f.rank}: ${f.product_name} — ${f.problem}\n${f.narrative}`)
    .join("\n\n");
}

function formatCompanyOverview(d: Dossier): string {
  const co = d.company_overview;
  const sections = [
    co.narrative,
    co.size_summary ? `Size: ${co.size_summary}` : null,
    co.key_clients ? `Key clients: ${co.key_clients}` : null,
    co.recent_news ? `Recent news: ${co.recent_news}` : null,
    co.certifications ? `Certifications: ${co.certifications}` : null,
  ].filter(Boolean);
  return sections.join("\n\n");
}

function formatProcessAssessment(d: Dossier): string {
  const pa = d.process_assessment;
  const manualList = pa.manual_process_areas.map((m) => `• ${m}`).join("\n");
  return [
    pa.core_processes,
    manualList ? `\nManual process areas:\n${manualList}` : "",
    pa.regulatory_frameworks ? `\nRegulatory frameworks: ${pa.regulatory_frameworks}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatAiReadiness(d: Dossier): string {
  return `Appetite: ${d.ai_readiness.appetite}\n\n${d.ai_readiness.narrative}`;
}

function formatAiRecommendation(d: Dossier): string {
  const top = d.top_fits[0];
  const lead = top
    ? `Lead with ${top.product_name} against ${top.problem}. ${top.narrative}`
    : "No high-confidence product fit identified — focus on discovery conversation.";
  const gapsLine = d.gaps ? `\n\nKnown gaps: ${d.gaps}` : "";
  return lead + gapsLine;
}

function formatProductMappingForDb(mapping: Dossier["product_mapping"]) {
  return mapping.map((m) => ({
    product: m.product_name,
    problem: m.problem,
    how: m.how_it_solves,
    relevance: m.relevance,
    starter: "Open with a question about this problem area, not the product.",
  }));
}

// ─────────────────────────────────────────────────────────────
// Endpoint
// ─────────────────────────────────────────────────────────────

export const submitDossierFromCowork = createServerFn({ method: "POST" })
  .inputValidator((d) => SubmitInputSchema.parse(d))
  .handler(async ({ data }) => {
    // Auth: verify the shared secret token
    const expectedToken = process.env.COWORK_BRIDGE_TOKEN;
    if (!expectedToken) {
      console.error("[cowork-bridge] COWORK_BRIDGE_TOKEN env var not set on server");
      throw new Error("Server misconfigured: bridge token missing");
    }
    if (data.token !== expectedToken) {
      console.warn("[cowork-bridge] Auth failure: invalid token presented");
      throw new Error("Unauthorized");
    }

    // We use the service-role Supabase client here because this endpoint
    // is called by Cowork (machine-to-machine), not by an authenticated user.
    // Service role bypasses RLS so the write succeeds.
    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[cowork-bridge] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Server misconfigured: Supabase credentials missing");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up the queue row
    const { data: queueRow, error: queueErr } = await supabase
      .from("queue")
      .select("*")
      .eq("id", data.queue_id)
      .maybeSingle();

    if (queueErr || !queueRow) {
      throw new Error(`Queue row not found: ${data.queue_id}`);
    }

    const d = data.dossier;

    // Build the companies payload (same shape as mock-pipeline.ts produces)
    const companyPayload: Record<string, unknown> = {
      industry: d.industry,
      confidence: d.overall_confidence,
      priority: d.priority_recommendation,
      relevant_products: d.relevant_products,
      industry_profile: formatCompanyOverview(d),
      process_assessment: formatProcessAssessment(d),
      digital_maturity_rating: d.digital_maturity.rating,
      digital_maturity: d.digital_maturity.narrative,
      ai_readiness: formatAiReadiness(d),
      problem_statements: formatProblemsForDb(d.problem_statements),
      product_mapping_table: JSON.stringify(formatProductMappingForDb(d.product_mapping)),
      top_fits: formatTopFitsForDb(d.top_fits),
      ai_recommendation: formatAiRecommendation(d),
    };

    // Check for existing company (re-run support)
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", queueRow.company_name)
      .ilike("location", queueRow.location ?? "")
      .maybeSingle();

    let companyId: string;

    if (existing) {
      // Update existing company
      companyId = existing.id;
      await supabase.from("companies").update(companyPayload).eq("id", companyId);
      // Clear out contacts/outreach for re-run
      await supabase.from("contacts").delete().eq("company_id", companyId);
      await supabase.from("outreach").delete().eq("company_id", companyId);
      await supabase.from("outreach_order").delete().eq("company_id", companyId);
    } else {
      // Insert new company
      const { data: created, error: insertErr } = await supabase
        .from("companies")
        .insert({
          ...companyPayload,
          name: queueRow.company_name,
          location: queueRow.location,
          stage: "researched" as Stage,
          created_by: queueRow.submitted_by,
          assigned_email: queueRow.submitted_email,
        })
        .select()
        .single();
      if (insertErr || !created) {
        throw insertErr ?? new Error("Failed to create company");
      }
      companyId = created.id;
    }

    // Insert contacts
    const contactsToInsert = d.contacts.map((c) => ({
      company_id: companyId,
      name: c.name,
      title: c.title,
      department: c.department,
      linkedin: c.linkedin_url,
      twitter: c.twitter,
      found_on: c.found_on,
      profile: c.profile,
      recent_activity: c.recent_activity,
      why: c.why_this_person,
      outreach_angle: c.outreach_angle,
      source: c.source_url,
      email:
        c.found_on?.toLowerCase().includes("provided") && queueRow.contact_email
          ? queueRow.contact_email
          : null,
      phone:
        c.found_on?.toLowerCase().includes("provided") && queueRow.contact_phone
          ? queueRow.contact_phone
          : null,
    }));

    if (contactsToInsert.length > 0) {
      const { error: contactErr } = await supabase.from("contacts").insert(contactsToInsert);
      if (contactErr) throw contactErr;
    }

    // Insert outreach drafts
    const outreachToInsert = d.outreach_drafts.map((o) => {
      const matchingContact = d.contacts.find((c) => c.name === o.contact_name);
      return {
        company_id: companyId,
        contact_name: o.contact_name,
        department: matchingContact?.department ?? "Unknown",
        linkedin_connect: o.linkedin_connect,
        linkedin_followup: o.linkedin_followup,
        email_subject: o.email_subject,
        email_body: o.email_body,
      };
    });

    if (outreachToInsert.length > 0) {
      const { error: outreachErr } = await supabase.from("outreach").insert(outreachToInsert);
      if (outreachErr) throw outreachErr;
    }

    // Insert outreach order
    const outreachOrderToInsert = d.outreach_order.map((o) => ({
      company_id: companyId,
      rank: o.rank,
      contact_name: o.name,
      reason: o.reason,
    }));

    if (outreachOrderToInsert.length > 0) {
      const { error: orderErr } = await supabase
        .from("outreach_order")
        .insert(outreachOrderToInsert);
      if (orderErr) throw orderErr;
    }

    // Activity log
    await supabase.from("activities").insert({
      company_id: companyId,
      type: "system",
      content: existing
        ? "AI research re-run via Cowork bridge (Minakshi's Max plan)."
        : "AI research completed via Cowork bridge (Minakshi's Max plan).",
      user_email: queueRow.submitted_email,
    });

    // Mark queue done
    await supabase.from("queue").update({ status: "done", company_id: companyId }).eq("id", data.queue_id);

    console.log(
      `[cowork-bridge] Wrote dossier for ${queueRow.company_name}: company=${companyId}, contacts=${contactsToInsert.length}, outreach=${outreachToInsert.length}`,
    );

    return {
      ok: true as const,
      company_id: companyId,
      contacts_created: contactsToInsert.length,
      outreach_created: outreachToInsert.length,
    };
  });

// ─────────────────────────────────────────────────────────────
// Read endpoint: list pending leads for Cowork to fetch
// ─────────────────────────────────────────────────────────────
// Cowork polls this to see what leads need research.
// Auth: same shared token.

const ListInputSchema = z.object({
  token: z.string(),
});

export const listPendingLeadsForCowork = createServerFn({ method: "POST" })
  .inputValidator((d) => ListInputSchema.parse(d))
  .handler(async ({ data }) => {
    const expectedToken = process.env.COWORK_BRIDGE_TOKEN;
    if (!expectedToken) {
      throw new Error("Server misconfigured: bridge token missing");
    }
    if (data.token !== expectedToken) {
      throw new Error("Unauthorized");
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Server misconfigured: Supabase credentials missing");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: pending, error } = await supabase
      .from("queue")
      .select("id, company_name, location, contact_name, contact_title, contact_email, contact_phone, notes, submitted_email, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return {
      ok: true as const,
      count: pending?.length ?? 0,
      leads: pending ?? [],
    };
  });