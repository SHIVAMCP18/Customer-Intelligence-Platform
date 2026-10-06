-- ============================================================================
-- 1. Batch analytics
--
-- The Opportunities, Trends and Executive-summary pages used to call
-- get_theme_stats / get_theme_trend once per theme. Incremental clustering
-- easily produces dozens of themes, so a single page load fanned out into
-- dozens of PostgREST round-trips -- slow at best, and one failing call threw
-- and took the whole page down. These org-wide versions return every theme in
-- one query. Both are security invoker, so RLS on feedback_items still
-- applies exactly as it did for the per-theme functions.
-- ============================================================================

create or replace function public.get_org_theme_stats(p_org_id uuid)
returns table (
  theme_id uuid,
  item_count int,
  reach int,
  avg_sentiment float8,
  sentiment_stddev float8
)
language sql
stable
as $$
  select
    theme_id,
    count(*)::int as item_count,
    count(distinct coalesce(customer_id::text, id::text))::int as reach,
    avg(sentiment_score) as avg_sentiment,
    stddev(sentiment_score) as sentiment_stddev
  from public.feedback_items
  where org_id = p_org_id
    and theme_id is not null
    and created_at > now() - interval '90 days'
  group by theme_id;
$$;

grant execute on function public.get_org_theme_stats(uuid) to authenticated;

create or replace function public.get_org_theme_trends(p_org_id uuid, p_weeks int default 8)
returns table (theme_id uuid, week_start date, item_count int)
language sql
stable
as $$
  select
    theme_id,
    date_trunc('week', created_at)::date as week_start,
    count(*)::int as item_count
  from public.feedback_items
  where org_id = p_org_id
    and theme_id is not null
    and created_at > now() - (p_weeks || ' weeks')::interval
  group by theme_id, week_start
  order by theme_id, week_start;
$$;

grant execute on function public.get_org_theme_trends(uuid, int) to authenticated;

-- ============================================================================
-- 2. Retrieval for the RAG chat
--
-- Two retrievers, merged in application code (src/lib/rag.ts):
--   * match_feedback   -- semantic search over the existing MiniLM embeddings
--   * search_feedback  -- Postgres full-text search, which needs no external
--                         API at all, so the chat keeps working (and still
--                         grounds its answers in real feedback) when the
--                         embedding API is down or not configured.
-- Both are security invoker: RLS decides which rows the caller can see, and
-- the explicit org filter keeps results to the active org.
-- ============================================================================

alter table public.feedback_items
  add column if not exists search_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists feedback_items_search_tsv_idx
  on public.feedback_items using gin (search_tsv);

create index if not exists feedback_items_embedding_hnsw_idx
  on public.feedback_items using hnsw (embedding vector_cosine_ops);

create or replace function public.match_feedback(
  p_org_id uuid,
  p_query_embedding vector(384),
  p_match_count int default 12
)
returns table (
  id uuid,
  content text,
  sentiment text,
  pain_point text,
  theme_name text,
  channel_name text,
  created_at timestamptz,
  similarity float8
)
language sql
stable
as $$
  select
    f.id,
    f.content,
    f.sentiment,
    f.pain_point,
    t.name as theme_name,
    c.name as channel_name,
    f.created_at,
    (1 - (f.embedding <=> p_query_embedding))::float8 as similarity
  from public.feedback_items f
  left join public.themes t on t.id = f.theme_id
  left join public.channels c on c.id = f.channel_id
  where f.org_id = p_org_id
    and f.embedding is not null
  order by f.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 50);
$$;

grant execute on function public.match_feedback(uuid, vector, int) to authenticated;

create or replace function public.search_feedback(
  p_org_id uuid,
  p_query text,
  p_match_count int default 12
)
returns table (
  id uuid,
  content text,
  sentiment text,
  pain_point text,
  theme_name text,
  channel_name text,
  created_at timestamptz,
  rank float8
)
language sql
stable
as $$
  with q as (
    -- OR the query's terms together: chat questions are full sentences, and
    -- requiring every word to match (websearch_to_tsquery's AND semantics)
    -- would find almost nothing.
    -- Lexemes are already normalized by to_tsvector, so they're quoted and
    -- cast straight to tsquery rather than re-parsed (which would choke on
    -- any punctuation left in them).
    select nullif(
      array_to_string(
        array(
          select quote_literal(lexeme)
          from unnest(to_tsvector('english', coalesce(p_query, '')))
        ),
        ' | '
      ),
      ''
    )::tsquery as expr
  )
  select
    f.id,
    f.content,
    f.sentiment,
    f.pain_point,
    t.name as theme_name,
    c.name as channel_name,
    f.created_at,
    ts_rank(f.search_tsv, q.expr)::float8 as rank
  from q, public.feedback_items f
  left join public.themes t on t.id = f.theme_id
  left join public.channels c on c.id = f.channel_id
  where q.expr is not null
    and f.org_id = p_org_id
    and f.search_tsv @@ q.expr
  order by rank desc, f.created_at desc
  limit least(greatest(p_match_count, 1), 50);
$$;

grant execute on function public.search_feedback(uuid, text, int) to authenticated;

-- Sentiment breakdown for the whole org in one query (the chat's overview
-- block and the dashboard summary cards). A null sentiment means "not
-- analyzed yet".
create or replace function public.get_feedback_sentiment_counts(p_org_id uuid)
returns table (sentiment text, item_count int)
language sql
stable
as $$
  select sentiment, count(*)::int
  from public.feedback_items
  where org_id = p_org_id
  group by sentiment;
$$;

grant execute on function public.get_feedback_sentiment_counts(uuid) to authenticated;
