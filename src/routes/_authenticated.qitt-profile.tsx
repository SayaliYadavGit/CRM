import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Archive, RotateCcw, Plus, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qitt-profile")({ component: Page });

function Page() {
  const { data: profile, refetch: rp } = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data } = await supabase.from("profile").select("*").limit(1).maybeSingle();
      return data;
    },
  });
  const { data: products = [], refetch: rpr } = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data } = await supabase.from("products").select("*").order("created_at");
      return data ?? [];
    },
  });
  const active = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">QITT Profile</h1>
        <p className="text-sm text-muted-foreground">Single source of truth for company + products.</p>
      </div>

      {profile && <ProfileCard profile={profile} onSaved={rp} />}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide">Product portfolio</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportMd(active)}>Export products.md</Button>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />Add product</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {active.map((p) => <ProductCard key={p.id} product={p} onEdit={() => setEditing(p)} onChanged={rpr} />)}
      </div>

      <div>
        <button onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Archived ({archived.length})
        </button>
        {showArchived && (
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {archived.map((p) => (
              <div key={p.id} className="qitt-card p-3 flex items-center justify-between">
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">Archived {p.archived_date ? new Date(p.archived_date).toLocaleDateString() : ""}</div></div>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("products").update({ archived: false, archived_date: null }).eq("id", p.id); rpr(); toast.success("Restored."); }}>
                  <RotateCcw className="h-4 w-4 mr-1" />Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(editing || newOpen) && (
        <ProductDialog
          product={editing}
          onClose={() => { setEditing(null); setNewOpen(false); }}
          onSaved={() => { rpr(); setEditing(null); setNewOpen(false); }}
        />
      )}
    </div>
  );
}

function ProfileCard({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(profile);
  return (
    <div className="qitt-card p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {edit ? (
            <>
              <Input className="text-xl font-display" value={draft.company_name ?? ""} onChange={(e) => setDraft({ ...draft, company_name: e.target.value })} />
              <Input className="mt-2" value={draft.tagline ?? ""} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
              <Textarea className="mt-2" rows={3} value={draft.about ?? ""} onChange={(e) => setDraft({ ...draft, about: e.target.value })} />
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl tracking-wide">{profile.company_name}</h2>
              <p className="text-accent text-sm mt-1">{profile.tagline}</p>
              <p className="text-sm text-muted-foreground mt-3">{profile.about}</p>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={async () => {
          if (edit) {
            await supabase.from("profile").update(draft).eq("id", profile.id);
            toast.success("Saved."); onSaved();
          }
          setEdit((e) => !e);
        }}>{edit ? "Save" : <Pencil className="h-4 w-4" />}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Array.isArray(profile.metrics) ? (profile.metrics as Array<{label:string;value:string}>) : []).map((m, i) => (
          <div key={i} className="bg-muted/40 rounded p-3"><div className="text-xs text-muted-foreground">{m.label}</div><div className="qitt-stat-value text-2xl mt-1">{m.value}</div></div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        {[
          ["Founded", profile.founded], ["Presence", profile.presence], ["Model", profile.model],
          ["Team size", profile.team_size], ["Sectors", profile.sectors], ["Certifications", profile.certifications],
          ["Website", profile.website],
        ].map(([k, v]) => (
          <div key={k as string}><div className="text-xs text-muted-foreground uppercase tracking-wider">{k}</div><div>{v ?? "—"}</div></div>
        ))}
      </div>

      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Value propositions</div>
        <ul className="space-y-1 text-sm">{(profile.value_props ?? []).map((v) => <li key={v} className="flex gap-2"><span className="text-accent">▸</span>{v}</li>)}</ul>
      </div>
    </div>
  );
}

function ProductCard({ product, onEdit, onChanged }: { product: Product; onEdit: () => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="qitt-card p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-start justify-between text-left">
        <div>
          <div className="font-display text-lg tracking-wide">{product.name}</div>
          <div className="text-xs text-accent">{product.subtitle}</div>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <div><div className="text-xs uppercase tracking-wider text-muted-foreground">What it is</div><p>{product.what}</p></div>
          <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Who it's for</div><p>{product.who}</p></div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Capabilities</div>
            <div className="flex flex-wrap gap-1">{(product.capabilities ?? []).map((c) => <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-teal-500/15 text-teal-400">{c}</span>)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Problems it solves</div>
            <ul className="space-y-1">{(product.problems ?? []).map((p) => <li key={p} className="flex gap-2"><span className="text-destructive">·</span>{p}</li>)}</ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Differentiators</div>
            <ul className="space-y-1">{(product.differentiators ?? []).map((d) => <li key={d} className="flex gap-2"><span className="text-accent">★</span>{d}</li>)}</ul>
          </div>
          {(product.notes ?? []).length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <ul className="space-y-1 text-xs">{(product.notes ?? []).map((n, i) => <li key={i} className="text-muted-foreground">{n}</li>)}</ul>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note…" className="h-8" />
            <Button size="sm" onClick={async () => {
              if (!note.trim()) return;
              const stamp = `${new Date().toLocaleDateString()} — ${note}`;
              await supabase.from("products").update({ notes: [...(product.notes ?? []), stamp] }).eq("id", product.id);
              setNote(""); onChanged();
            }}>Add</Button>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              await supabase.from("products").update({ archived: true, archived_date: new Date().toISOString() }).eq("id", product.id);
              onChanged(); toast.success("Archived.");
            }}><Archive className="h-3 w-3 mr-1" />Archive</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDialog({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState({
    name: product?.name ?? "", subtitle: product?.subtitle ?? "", what: product?.what ?? "", who: product?.who ?? "",
    capabilities: (product?.capabilities ?? []).join(", "),
    problems: (product?.problems ?? []).join(", "),
    differentiators: (product?.differentiators ?? []).join(", "),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Subtitle" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
          <Textarea placeholder="What it is" rows={2} value={draft.what} onChange={(e) => setDraft({ ...draft, what: e.target.value })} />
          <Textarea placeholder="Who it's for" rows={2} value={draft.who} onChange={(e) => setDraft({ ...draft, who: e.target.value })} />
          <Input placeholder="Capabilities (comma-separated)" value={draft.capabilities} onChange={(e) => setDraft({ ...draft, capabilities: e.target.value })} />
          <Input placeholder="Problems (comma-separated)" value={draft.problems} onChange={(e) => setDraft({ ...draft, problems: e.target.value })} />
          <Input placeholder="Differentiators (comma-separated)" value={draft.differentiators} onChange={(e) => setDraft({ ...draft, differentiators: e.target.value })} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
            const payload = { name: draft.name, subtitle: draft.subtitle, what: draft.what, who: draft.who,
              capabilities: split(draft.capabilities), problems: split(draft.problems), differentiators: split(draft.differentiators) };
            if (product) await supabase.from("products").update(payload).eq("id", product.id);
            else await supabase.from("products").insert(payload);
            toast.success("Saved."); onSaved();
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportMd(products: Product[]) {
  const md = products.map((p) => `## ${p.name}\n**${p.subtitle}**\n\n**What:** ${p.what}\n\n**Who:** ${p.who}\n\n**Capabilities:** ${(p.capabilities ?? []).join(", ")}\n\n**Problems:** ${(p.problems ?? []).join("; ")}\n\n**Differentiators:** ${(p.differentiators ?? []).join("; ")}\n`).join("\n---\n\n");
  const blob = new Blob([`# QITT Products\n\n${md}`], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "products.md"; a.click();
  URL.revokeObjectURL(url);
}
