import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STAGES, STAGE_LABEL, canTransition, type Activity, type Company, type Contact, type Outreach, type OutreachOrder, type Stage, TEAM } from "@/lib/types";
import { StageBadge, ConfidenceBar } from "./_authenticated.opportunities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ChevronDown, ChevronRight, Copy, RefreshCw, MessageSquare, Activity as ActIcon, History, Plus, Pencil, Trash2 } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";
import { toast } from "sonner";
import { rerunResearchForCompany } from "@/lib/mock-pipeline";

export const Route = createFileRoute("/_authenticated/companies/$companyId")({ component: Page });

function Page() {
  const { companyId } = Route.useParams();
  const { user } = useAuth();

  const { data: company, refetch: rc } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async (): Promise<Company | null> => (await supabase.from("companies").select("*").eq("id", companyId).maybeSingle()).data,
  });
  const { data: contacts = [], refetch: rContacts } = useQuery({
    queryKey: ["contacts", companyId],
    queryFn: async (): Promise<Contact[]> => (await supabase.from("contacts").select("*").eq("company_id", companyId)).data ?? [],
  });
  const { data: outreach = [] } = useQuery({
    queryKey: ["outreach", companyId],
    queryFn: async (): Promise<Outreach[]> => (await supabase.from("outreach").select("*").eq("company_id", companyId)).data ?? [],
  });
  const { data: order = [] } = useQuery({
    queryKey: ["outreach_order", companyId],
    queryFn: async (): Promise<OutreachOrder[]> => (await supabase.from("outreach_order").select("*").eq("company_id", companyId).order("rank")).data ?? [],
  });
  const { data: activities = [], refetch: ra } = useQuery({
    queryKey: ["activities", companyId],
    queryFn: async (): Promise<Activity[]> => (await supabase.from("activities").select("*").eq("company_id", companyId).order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel(`co-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `company_id=eq.${companyId}` }, () => ra())
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `id=eq.${companyId}` }, () => rc())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, ra, rc]);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [editContact, setEditContact] = useState<Partial<Contact> | null>(null);

  if (!company) return <div className="px-6 py-12 text-muted-foreground">Loading company…</div>;

  async function changeStage(s: Stage) {
    if (!company) return;
    if (company.stage === s) return;
    const guard = canTransition(company.stage, s);
    if (!guard.ok) { toast.error(guard.reason ?? "Invalid stage move"); return; }
    if ((s === "contract_signed" || s === "won") && !company.deal_value) {
      toast.error("Set a deal value before closing.");
      return;
    }
    if (s === "lost") { setLostOpen(true); return; }
    const { error } = await supabase.from("companies").update({ stage: s }).eq("id", company.id);
    if (error) toast.error(error.message); else toast.success(`Moved to ${STAGE_LABEL[s]}`);
  }
  async function confirmLost() {
    if (!company || !lostReason.trim()) return;
    const { error } = await supabase.from("companies").update({ stage: "lost", lost_reason: lostReason.trim() }).eq("id", company.id);
    if (error) toast.error(error.message); else { toast.success("Marked as Lost"); setLostOpen(false); setLostReason(""); }
  }
  async function setAssignee(email: string) {
    if (!company) return;
    await supabase.from("companies").update({ assigned_email: email }).eq("id", company.id);
  }
  async function setDeal(v: string) {
    if (!company) return;
    await supabase.from("companies").update({ deal_value: v ? Number(v) : null }).eq("id", company.id);
  }
  async function addNote() {
    if (!note.trim() || !company) return;
    await supabase.from("activities").insert({ company_id: company.id, type: "note", content: note, user_email: user?.email, user_id: user?.id });
    setNote(""); ra();
  }
  async function rerun() {
    if (!company) return;
    setBusy(true);
    try {
      await rerunResearchForCompany(company.id, user?.email, user?.id);
      toast.success("Research refreshed (snapshot saved).");
      rc(); ra();
    } catch (e) { console.error(e); toast.error("Failed."); }
    finally { setBusy(false); }
  }

  let mapping: Array<{product:string;problem:string;how:string;relevance:string;starter:string}> = [];
  try { mapping = JSON.parse(company.product_mapping_table ?? "[]"); } catch {}

  return (
<div className="px-6 py-6 max-w-screen-2xl mx-auto space-y-5">
          <Link to="/opportunities" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3 mr-1" />Back</Link>

      <div className="qitt-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl tracking-wide">{company.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">{company.location} · {company.industry ?? "—"}</div>
            <div className="mt-3"><ConfidenceBar value={company.confidence ?? 0} /></div>
          </div>
          <Button size="sm" variant="outline" onClick={rerun} disabled={busy}><RefreshCw className={cn("h-3 w-3 mr-1", busy && "animate-spin")} />Re-run research</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">Stage</span>
          {STAGES.map((s) => (
            <button key={s} onClick={() => changeStage(s)}
              className={cn("text-[10px] px-2 py-1 rounded uppercase tracking-wider", company.stage === s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Owner</span>
            <Select value={company.assigned_email ?? ""} onValueChange={setAssignee}>
              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{TEAM.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Deal value</span>
            <Input className="h-8 w-32" type="number" defaultValue={company.deal_value ?? ""} onBlur={(e) => setDeal(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="qitt-card p-5">
        <h2 className="font-display text-lg tracking-wide mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" />Activity & notes</h2>
        <div className="flex gap-2 mb-4">
          <Textarea rows={2} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={addNote}>Post</Button>
        </div>
        <div className="space-y-3">
          {activities.map((a) => {
            const Icon = a.type === "note" ? MessageSquare : a.type === "stage_change" ? History : ActIcon;
            return (
              <div key={a.id} className="flex gap-3 text-sm">
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div>{a.content}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.user_email ?? "system"} · {fmtDate(a.created_at)}</div>
                </div>
              </div>
            );
          })}
          {activities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
        </div>
      </div>

      <Section title="Industry Profile" body={company.industry_profile} />
      <Section title="Process & Operations" body={company.process_assessment} />
      <Section title="Digital Maturity" body={company.digital_maturity} chip={company.digital_maturity_rating} />
      <Section title="AI & Automation Readiness" body={company.ai_readiness} />
      <Section title="Predicted Problem Statements" body={company.problem_statements} />

      <Collapsible title="QITT Product Relevance">
        {company.product_mapping_table && (
          <div className="overflow-x-auto mb-3 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_th]:text-left [&_th]:p-2 [&_th]:bg-muted/40 [&_th]:text-muted-foreground [&_th]:font-medium [&_th]:border-b [&_th]:border-border [&_td]:p-2 [&_td]:border-b [&_td]:border-border [&_tr:hover]:bg-muted/20" dangerouslySetInnerHTML={{ __html: company.product_mapping_table }} />
        )}
        {company.top_fits && (
          <div className="text-sm text-muted-foreground mt-3 space-y-2 [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:text-sm [&_h4]:mt-3 [&_h4:first-child]:mt-0 [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: company.top_fits }} />
        )}
      </Collapsible>
      <Collapsible title={`Contacts (${contacts.length})`}>
        <div className="flex justify-end mb-3">
          <Button size="sm" variant="outline" onClick={() => setEditContact({ company_id: company.id, name: "" })}>
            <Plus className="h-3 w-3 mr-1" />Add contact
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <div key={c.id} className="qitt-card p-4 text-sm relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditContact(c)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => {
                  if (!confirm(`Delete ${c.name}?`)) return;
                  const { error } = await supabase.from("contacts").delete().eq("id", c.id);
                  if (error) toast.error(error.message); else { toast.success("Deleted"); rContacts(); }
                }}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="font-medium pr-16">{c.name}</div>
              <div className="text-xs text-accent">{c.title} · {c.department}</div>
              {c.profile && <p className="text-xs text-muted-foreground mt-2">{c.profile}</p>}
              {c.why && <p className="text-xs mt-2"><span className="text-muted-foreground">Why: </span>{c.why}</p>}
              {c.outreach_angle && <p className="text-xs mt-1"><span className="text-muted-foreground">Angle: </span>{c.outreach_angle}</p>}
              <div className="flex gap-3 mt-2 text-xs">
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-primary underline">LinkedIn</a>}
                {c.email && <a href={`mailto:${c.email}`} className="text-primary underline">{c.email}</a>}
                {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
              </div>
            </div>
          ))}
          {contacts.length === 0 && <div className="text-xs text-muted-foreground col-span-2 text-center py-4">No contacts yet.</div>}
        </div>
      </Collapsible>

      <Collapsible title="Outreach drafts">
        <div className="space-y-4">
          {outreach.map((o) => (
            <div key={o.id} className="qitt-card p-4 text-sm space-y-3">
              <div className="font-medium">{o.contact_name} <span className="text-xs text-muted-foreground">· {o.department}</span></div>
              <CopyBlock label="LinkedIn connection" text={o.linkedin_connect ?? ""} />
              <CopyBlock label="LinkedIn follow-up" text={o.linkedin_followup ?? ""} />
              <CopyBlock label={`Email — ${o.email_subject ?? ""}`} text={o.email_body ?? ""} />
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Recommended outreach order">
        <ol className="space-y-2 text-sm">{order.map((o) => (
          <li key={o.id} className="flex gap-3"><span className="text-accent font-display text-lg">{o.rank}</span><div><div className="font-medium">{o.contact_name}</div><div className="text-xs text-muted-foreground">{o.reason}</div></div></li>
        ))}</ol>
      </Collapsible>

      {company.lost_reason && (
        <div className="qitt-card p-4 border-destructive/40 text-sm">
          <div className="text-xs uppercase tracking-wider text-destructive mb-1">Lost reason</div>
          <p className="text-muted-foreground">{company.lost_reason}</p>
        </div>
      )}

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark deal as Lost</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Capture why so the team learns from it.</p>
          <Textarea rows={4} placeholder="Reason (budget, timing, competitor, no decision-maker, etc.)…"
            value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLostOpen(false)}>Cancel</Button>
            <Button disabled={!lostReason.trim()} onClick={confirmLost}>Mark as Lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactDialog
        contact={editContact}
        onClose={() => setEditContact(null)}
        onSaved={() => { setEditContact(null); rContacts(); }}
      />
    </div>
  );
}

function ContactDialog({ contact, onClose, onSaved }: { contact: Partial<Contact> | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Contact>>({});
  useEffect(() => { setForm(contact ?? {}); }, [contact]);
  if (!contact) return null;
  const isEdit = !!contact.id;
  async function save() {
    if (!form.name?.trim() || !form.company_id) { toast.error("Name is required"); return; }
    const payload = {
      company_id: form.company_id,
      name: form.name.trim(),
      title: form.title || null,
      department: form.department || null,
      email: form.email || null,
      phone: form.phone || null,
      linkedin: form.linkedin || null,
      profile: form.profile || null,
      why: form.why || null,
      outreach_angle: form.outreach_angle || null,
    };
    const { error } = isEdit
      ? await supabase.from("contacts").update(payload).eq("id", contact!.id!)
      : await supabase.from("contacts").insert(payload);
    if (error) toast.error(error.message); else { toast.success(isEdit ? "Updated" : "Added"); onSaved(); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Name *" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Department" value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <Input placeholder="Email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="LinkedIn URL" value={form.linkedin ?? ""} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
        </div>
        <Textarea rows={2} placeholder="Profile / context" value={form.profile ?? ""} onChange={(e) => setForm({ ...form, profile: e.target.value })} />
        <Textarea rows={2} placeholder="Why this contact" value={form.why ?? ""} onChange={(e) => setForm({ ...form, why: e.target.value })} />
        <Textarea rows={2} placeholder="Outreach angle" value={form.outreach_angle ?? ""} onChange={(e) => setForm({ ...form, outreach_angle: e.target.value })} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{isEdit ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, body, chip }: { title: string; body?: string | null; chip?: string | null }) {
  return (
    <Collapsible title={title}>
      {chip && <span className="inline-block text-[10px] px-2 py-1 rounded bg-accent/15 text-accent uppercase tracking-wider mb-2">{chip}</span>}
{body
        ? <div className="text-sm text-muted-foreground space-y-2 [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:text-xs [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-accent [&_h4]:mt-4 [&_h4:first-child]:mt-0 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-sm [&_strong]:text-foreground [&_strong]:font-medium [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:bg-muted/20" dangerouslySetInnerHTML={{ __html: body }} />
        : <p className="text-sm text-muted-foreground">No data yet.</p>
      }
    </Collapsible>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="qitt-card p-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <h2 className="font-display text-lg tracking-wide">{title}</h2>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}><Copy className="h-3 w-3 mr-1" />Copy</Button>
      </div>
      <div className="bg-muted/40 rounded p-3 whitespace-pre-wrap text-xs">{text}</div>
    </div>
  );
}
