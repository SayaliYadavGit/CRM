import { supabase } from "@/integrations/supabase/client";
import type { QueueItem, Stage } from "./types";
import { researchCompany } from "./research.functions";

/** Try real LLM first; fall back to deterministic mock so the demo never blocks. */
async function getResearch(item: { company_name: string; location: string | null; industry_hint?: string | null }) {
  try {
    const r = await researchCompany({ data: { company_name: item.company_name, location: item.location, industry_hint: item.industry_hint ?? null } });
    return {
      industry: r.industry,
      confidence: r.confidence,
      products: r.relevant_products,
      industry_profile: r.industry_profile,
      process_assessment: r.process_assessment,
      digital_maturity: r.digital_maturity,
      digital_maturity_rating: r.digital_maturity_rating,
      ai_readiness: r.ai_readiness,
      problem_statements: r.problem_statements,
      product_mapping_table: r.product_mapping_table,
      top_fits: r.top_fits,
      ai_recommendation: r.ai_recommendation,
      _model: "lovable-ai/google/gemini-2.5-flash",
    };
  } catch (e) {
    console.warn("LLM research failed, using deterministic mock:", e);
    const m = buildResearch({ company_name: item.company_name, location: item.location });
    return { ...m, _model: "mock-pipeline-v1" };
  }
}

// Deterministic pseudo-random from string
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const INDUSTRIES = ["Oil & Gas", "EPC / Construction", "Industrial Manufacturing", "Facilities Management", "Power & Utilities", "Engineering Services", "Heavy Equipment"];
const PRODUCTS = ["NIZARA Ops", "NIZARA Shield", "NIZARA Build", "Spectra (CAD2Quote)", "Custom AI Automation"];
const MATURITY = ["Early", "Developing", "Established", "Advanced"];

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seed >> (i % 16)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

function buildResearch(item: { company_name: string; location: string | null; contact_name?: string | null; contact_title?: string | null; contact_email?: string | null; contact_phone?: string | null }) {
  const seed = hash(item.company_name + (item.location ?? "") + Date.now().toString());
  const industry = INDUSTRIES[seed % INDUSTRIES.length];
  const confidence = 45 + (seed % 41);
  const products = pickN(PRODUCTS, 2 + (seed % 3), seed);
  const maturity = MATURITY[seed % MATURITY.length];

  const industryProfile = `${item.company_name} operates in the ${industry.toLowerCase()} sector across ${item.location ?? "the region"}. Mid-to-large operator with multi-site footprint and a workforce that includes contractors and shift-based field crews.`;
  const processAssessment = `Core processes revolve around field operations, work authorisation, inspection cycles, and contractor coordination. Paperwork-heavy areas: permit-to-work, incident reports, audit findings, shift handovers, competency records.`;
  const aiReadiness = `Limited public evidence of in-house AI/ML capability. Department-level appetite is highest in HSE and Operations; IT typically gates procurement.`;

  const problems = [
    { p: "Paper-based permit-to-work and inspection records create audit risk.", e: "Industry baseline; no public mention of digital HSE platform.", i: "Audit failures, slow incident response, regulatory exposure." },
    { p: "Lone-worker and heat-stress incidents go unmonitored in field operations.", e: `${item.location ?? "Region"} climate + multi-site footprint.`, i: "Preventable incidents, insurance loss, reputational damage." },
    { p: "Shift handovers rely on email + spreadsheets.", e: "Common in this industry vertical.", i: "Repeat incidents, lost institutional knowledge." },
    { p: "Compliance reporting consumes weeks per cycle.", e: "Manual data aggregation across sites.", i: "Management flying blind between cycles." },
    { p: "Contractor safety verification is manual and unreliable.", e: "Multi-contractor sites typical of sector.", i: "Liability + project delays." },
    { p: "Quoting / engineering estimation is bottlenecked on senior staff.", e: "Sector quoting cycles run days, not minutes.", i: "Lost RFQs, margin leakage." },
  ];

  const productMapping = products.map((p, i) => ({
    product: p,
    problem: problems[(seed + i) % problems.length].p,
    how: `${p} replaces the manual workflow with a structured, evidence-based digital pipeline.`,
    relevance: ["High", "Medium", "Medium"][(seed + i) % 3],
    starter: `How are you currently handling this across your ${item.location ?? "operating"} sites?`,
  }));

  const topFits = `Best-fit product is ${products[0]} given the company's profile and the regulatory environment. ${products[1] ?? products[0]} is a strong second move once initial trust is established.`;
  const aiRec = `Recommend prioritising HSE-leadership outreach with ${products[0]} as the lead conversation. Expect 1-2 month evaluation cycle.`;

  return {
    industry, confidence, products, maturity,
    industry_profile: industryProfile,
    process_assessment: processAssessment,
    digital_maturity_rating: maturity,
    digital_maturity: `Digital maturity assessed as ${maturity}. Most operational systems are partially digital; safety and compliance remain paper-heavy.`,
    ai_readiness: aiReadiness,
    problem_statements: problems.map((x) => `• ${x.p}\n   Evidence: ${x.e}\n   Impact: ${x.i}`).join("\n\n"),
    product_mapping_table: productMapping,
    top_fits: topFits,
    ai_recommendation: aiRec,
  };
}

