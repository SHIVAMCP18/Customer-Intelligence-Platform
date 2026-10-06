import { cache } from "react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type OrgRole = "admin" | "member" | "viewer";

export type CurrentMembership = {
  orgId: string;
  orgName: string;
  role: OrgRole;
};

export type MembershipSummary = {
  orgId: string;
  orgName: string;
  role: OrgRole;
};

/**
 * There's no generated Database type yet (needs a linked Supabase project to
 * generate against), so these results aren't schema-checked -- just
 * hand-typed at this boundary until `supabase gen types` is wired up.
 */

/** All orgs the signed-in user belongs to, for the org switcher. */
export const listMemberships = cache(async (): Promise<MembershipSummary[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!data) return [];

  return data.map((row) => {
    const org = row.organizations as unknown as { name: string } | null;
    return {
      orgId: row.org_id as string,
      orgName: org?.name ?? "",
      role: row.role as OrgRole,
    };
  });
});

/**
 * The user's active org (profiles.current_org_id), falling back to whichever
 * membership was found first if unset or stale (e.g. removed from that org).
 */
export const getCurrentMembership = cache(async (): Promise<CurrentMembership | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: profile }, memberships] = await Promise.all([
    supabase.from("profiles").select("current_org_id").eq("id", user.id).maybeSingle(),
    listMemberships(),
  ]);
  if (memberships.length === 0) return null;

  return memberships.find((m) => m.orgId === profile?.current_org_id) ?? memberships[0];
});
