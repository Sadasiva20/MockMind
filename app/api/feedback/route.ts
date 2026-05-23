import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";
import { callGeminiAPI } from "../../lib/gemini-service";

const PROBLEMS_COLLECTION = process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";
const INTERVIEW_COLLECTION = process.env.MONGODB_COLLECTION ?? "interview_results";

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

async function evaluateWithGemini(problem: Problem, answer: string): Promise<Evaluation> {
  const systemPrompt =
    "You are a LeetCode interviewer who judges correctness, simulates pressure, and asks follow-up questions such as 'Can you optimize this?', 'What is time complexity?', and 'What are edge cases?'. " +
    buildEvaluationPrompt(problem, answer);

  const rawText = await callGeminiAPI(systemPrompt);
  try {
    return JSON.parse(rawText) as Evaluation;
  } catch {
    const safeText = rawText.replace(/^[^{]*/, "").replace(/[^}]*$/, "").trim();
    try {
      return JSON.parse(safeText) as Evaluation;
    } catch {
      return {
        correctness: "partial",
        confidence: "Could not parse model output cleanly.",
        timeComplexity: "Unknown",
        mistakes: rawText,
        hint:
          "Review the answer and provide a compact JSON object if possible.",
        followUp:
          "Explain your time complexity and edge-case handling in a few sentences.",
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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.answer !== "string" || typeof body.problemId !== "string") {
    return NextResponse.json(
      { error: "Request must include problemId and answer." },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return NextResponse.json(
      { error: "Missing GOOGLE_APPLICATION_CREDENTIALS environment variable." },
      { status: 500 }
    );
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Missing MONGODB_URI environment variable." },
      { status: 500 }
    );
  }

  const mongoClient = await getMongoClient();
  const db = mongoClient.db(MONGODB_DB);
  const problems = db.collection(PROBLEMS_COLLECTION);
  const problem = await problems.findOne<Problem>({ id: body.problemId });

  if (!problem) {
    return NextResponse.json({ error: "Invalid problemId." }, { status: 400 });
  }

  const evaluation = await evaluateWithGemini(problem, body.answer);
  const assignedDifficulty = pickNextDifficulty(problem.difficulty, evaluation.correctness);
  const sessionRecord = {
    problemId: problem.id,
    problemTitle: problem.title,
    problemDifficulty: problem.difficulty,
    topic: problem.topic,
    answer: body.answer,
    evaluation,
    assignedDifficulty,
    createdAt: new Date(),
  };

  const reviews = db.collection(INTERVIEW_COLLECTION);
  await reviews.insertOne(sessionRecord);

  return NextResponse.json({ feedback: evaluation, assignedDifficulty });
}
