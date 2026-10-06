import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org";
import { parseJsonBody } from "@/lib/api/validate";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClient as getGroq, isGroqConfigured, MODEL } from "@/lib/groq";
import { logError } from "@/lib/log-error";
import { buildSystemPrompt, fallbackAnswer, trimHistory } from "@/lib/rag";
import { retrieveContext } from "@/lib/rag-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1, "Ask a question").max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(40)
    .default([]),
});

/**
 * Streams newline-delimited JSON events:
 *   {"type":"sources", "sources":[...], "retrievers":{...}}   -- once, first
 *   {"type":"delta", "text":"..."}                             -- many
 *   {"type":"done"} | {"type":"error","message":"..."}          -- once, last
 *
 * Retrieval runs as the signed-in user, so RLS limits it to their own org.
 */
export async function POST(request: Request) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  }

  const limit = await checkRateLimit(`chat:${membership.orgId}`);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many questions — wait a few seconds." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.success) return parsed.response;
  const { message, history } = parsed.data;

  const supabase = await createClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const { overview, sources, retrievers } = await retrieveContext(
          supabase,
          membership.orgId,
          message
        );

        send({
          type: "sources",
          retrievers,
          sources: sources.map((s, i) => ({
            n: i + 1,
            id: s.id,
            content: s.content,
            sentiment: s.sentiment,
            themeName: s.themeName,
            channelName: s.channelName,
            createdAt: s.createdAt,
          })),
        });

        if (overview.totalFeedback === 0) {
          send({
            type: "delta",
            text: "There's no feedback in this workspace yet. Add some from **Add feedback** or **Import CSV**, then ask again.",
          });
          send({ type: "done" });
          return;
        }

        if (!isGroqConfigured()) {
          send({
            type: "delta",
            text: fallbackAnswer(sources, overview, "AI answers are off because GROQ_API_KEY isn't set."),
          });
          send({ type: "done" });
          return;
        }

        try {
          const completion = await getGroq().chat.completions.create({
            model: MODEL,
            stream: true,
            temperature: 0.2,
            max_completion_tokens: 900,
            messages: [
              { role: "system", content: buildSystemPrompt(overview, sources) },
              ...trimHistory(history),
              { role: "user", content: message },
            ],
          });

          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) send({ type: "delta", text });
          }
        } catch (error) {
          logError("chat.generate", error, { orgId: membership.orgId });
          send({
            type: "delta",
            text: fallbackAnswer(sources, overview, "The AI model couldn't be reached right now."),
          });
        }

        send({ type: "done" });
      } catch (error) {
        logError("chat.retrieve", error, { orgId: membership.orgId });
        send({ type: "error", message: "Something went wrong while searching your feedback." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
