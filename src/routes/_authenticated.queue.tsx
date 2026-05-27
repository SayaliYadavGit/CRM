import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { parseCard } from "@/lib/ocr";
import { runMockResearch } from "@/lib/mock-pipeline";
import { cn } from "@/lib/utils";
import type { QueueItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/queue")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [form, setForm] = useState({ company_name: "", location: "", contact_name: "", contact_title: "", contact_email: "", contact_phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [cardName, setCardName] = useState<string | null>(null);

  const { data: items = [], refetch } = useQuery({
    queryKey: ["queue"],
    queryFn: async (): Promise<QueueItem[]> => {
      const { data } = await supabase.from("queue").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    // Watchdog: clear out any items stuck in "processing" > 5 minutes.
    void supabase.rpc("expire_stale_queue" as never).then(() => refetch());
    const interval = setInterval(() => {
      void supabase.rpc("expire_stale_queue" as never).then(() => refetch());
    }, 60_000);
    const ch = supabase.channel("queue").on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => refetch()).subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [refetch]);

 async function retry(q: QueueItem) {
    await supabase.from("queue").update({ status: "pending" }).eq("id", q.id);
    runMockResearch({ data: { queue_id: q.id } }).catch(async (err) => {
      console.error(err);
      await supabase.from("queue").update({ status: "failed" }).eq("id", q.id);
      toast.error("Research failed again.");
    });
  }

  async function handleCard(file: File) {
    setOcrBusy(true);
    setHasCard(true); setCardName(file.name);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data: { text } } = await Tesseract.recognize(file, "eng");
      const parsed = parseCard(text);
      setForm((f) => ({
        company_name: parsed.company_name ?? f.company_name,
        location: parsed.location ?? f.location,
        contact_name: parsed.contact_name ?? f.contact_name,
        contact_title: parsed.contact_title ?? f.contact_title,
        contact_email: parsed.contact_email ?? f.contact_email,
        contact_phone: parsed.contact_phone ?? f.contact_phone,
        notes: f.notes,
      }));
      toast.success("Business card parsed.");
    } catch (e) {
      console.error(e);
      toast.error("Could not parse card. Fill in the fields manually.");
    } finally { setOcrBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.location) return toast.error("Company and location are required.");
    setBusy(true);
    const { data, error } = await supabase.from("queue").insert({
      ...form,
      status: "pending",
      submitted_by: user?.id,
      submitted_email: user?.email,
      has_card: hasCard,
      card_name: cardName,
    }).select().single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Failed."); }
    setForm({ company_name: "", location: "", contact_name: "", contact_title: "", contact_email: "", contact_phone: "", notes: "" });
    setHasCard(false); setCardName(null);
    setBusy(false);
   toast.success("Submitted. AI research starting…");
    runMockResearch({ data: { queue_id: data.id } }).catch(async (err) => {
      console.error(err);
      await supabase.from("queue").update({ status: "failed" }).eq("id", data.id);
      toast.error("Research failed.");
    });
  }

  return (
    <div className="px-6 py-6 grid lg:grid-cols-2 gap-6">
      <div className="qitt-card p-6">
        <h2 className="font-display text-xl tracking-wide mb-1">Submit a company</h2>
        <p className="text-xs text-muted-foreground mb-4">Drop a business card to auto-fill, or fill in manually.</p>
        <label className={cn("flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-accent text-sm", ocrBusy && "opacity-60")}>
          {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {ocrBusy ? "Parsing card…" : cardName ?? "Upload business card (JPG/PNG)"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCard(f); }} />
        </label>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {[
            { k: "company_name", label: "Company name *" },
            { k: "location", label: "Location *" },
            { k: "contact_name", label: "Contact name" },
            { k: "contact_title", label: "Title / role" },
            { k: "contact_email", label: "Email", type: "email" },
            { k: "contact_phone", label: "Phone" },
          ].map((f) => (
            <div key={f.k} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input type={f.type ?? "text"} value={(form as Record<string,string>)[f.k]} onChange={(e) => setForm((p) => ({ ...p, [f.k]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit & start AI research"}</Button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl tracking-wide">Queue</h2>
        {items.length === 0 && <div className="qitt-card p-6 text-sm text-muted-foreground">No submissions yet.</div>}
        {items.map((q) => (
          <div key={q.id} className="qitt-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{q.company_name}</div>
                <div className="text-xs text-muted-foreground">{q.location} · {q.submitted_email}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={q.status} />
                {q.status === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => retry(q)}>Retry</Button>
                )}
              </div>
            </div>
            {(q.contact_name || q.notes) && (
              <div className="mt-3 text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
                {q.contact_name && <div>{q.contact_name}{q.contact_title ? ` — ${q.contact_title}` : ""}</div>}
                {q.contact_email && <div>{q.contact_email}</div>}
                {q.notes && <div className="italic">{q.notes}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string,string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-amber-500/15 text-amber-500",
    done: "bg-green-500/15 text-green-500",
    failed: "bg-destructive/15 text-destructive",
  };
  return <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded", tone[status] ?? "bg-muted")}>{status}</span>;
}
