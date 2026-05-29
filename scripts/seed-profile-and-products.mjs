// scripts/seed-profile-and-products.mjs
//
// Seeds the QITT profile (1 row) and product portfolio (5 products) into Supabase.
// Idempotent: uses upsert logic — safe to re-run, will update existing rows.
//
// Usage:
//   node --env-file=.env scripts/seed-profile-and-products.mjs
//
// Reads from src/lib/qitt-data.ts (compiled inline since we can't import .ts directly).
// If qitt-data.ts ever changes, re-running this script syncs the DB to match.

import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  console.error("Run with: node --env-file=.env scripts/seed-profile-and-products.mjs");
  process.exit(1);
}

// ---------- supabase ----------
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- data (inline copy of src/lib/qitt-data.ts) ----------
// Why inline: this script is .mjs and qitt-data.ts is TypeScript.
// Rather than set up a transpile step, we duplicate the data here.
// If qitt-data.ts changes, update this block to match, then re-run.

const QITT_PROFILE = {
  company_name: "QITT Solutions",
  tagline: "Practitioner-Led. Operator-Grade. Board-Ready.",
  about:
    "QITT Solutions is a Dubai-headquartered technical execution partner for complex enterprise programmes — M&A integration, industrial digital transformation, and operational IT. We deliver the technical execution that strategy firms design but cannot build — replacing 4-5 disconnected vendors with a single unified accountability partner. Our team has operated inside SAP systems, war rooms, and factory floors. We deliver, not just recommend.",
  founded: "Dubai, UAE",
  presence: "UAE · KSA · India · Europe",
  model: "Practitioner-Led",
  team_size: "10+ Senior Practitioners, Scalable to 200+",
  sectors:
    "Oil & Gas, EPC, Engineering, Manufacturing, E-Commerce, Logistics, Construction, Facility Management",
  certifications: "PMP, CIMA, ISO27001, SAFe, ITIL",
  website: "qitt.io",
  metrics: [
    { label: "Transaction Value", value: "$680M+" },
    { label: "Staff Integrated", value: "7,000" },
    { label: "Countries", value: "20+" },
    { label: "IT Synergies", value: "$23M/yr" },
    { label: "Day-1 Failures", value: "Zero" },
  ],
  value_props: [
    "One Firm. One Throat to Choke. Zero Excuses.",
    "Single integration partner replacing 4-5 fragmented vendors",
    "Zero Day-1 failures across all programmes",
    "34-63% lower cost than Big 4",
    "7/7 KSA compliance gates (no competitor passes more than 2)",
    "4-week go-live vs 9-18 months for global SaaS",
    "Arabic-native, Saudi sovereign cloud hosting",
  ],
};

