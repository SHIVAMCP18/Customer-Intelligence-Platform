# VoiceIQ Enterprise

> **VoiceIQ is an AI-powered customer intelligence platform that aggregates scattered feedback, clusters it into actionable themes, and scores opportunities by sentiment and business impact to drive evidence-based product roadmaps.**

Customer feedback is scattered across support tickets, reviews, surveys, call notes, and sales conversations — which means the loudest voice, not the most common or highest-impact one, tends to win roadmap debates. VoiceIQ turns that scattered feedback into a continuously updated, prioritized product opportunity map, so prioritization is evidence-based instead of anecdote-based.

**Live:** [frontend-production-b159.up.railway.app](https://frontend-production-b159.up.railway.app)

## What it does

- Ingests feedback from multiple channels (manual entry, CSV import, embeddable widget)
- Clusters feedback into themes using semantic embeddings
- Scores each theme by volume, sentiment, and business impact (RICE-based)
- Surfaces data-backed personas and an executive-ready narrative of what customers are asking for and why it matters
- **AI Chat (RAG):** ask questions in plain English; answers are retrieved from your own feedback (hybrid pgvector + full-text search), streamed from Llama 3.3, and cite the exact feedback items they rely on

## Tech stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Hosting:** Railway
- **Database / Auth:** Supabase (Postgres, Auth, Storage, Row-Level Security, pgvector)
- **AI:** Groq (Llama 3.3) for sentiment, summarization, clustering labels and the RAG chat; Hugging Face `all-MiniLM-L6-v2` embeddings (384-d) stored in pgvector
- **Caching / rate limiting:** Upstash Redis
- **Charts:** Recharts

See [ARCHITECTURE.md](./ARCHITECTURE.md) for schema and pipeline details, and [PRD.md](./PRD.md) for product scope.

## Getting started

Everything runs in the single Next.js app — there is no separate AI server.

```bash
npm install
cp .env.example .env.local   # fill in your own service keys
npx supabase db push         # apply supabase/migrations to your project
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Only the two Supabase keys are required. Every AI feature degrades gracefully
without its key: with no `HUGGINGFACE_API_TOKEN` the chat falls back to
Postgres full-text retrieval, and with no `GROQ_API_KEY` it returns the most
relevant feedback instead of a generated answer.

To run against a local Supabase instead: `npx supabase start`, then put the
printed API URL and anon key in `.env.local`.

### How the RAG chat works

```
question ─┬─ embed (MiniLM) ─► match_feedback()   semantic search, pgvector HNSW
          └────────────────► search_feedback()  Postgres full-text search
                                   │
                  reciprocal-rank fusion ─► top 10 feedback items
                                   │
   org overview (theme sizes, sentiment mix) + numbered sources ─► Groq, streamed
```

Retrieval runs as the signed-in user, so row-level security keeps it inside
the user's own organization. See `src/lib/rag.ts`, `src/lib/rag-server.ts`
and `src/app/api/ai/chat/route.ts`.

### Deploying (Docker / Railway)

`NEXT_PUBLIC_*` values are read at runtime on the server, so one image works
for any environment — set the variables on the service, no build args needed.
`railway.json` pins the Dockerfile build and uses `/api/health` as the
health check.

**Troubleshooting:** open `https://<your-app>/api/health`. It reports (without
revealing any secrets) whether Supabase is configured and reachable, whether
the database migrations are applied, and which AI keys are missing.

### Supabase Auth settings (needed for sign-up emails)

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** your app's URL, e.g. `https://frontend-production-b159.up.railway.app`
- **Redirect URLs:** add `https://frontend-production-b159.up.railway.app/**`

Without these, confirmation emails link to `localhost`.

Optional, recommended — lets people confirm from a different device than the
one they signed up on (e.g. sign up on a laptop, open the email on a phone):
**Authentication → Emails → Confirm signup**, change the link to

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Supabase's built-in email service only sends a few emails per hour; for real
users configure custom SMTP under **Authentication → Emails → SMTP Settings**.

## Project docs

- [EXECUTIVE_PRESENTATION.md](./EXECUTIVE_PRESENTATION.md) — one-page overview
- [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) — sprint-by-sprint status
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) — vision and sprint plan
- [PRD.md](./PRD.md) — product requirements
- [PERSONAS.md](./PERSONAS.md) — target users
- [COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md) — market landscape
- [OPPORTUNITY_FRAMEWORK.md](./OPPORTUNITY_FRAMEWORK.md) / [RICE_PRIORITIZATION.md](./RICE_PRIORITIZATION.md) — how opportunity scoring works
- [KPI_FRAMEWORK.md](./KPI_FRAMEWORK.md) — how success is measured
- [GTM_STRATEGY.md](./GTM_STRATEGY.md) — go-to-market plan
- [PRICING_STRATEGY.md](./PRICING_STRATEGY.md) — pricing plan
- [ROADMAP.md](./ROADMAP.md) — MVP → V1 → V2
- [BACKLOG.md](./BACKLOG.md) — current sprint backlog
- [ARCHITECTURE.md](./ARCHITECTURE.md) — schema, API, pipeline design

## License

Proprietary — all rights reserved.
