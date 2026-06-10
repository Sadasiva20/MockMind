"use client";

import { useEffect, useMemo, useState } from "react";

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

type SubmitParams = {
  command?: string | null;
  problemId?: string | null;
  title?: string | null;
  difficulty?: string | null;
  topic?: string | null;
  answer?: string | null;
};

const USER_ID = "local-user";

export default function GeminiAgent() {
  const queryParams: SubmitParams = useMemo(() => {
    if (typeof window === "undefined") return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      command: sp.get("command"),
      problemId: sp.get("problemId"),
      title: sp.get("title"),
      difficulty: sp.get("difficulty"),
      topic: sp.get("topic"),
      answer: sp.get("answer"),
    };
  }, []);

  const [prompt, setPrompt] = useState(
    "Ask the Gemini agent a question or request coaching advice."
  );

  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [assignedDifficulty, setAssignedDifficulty] = useState<string | null>(
    null
  );
  const [agentAdvice, setAgentAdvice] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  async function handleAskAgent() {
    if (!prompt.trim()) {
      setError("Please enter a prompt before sending it to Gemini.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "chat",
          userId: USER_ID,
          prompt: prompt.trim(),
        }),
      });

      const data = (await res.json()) as AgentResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error || "Gemini request failed.");
      }

      setResponse(data.agentAdvice ?? "No response returned from Gemini.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  async function autoSubmitIfNeeded() {
    const { command, problemId, answer } = queryParams;
    if (command !== "submit_answer") return;
    if (!problemId || typeof problemId !== "string") return;
    if (!answer || typeof answer !== "string") return;

    setSubmitLoading(true);
    setSubmitError(null);

    setEvaluation(null);
    setAssignedDifficulty(null);
    setAgentAdvice(null);
    setProgressSummary(null);
    setNextAction(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "submit_answer",
          userId: USER_ID,
          problemId,
          answer,
        }),
      });

      const data = (await res.json()) as AgentResponse;

      if (!res.ok || data.error || !data.feedback) {
        throw new Error(data.error || "Agent evaluation failed.");
      }

      setEvaluation(data.feedback);
      setAssignedDifficulty(data.assignedDifficulty ?? null);
      setAgentAdvice(data.agentAdvice ?? null);
      setProgressSummary(data.progressSummary ?? null);
      setNextAction(data.nextAction ?? null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown submit error.");
    } finally {
      setSubmitLoading(false);
    }
  }

  useEffect(() => {
    // Avoid synchronous setState in effect body; schedule after paint.
    void Promise.resolve().then(() => autoSubmitIfNeeded());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const correctnessPill = evaluation
    ? evaluation.correctness === "correct"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300";

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-600">
              Gemini Agent
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              Ask MockMind&#39;s Gemini agent
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Send a prompt to Google Gemini using the configured Gemini service.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              This page also supports auto-evaluation when opened from the main
              interface via query params.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Model: gemini-3.5-flash
            </p>
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          Your prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleAskAgent}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-3xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            {loading ? "Asking Gemini..." : "Ask Gemini"}
          </button>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use a real Gemini API key in <code>.env.local</code> to get live responses.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {response ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-900 dark:border-slate-800 dark:bg-zinc-950 dark:text-slate-100">
            <p className="font-semibold">Gemini response</p>
            <p className="mt-3 whitespace-pre-wrap">{response}</p>
          </div>
        ) : null}
      </div>

      {/* Auto-evaluation section */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
              Auto evaluation
            </p>
            <h2 className="mt-2 text-2xl font-semibold">AI evaluation</h2>
          </div>

          {submitLoading ? (
            <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Evaluating...
            </span>
          ) : evaluation ? (
            <span className={`rounded-2xl px-3 py-1 text-sm font-semibold ${correctnessPill}`}>
              {evaluation.correctness === "correct" ? "Looks good" : "Needs improvement"}
            </span>
          ) : (
            <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Awaiting submission
            </span>
          )}
        </div>

        {submitError ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {submitError}
          </div>
        ) : null}

        {evaluation ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-zinc-900">
              <p className="font-semibold">Correctness</p>
              <p className="mt-2">{evaluation.correctness}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-5 dark:bg-zinc-900">
                <p className="font-semibold">Time complexity</p>
                <p className="mt-2">{evaluation.timeComplexity}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 dark:bg-zinc-900">
                <p className="font-semibold">Hint</p>
                <p className="mt-2">{evaluation.hint}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 dark:bg-zinc-900">
                <p className="font-semibold">Follow-up</p>
                <p className="mt-2">{evaluation.followUp}</p>
              </div>
            </div>

            {assignedDifficulty ? (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm dark:bg-zinc-900">
                <p className="font-semibold">Next difficulty</p>
                <p className="mt-2">{assignedDifficulty}</p>
              </div>
            ) : null}

            <div className="rounded-3xl bg-slate-50 p-5 text-sm dark:bg-zinc-900">
              <p className="font-semibold">Coach recommendations</p>
              <p className="mt-2">{agentAdvice ?? "No advice returned."}</p>

              {progressSummary ? (
                <p className="mt-4">{progressSummary}</p>
              ) : null}

              <p className="mt-4">
                <span className="font-semibold">Next action: </span>
                {nextAction ?? ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