/** Run from the queue submission flow — creates company + first snapshot. */
export async function runMockResearch(item: QueueItem) {
  await supabase.from("queue").update({ status: "processing" }).eq("id", item.id);
  await new Promise((r) => setTimeout(r, 1500 + (hash(item.company_name) % 2000)));

  const r = buildResearch(item);

  // Upsert: if a company with same name+location exists, update it; else insert.
  const { data: existing } = await supabase.from("companies").select("id, stage")
    .ilike("name", item.company_name)
    .ilike("location", item.location ?? "")
    .maybeSingle();

  let companyId: string;
  if (existing) {
    companyId = existing.id;
    await supabase.from("companies").update({
      industry: r.industry,
      confidence: r.confidence,
      relevant_products: r.products,
      industry_profile: r.industry_profile,
      process_assessment: r.process_assessment,
      digital_maturity: r.digital_maturity,
      digital_maturity_rating: r.digital_maturity_rating,
      ai_readiness: r.ai_readiness,
      problem_statements: r.problem_statements,
      product_mapping_table: JSON.stringify(r.product_mapping_table),
      top_fits: r.top_fits,
      ai_recommendation: r.ai_recommendation,
    }).eq("id", companyId);
  } else {
    const { data: created, error } = await supabase.from("companies").insert({
      name: item.company_name,
      location: item.location,
      industry: r.industry,
      confidence: r.confidence,
      stage: "researched" as Stage,
      relevant_products: r.products,
      industry_profile: r.industry_profile,
      process_assessment: r.process_assessment,
      digital_maturity_rating: r.digital_maturity_rating,
      digital_maturity: r.digital_maturity,
      ai_readiness: r.ai_readiness,
      problem_statements: r.problem_statements,
      product_mapping_table: JSON.stringify(r.product_mapping_table),
      top_fits: r.top_fits,
      ai_recommendation: r.ai_recommendation,
      created_by: item.submitted_by,
      assigned_email: item.submitted_email,
    }).select().single();
    if (error || !created) throw error ?? new Error("Failed to create company");
    companyId = created.id;

    // Seed contacts only on first creation
    const seedContacts = [
      { name: item.contact_name || "HSE Manager", title: item.contact_title || "HSE Manager", department: "HSE" },
      { name: "Operations Director", title: "Operations Director", department: "Operations" },
      { name: "IT / Digital Lead", title: "Head of Digital Transformation", department: "IT/Digital" },
    ];
    await supabase.from("contacts").insert(seedContacts.map((c) => ({
      company_id: companyId,
      name: c.name, title: c.title, department: c.department,
      linkedin: `https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(c.title + " " + item.company_name)}`,
      found_on: "LinkedIn search (suggested)",
      profile: `${c.title} at ${item.company_name}. Profile to be confirmed by AE.`,
      recent_activity: "Recent posts about safety initiatives and operational excellence.",
      why: `Decision/influence on ${c.department} budget — direct buyer for ${r.products[0]}.`,
      outreach_angle: `Lead with ${r.products[0]} value prop tailored to ${c.department}.`,
      source: "Inferred from company profile",
      email: c.name === item.contact_name ? item.contact_email : null,
      phone: c.name === item.contact_name ? item.contact_phone : null,
    })));

    await supabase.from("outreach").insert(seedContacts.map((c) => ({
      company_id: companyId,
      contact_name: c.name,
      department: c.department,
      linkedin_connect: `Hi ${c.name.split(" ")[0]} — leading work on ${r.products[0]} for ${r.industry.toLowerCase()} operators in ${item.location ?? "the region"}. Would love to connect.`,
      linkedin_followup: `Thanks for connecting, ${c.name.split(" ")[0]}. We help ${r.industry.toLowerCase()} teams replace paper HSE and shift-handover processes with one evidence-based platform — typically a 2-4 week pilot. Would a 20-min walkthrough next week be useful for ${item.company_name}?`,
      email_subject: `${item.company_name} — replacing paper HSE workflows`,
      email_body: `Hi ${c.name.split(" ")[0]},\n\nI'm reaching out because ${item.company_name} fits the profile of ${r.industry.toLowerCase()} operators we're partnering with on ${r.products[0]}.\n\nThree things teams in your position usually want to fix:\n• Paper permit-to-work and inspections that don't survive audits\n• Shift handovers that lose context between crews\n• Compliance reports that take weeks to compile\n\nWould you be open to a short call to compare notes on how peers in ${item.location ?? "the region"} are tackling this?\n\nBest,\n— QITT Solutions`,
    })));

    await supabase.from("outreach_order").insert(seedContacts.map((c, i) => ({
      company_id: companyId, rank: i + 1, contact_name: c.name,
      reason: i === 0 ? "Direct economic buyer for the lead product." : i === 1 ? "Operational sponsor — co-validates the pain." : "Gatekeeper — necessary for procurement.",
    })));
  }

  // Always write a snapshot
  await supabase.from("company_research").insert({
    company_id: companyId,
    created_by: item.submitted_by,
    created_email: item.submitted_email,
    model: "mock-pipeline-v1",
    industry_profile: r.industry_profile,
    process_assessment: r.process_assessment,
    digital_maturity: r.digital_maturity,
    digital_maturity_rating: r.digital_maturity_rating,
    ai_readiness: r.ai_readiness,
    problem_statements: r.problem_statements,
    product_mapping_table: r.product_mapping_table,
    top_fits: r.top_fits,
    ai_recommendation: r.ai_recommendation,
    confidence: r.confidence,
    relevant_products: r.products,
  });

  await supabase.from("activities").insert({
    company_id: companyId,
    type: "system",
    content: existing ? "AI research re-run (snapshot saved)." : "AI research completed.",
    user_email: item.submitted_email,
  });

  await supabase.from("queue").update({ status: "done", company_id: companyId }).eq("id", item.id);
  return { id: companyId };
}

