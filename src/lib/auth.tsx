import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "ae" | "viewer";
type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
};
const Ctx = createContext<AuthState>({ user: null, session: null, loading: true, roles: [], isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true, roles: [], isAdmin: false });

  useEffect(() => {
    let cancelled = false;

    async function hydrate(session: Session | null) {
      if (!session?.user) {
        if (!cancelled) setState({ user: null, session: null, loading: false, roles: [], isAdmin: false });
        return;
      }
      // Try to claim AE role (no-op if already there, errors out for non-@qitt.ae)
      // Fire-and-forget; we don't want it to block the UI.
      // Use setTimeout to avoid running inside the auth callback synchronously (deadlock guard).
      setTimeout(() => { void supabase.rpc("claim_qitt_role" as never); }, 0);

      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles: Role[] = ((roleRows ?? []) as Array<{ role: Role }>).map((r) => r.role);
      if (!cancelled) {
        setState({
          user: session.user,
          session,
          loading: false,
          roles,
          isAdmin: roles.includes("admin"),
        });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void hydrate(session);
    });
    supabase.auth.getSession().then(({ data }) => { void hydrate(data.session); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
