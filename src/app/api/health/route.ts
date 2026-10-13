import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

async function probe(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
}

/**
 * Liveness + configuration report. Always 200 when the app itself is up (so a
 * platform health check never takes the app down because Supabase is paused);
 * the body says what's wrong. Reports only booleans -- never values or keys.
 *
 * Open /api/health in a browser when sign-in or a page misbehaves.
 */
export async function GET() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const configured = Boolean(url && anonKey);

  let authReachable: boolean | null = null;
  let migrationsApplied: boolean | null = null;

  if (configured) {
    const headers = { apikey: anonKey!, Authorization: `Bearer ${anonKey}` };
    const [auth, rpc] = await Promise.all([
      probe(`${url}/auth/v1/health`, { headers }),
      // The newest migration's function. Anonymous callers aren't allowed to
      // run it, so "permission denied" means it exists; PGRST202 means the
      // migration hasn't been applied to this database.
      probe(`${url}/rest/v1/rpc/get_org_theme_stats`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ p_org_id: "00000000-0000-0000-0000-000000000000" }),
      }),
    ]);
    authReachable = auth?.ok ?? false;
    if (rpc) {
      const body = (await rpc.json().catch(() => null)) as { code?: string } | null;
      migrationsApplied = body?.code !== "PGRST202";
    }
  }

  const problems: string[] = [];
  if (!configured) problems.push("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set on the server.");
  if (configured && !authReachable)
    problems.push("Supabase Auth is unreachable — check the URL, and that the Supabase project isn't paused.");
  if (migrationsApplied === false)
    problems.push("Database migrations are missing — run the SQL in supabase/migrations/ (newest file) on your project.");
  if (!process.env.GROQ_API_KEY) problems.push("GROQ_API_KEY is not set — AI answers, labels and summaries are off.");
  if (!process.env.HUGGINGFACE_API_TOKEN)
    problems.push("HUGGINGFACE_API_TOKEN is not set — clustering and semantic search are off.");

  return NextResponse.json(
    {
      status: problems.length === 0 ? "ok" : "degraded",
      supabase: { configured, authReachable, migrationsApplied },
      ai: { groq: Boolean(process.env.GROQ_API_KEY), embeddings: Boolean(process.env.HUGGINGFACE_API_TOKEN) },
      problems,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
