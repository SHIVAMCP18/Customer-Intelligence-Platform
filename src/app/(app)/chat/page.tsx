import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org";
import { FeedbackChat } from "@/components/feedback-chat";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "AI Chat — VoiceIQ Enterprise" };

export default async function ChatPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  // Only a count is needed here: retrieval happens server-side per question
  // (see /api/ai/chat), so no feedback is shipped to the browser up front.
  const supabase = await createClient();
  const { count } = await supabase
    .from("feedback_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.orgId);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="AI Chat"
        description="Ask questions in plain English. Answers are retrieved from your feedback and cite their sources."
      />
      <div className="h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <FeedbackChat orgId={membership.orgId} feedbackCount={count ?? 0} />
      </div>
    </div>
  );
}
