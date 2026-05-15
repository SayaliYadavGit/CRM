import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, STAGE_LABEL, STAGE_TONE, STAGE_PROBABILITY, TEAM, confidenceTone, type Company, type Stage } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Download, Users, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/opportunities")({ component: Page });

function Page() {
  const { data: companies = [], refetch } = useQuery({
    queryKey: ["companies"],
    queryFn: async (): Promise<Company[]> => {
      const { data } = await supabase.from("companies").select("*").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("companies-list").on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [view, setView] = useState<"table" | "industry" | "confidence">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (stage !== "all" && c.stage !== stage) return false;
      if (q && ![c.name, c.location, c.industry].some((x) => (x ?? "").toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [companies, q, stage]);

  const stats = useMemo(() => {
    const open = companies.filter((c) => c.stage !== "won" && c.stage !== "lost");
    const total = companies.length;
    const won = companies.filter((c) => c.stage === "won").length;
    const avg = total ? Math.round(companies.reduce((s, c) => s + (c.confidence ?? 0), 0) / total) : 0;
    const pipelineValue = open.reduce((s, c) => s + Number(c.deal_value ?? 0), 0);
    const weighted = open.reduce((s, c) => s + Number(c.deal_value ?? 0) * STAGE_PROBABILITY[c.stage], 0);
    const wonValue = companies.filter((c) => c.stage === "won").reduce((s, c) => s + Number(c.deal_value ?? 0), 0);
    return { total, won, avg, pipelineValue, weighted, wonValue, open: open.length };
  }, [companies]);

  const fmtMoney = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`;

  async function bulkAssign(email: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("companies").update({ assigned_email: email }).in("id", ids);
    if (error) toast.error(error.message); else { toast.success(`Reassigned ${ids.length} to ${email.split("@")[0]}`); setSelected(new Set()); refetch(); }
  }
  async function bulkStage(s: Stage) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("companies").update({ stage: s }).in("id", ids);
    if (error) toast.error(error.message); else { toast.success(`Moved ${ids.length} to ${STAGE_LABEL[s]}`); setSelected(new Set()); refetch(); }
  }
  function exportCsv() {
    const rows = (selected.size ? filtered.filter((c) => selected.has(c.id)) : filtered);
    const header = ["Name", "Location", "Industry", "Stage", "Confidence", "Deal value", "Owner"];
    const csv = [header, ...rows.map((c) => [c.name, c.location ?? "", c.industry ?? "", STAGE_LABEL[c.stage], c.confidence ?? 0, c.deal_value ?? "", c.assigned_email ?? ""])]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `qitt-opportunities-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">All companies in your intelligence pipeline.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Open deals" value={stats.open} />
        <Stat label="Pipeline value" value={`AED ${fmtMoney(stats.pipelineValue)}`} />
        <Stat label="Weighted forecast" value={`AED ${fmtMoney(stats.weighted)}`} accent />
        <Stat label="Won (closed)" value={`AED ${fmtMoney(stats.wonValue)}`} />
        <Stat label="Avg confidence" value={`${stats.avg}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search company, industry, location…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3 w-3 mr-1" />Export CSV</Button>
        <div className="ml-auto flex rounded-md border border-border overflow-hidden text-xs">
          {(["table","industry","confidence"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1.5", view === v ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>{v}</button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="qitt-card p-3 flex flex-wrap items-center gap-3 text-sm border-accent/40">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 text-muted-foreground" />
            <Select onValueChange={bulkAssign}>
              <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Reassign owner…" /></SelectTrigger>
              <SelectContent>{TEAM.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
            <Select onValueChange={(v) => bulkStage(v as Stage)}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Move to stage…" /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {view === "table" && <CompanyTable items={filtered} selected={selected} onToggle={(id) => {
        const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next);
      }} onToggleAll={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))} />}
      {view === "industry" && <IndustryView items={filtered} />}
      {view === "confidence" && <ConfidenceView items={filtered} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="qitt-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("qitt-stat-value mt-2", accent && "text-accent")}>{value}</div>
    </div>
  );
}

function CompanyTable({ items, selected, onToggle, onToggleAll }: { items: Company[]; selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void }) {
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  return (
    <div className="qitt-card overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <tr>
            <th className="px-3 py-3 w-8"><Checkbox checked={allSelected} onCheckedChange={onToggleAll} /></th>
            <th className="px-4 py-3 text-left">Stage</th>
            <th className="px-4 py-3 text-left">Company</th>
            <th className="px-4 py-3 text-left">Location</th>
            <th className="px-4 py-3 text-left">Industry</th>
            <th className="px-4 py-3 text-left">Products</th>
            <th className="px-4 py-3 text-left">Confidence</th>
            <th className="px-4 py-3 text-left">Owner</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No companies yet. Submit one in the Queue tab.</td></tr>
          )}
          {items.map((c) => (
            <tr key={c.id} className={cn("border-b border-border/50 hover:bg-muted/40", selected.has(c.id) && "bg-accent/5")}>
              <td className="px-3 py-3"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => onToggle(c.id)} /></td>
              <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
              <td className="px-4 py-3"><Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium hover:text-accent">{c.name}</Link></td>
              <td className="px-4 py-3 text-muted-foreground">{c.location ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.industry ?? "—"}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{(c.relevant_products ?? []).slice(0, 2).map((p) => <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-teal-500/15 text-teal-400">{p}</span>)}</div></td>
              <td className="px-4 py-3"><ConfidenceBar value={c.confidence ?? 0} /></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{c.assigned_email?.split("@")[0] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={cn("text-[10px] px-2 py-1 rounded uppercase tracking-wider font-medium", STAGE_TONE[stage])}>{STAGE_LABEL[stage]}</span>;
}

export function ConfidenceBar({ value }: { value: number }) {
  const tone = confidenceTone(value);
  const barColor = value >= 75 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : value >= 25 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", barColor)} style={{ width: `${value}%` }} /></div>
      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", tone)}>{value}%</span>
    </div>
  );
}

function IndustryView({ items }: { items: Company[] }) {
  const groups = items.reduce((acc, c) => {
    const k = c.industry ?? "Unclassified";
    (acc[k] = acc[k] ?? []).push(c);
    return acc;
  }, {} as Record<string, Company[]>);
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(groups).map(([industry, list]) => (
        <div key={industry} className="qitt-card p-4">
          <div className="text-sm font-semibold text-accent">{industry}</div>
          <div className="text-xs text-muted-foreground mb-3">{list.length} companies</div>
          <div className="space-y-2">
            {list.map((c) => (
              <Link key={c.id} to="/companies/$companyId" params={{ companyId: c.id }} className="block px-2 py-1.5 rounded hover:bg-muted text-sm">
                {c.name} <span className="text-xs text-muted-foreground">· {c.confidence}%</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfidenceView({ items }: { items: Company[] }) {
  const buckets = {
    "High (≥75%)": items.filter((c) => (c.confidence ?? 0) >= 75),
    "Medium (50-74%)": items.filter((c) => (c.confidence ?? 0) >= 50 && (c.confidence ?? 0) < 75),
    "Low (25-49%)": items.filter((c) => (c.confidence ?? 0) >= 25 && (c.confidence ?? 0) < 50),
    "Needs Validation (<25%)": items.filter((c) => (c.confidence ?? 0) < 25),
  };
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Object.entries(buckets).map(([label, list]) => (
        <div key={label} className="qitt-card p-4">
          <div className="text-sm font-semibold mb-3">{label} <span className="text-xs text-muted-foreground">· {list.length}</span></div>
          <div className="space-y-2">
            {list.map((c) => (
              <Link key={c.id} to="/companies/$companyId" params={{ companyId: c.id }} className="block px-2 py-2 rounded bg-muted/40 hover:bg-muted text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.location} · {c.confidence}%</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
