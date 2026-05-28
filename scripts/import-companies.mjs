// scripts/import-companies.mjs
//
// One-shot import of pre-researched companies into Supabase.
// Idempotent: skips companies that already exist by name.
//
// Usage:
//   node --env-file=.env scripts/import-companies.mjs path/to/crm_import_51_companies.json
//
// Requires in .env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------- args ----------
const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: node --env-file=.env scripts/import-companies.mjs <path-to-json>");
  process.exit(1);
}

// ---------- env ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  console.error("Run with: node --env-file=.env scripts/import-companies.mjs ...");
  process.exit(1);
}

// ---------- supabase ----------
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers ----------

// Derive the High/Medium/Low pill from raw priority + confidence.
// - If priority is already a tier word, use it as-is.
// - Otherwise (numeric or missing), derive from confidence:
//     >= 70 High, 50-69 Medium, < 50 Low.
function derivePriorityTier(rawPriority, confidence) {
  if (typeof rawPriority === "string") {
    const v = rawPriority.trim();
    if (v === "High" || v === "Medium" || v === "Low") return v;
  }
  const c = Number(confidence) || 0;
  if (c >= 70) return "High";
  if (c >= 50) return "Medium";
  return "Low";
}

// Keep the numeric rank in `priority` only when it's actually a number.
// Tier strings get null here (the tier lives in priority_tier).
function normalizePriorityInt(rawPriority) {
  if (typeof rawPriority === "number" && Number.isInteger(rawPriority)) {
    return rawPriority;
  }
  return null;
}

// ---------- main ----------

const absPath = resolve(jsonPath);
console.log(`Reading: ${absPath}`);
const data = JSON.parse(readFileSync(absPath, "utf8"));
const companies = data.companies || [];
console.log(`Loaded ${companies.length} companies.\n`);

let inserted = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < companies.length; i++) {
  const c = companies[i];
  const tag = `[${i + 1}/${companies.length}] ${c.name}`;

  // 1. Idempotency check — does a company with this name already exist?
  const { data: existing, error: existErr } = await sb
    .from("companies")
    .select("id, name")
    .eq("name", c.name)
    .maybeSingle();

  if (existErr) {
    console.error(`${tag} -> lookup failed:`, existErr.message);
    failed++;
    continue;
  }
  if (existing) {
    console.log(`${tag} -> SKIP (already exists, id=${existing.id})`);
    skipped++;
    continue;
  }

  // 2. Build company row
  const companyRow = {
    name: c.name,
    location: c.location ?? null,
    industry: c.industry ?? null,
    stage: "researched", // all 51 have research_status: "Researched"
    confidence: typeof c.confidence === "number" ? c.confidence : 0,
    priority: normalizePriorityInt(c.priority),
    priority_tier: derivePriorityTier(c.priority, c.confidence),
    lead_source: c.lead_source || null,
    relevant_products: Array.isArray(c.relevant_products) ? c.relevant_products : [],
    industry_profile: c.industry_profile ?? null,
    process_assessment: c.process_assessment ?? null,
    digital_maturity_rating: c.digital_maturity_rating ?? null,
    digital_maturity: c.digital_maturity ?? null,
    ai_readiness: c.ai_readiness ?? null,
    problem_statements: c.problem_statements ?? null,
    product_mapping_table: c.product_mapping_table ?? null,
    top_fits: c.top_fits ?? null,
  };

  // 3. Insert company
  const { data: inserted_company, error: insErr } = await sb
    .from("companies")
    .insert(companyRow)
    .select("id")
    .single();

  if (insErr) {
    console.error(`${tag} -> company insert failed:`, insErr.message);
    failed++;
    continue;
  }
  const companyId = inserted_company.id;

  // 4. Insert contacts
  const contacts = Array.isArray(c.contacts) ? c.contacts : [];
  if (contacts.length) {
    const rows = contacts.map((ct) => ({
      company_id: companyId,
      name: ct.name,
      title: ct.title ?? null,
      department: ct.department ?? null,
      linkedin: ct.linkedin || null,
      twitter: ct.twitter || null,
      found_on: ct.found_on ?? null,
      profile: ct.profile ?? null,
      recent_activity: ct.recent_activity ?? null,
      why: ct.why ?? null,
      outreach_angle: ct.outreach_angle ?? null,
      source: ct.source ?? null,
    }));
    const { error: ctErr } = await sb.from("contacts").insert(rows);
    if (ctErr) {
      console.error(`${tag} -> contacts insert failed (rolling back company):`, ctErr.message);
      await sb.from("companies").delete().eq("id", companyId);
      failed++;
      continue;
    }
  }

  // 5. Insert outreach
  const outreach = Array.isArray(c.outreach) ? c.outreach : [];
  if (outreach.length) {
    const rows = outreach.map((o) => ({
      company_id: companyId,
      contact_name: o.contact_name ?? null,
      department: o.department ?? null,
      linkedin_connect: o.linkedin_connect ?? null,
      linkedin_followup: o.linkedin_followup ?? null,
      email_subject: o.email_subject ?? null,
      email_body: o.email_body ?? null,
    }));
    const { error: oErr } = await sb.from("outreach").insert(rows);
    if (oErr) {
      console.error(`${tag} -> outreach insert failed (rolling back):`, oErr.message);
      await sb.from("contacts").delete().eq("company_id", companyId);
      await sb.from("companies").delete().eq("id", companyId);
      failed++;
      continue;
    }
  }

  // 6. Insert outreach_order
  // JSON uses both `name` and `contact_name` in different entries — handle both.
  const ooEntries = Array.isArray(c.outreach_order) ? c.outreach_order : [];
  if (ooEntries.length) {
    const rows = ooEntries.map((o) => ({
      company_id: companyId,
      rank: typeof o.rank === "number" ? o.rank : parseInt(o.rank, 10) || 0,
      contact_name: o.contact_name ?? o.name ?? null,
      reason: o.reason ?? null,
    }));
    const { error: ooErr } = await sb.from("outreach_order").insert(rows);
    if (ooErr) {
      console.error(`${tag} -> outreach_order insert failed (rolling back):`, ooErr.message);
      await sb.from("outreach").delete().eq("company_id", companyId);
      await sb.from("contacts").delete().eq("company_id", companyId);
      await sb.from("companies").delete().eq("id", companyId);
      failed++;
      continue;
    }
  }

  console.log(
    `${tag} -> OK (id=${companyId}, ` +
      `contacts=${contacts.length}, outreach=${outreach.length}, order=${ooEntries.length}, ` +
      `tier=${companyRow.priority_tier}, conf=${companyRow.confidence})`,
  );
  inserted++;
}

console.log("\n---- Done ----");
console.log(`Inserted: ${inserted}`);
console.log(`Skipped (already existed): ${skipped}`);
console.log(`Failed: ${failed}`);
console.log(`Total processed: ${inserted + skipped + failed}/${companies.length}`);
