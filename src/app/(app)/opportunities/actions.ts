"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org";
import { IMPACT_SCALE } from "@/lib/scoring";

function parseOverride(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateThemeScoring(formData: FormData) {
  const themeId = formData.get("themeId");
  if (typeof themeId !== "string") return;

  const membership = await getCurrentMembership();
  if (!membership) throw new Error("Not authenticated");
  if (membership.role === "viewer") throw new Error("Viewers can't edit scoring.");

  // Impact snaps to the RICE scale, confidence is a 0-1 fraction, effort must
  // be positive -- out-of-range values would otherwise silently distort the
  // ranking (e.g. a confidence of 80 meaning "80%" multiplies the score by 80).
  const impactRaw = parseOverride(formData.get("impactOverride"));
  const impactOverride =
    impactRaw === null
      ? null
      : IMPACT_SCALE.reduce((best, v) => (Math.abs(v - impactRaw) < Math.abs(best - impactRaw) ? v : best));
  const confidenceRaw = parseOverride(formData.get("confidenceOverride"));
  const confidenceOverride =
    confidenceRaw === null ? null : Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw));
  const effortRaw = parseOverride(formData.get("effort"));
  const effort = effortRaw !== null && effortRaw > 0 ? Math.min(effortRaw, 1000) : 1;

  const supabase = await createClient();
  const { error } = await supabase
    .from("themes")
    .update({
      impact_override: impactOverride,
      confidence_override: confidenceOverride,
      effort,
    })
    .eq("id", themeId);
  if (error) throw new Error(error.message);

  await supabase.rpc("log_audit_event", {
    p_org_id: membership.orgId,
    p_action: "theme.scoring_updated",
    p_target_type: "theme",
    p_target_id: themeId,
    p_metadata: { impact_override: impactOverride, confidence_override: confidenceOverride, effort },
  });

  revalidatePath("/opportunities");
}
