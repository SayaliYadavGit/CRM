import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Moon, Sun, LogOut, LayoutGrid, Columns3, Inbox, Building2, CheckCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { cn, fmtDate } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import logo from "@/assets/qitt-logo.png";

const TABS = [
  { to: "/opportunities", label: "Opportunities", icon: LayoutGrid },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/queue", label: "Queue", icon: Inbox },
  { to: "/qitt-profile", label: "QITT Profile", icon: Building2 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const nav = useNavigate();

  const load = useCallback(async () => {
    if (!user?.email) return;
    const { data } = await supabase.from("notifications").select("*")
      .eq("user_email", user.email).order("created_at", { ascending: false }).limit(20);
    setNotifs(data ?? []);
  }, [user?.email]);

  useEffect(() => {
    load();
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const unread = notifs.filter((n) => !n.read).length;

  async function openNotif(n: Notification) {
    if (!n.read) await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    if (n.company_id) nav({ to: "/companies/$companyId", params: { companyId: n.company_id } });
  }
  async function markAllRead() {
    if (!user?.email) return;
    await supabase.from("notifications").update({ read: true }).eq("user_email", user.email).eq("read", false);
    load();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="px-6 py-3 flex items-center gap-6">
          <Link to="/opportunities" className="flex items-center gap-3">
            <img src={logo} alt="QITT" className="h-7 w-auto" />
            <span className="font-display text-sm tracking-widest text-muted-foreground hidden sm:inline">CRM</span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            {TABS.map((t) => {
              const active = path.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition",
                    active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}>
                  <Icon className="h-4 w-4" />{t.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">{unread}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="text-sm font-medium">Notifications</div>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <CheckCheck className="h-3 w-3" />Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.length === 0 && <div className="px-3 py-6 text-xs text-muted-foreground text-center">No notifications yet.</div>}
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => openNotif(n)}
                      className={cn("w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted/50 transition flex gap-2", !n.read && "bg-accent/5")}>
                      <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-accent")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(n.created_at)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground hidden md:inline">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
