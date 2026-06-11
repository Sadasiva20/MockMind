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
  const [assignedDifficulty, setAssignedDifficulty] = useState<string | null>(null);
  const [agentAdvice, setAgentAdvice] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  /* ---------------- SAFE RESET ---------------- */
  function resetAgentState() {
    setEvaluation(null);
    setAssignedDifficulty(null);
    setAgentAdvice(null);
    setProgressSummary(null);
    setNextAction(null);
  }

  /* ---------------- CHAT ---------------- */
  async function handleAskAgent() {
    if (!prompt.trim()) {
      setError("Please enter a prompt before sending it to Gemini.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    resetAgentState();

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

  /* ---------------- AUTO SUBMIT ---------------- */
  async function autoSubmitIfNeeded() {
    const { command, problemId, answer } = queryParams;

    if (command !== "submit_answer") return;
    if (!problemId || typeof problemId !== "string") return;
    if (!answer || typeof answer !== "string") return;

    setSubmitLoading(true);
    setSubmitError(null);
    resetAgentState();

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
      setSubmitError(
        err instanceof Error ? err.message : "Unknown submit error."
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  /* ---------------- FIXED EFFECT (IMPORTANT) ---------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { command, problemId, answer } = queryParams;

    if (command !== "submit_answer") return;
    if (!problemId || !answer) return;

    autoSubmitIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  const correctnessPill = evaluation
    ? evaluation.correctness === "correct"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
    : "bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300";

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">

      {/* ---------------- TOP CHAT SECTION ---------------- */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
        <h1 className="text-3xl font-semibold">Gemini Agent</h1>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          className="mt-4 w-full rounded-3xl border p-4"
        />

        <button
          onClick={handleAskAgent}
          disabled={loading}
          className="mt-4 rounded-3xl bg-sky-600 px-6 py-3 text-white"
        >
          {loading ? "Asking..." : "Ask Gemini"}
        </button>

        {response && (
          <div className="mt-6 rounded-3xl bg-slate-50 p-4">
            {response}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-3xl bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ---------------- AUTO EVALUATION ---------------- */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
        <h2 className="text-2xl font-semibold">AI Evaluation</h2>

        {submitLoading && <p className="mt-4">Evaluating...</p>}

        {submitError && (
          <div className="mt-4 rounded-3xl bg-red-100 p-4 text-red-700">
            {submitError}
          </div>
        )}

        {evaluation && (
          <div className="mt-6 space-y-4">
            <p><b>Correctness:</b> {evaluation.correctness}</p>
            <p><b>Time Complexity:</b> {evaluation.timeComplexity}</p>
            <p><b>Hint:</b> {evaluation.hint}</p>
            <p><b>Follow-up:</b> {evaluation.followUp}</p>

            {assignedDifficulty && (
              <p><b>Next Difficulty:</b> {assignedDifficulty}</p>
            )}

            <div className="mt-4 rounded-3xl bg-slate-50 p-4">
              <p><b>Coach:</b> {agentAdvice}</p>
              <p className="mt-2">{progressSummary}</p>
              <p className="mt-2">
                <b>Next Action:</b> {nextAction}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}