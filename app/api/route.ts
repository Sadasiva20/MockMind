import { NextResponse } from "next/server";

// This is a catch-all for /api base path.
// In Next.js App Router, specific routes like /api/problems/route.ts take precedence.
export async function GET() {
  return NextResponse.json({
    message: "MockMind API",
    endpoints: {
      problems: "GET /api/problems?topic=...&difficulty=... or ?problemId=...",
      agent: "POST /api/agent with command in body",
      feedback: "POST /api/feedback (legacy, use /api/agent)",
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "POST /api not supported. Use specific endpoints like /api/agent or /api/feedback",
    },
    { status: 405 }
  );
}



