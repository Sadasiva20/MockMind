import { NextRequest, NextResponse } from "next/server";

/**
 * Alias endpoint for legacy clients.
 *
 * Front-end integration uses:
 * - GET /api/problems?... 
 * - POST /api/agent { command: "submit_answer" | "review_progress" | "recommend_problem" }
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  // Legacy clients might POST `{ problemId, answer }` without `command`.
  const command =
    typeof body?.command === "string" ? (body.command as string) : "submit_answer";

  const forwarded = {
    ...(body ?? {}),
    command,
  };

  const upstreamRes = await fetch(
    new URL("/api/agent", request.url),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(forwarded),
    }
  );

  const contentType = upstreamRes.headers.get("content-type") ?? "application/json";

  if (contentType.includes("application/json")) {
    const data = await upstreamRes.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: upstreamRes.status });
  }

  const text = await upstreamRes.text();
  return new NextResponse(text, {
    status: upstreamRes.status,
    headers: { "content-type": contentType },
  });
}

