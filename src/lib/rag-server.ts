import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmbedding, isEmbeddingConfigured } from "@/lib/embeddings";
import { getOrgThemeStats } from "@/lib/scoring";
import { logError } from "@/lib/log-error";
import { fuseResults, type OrgOverview, type RetrievedFeedback } from "@/lib/rag";

const PER_RETRIEVER = 15;
const SOURCES_FOR_PROMPT = 10;
const TOP_THEMES = 8;
const EMBEDDING_TIMEOUT_MS = 8_000;

type MatchRow = {
  id: string;
  content: string;
  sentiment: string | null;
  pain_point: string | null;
  theme_name: string | null;
  channel_name: string | null;
  created_at: string;
};

function toRetrieved(rows: MatchRow[] | null): RetrievedFeedback[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    content: r.content,
    sentiment: r.sentiment,
    painPoint: r.pain_point,
    themeName: r.theme_name,
    channelName: r.channel_name,
    createdAt: r.created_at,
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

async function semanticSearch(
  supabase: SupabaseClient,
  orgId: string,
  question: string
): Promise<RetrievedFeedback[]> {
  if (!isEmbeddingConfigured()) return [];
  try {
    const embedding = await withTimeout(getEmbedding(question), EMBEDDING_TIMEOUT_MS);
    const { data, error } = await supabase.rpc("match_feedback", {
      p_org_id: orgId,
      p_query_embedding: embedding,
      p_match_count: PER_RETRIEVER,
    });
    if (error) throw new Error(error.message);
    return toRetrieved(data as MatchRow[]);
  } catch (error) {
    logError("rag.semantic_search", error, { orgId });
    return [];
  }
}

async function keywordSearch(
  supabase: SupabaseClient,
  orgId: string,
  question: string
): Promise<RetrievedFeedback[]> {
  const { data, error } = await supabase.rpc("search_feedback", {
    p_org_id: orgId,
    p_query: question,
    p_match_count: PER_RETRIEVER,
  });
  if (error) {
    logError("rag.keyword_search", error, { orgId });
    return [];
  }
  return toRetrieved(data as MatchRow[]);
}

/** Broad questions ("summarize sentiment") match nothing specific -- fall back to recent feedback. */
async function recentFeedback(supabase: SupabaseClient, orgId: string): Promise<RetrievedFeedback[]> {
  const { data, error } = await supabase
    .from("feedback_items")
    .select("id, content, sentiment, pain_point, created_at, themes(name), channels(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(SOURCES_FOR_PROMPT);
  if (error) {
    logError("rag.recent_feedback", error, { orgId });
    return [];
  }
  return (data ?? []).map((r) => {
    const theme = r.themes as unknown as { name: string | null } | null;
    const channel = r.channels as unknown as { name: string | null } | null;
    return {
      id: r.id as string,
      content: r.content as string,
      sentiment: r.sentiment as string | null,
      painPoint: r.pain_point as string | null,
      themeName: theme?.name ?? null,
      channelName: channel?.name ?? null,
      createdAt: r.created_at as string,
    };
  });
}

async function loadOverview(supabase: SupabaseClient, orgId: string): Promise<OrgOverview> {
  const [sentimentRes, themesRes, stats] = await Promise.all([
    supabase.rpc("get_feedback_sentiment_counts", { p_org_id: orgId }),
    supabase.from("themes").select("id, name").eq("org_id", orgId).not("name", "is", null),
    getOrgThemeStats(supabase, orgId).catch((error) => {
      logError("rag.theme_stats", error, { orgId });
      return new Map();
    }),
  ]);

  const sentimentCounts: Record<string, number> = {};
  let totalFeedback = 0;
  for (const row of (sentimentRes.data ?? []) as { sentiment: string | null; item_count: number }[]) {
    sentimentCounts[row.sentiment ?? "not_analyzed"] = row.item_count;
    totalFeedback += row.item_count;
  }

  const topThemes = (themesRes.data ?? [])
    .map((t) => {
      const s = stats.get(t.id as string);
      return {
        name: t.name as string,
        itemCount: s?.itemCount ?? 0,
        avgSentiment: s?.avgSentiment ?? null,
      };
    })
    .filter((t) => t.itemCount > 0)
    .sort((a, b) => b.itemCount - a.itemCount)
    .slice(0, TOP_THEMES);

  return { totalFeedback, sentimentCounts, topThemes };
}

export type RetrievalResult = {
  overview: OrgOverview;
  sources: RetrievedFeedback[];
  retrievers: { semantic: boolean; keyword: boolean; recent: boolean };
};

export async function retrieveContext(
  supabase: SupabaseClient,
  orgId: string,
  question: string
): Promise<RetrievalResult> {
  const [semantic, keyword, overview] = await Promise.all([
    semanticSearch(supabase, orgId, question),
    keywordSearch(supabase, orgId, question),
    loadOverview(supabase, orgId),
  ]);

  let sources = fuseResults([semantic, keyword], SOURCES_FOR_PROMPT);
  let usedRecent = false;
  if (sources.length < SOURCES_FOR_PROMPT / 2) {
    const recent = await recentFeedback(supabase, orgId);
    sources = fuseResults([sources, recent], SOURCES_FOR_PROMPT);
    usedRecent = recent.length > 0;
  }

  return {
    overview,
    sources,
    retrievers: { semantic: semantic.length > 0, keyword: keyword.length > 0, recent: usedRecent },
  };
}