const QITT_PRODUCTS = [
  {
    name: "NIZARA Ops",
    subtitle: "Operational Intelligence Platform",
    what: "A SaaS platform that digitises Health, Safety & Environment (HSE) operations for industrial companies. Replaces every paper form, spreadsheet tracker, and email chain in safety management with one smart digital system. 21 modules across 5 domains.",
    who: "Oil & gas companies, ARAMCO contractors, industrial plants, construction firms, heavy industry operators, facility management companies — anyone with field workers in high-risk environments.",
    capabilities: [
      "Incident Management",
      "Inspection & Audit",
      "Permit to Work (PTW)",
      "LOTO (Lockout/Tagout)",
      "Observations / near-miss reporting",
      "SCAT root cause investigation",
      "Risk Register",
      "CAPA (Corrective & Preventive Actions)",
      "Shift Handovers",
      "Management of Change (MOC)",
      "Emergency Response planning",
      "Quality inspection & non-conformance",
      "Competency management",
      "LMS / training delivery",
      "Contractor management",
      "Compliance dashboards",
      "KPI tracking",
      "Regulatory reporting",
    ],
    problems: [
      "Paper-based safety management = lost records, slow investigations, audit failures",
      "No real-time visibility into safety metrics across multiple sites",
      "Manual shift handovers = missed information, repeated incidents",
      "Compliance tracking scattered across spreadsheets",
      "Weeks to compile safety reports that should take minutes",
      "Contractor safety verification is manual and unreliable",
    ],
    differentiators: [
      "Arabic-native (Gulf market first-class citizen)",
      "SACS-002 ready (Saudi ARAMCO compliance)",
      "Modular — buy only what you need, expand later",
      "Evidence-based design — every data point links back to its source",
    ],
    notes: [],
  },
  {
    name: "NIZARA Shield",
    subtitle: "AI-Powered Worker Safety Wearable",
    what: "A wearable hardware + AI system that monitors worker safety in real time. Instead of investigating after someone gets hurt, Shield predicts dangerous situations before they happen. Like a fitness tracker, but for heat-stroke risk, falls, and lone worker safety. Hardware: Chest-mounted Core device (ATEX Zone 1 certified for explosive environments) + modular upper-arm Vitals patch. Streams data via BLE/LTE.",
    who: "Any company with workers in harsh or hazardous environments — oil & gas, construction, mining, industrial plants, logistics yards.",
    capabilities: [
      "Heat stress prediction — 10-15 min advance warning (critical in 50°C+ Gulf summers)",
      "Lone worker detection",
      "Fall detection",
      "Gas detection",
      "GPS tracking (indoor + outdoor)",
      "Continuous vital signs (heart rate, skin temp, hydration)",
    ],
    problems: [
      "Reactive safety culture — only knowing about problems after incidents occur",
      "Heat-related illness is the #1 killer of outdoor workers in the Gulf",
      "Lone worker monitoring done by periodic phone check-ins (unreliable)",
      "No real-time visibility into worker welfare across large sites",
      "Compliance with MOH and OSHA heat illness prevention regulations",
    ],
    differentiators: [
      "ATEX Zone 1 certified (safe in explosive atmospheres)",
      "Heat-stress prediction (not just detection) — 10-15 min advance warning",
      "Modular hardware — Core + Vitals patch deployable independently",
      "Designed for Gulf climate from day one",
    ],
    notes: [],
  },
  {
    name: "NIZARA Build",
    subtitle: "Engineering Project Management System (Planned)",
    what: "A project management platform built specifically for engineering and construction projects, using Earned Value Management (EVM) methodology. STATUS: Planned — not yet in active development. Do NOT propose as a current solution; mention only as roadmap context if the prospect specifically asks about EVM tooling.",
    who: "Engineering firms, EPC contractors, project management offices running large-scale construction or infrastructure projects.",
    capabilities: [
      "Earned Value Management",
      "Resource allocation and tracking",
      "Progress measurement with evidence trail",
      "Integrated with NIZARA Ops (same site/asset/workforce model)",
    ],
    problems: [
      "Engineering projects tracked in disconnected spreadsheets and email",
      "No single source of truth for project progress across disciplines",
      "Safety, project, and workforce data live in three different systems",
      "EVM calculations done manually = errors and delayed reporting",
    ],
    differentiators: [
      "Integrated natively with NIZARA Ops (single site/asset/workforce model)",
    ],
    notes: [],
  },
  {
    name: "Spectra (CAD2Quote)",
    subtitle: "AI-Powered Quoting from Technical Drawings",
    what: "An AI system that reads CAD drawings (technical blueprints) and automatically generates accurate price quotations. Replaces a manual process that typically takes 5-6 hours per quote with a 10-minute automated workflow plus human review. Built as a 3-agent AI system: Document Analysis → Product Matching → Quotation. Items matched with <80-85% confidence are flagged for human review. Typical pain point: 80-90 quote schedules per week across 20 estimators.",
    who: "Manufacturing companies, fabrication shops, engineering firms, architectural hardware distributors, any company that quotes custom orders from technical drawings.",
    capabilities: [
      "Document Analysis Agent — reads CAD/PDF, extracts dimensions, materials, quantities",
      "Product Matching Agent — matches extracted items to product catalogue using RAG",
      "Quotation Agent — assembles final quote with pricing, alternatives, confidence scores",
    ],
    problems: [
      "Manual quoting takes 5-6 hours per drawing → 10 minutes with this product",
      "80-90 quote schedules per week across 20 estimators = massive bottleneck",
      "Human error in product matching and pricing",
      "Slow quote turnaround = lost deals to faster competitors",
      "Estimator expertise is tribal knowledge — hard to scale or replace",
    ],
    differentiators: [
      "Human-in-the-loop — items <80-85% confidence flagged for review, system learns from corrections",
      "3-agent architecture designed for explainability",
      "Works with mixed input formats (DWG, DXF, PDF schedules)",
    ],
    notes: [],
  },
  {
    name: "Custom AI Automation",
    subtitle: "Bespoke AI Solutions",
    what: "For companies whose primary pain point is manual, repetitive, document-heavy work — but where the specific process does not map to an existing NIZARA or Spectra product — QITT builds bespoke AI automation. Scoped, built, deployed as fixed-outcome engagements. The pitch is not 'we sell AI' — it is 'if your team is drowning in paperwork and manual processes, we can probably automate it.'",
    who: "Companies with specific, high-value process bottlenecks that off-the-shelf SaaS cannot address. Fit signals: people manually entering data from forms, hours generating reports that should be automatic, complex approval workflows on email and paper, extracting info from PDFs/drawings/invoices/contracts, matching items across catalogues, regular compliance documentation generation.",
    capabilities: [
      "Document intelligence (OCR + LLM extraction)",
      "Workflow automation across approval chains",
      "Predictive analytics",
      "Custom LLM deployments (private / sovereign hosting available)",
      "Process mining and optimisation",
      "Catalogue matching and recommendation engines",
    ],
    problems: [
      "Specific operational workflows that no SaaS product addresses",
      "High-volume document processing eating staff time",
      "Decision-making processes that could be augmented by AI",
      "ZATCA / regional compliance reporting overhead",
    ],
    differentiators: [
      "Fixed-scope, fixed-outcome engagements (not time-and-materials)",
      "Practitioner-led delivery (operators, not consultants)",
      "Integration with existing systems (SAP, Oracle, custom ERPs)",
      "Sovereign hosting option for sensitive data",
    ],
    notes: [
      "Examples built: E-invoicing system for KSA ZATCA compliance (automated invoice clearance, QR codes, VAT calculation); document analysis and extraction pipelines; automated compliance report generation; catalogue matching and recommendation engines.",
    ],
  },
];

