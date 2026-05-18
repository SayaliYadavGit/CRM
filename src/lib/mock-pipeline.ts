import { supabase } from "@/integrations/supabase/client";
import type { QueueItem, Stage } from "./types";
import { researchCompany } from "./research.functions";
import type { Dossier } from "./research-prompt";

/**
 * Real AI research first; deterministic mock as a fallback so the demo never blocks.
 * The real engine is GPT-5.5 + web search + 7-rule prompt validated on Häfele.
 */

// ─────────────────────────────────────────────────────────────
// BRIDGE MODE FLAG
// ─────────────────────────────────────────────────────────────
// 'cowork' = pause the OpenAI engine; leads just queue until
//            Cowork on Minakshi's Mac researches them and POSTs
//            results to the cowork-bridge endpoint.
// 'openai' = original yesterday's flow; queue submission auto-
//            triggers OpenAI research (default).
//
// See BRIDGE_MODE.md for switch-back instructions.
// ─────────────────────────────────────────────────────────────
const RESEARCH_MODE = (
  typeof process !== "undefined" ? process.env.RESEARCH_MODE : undefined
) ?? "openai";

async function getResearch(item: {
  company_name: string;
  location: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  notes?: string | null;
}) {
  try {
    const dossier = await researchCompany({
      data: {
        company_name: item.company_name,
        location: item.location,
        contact_name: item.contact_name ?? null,
        contact_title: item.contact_title ?? null,
        notes: item.notes ?? null,
      },
    });
    return { dossier, model: "openai/gpt-5.5+web_search" as const };
  } catch (e) {
    console.warn("[pipeline] Real research failed, falling back to mock:", e);
    return { dossier: null, model: "mock-pipeline-v1" as const };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Formatters: rich dossier → DB string shape
// ──────────────────────────────────────────────────────────────────────────────

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

function formatDigitalMaturity(d: Dossier): string {
  return d.digital_maturity.narrative;
}

function formatAiReadiness(d: Dossier): string {
  return `Appetite: ${d.ai_readiness.appetite}\n\n${d.ai_readiness.narrative}`;
}

function formatAiRecommendation(d: Dossier): string {
  // The schema doesn't have ai_recommendation as a dedicated field, so we synthesise
  // a summary from top_fits + gaps. Reps see this as the "what to do next" paragraph.
  const top = d.top_fits[0];
  const lead = top
    ? `Lead with ${top.product_name} against ${top.problem}. ${top.narrative}`
    : "No high-confidence product fit identified — focus on discovery conversation.";
  const gapsLine = d.gaps ? `\n\nKnown gaps: ${d.gaps}` : "";
  return lead + gapsLine;
}

function formatProductMappingForDb(mapping: Dossier["product_mapping"]) {
  // Her UI expects this shape (matches the existing mock output):
  // { product, problem, how, relevance, starter }
  return mapping.map((m) => ({
    product: m.product_name,
    problem: m.problem,
    how: m.how_it_solves,
    relevance: m.relevance,
    starter: "Open with a question about this problem area, not the product.",
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock fallback (kept lean — only triggers if real AI fails)
// ──────────────────────────────────────────────────────────────────────────────

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const INDUSTRIES = [
  "Oil & Gas",
  "EPC / Construction",
  "Industrial Manufacturing",
  "Facilities Management",
  "Power & Utilities",
  "Engineering Services",
  "Heavy Equipment",
];
const PRODUCTS = ["NIZARA Ops", "NIZARA Shield", "Spectra (CAD2Quote)", "Custom AI Automation"];
const MATURITY = ["Early", "Developing", "Established", "Advanced"];

function buildMockResearch(item: { company_name: string; location: string | null }) {
  const seed = hash(item.company_name + (item.location ?? ""));
  const industry = INDUSTRIES[seed % INDUSTRIES.length];
  const confidence = 45 + (seed % 30);
  const products = PRODUCTS.slice(0, 2 + (seed % 2));
  const maturity = MATURITY[seed % MATURITY.length];

  const problems = `• Paper-based permit-to-work and inspection records create audit risk.
   Evidence: Industry baseline; no public mention of digital HSE platform.
   Impact: Audit failures, slow incident response, regulatory exposure.

- Shift handovers rely on email + spreadsheets.
   Evidence: Common in this industry vertical.
   Impact: Repeat incidents, lost institutional knowledge.

- Compliance reporting consumes weeks per cycle.
   Evidence: Manual data aggregation across sites.
   Impact: Management flying blind between cycles.`;

  const mapping = products.map((p, i) => ({
    product: p,
    problem: "Manual workflow bottleneck",
    how: `${p} replaces the manual workflow with a structured digital pipeline.`,
    relevance: i === 0 ? "High" : "Medium",
    starter: `How are you currently handling this across your sites?`,
  }));

  return {
    industry,
    confidence,
    products,
    industry_profile: `${item.company_name} operates in the ${industry.toLowerCase()} sector. Mock fallback — real AI research failed.`,
    process_assessment: `Core processes revolve around field operations, work authorisation, inspection cycles, and contractor coordination.`,
    digital_maturity_rating: maturity,
    digital_maturity: `Digital maturity assessed as ${maturity}. (Mock fallback — real AI research failed.)`,
    ai_readiness: `Limited public evidence. Department-level appetite likely strongest in HSE and Operations.`,
    problem_statements: problems,
    product_mapping_table: mapping,
    top_fits: `Best-fit product is ${products[0]} given the profile. (Mock fallback.)`,
    ai_recommendation: `Mock fallback used. Re-run research when API is available.`,
    priority: 5,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main pipeline: queue → company + contacts + outreach
// ──────────────────────────────────────────────────────────────────────────────

export async function runMockResearch(item: QueueItem) {
  // BRIDGE MODE: when in cowork mode, do not run any AI here.
  // Leave the queue row as 'pending'. Cowork on Minakshi's Mac
  // will pick it up and POST results to /cowork-bridge.
  if (RESEARCH_MODE === "cowork") {
    console.log(
      `[bridge] Queued for Cowork research: ${item.company_name} (${item.location ?? "no location"})`,
    );
    return { id: item.id, mode: "cowork" as const };
  }

  // OPENAI MODE: original yesterday's flow continues below.
  await supabase.from("queue").update({ status: "processing" }).eq("id", item.id);

  const { dossier, model } = await getResearch({
    company_name: item.company_name,
    location: item.location,
    contact_name: item.contact_name,
    contact_title: item.contact_title,
    notes: item.notes,
  });

  // Build the row payload for `companies`. Source: real dossier or mock fallback.
  let companyPayload: Record<string, unknown>;
  let contactsToInsert: Array<Record<string, unknown>> = [];
  let outreachToInsert: Array<Record<string, unknown>> = [];
  let outreachOrderToInsert: Array<Record<string, unknown>> = [];

  if (dossier) {
    // Real AI path
    companyPayload = {
      industry: dossier.industry,
      confidence: dossier.overall_confidence,
      priority: dossier.priority_recommendation,
      relevant_products: dossier.relevant_products,
      industry_profile: formatCompanyOverview(dossier),
      process_assessment: formatProcessAssessment(dossier),
      digital_maturity_rating: dossier.digital_maturity.rating,
      digital_maturity: formatDigitalMaturity(dossier),
      ai_readiness: formatAiReadiness(dossier),
      problem_statements: formatProblemsForDb(dossier.problem_statements),
      product_mapping_table: JSON.stringify(formatProductMappingForDb(dossier.product_mapping)),
      top_fits: formatTopFitsForDb(dossier.top_fits),
      ai_recommendation: formatAiRecommendation(dossier),
    };

    contactsToInsert = dossier.contacts.map((c) => ({
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
      // Email/phone come from the provided contact (Jihal) if any; otherwise AI doesn't
      // produce email/phone for cold-discovered contacts.
      email:
        c.found_on?.toLowerCase().includes("provided") && item.contact_email
          ? item.contact_email
          : null,
      phone:
        c.found_on?.toLowerCase().includes("provided") && item.contact_phone
          ? item.contact_phone
          : null,
    }));

    outreachToInsert = dossier.outreach_drafts.map((o) => {
      // Find the matching contact to grab their department.
      const matchingContact = dossier.contacts.find((c) => c.name === o.contact_name);
      return {
        contact_name: o.contact_name,
        department: matchingContact?.department ?? "Unknown",
        linkedin_connect: o.linkedin_connect,
        linkedin_followup: o.linkedin_followup,
        email_subject: o.email_subject,
        email_body: o.email_body,
      };
    });

    outreachOrderToInsert = dossier.outreach_order.map((o) => ({
      rank: o.rank,
      contact_name: o.name,
      reason: o.reason,
    }));
  } else {
    // Mock fallback path
    const m = buildMockResearch(item);
    companyPayload = {
      industry: m.industry,
      confidence: m.confidence,
      priority: m.priority,
      relevant_products: m.products,
      industry_profile: m.industry_profile,
      process_assessment: m.process_assessment,
      digital_maturity_rating: m.digital_maturity_rating,
      digital_maturity: m.digital_maturity,
      ai_readiness: m.ai_readiness,
      problem_statements: m.problem_statements,
      product_mapping_table: JSON.stringify(m.product_mapping_table),
      top_fits: m.top_fits,
      ai_recommendation: m.ai_recommendation,
    };

    contactsToInsert = [
      {
        name: item.contact_name || "HSE Manager",
        title: item.contact_title || "HSE Manager",
        department: "HSE",
        linkedin: null,
        found_on: item.contact_name ? "Provided by user" : "Inferred",
        profile: `${item.contact_title ?? "HSE Manager"} at ${item.company_name}.`,
        recent_activity: null,
        why: "Direct decision-maker for safety tooling.",
        outreach_angle: "Open with paperwork burden and audit readiness.",
        source: null,
        email: item.contact_email ?? null,
        phone: item.contact_phone ?? null,
      },
    ];

    outreachToInsert = [
      {
        contact_name: contactsToInsert[0].name,
        department: "HSE",
        linkedin_connect: `Hi ${String(contactsToInsert[0].name).split(" ")[0]} — keen to compare notes on HSE workflow challenges in ${item.location ?? "the region"}.`,
        linkedin_followup: `Thanks for connecting. Three things teams in your position usually want to fix: paperwork burden on PTW and inspections, shift handovers losing context, and audits taking weeks. Open to 15 min to compare notes?`,
        email_subject: `${item.company_name} — HSE workflow burden`,
        email_body: `Hi — reaching out because ${item.company_name} fits a pattern we see often in this sector. Three pain points keep surfacing: paper PTW, audit prep, shift handovers. Worth 15 minutes to compare what's working for peers?\n\nWarm regards,\nMinakshi Shrimalve\nProduct Director, QITT Solutions`,
      },
    ];

    outreachOrderToInsert = [
      {
        rank: 1,
        contact_name: contactsToInsert[0].name,
        reason: "Primary contact provided / inferred decision-maker.",
      },
    ];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Write to DB: upsert company, then insert contacts/outreach/order
  // ────────────────────────────────────────────────────────────────────────────

  const { data: existing } = await supabase
    .from("companies")
    .select("id, stage")
    .ilike("name", item.company_name)
    .ilike("location", item.location ?? "")
    .maybeSingle();

  let companyId: string;

  if (existing) {
    companyId = existing.id;
    await supabase.from("companies").update(companyPayload).eq("id", companyId);
    // Replace contacts and outreach for re-runs (clean slate)
    await supabase.from("contacts").delete().eq("company_id", companyId);
    await supabase.from("outreach").delete().eq("company_id", companyId);
    await supabase.from("outreach_order").delete().eq("company_id", companyId);
  } else {
    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        ...companyPayload,
        name: item.company_name,
        location: item.location,
        stage: "researched" as Stage,
        created_by: item.submitted_by,
        assigned_email: item.submitted_email,
      })
      .select()
      .single();
    if (error || !created) throw error ?? new Error("Failed to create company");
    companyId = created.id;
  }

  // Insert contacts (with company_id)
  if (contactsToInsert.length > 0) {
    await supabase
      .from("contacts")
      .insert(contactsToInsert.map((c) => ({ ...c, company_id: companyId })));
  }

  // Insert outreach drafts
  if (outreachToInsert.length > 0) {
    await supabase
      .from("outreach")
      .insert(outreachToInsert.map((o) => ({ ...o, company_id: companyId })));
  }

  // Insert outreach order
  if (outreachOrderToInsert.length > 0) {
    await supabase
      .from("outreach_order")
      .insert(outreachOrderToInsert.map((o) => ({ ...o, company_id: companyId })));
  }

  // Activity log
  await supabase.from("activities").insert({
    company_id: companyId,
    type: "system",
    content: existing
      ? `AI research re-run (${model}).`
      : `AI research completed (${model}).`,
    user_email: item.submitted_email,
  });

  // Mark queue done
  await supabase.from("queue").update({ status: "done", company_id: companyId }).eq("id", item.id);

  return { id: companyId };
}

/**
 * Re-run research for an existing company. Same flow as the queue submission, just
 * without going through the queue table.
 */
export async function rerunResearchForCompany(
  companyId: string,
  userEmail?: string | null,
  userId?: string | null,
) {
  // BRIDGE MODE: re-runs also have to go through Cowork.
  // We mark the company as 'needs research' and Cowork picks it up
  // on its next run. (For v1 of the bridge we don't yet support
  // re-runs — only initial research via the queue. Tell user.)
  if (RESEARCH_MODE === "cowork") {
    throw new Error(
      "Re-running research is not available during bridge mode. " +
        "Cowork researches via the queue. Add the company as a new queue entry to re-research.",
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (!company) throw new Error("Company not found");

  // Build a synthetic queue item to reuse the same code path
  const syntheticItem: QueueItem = {
    id: "rerun-" + companyId,
    company_name: company.name,
    location: company.location,
    contact_name: null,
    contact_title: null,
    contact_email: null,
    contact_phone: null,
    notes: null,
    status: "processing",
    submitted_by: userId ?? null,
    submitted_email: userEmail ?? null,
    has_card: false,
    card_name: null,
    card_data: null,
    company_id: companyId,
    created_at: new Date().toISOString(),
  };

  // Run the same pipeline (it will UPDATE the existing company since name+location match)
  await runMockResearch(syntheticItem);
  return companyId;
}