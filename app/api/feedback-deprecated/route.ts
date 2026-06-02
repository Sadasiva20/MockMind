import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use POST /api/agent with command=submit_answer instead.",
    },
    { status: 410 }
  );
}