// ---------- profile upsert ----------
console.log("\n=== Seeding profile ===");
{
  // Check if profile exists (single-row table)
  const { data: existing, error: selErr } = await sb
    .from("profile")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (selErr) {
    console.error("Profile lookup failed:", selErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error: updErr } = await sb
      .from("profile")
      .update(QITT_PROFILE)
      .eq("id", existing.id);
    if (updErr) {
      console.error("Profile update failed:", updErr.message);
      process.exit(1);
    }
    console.log(`✓ Profile updated (id=${existing.id})`);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from("profile")
      .insert(QITT_PROFILE)
      .select("id")
      .single();
    if (insErr) {
      console.error("Profile insert failed:", insErr.message);
      process.exit(1);
    }
    console.log(`✓ Profile inserted (id=${inserted.id})`);
  }
}

// ---------- products upsert ----------
console.log("\n=== Seeding products ===");
let inserted = 0;
let updated = 0;
let failed = 0;

for (const p of QITT_PRODUCTS) {
  const tag = `[${p.name}]`;

  // Idempotency: check by name
  const { data: existing, error: selErr } = await sb
    .from("products")
    .select("id, archived")
    .eq("name", p.name)
    .maybeSingle();

  if (selErr) {
    console.error(`${tag} lookup failed:`, selErr.message);
    failed++;
    continue;
  }

  if (existing) {
    const { error: updErr } = await sb
      .from("products")
      .update({
        subtitle: p.subtitle,
        what: p.what,
        who: p.who,
        capabilities: p.capabilities,
        problems: p.problems,
        differentiators: p.differentiators,
        notes: p.notes,
        // intentionally NOT touching `archived` / `archived_date` — user may have changed them
      })
      .eq("id", existing.id);
    if (updErr) {
      console.error(`${tag} update failed:`, updErr.message);
      failed++;
      continue;
    }
    console.log(`${tag} UPDATED (id=${existing.id}${existing.archived ? ", archived" : ""})`);
    updated++;
  } else {
    const { data: ins, error: insErr } = await sb
      .from("products")
      .insert({
        name: p.name,
        subtitle: p.subtitle,
        what: p.what,
        who: p.who,
        capabilities: p.capabilities,
        problems: p.problems,
        differentiators: p.differentiators,
        notes: p.notes,
        archived: false,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error(`${tag} insert failed:`, insErr.message);
      failed++;
      continue;
    }
    console.log(`${tag} INSERTED (id=${ins.id})`);
    inserted++;
  }
}

console.log("\n---- Done ----");
console.log(`Profile: seeded`);
console.log(`Products inserted: ${inserted}`);
console.log(`Products updated: ${updated}`);
console.log(`Products failed: ${failed}`);
console.log(`Total: ${inserted + updated + failed}/${QITT_PRODUCTS.length}`);
