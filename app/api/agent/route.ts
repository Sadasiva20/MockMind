import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";
import { callGeminiAPI } from "../../lib/gemini-service";

const PROBLEMS_COLLECTION = process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";
const REVIEWS_COLLECTION = process.env.MONGODB_COLLECTION ?? "interview_results";

type Problem = {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  topic: string;
  difficulty: string;
  hints?: string[];
};

type Evaluation = {
  correctness: string;
  confidence: string;
  timeComplexity: string;
  mistakes: string;
  hint: string;
  followUp: string;
  assignedDifficulty: string;
};

function cleanJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const safeText = text.replace(/^[^{]*([\s\S]*?)[^}]*$/, "$1");
    return JSON.parse(safeText);
  }
}

function buildEvaluationPrompt(problem: Problem, answer: string) {
  return `You are a LeetCode interviewer. Evaluate the candidate's textual solution for the following problem with interview pressure and precision.

Problem title: ${problem.title}
Difficulty: ${problem.difficulty}
Topic: ${problem.topic}
Description: ${problem.description}
Instructions: ${problem.instructions ?? "Review the problem description and provide an optimal approach."}
Hints: ${problem.hints?.join("; ") ?? "No hints provided."}

Candidate answer:
${answer}

Respond only with valid JSON containing these keys:
- correctness: one of "correct", "partial", or "incorrect"
- confidence: a short confidence statement
- timeComplexity: your estimated runtime complexity
- mistakes: what is wrong or missing in the answer
- hint: a concise hint for improvement
- followUp: an interview-style follow-up question
- assignedDifficulty: recommended next problem difficulty (Easy, Medium, Hard)

Do not include any additional text outside the JSON object.`;
}

function buildAgentPrompt({
  userId,
  command,
  currentProblem,
  evaluation,
  historySummary,
}: {
  userId: string;
  command: string;
  currentProblem?: Problem;
  evaluation?: Evaluation;
  historySummary: string;
}) {
  return `You are a MongoDB-powered coding coach agent built to help a developer improve their interview readiness. The agent stores session feedback and uses that history to recommend the next action.

User ID: ${userId}
Command: ${command}

History summary:
${historySummary}

${currentProblem ? `Current problem: ${currentProblem.title}
Difficulty: ${currentProblem.difficulty}
Topic: ${currentProblem.topic}
Description: ${currentProblem.description}
Instructions: ${currentProblem.instructions ?? "n/a"}
Hints: ${currentProblem.hints?.join(", ") ?? "none"}

` : ""}
${evaluation ? `Latest evaluation:
- Correctness: ${evaluation.correctness}
- Confidence: ${evaluation.confidence}
- Time complexity: ${evaluation.timeComplexity}
- Mistakes: ${evaluation.mistakes}
- Hint: ${evaluation.hint}
- Follow-up: ${evaluation.followUp}
- Assigned difficulty: ${evaluation.assignedDifficulty}

` : ""}
Provide a concise coaching response in plain text. Include one recommended next action the user can take. Do not return JSON.
`;
}

async function evaluateWithGemini(problem: Problem, answer: string): Promise<Evaluation> {
  const systemPrompt =
    "You are a LeetCode interviewer who judges correctness, simulates pressure, and asks follow-up questions such as 'Can you optimize this?', 'What is time complexity?', and 'What are edge cases?'. " +
    buildEvaluationPrompt(problem, answer);

  const rawText = await callGeminiAPI(systemPrompt);
  try {
    return cleanJson(rawText) as Evaluation;
  } catch {
    const safeText = rawText.replace(/^[^{]*/, "").replace(/[^}]*$/, "").trim();
    try {
      return cleanJson(safeText) as Evaluation;
    } catch {
      return {
        correctness: "partial",
        confidence: "Could not parse model output cleanly.",
        timeComplexity: "Unknown",
        mistakes: rawText,
        hint: "Review the answer and provide a compact JSON object if possible.",
        followUp: "Explain your time complexity and edge-case handling in a few sentences.",
        assignedDifficulty: problem.difficulty,
      };
    }
  }
}

function pickNextDifficulty(current: string, correctness: string) {
  if (correctness === "correct") {
    return current === "Easy" ? "Medium" : current === "Medium" ? "Hard" : "Hard";
  }
  if (correctness === "partial") {
    return current === "Easy" ? "Easy" : "Medium";
  }
  return "Easy";
}

