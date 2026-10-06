import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  fallbackAnswer,
  fuseResults,
  trimHistory,
  type OrgOverview,
  type RetrievedFeedback,
} from "./rag";

function item(id: string, content = `feedback ${id}`): RetrievedFeedback {
  return {
    id,
    content,
    sentiment: "negative",
    painPoint: null,
    themeName: "Checkout",
    channelName: "Support",
    createdAt: "2026-09-01T10:00:00Z",
  };
}

const overview: OrgOverview = {
  totalFeedback: 42,
  sentimentCounts: { negative: 20, positive: 10, not_analyzed: 12 },
  topThemes: [{ name: "Checkout", itemCount: 12, avgSentiment: -0.5 }],
};

describe("fuseResults", () => {
  it("ranks items found by both retrievers above single-retriever hits", () => {
    const semantic = [item("a"), item("b"), item("c")];
    const keyword = [item("c"), item("d")];
    const fused = fuseResults([semantic, keyword], 10).map((r) => r.id);
    expect(fused[0]).toBe("c");
    expect(fused).toHaveLength(4);
  });

  it("dedupes and respects the limit", () => {
    const fused = fuseResults([[item("a"), item("b")], [item("a"), item("b")]], 1);
    expect(fused.map((r) => r.id)).toEqual(["a"]);
  });

  it("handles empty input", () => {
    expect(fuseResults([[], []], 5)).toEqual([]);
  });
});

describe("buildSystemPrompt", () => {
  it("numbers sources and includes the overview", () => {
    const prompt = buildSystemPrompt(overview, [item("a", "Checkout times out"), item("b")]);
    expect(prompt).toContain("[1] (channel: Support");
    expect(prompt).toContain("Checkout times out");
    expect(prompt).toContain("[2]");
    expect(prompt).toContain("Total feedback items: 42");
    expect(prompt).toContain("- Checkout: 12 items");
  });

  it("says so when nothing matched", () => {
    expect(buildSystemPrompt(overview, [])).toContain("no feedback matched");
  });
});

describe("trimHistory", () => {
  it("keeps only the most recent turns and truncates long ones", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: i === 11 ? "x".repeat(5000) : `turn ${i}`,
    }));
    const trimmed = trimHistory(history, 4, 100);
    expect(trimmed).toHaveLength(4);
    expect(trimmed[0].content).toBe("turn 8");
    expect(trimmed[3].content.length).toBeLessThanOrEqual(101);
  });
});

describe("fallbackAnswer", () => {
  it("lists retrieved feedback with citations", () => {
    const text = fallbackAnswer([item("a", "Slow checkout")], overview, "AI is off.");
    expect(text).toContain("AI is off.");
    expect(text).toContain("Slow checkout [1]");
    expect(text).toContain("Checkout — 12 items");
  });
});
