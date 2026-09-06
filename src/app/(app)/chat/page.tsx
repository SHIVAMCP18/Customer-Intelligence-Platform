import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org";
import { FeedbackChat } from "@/components/feedback-chat";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "AI Chat — VoiceIQ Enterprise" };

export default async function ChatPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const supabase = await createClient();

  // Fetch recent feedback to use as RAG context
  const { data } = await supabase
    .from("feedback_items")
    .select("content, sentiment, channels(name)")
    .eq("org_id", membership.orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const context =
    (data ?? [])
      .map((item) => {
        const channels: any = item.channels;
        const channel = Array.isArray(channels) && channels.length > 0
          ? channels[0].name
          : channels?.name || "unknown";
        const sentiment = item.sentiment ?? "unanalyzed";
        return `[${channel} | ${sentiment}] ${item.content}`;
      })
      .join("\n") || "No feedback available yet.";

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "calc(100vh - 4rem)" }}>
      <PageHeader
        title="AI Chat"
        description="Ask natural-language questions about your customer feedback. Powered by LangGraph + Llama 3."
      />
      <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-sm" style={{ height: "calc(100vh - 12rem)" }}>
        <FeedbackChat context={context} />
      </div>
    </div>
  );
}
