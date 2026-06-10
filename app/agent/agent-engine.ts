import { callGeminiAPI } from "../lib/gemini-service-safe";

export type Problem = {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  topic: string;
  difficulty: string;
  hints?: string[];
};

export type Evaluation = {
  correctness: "correct" | "partial" | "incorrect" | string;
  confidence: string;
  timeComplexity: string;
  mistakes: string;
  hint: string;
  followUp: string;
  assignedDifficulty: string;
};

export type AgentResult = {
  feedback: Evaluation;
  assignedDifficulty: string;
  agentAdvice: string;
  progressSummary: string;
  nextAction: string;
};

function cleanJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    // best-effort extraction of first {...} block
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
  return `You are a MongoDB-powered coding coach agent built to help a developer improve their interview readiness.

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
Provide a concise coaching response in plain text. Include one recommended next action the user can take. Do not return JSON.`;
}

function pickNextDifficulty(current: string, correctness: Evaluation["correctness"]) {
  const c = correctness as string;
  if (c === "correct") {
    return current === "Easy" ? "Medium" : current === "Medium" ? "Hard" : "Hard";
  }
  if (c === "partial") {
    return current === "Easy" ? "Easy" : "Medium";
  }
  return "Easy";
}

export async function runSubmitAnswerAgent({
  userId,
  command,
  currentProblem,
  answer,
  historySummary,
}: {
  userId: string;
  command: "submit_answer";
  currentProblem: Problem;
  answer: string;
  historySummary: string;
}): Promise<AgentResult> {
  const systemPrompt =
    "You are a LeetCode interviewer who judges correctness, simulates pressure, and asks follow-up questions. " +
    buildEvaluationPrompt(currentProblem, answer);

  let rawText: string;
  try {
    rawText = await callGeminiAPI(systemPrompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const feedback: Evaluation = {
      correctness: "partial",
      confidence: "Gemini call failed.",
      timeComplexity: "Unknown",
      mistakes: message,
      hint: "Fix Gemini configuration or verify Vertex AI credentials.",
      followUp: "Try again once Gemini is configured correctly.",
      assignedDifficulty: currentProblem.difficulty,
    };

    const assignedDifficulty = pickNextDifficulty(currentProblem.difficulty, feedback.correctness);
    return {
      feedback,
      assignedDifficulty,
      agentAdvice: "Gemini evaluation failed; check your configuration and try again.",
      progressSummary: historySummary,
      nextAction: "Review the hint, adjust your approach, and try again.",
    };
  }

  let feedback: Evaluation;
  try {
    feedback = cleanJson(rawText) as Evaluation;
  } catch {
    const fallback = rawText.replace(/^[^{]*/, "").replace(/[^}]*$/, "").trim();
    feedback = cleanJson(fallback) as Evaluation;
  }

  const assignedDifficulty = pickNextDifficulty(currentProblem.difficulty, feedback.correctness);

  const agentPrompt = buildAgentPrompt({
    userId,
    command,
    currentProblem,
    evaluation: feedback,
    historySummary,
  });

  const systemInstruction =
    "You are a MongoDB-powered coding coach that uses stored session history to recommend next actions for the user. " +
    agentPrompt;

  const agentAdvice = (await callGeminiAPI(systemInstruction)).trim();

  const nextAction =
    feedback.correctness === "correct"
      ? "Try a slightly harder problem or review the follow-up question."
      : feedback.correctness === "partial"
        ? "Revise your solution to fix the reported issues and resubmit."
        : "Review the hint, adjust your approach, and try again.";

  return {
    feedback,
    assignedDifficulty,
    agentAdvice,
    progressSummary: historySummary,
    nextAction,
  };
}

