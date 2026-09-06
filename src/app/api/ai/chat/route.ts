import { NextRequest, NextResponse } from "next/server";

const AI_BACKEND = process.env.AI_BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${AI_BACKEND}/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { error: `AI backend error: ${text}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/ai/chat]", err);
    return NextResponse.json(
      { error: "Could not reach the AI backend." },
      { status: 502 }
    );
  }
}
