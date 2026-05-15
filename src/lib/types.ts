import type { Database } from "@/integrations/supabase/types";

export type Stage = Database["public"]["Enums"]["deal_stage"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];

export const STAGES: Stage[] = [
  "new",
  "researched",
  "contact_identified",
  "contacted",
  "meeting_booked",
  "proposal_sent",
  "contract_signed",
  "won",
  "lost",
];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  researched: "Researched",
  contact_identified: "Contact Identified",
  contacted: "Contacted",
  meeting_booked: "Meeting Booked",
  proposal_sent: "Proposal Sent",
  contract_signed: "Contract Signed",
  won: "Won",
  lost: "Lost",
};

export const STAGE_TONE: Record<Stage, string> = {
  new: "bg-muted text-muted-foreground",
  researched: "bg-blue-500/15 text-blue-500",
  contact_identified: "bg-cyan-500/15 text-cyan-400",
  contacted: "bg-purple-500/15 text-purple-400",
  meeting_booked: "bg-amber-500/15 text-amber-500",
  proposal_sent: "bg-orange-500/15 text-orange-400",
  contract_signed: "bg-teal-500/15 text-teal-400",
  won: "bg-green-500/20 text-green-500",
  lost: "bg-red-500/15 text-red-500",
};

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Outreach = Database["public"]["Tables"]["outreach"]["Row"];
export type OutreachOrder = Database["public"]["Tables"]["outreach_order"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type QueueItem = Database["public"]["Tables"]["queue"]["Row"];
export type Profile = Database["public"]["Tables"]["profile"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// Weighted forecast probabilities per stage (0-1)
export const STAGE_PROBABILITY: Record<Stage, number> = {
  new: 0.05,
  researched: 0.10,
  contact_identified: 0.15,
  contacted: 0.25,
  meeting_booked: 0.45,
  proposal_sent: 0.65,
  contract_signed: 0.90,
  won: 1.0,
  lost: 0,
};

// Stage forward order (for "no skipping" guard). Lost can be set from anywhere.
const STAGE_INDEX: Record<Stage, number> = {
  new: 0, researched: 1, contact_identified: 2, contacted: 3,
  meeting_booked: 4, proposal_sent: 5, contract_signed: 6, won: 7, lost: -1,
};

export function canTransition(from: Stage, to: Stage): { ok: boolean; reason?: string } {
  if (from === to) return { ok: true };
  if (to === "lost") return { ok: true };
  if (from === "won" || from === "lost") return { ok: false, reason: "Reopen the deal first." };
  const fi = STAGE_INDEX[from];
  const ti = STAGE_INDEX[to];
  if (ti < fi) return { ok: true }; // allow moving back
  if (ti - fi > 2) return { ok: false, reason: "You're skipping too many stages. Move one or two at a time." };
  return { ok: true };
}

export function confidenceTone(v: number): string {
  if (v >= 75) return "bg-green-500/20 text-green-500";
  if (v >= 50) return "bg-amber-500/20 text-amber-500";
  if (v >= 25) return "bg-orange-500/20 text-orange-400";
  return "bg-red-500/15 text-red-400";
}

export const TEAM = [
  "minakshi.shrimalve@qitt.ae",
  "mohammad.saleem@qitt.ae",
  "taru.jain@qitt.ae",
  "karuthapandi.gurusamy@qitt.ae",
];
