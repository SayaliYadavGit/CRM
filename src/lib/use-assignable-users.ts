import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AssignableUser = { email: string; role: "admin" | "ae" };

/**
 * Fetches the list of users who can be assigned as owner of a lead.
 * Returns admins + account executives (excludes viewers).
 * Backed by the public.get_assignable_users() Postgres function.
 */
export function useAssignableUsers() {
  return useQuery({
    queryKey: ["assignable-users"],
    queryFn: async (): Promise<AssignableUser[]> => {
      const { data, error } = await supabase.rpc("get_assignable_users");
      if (error) {
        console.error("Failed to fetch assignable users:", error);
        return [];
      }
      return (data ?? []) as AssignableUser[];
    },
    staleTime: 5 * 60 * 1000, // cache for 5 min — user list changes rarely
  });
}
