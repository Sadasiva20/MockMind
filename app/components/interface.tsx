"use client";

import { useEffect, useState } from "react";

const modes = ["Mock Interview", "System Design", "LeetCode Mode"] as const;

type Mode = (typeof modes)[number];

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

type AgentResponse = {
  feedback?: Evaluation;
  assignedDifficulty?: string;
  agentAdvice?: string;
  progressSummary?: string;
  nextAction?: string;
  problem?: Problem;
  error?: string;
};

const topics = [
  "all",
  "arrays",
  "strings",
  "linked_list",
  "trees",
  "graphs",
  "hashing",
  "stack",
  "binary_search",
  "sliding_window",
];

const difficulties = ["all", "easy", "medium", "hard"] as const;

const USER_ID = "local-user";

export default function InterviewInterface() {
  const [mode, setMode] = useState<Mode>("LeetCode Mode");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");

  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Evaluation | null>(null);

  const [assignedDifficulty, setAssignedDifficulty] = useState<string | null>(
    null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [attempts, setAttempts] = useState(0);
  const [resultHistory, setResultHistory] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [agentAdvice, setAgentAdvice] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    loadProblem();
  }, [selectedTopic, selectedDifficulty]);

  async function loadProblem() {
    setError(null);
    setProblem(null);
    setFeedback(null);

    setAssignedDifficulty(null);
    setAgentAdvice(null);
    setProgressSummary(null);
    setNextAction(null);

    const params = new URLSearchParams();

    if (selectedTopic !== "all") {
      params.set("topic", selectedTopic);
    }

    if (selectedDifficulty !== "all") {
      params.set("difficulty", selectedDifficulty);
    }

    try {
      const response = await fetch(
        `/api/problems?${params.toString()}`
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to load a problem from the backend."
        );
      }

      setProblem(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load problem."
      );
    }
  }

  async function callAgent(
    command: string,
    payload: Record<string, unknown>
  ) {
    setAgentLoading(true);
    setAgentError(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command,
          userId: USER_ID,
          ...payload,
        }),
      });

      const data = (await response.json()) as AgentResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error || "Agent request failed.");
      }

      return data;
    } catch (err) {
      setAgentError(
        err instanceof Error
          ? err.message
          : "Agent call failed."
      );

      return null;
    } finally {
      setAgentLoading(false);
    }
  }

  async function submitAnswer() {
    if (!problem) return;

    setIsSubmitting(true);

    setFeedback(null);
    setError(null);

    setAgentAdvice(null);
    setProgressSummary(null);
    setNextAction(null);

    try {
      const data = await callAgent("submit_answer", {
        problemId: problem.id,
        answer,
      });

      if (!data || !data.feedback || !data.assignedDifficulty) {
        throw new Error("Invalid agent response.");
      }

      setFeedback(data.feedback);

      setAssignedDifficulty(data.assignedDifficulty);

      setAgentAdvice(data.agentAdvice ?? null);
      setProgressSummary(data.progressSummary ?? null);
      setNextAction(data.nextAction ?? null);

      setAttempts((current) => current + 1);

      setResultHistory((current) =>
        [
          `${new Date().toLocaleTimeString()}: ${data.feedback?.correctness} — ${data.feedback?.confidence}`,
          ...current,
        ].slice(0, 5)
      );

      if (data.feedback.correctness === "correct") {
        setTimeout(() => {
          loadProblem();
          setAnswer("");
          setFeedback(null);
        }, 1200);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestAgentReview(
    command: "review_progress" | "recommend_problem"
  ) {
    if (command === "recommend_problem" && problem) {
      setAgentAdvice(null);
      setProgressSummary(null);
      setNextAction(null);
    }

    const payload: Record<string, unknown> = {
      topic: selectedTopic,
      difficulty: selectedDifficulty,
    };

    if (command === "review_progress") {
      payload.problemId = problem?.id ?? null;
    }

    const data = await callAgent(command, payload);

    if (!data) return;

    if (data.problem) {
      setProblem(data.problem);
      setAnswer("");
      setFeedback(null);
      setAssignedDifficulty(null);
    }

    setAgentAdvice(data.agentAdvice ?? null);
    setProgressSummary(data.progressSummary ?? null);
    setNextAction(data.nextAction ?? null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-600">
              Modes
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Interview modes
            </h2>

            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Switch between behavioral interview practice,
              system design, and LeetCode-style challenges.
            </p>
          </div>

          <div className="grid gap-2">
            {modes.map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  mode === item
                    ? "border-sky-500 bg-sky-50 text-slate-950 dark:border-sky-400 dark:bg-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-zinc-950 dark:text-slate-300"
                }`}
              >
                <div className="font-semibold">{item}</div>

                {item === "LeetCode Mode" ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    New
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Agent coaching
          </p>

          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div>
              Use the AI coach to review progress,
              recommend problems, or create a study plan.
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => requestAgentReview("review_progress")}
                className="rounded-3xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Review progress
              </button>

              <button
                type="button"
                onClick={() => requestAgentReview("recommend_problem")}
                className="rounded-3xl bg-sky-600 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Recommend next problem
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
            Progress
          </p>

          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div>Attempts: {attempts}</div>

            <div>Last results:</div>

            <ul className="list-disc space-y-1 pl-5">
              {resultHistory.length > 0 ? (
                resultHistory.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))
              ) : (
                <li className="text-slate-400">
                  No submissions yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {mode !== "LeetCode Mode" ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
            <h2 className="text-2xl font-semibold">{mode}</h2>

            <p className="mt-3 text-slate-600 dark:text-slate-300">
              {mode === "Mock Interview"
                ? "Practice behavioral questions with AI coaching."
                : "Practice system design walkthroughs with scalability feedback."}
            </p>

            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              This interface is still being expanded for behavioral
              and system design workflows.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
                    Problem
                  </p>

                  <h2 className="mt-1 text-3xl font-semibold">
                    {problem?.title ?? "Loading problem..."}
                  </h2>

                  {problem ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {problem.difficulty}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {problem.topic}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  LeetCode Mode
                </div>
              </div>

              <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {problem ? (
                  <>
                    <p>{problem.description}</p>

                    <div className="space-y-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                      <p className="font-semibold">Instructions</p>

                      <p>{problem.instructions}</p>
                    </div>

                    {problem.hints?.length ? (
                      <div className="space-y-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                        <p className="font-semibold">Hints</p>

                        <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                          {problem.hints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">
                    Loading a problem from the backend...
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Problem filters
                  </p>

                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Pick a topic or difficulty and load a problem.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadProblem}
                  className="inline-flex items-center justify-center rounded-3xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Load problem
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  Topic

                  <select
                    value={selectedTopic}
                    onChange={(event) =>
                      setSelectedTopic(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic === "all"
                          ? "All topics"
                          : topic}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  Difficulty

                  <select
                    value={selectedDifficulty}
                    onChange={(event) =>
                      setSelectedDifficulty(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {difficulties.map((level) => (
                      <option key={level} value={level}>
                        {level === "all"
                          ? "All difficulties"
                          : level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Your solution
                  </p>

                  <h3 className="mt-2 text-xl font-semibold">
                    Explain your approach
                  </h3>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  MVP text / pseudocode
                </span>
              </div>

              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Describe your solution here..."
                rows={11}
                className="mt-5 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Share your full approach before submitting.
                </p>

                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={isSubmitting || !problem}
                  className="inline-flex items-center justify-center rounded-3xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                >
                  {isSubmitting
                    ? "Reviewing..."
                    : "Submit for AI evaluation"}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            {agentError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                {agentError}
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
                    Feedback
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    AI evaluation
                  </h3>
                </div>

                {feedback ? (
                  <span
                    className={`rounded-2xl px-3 py-1 text-sm font-semibold ${
                      feedback.correctness === "correct"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {feedback.correctness === "correct"
                      ? "Looks good"
                      : "Needs improvement"}
                  </span>
                ) : (
                  <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Awaiting submission
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
                <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
                  <p className="font-semibold">Correctness</p>

                  <p className="mt-2">
                    {feedback
                      ? feedback.correctness
                      : "Submit your answer to see feedback."}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
                    <p className="font-semibold">
                      Time complexity
                    </p>

                    <p className="mt-2">
                      {feedback
                        ? feedback.timeComplexity
                        : "Waiting for AI review."}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
                    <p className="font-semibold">Hint</p>

                    <p className="mt-2">
                      {feedback
                        ? feedback.hint
                        : "A hint will appear here."}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
                    <p className="font-semibold">Follow-up</p>

                    <p className="mt-2">
                      {feedback
                        ? feedback.followUp
                        : "A follow-up question will appear here."}
                    </p>
                  </div>
                </div>
              </div>

              {assignedDifficulty ? (
                <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm dark:bg-slate-900">
                  <p className="font-semibold">
                    Next difficulty
                  </p>

                  <p className="mt-2">
                    {assignedDifficulty}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
                    Coach summary
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Agent recommendations
                  </h3>
                </div>

                {agentLoading ? (
                  <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Analyzing...
                  </span>
                ) : (
                  <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Coach powered by Gemini + MongoDB
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
                <div className="rounded-3xl bg-white p-5 dark:bg-slate-900">
                  <p className="font-semibold">Summary</p>

                  <p className="mt-2">
                    {agentAdvice ??
                      "Submit a solution or ask the coach to review your progress."}
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-5 dark:bg-slate-900">
                  <p className="font-semibold">
                    Latest progress note
                  </p>

                  <p className="mt-2">
                    {progressSummary ??
                      "No coach summary available yet."}
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-5 dark:bg-slate-900">
                  <p className="font-semibold">Next action</p>

                  <p className="mt-2">
                    {nextAction ??
                      "Ask the coach for a recommendation after submitting your first answer."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}