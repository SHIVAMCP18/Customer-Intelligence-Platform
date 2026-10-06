"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // "local" ends only this browser's session (the default, "global", also
  // signs the user out on every other device). Errors are ignored: even if
  // the Auth server can't be reached, signOut() still clears the session
  // cookies, which is what actually signs this browser out.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  // Drop every cached page rendered for the signed-in user, so Back/Forward
  // can't show stale authenticated content after signing out.
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function switchOrg(formData: FormData) {
  const orgId = formData.get("orgId");
  if (typeof orgId !== "string" || orgId.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ current_org_id: orgId })
    .eq("id", user.id);

  revalidatePath("/", "layout");
}
