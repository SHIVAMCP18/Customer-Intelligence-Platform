import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org";
import { computeOpportunityScore, getOrgThemeStats, statsFor } from "@/lib/scoring";
import { ThemeRow } from "./theme-row";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = { title: "Opportunities — VoiceIQ Enterprise" };

export default async function OpportunitiesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const [{ data: themes, error }, stats] = await Promise.all([
    supabase
      .from("themes")
      .select("id, name, summary, item_count, impact_override, confidence_override, effort")
      .eq("org_id", membership.orgId),
    getOrgThemeStats(supabase, membership.orgId),
  ]);
  if (error) throw new Error(`Failed to load themes: ${error.message}`);

  const scored = (themes ?? []).map((theme) => {
    const score = computeOpportunityScore(statsFor(stats, theme.id), {
      impactOverride: theme.impact_override as number | null,
      confidenceOverride: theme.confidence_override as number | null,
      effort: theme.effort as number,
    });
    return { theme, score };
  });

  scored.sort((a, b) => b.score.opportunityScore - a.score.opportunityScore);

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description="Themes ranked by opportunity score — Reach × Impact × Confidence ÷ Effort."
      />

      {scored.length === 0 ? (
        <EmptyState
          title="No themes yet"
          description="Feedback gets clustered into themes automatically as it's processed."
        />
      ) : (
        <div className="stagger-children space-y-3">
          {scored.map(({ theme, score }) => (
            <ThemeRow
              key={theme.id}
              themeId={theme.id}
              name={theme.name as string | null}
              summary={theme.summary as string | null}
              itemCount={theme.item_count as number}
              score={score}
              canEdit={membership.role !== "viewer"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