function summarizeHistory(records: Array<{ evaluation: Evaluation }>) {
  if (!records.length) {
    return "No previous interview sessions found. The agent can help you build a study plan from your first attempt.";
  }

  const counts = { correct: 0, partial: 0, incorrect: 0 };
  records.forEach((record) => {
    counts[record.evaluation.correctness] = (counts as any)[record.evaluation.correctness] + 1;
  });

  return `In ${records.length} sessions, you have ${counts.correct} correct, ${counts.partial} partial, and ${counts.incorrect} incorrect reviews. The coach will focus on steady improvement and balanced difficulty progression.`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.command !== "string") {
    return NextResponse.json({ error: "Request must include a command." }, { status: 400 });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return NextResponse.json({ error: "Missing GOOGLE_APPLICATION_CREDENTIALS environment variable." }, { status: 500 });
  }

  const mongoClient = await getMongoClient();
  const db = mongoClient.db(MONGODB_DB);
  const problems = db.collection(PROBLEMS_COLLECTION);
  const reviews = db.collection(REVIEWS_COLLECTION);
  const userId = typeof body.userId === "string" ? body.userId : "local-user";

  if (body.command === "submit_answer") {
    if (typeof body.problemId !== "string" || typeof body.answer !== "string") {
      return NextResponse.json({ error: "submit_answer requires problemId and answer." }, { status: 400 });
    }

    const problem = await problems.findOne<Problem>({ id: body.problemId });
    if (!problem) {
      return NextResponse.json({ error: "Invalid problemId." }, { status: 400 });
    }

    const evaluation = await evaluateWithGemini(problem, body.answer);
    const assignedDifficulty = pickNextDifficulty(problem.difficulty, evaluation.correctness);
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

    const history = await reviews.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
    const historySummary = summarizeHistory(history as Array<{ evaluation: Evaluation }>);
    const agentPrompt = buildAgentPrompt({
      userId,
      command: "submit_answer",
      currentProblem: problem,
      evaluation,
      historySummary,
    });

    const systemInstruction =
      "You are a MongoDB-powered coding coach that uses stored session history to recommend next actions for the user. " +
      agentPrompt;
    const agentAdvice = (await callGeminiAPI(systemInstruction)).trim();
    const nextAction =
      evaluation.correctness === "correct"
        ? "Try a slightly harder problem or review the follow-up question."
        : evaluation.correctness === "partial"
        ? "Revise your solution to fix the reported issues and resubmit."
        : "Review the hint, adjust your approach, and try again.";

    return NextResponse.json({
      feedback: evaluation,
      assignedDifficulty,
      agentAdvice,
      progressSummary: historySummary,
      nextAction,
    });
  }

  if (body.command === "review_progress") {
    const history = await reviews.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
    const historySummary = summarizeHistory(history as Array<{ evaluation: Evaluation }>);
    const agentPrompt = buildAgentPrompt({
      userId,
      command: "review_progress",
      historySummary,
    });

    const systemInstruction =
      "You are a MongoDB-powered coding coach that uses stored session history to summarize a user's interview progress. " +
      agentPrompt;
    const agentAdvice = (await callGeminiAPI(systemInstruction)).trim();

    return NextResponse.json({
      agentAdvice,
      progressSummary: historySummary,
      nextAction: "Pick a topic or ask the coach for a recommended problem.",
    });
  }

  if (body.command === "recommend_problem") {
    const filter: Record<string, unknown> = {};
    if (typeof body.topic === "string" && body.topic !== "all") filter.topic = body.topic.toLowerCase();
    if (typeof body.difficulty === "string" && body.difficulty !== "all") filter.difficulty = body.difficulty.toLowerCase();

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });
    pipeline.push({ $sample: { size: 1 } });

    const [problem] = await problems.aggregate<Problem>(pipeline).toArray();
    if (!problem) {
      return NextResponse.json({ error: "No matching problems found." }, { status: 404 });
    }

    const history = await reviews.find({ userId }).sort({ createdAt: -1 }).limit(20).toArray();
    const historySummary = summarizeHistory(history as Array<{ evaluation: Evaluation }>);
    const agentPrompt = buildAgentPrompt({
      userId,
      command: "recommend_problem",
      currentProblem: problem,
      historySummary,
    });

    const systemInstruction =
      "You are a MongoDB-powered coding coach that recommends a new practice problem based on the user's stored history and selected preferences. " +
      agentPrompt;
    const agentAdvice = (await callGeminiAPI(systemInstruction)).trim();

    return NextResponse.json({
      agentAdvice,
      progressSummary: historySummary,
      nextAction: "Solve this new problem and submit your answer to the coach.",
      problem,
    });
  }

  return NextResponse.json({ error: "Unknown command." }, { status: 400 });
}
