import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";
import { callGeminiAPI } from "../../lib/gemini-service";
import { hasAIConfig } from "../../lib/gemini-service-safe";

import {
  type Problem as EngineProblem,
  type Evaluation as EngineEvaluation,
  runSubmitAnswerAgent,
} from "../../agent/agent-engine";

const PROBLEMS_COLLECTION =
  process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";
const REVIEWS_COLLECTION =
  process.env.MONGODB_COLLECTION ?? "interview_results";

type Problem = EngineProblem;
type Evaluation = EngineEvaluation;

/* ---------------- SAFE HELPERS ---------------- */

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    return JSON.parse(cleaned);
  }
}

/* ---------------- PROMPTS ---------------- */

function buildAgentPrompt(args: {
  userId: string;
  command: string;
  currentProblem?: Problem;
  evaluation?: Evaluation;
  historySummary: string;
}) {
  const { userId, command, currentProblem, evaluation, historySummary } = args;

  return `
User ID: ${userId}
Command: ${command}

History:
${historySummary}

${
  currentProblem
    ? `Current Problem:
Title: ${currentProblem.title}
Difficulty: ${currentProblem.difficulty}
Topic: ${currentProblem.topic}
Description: ${currentProblem.description}
Instructions: ${currentProblem.instructions ?? "n/a"}`
    : ""
}

${
  evaluation
    ? `Latest Evaluation:
Correctness: ${evaluation.correctness}
Confidence: ${evaluation.confidence}
Time Complexity: ${evaluation.timeComplexity}
Mistakes: ${evaluation.mistakes}
Hint: ${evaluation.hint}
Follow-up: ${evaluation.followUp}
Assigned Difficulty: ${evaluation.assignedDifficulty}`
    : ""
}

Return a concise coaching message with ONE next action.
`;
}

/* ---------------- HISTORY ---------------- */

function summarizeHistory(
  records: Array<{ evaluation: Evaluation }>
): string {
  if (!records?.length) {
    return "No prior sessions found.";
  }

  const counts = { correct: 0, partial: 0, incorrect: 0 };

  for (const r of records) {
    const c = r?.evaluation?.correctness;
    if (c in counts) counts[c as keyof typeof counts]++;
  }

  return `Sessions: ${records.length}
Correct: ${counts.correct}
Partial: ${counts.partial}
Incorrect: ${counts.incorrect}`;
}

/* ---------------- MAIN ROUTE ---------------- */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body?.command || typeof body.command !== "string") {
      return NextResponse.json(
        { error: "Missing command" },
        { status: 400 }
      );
    }

    if (!hasAIConfig()) {
      return NextResponse.json(
        { error: "AI not configured (missing GOOGLE_API_KEY)" },
        { status: 500 }
      );
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db(MONGODB_DB);

    const problems = db.collection(PROBLEMS_COLLECTION);
    const reviews = db.collection(REVIEWS_COLLECTION);

    const userId =
      typeof body.userId === "string" ? body.userId : "local-user";

    /* ---------------- SUBMIT ANSWER ---------------- */

    if (body.command === "submit_answer") {
      if (
        typeof body.problemId !== "string" ||
        typeof body.answer !== "string"
      ) {
        return NextResponse.json(
          { error: "problemId and answer required" },
          { status: 400 }
        );
      }

      const problem = await problems.findOne<Problem>({
        id: body.problemId,
      });

      if (!problem) {
        return NextResponse.json(
          { error: "Problem not found" },
          { status: 404 }
        );
      }

      let engineResult;

      try {
        engineResult = await runSubmitAnswerAgent({
          userId,
          command: "submit_answer",
          currentProblem: problem,
          answer: body.answer,
          historySummary: "session",
        });
      } catch (err) {
        console.error("Engine error:", err);

        return NextResponse.json(
          {
            error: "Agent engine failed. Check server logs.",
          },
          { status: 500 }
        );
      }

      const evaluation = engineResult.feedback;
      const assignedDifficulty = engineResult.assignedDifficulty;

      await reviews.insertOne({
        userId,
        problemId: problem.id,
        problemTitle: problem.title,
        problemDifficulty: problem.difficulty,
        topic: problem.topic,
        answer: body.answer,
        evaluation,
        assignedDifficulty,
        createdAt: new Date(),
      });

      const history = await reviews
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      const historySummary = summarizeHistory(
        history as unknown as Array<{ evaluation: Evaluation }>
      );

      let agentAdvice = "";
      try {
         const prompt = buildAgentPrompt({
         userId,
         command: "submit_answer",
        currentProblem: problem,
        evaluation,
        historySummary,
  });

  agentAdvice = (await callGeminiAPI(prompt)).trim();
} catch (err) {
  console.error("Gemini error FULL:", err);

  agentAdvice =
    err instanceof Error
      ? `Gemini failed: ${err.message}`
      : `Gemini failed: ${String(err)}`;
}
      const nextAction =
        evaluation.correctness === "correct"
          ? "Try a harder problem"
          : evaluation.correctness === "partial"
          ? "Fix issues and retry"
          : "Review hints and retry";

      return NextResponse.json({
        feedback: evaluation,
        assignedDifficulty,
        agentAdvice,
        progressSummary: historySummary,
        nextAction,
      });
    }

    /* ---------------- CHAT ---------------- */

    if (body.command === "chat") {
      if (!body.prompt || typeof body.prompt !== "string") {
        return NextResponse.json(
          { error: "Prompt required" },
          { status: 400 }
        );
      }

      try {
        const reply = await callGeminiAPI(body.prompt);

        return NextResponse.json({
          agentAdvice: reply,
        });
      } catch (err) {
        console.error("Chat error:", err);

        return NextResponse.json(
          { error: "Chat failed" },
          { status: 500 }
        );
      }
    }

    /* ---------------- REVIEW ---------------- */

    if (body.command === "review_progress") {
      const history = await reviews
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      const summary = summarizeHistory(
        history as unknown as Array<{ evaluation: Evaluation }>
      );

      let advice = "";

      try {
        advice = await callGeminiAPI(
          `Summarize progress and suggest next steps:\n${summary}`
        );
      } catch (err) {
        console.error("Review error:", err);
        advice = "Unable to generate review.";
      }

      return NextResponse.json({
        agentAdvice: advice,
        progressSummary: summary,
        nextAction: "Continue practicing problems",
      });
    }

    /* ---------------- RECOMMEND ---------------- */

    if (body.command === "recommend_problem") {
      const pipeline: Record<string, unknown>[] = [];

      if (body.topic && body.topic !== "all") {
        pipeline.push({
          $match: { topic: body.topic.toLowerCase() },
        });
      }

      if (body.difficulty && body.difficulty !== "all") {
        pipeline.push({
          $match: { difficulty: body.difficulty.toLowerCase() },
        });
      }

      pipeline.push({ $sample: { size: 1 } });

      const [problem] = await problems
        .aggregate<Problem>(pipeline)
        .toArray();

      if (!problem) {
        return NextResponse.json(
          { error: "No problem found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        problem,
        nextAction: "Solve this problem",
      });
    }

    return NextResponse.json(
      { error: "Unknown command" },
      { status: 400 }
    );
  } catch (err) {
    console.error("API /agent fatal error:", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Server failure",
      },
      { status: 500 }
    );
  }
}