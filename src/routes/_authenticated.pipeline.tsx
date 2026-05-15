import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, STAGE_LABEL, canTransition, type Company, type Stage } from "@/lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pipeline")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: companies = [], refetch } = useQuery({
    queryKey: ["companies"],
    queryFn: async (): Promise<Company[]> => {
      const { data } = await supabase.from("companies").select("*").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  useEffect(() => {
    const ch = supabase.channel("pipeline").on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCompany = activeId ? companies.find((c) => c.id === activeId) : null;

  const [pendingLost, setPendingLost] = useState<{ id: string; reason: string } | null>(null);

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  async function applyMove(id: string, newStage: Stage, extra: Partial<Company> = {}) {
    const prev = companies;
    qc.setQueryData<Company[]>(["companies"], (old) =>
      (old ?? []).map((c) => (c.id === id ? { ...c, stage: newStage, ...extra } : c))
    );
    const { error } = await supabase.from("companies").update({ stage: newStage, ...extra }).eq("id", id);
    if (error) {
      qc.setQueryData(["companies"], prev);
      toast.error("Failed to move card.");
    } else {
      toast.success(`Moved to ${STAGE_LABEL[newStage]}`);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const newStage = overId as Stage;
    const current = companies.find((c) => c.id === id);
    if (!current || current.stage === newStage) return;

    const guard = canTransition(current.stage, newStage);
    if (!guard.ok) { toast.error(guard.reason ?? "Invalid stage move"); return; }
    if ((newStage === "contract_signed" || newStage === "won") && !current.deal_value) {
      toast.error("Set a deal value on the company before closing.");
      return;
    }
    if (newStage === "lost") { setPendingLost({ id, reason: "" }); return; }

    await applyMove(id, newStage);
  }

  return (
    <div className="px-6 py-6 space-y-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Drag a card between columns to update its stage. Stage rules apply.</p>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-6 px-6">
          <div className="grid grid-cols-9 gap-3 min-w-[1400px]">
            {STAGES.map((s) => {
              const list = companies.filter((c) => c.stage === s);
              return <Column key={s} stage={s} companies={list} onOpen={(id) => nav({ to: "/companies/$companyId", params: { companyId: id } })} />;
            })}
          </div>
        </div>
        <DragOverlay>{activeCompany && <CardInner company={activeCompany} dragging />}</DragOverlay>
      </DndContext>

      <Dialog open={!!pendingLost} onOpenChange={(o) => !o && setPendingLost(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark deal as Lost</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Capture why so the team learns from it.</p>
          <Textarea rows={4} placeholder="Reason (e.g. budget, timing, competitor, no decision-maker reached)…"
            value={pendingLost?.reason ?? ""}
            onChange={(e) => setPendingLost((p) => p ? { ...p, reason: e.target.value } : p)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingLost(null)}>Cancel</Button>
            <Button disabled={!pendingLost?.reason?.trim()} onClick={async () => {
              if (!pendingLost) return;
              await applyMove(pendingLost.id, "lost", { lost_reason: pendingLost.reason.trim() });
              setPendingLost(null);
            }}>Mark as Lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({ stage, companies, onOpen }: { stage: Stage; companies: Company[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className={cn("qitt-card p-3 transition", isOver && "ring-2 ring-accent")}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        {STAGE_LABEL[stage]} <span className="text-accent">{companies.length}</span>
      </div>
      <div className="space-y-2 min-h-[40px]">
        {companies.map((c) => <DraggableCard key={c.id} company={c} onOpen={onOpen} />)}
        {companies.length === 0 && <div className="text-xs text-muted-foreground/50 px-2 py-3">Empty</div>}
      </div>
    </div>
  );
}

function DraggableCard({ company, onOpen }: { company: Company; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: company.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onOpen(company.id); } }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <CardInner company={company} />
    </div>
  );
}

function CardInner({ company, dragging }: { company: Company; dragging?: boolean }) {
  return (
    <div className={cn("p-2 rounded bg-muted/40 hover:bg-muted text-xs", dragging && "shadow-lg ring-1 ring-accent bg-card")}>
      <div className="font-medium">{company.name}</div>
      <div className="text-muted-foreground">{company.location}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {(company.relevant_products ?? []).slice(0, 2).map((p) => (
          <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400">{p}</span>
        ))}
      </div>
      <div className="text-[10px] mt-1 text-accent font-mono">{company.confidence ?? 0}%</div>
    </div>
  );
}
