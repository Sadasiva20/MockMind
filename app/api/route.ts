import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    endpoints: {
      problems: "/api/problems",
      feedback: "/api/feedback",
    },
    description: "Use /api/problems to fetch a problem by topic/difficulty or problemId, and /api/feedback to submit an answer for AI evaluation.",
  });
}