/** Re-run for an existing company without going through the queue. */
export async function rerunResearchForCompany(companyId: string, userEmail?: string | null, userId?: string | null) {
  const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
  if (!company) throw new Error("Company not found");

  await new Promise((r) => setTimeout(r, 1200 + (hash(company.name) % 1500)));
  const r = buildResearch({
    company_name: company.name,
    location: company.location,
  });

  await supabase.from("companies").update({
    industry: r.industry,
    confidence: r.confidence,
    relevant_products: r.products,
    industry_profile: r.industry_profile,
    process_assessment: r.process_assessment,
    digital_maturity: r.digital_maturity,
    digital_maturity_rating: r.digital_maturity_rating,
    ai_readiness: r.ai_readiness,
    problem_statements: r.problem_statements,
    product_mapping_table: JSON.stringify(r.product_mapping_table),
    top_fits: r.top_fits,
    ai_recommendation: r.ai_recommendation,
  }).eq("id", companyId);

  await supabase.from("company_research").insert({
    company_id: companyId,
    created_by: userId ?? null,
    created_email: userEmail ?? null,
    model: "mock-pipeline-v1",
    industry_profile: r.industry_profile,
    process_assessment: r.process_assessment,
    digital_maturity: r.digital_maturity,
    digital_maturity_rating: r.digital_maturity_rating,
    ai_readiness: r.ai_readiness,
    problem_statements: r.problem_statements,
    product_mapping_table: r.product_mapping_table,
    top_fits: r.top_fits,
    ai_recommendation: r.ai_recommendation,
    confidence: r.confidence,
    relevant_products: r.products,
  });

  await supabase.from("activities").insert({
    company_id: companyId,
    type: "system",
    content: "AI research re-run (snapshot saved).",
    user_email: userEmail ?? null,
  });

  return companyId;
}
