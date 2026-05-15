## Finish QITT CRM Phase 1

Complete the three deferred items from the initial build and verify the app end-to-end.

### 1. Pipeline drag-and-drop
- Wire `@dnd-kit/core` (already installed) into `_authenticated.pipeline.tsx`
- `DndContext` + `SortableContext` per stage column; draggable company cards
- On drop: `supabase.from("companies").update({ stage }).eq("id", ...)` — DB trigger handles activity + notification
- Optimistic update via React Query `setQueryData`, rollback on error
- Keep mobile fallback: tap card → small popover with stage select

### 2. Notifications dropdown
- Replace bare bell button in `AppShell.tsx` with a `Popover`
- List last 20 notifications (realtime already wired), unread styled with accent dot
- Click row → mark read + navigate to `/companies/$companyId`
- "Mark all read" action

### 3. Null-safety + polish pass on QITT Profile
- Guard `metrics`, `value_props`, `sectors`, etc. when undefined
- Ensure product edit dialog handles arrays (`capabilities`, `problems`, `differentiators`, `notes`) when null
- Verify "Export products.md" still produces valid markdown for archived/empty fields

### 4. Verification
- Read console + network logs after each fix
- Smoke test in preview: signup → submit queue card → research auto-runs → company detail loads → drag in pipeline → notification appears in bell dropdown
- Confirm dark/light theme toggle on every route

### Out of scope (still phase 2)
- Real LLM research pipeline
- Server-enforced `@qitt.ae` allowlist
- Mobile-optimized kanban interactions beyond tap-to-move
