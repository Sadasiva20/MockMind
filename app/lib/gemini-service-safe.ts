import { GoogleGenerativeAI } from "@google/generative-ai";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";
const USE_MOCK = process.env.USE_MOCK_GEMINI === "true";

const FALLBACK_AI_API_URL = process.env.FALLBACK_AI_API_URL;
const FALLBACK_AI_API_KEY = process.env.FALLBACK_AI_API_KEY;
const FALLBACK_AI_MODEL = process.env.FALLBACK_AI_MODEL ?? "gpt-4o-mini";
const FALLBACK_AI_TYPE = (process.env.FALLBACK_AI_API_TYPE ?? "openai").toLowerCase();

let genAI: GoogleGenerativeAI | null = null;

function hasGeminiConfig() {
  return Boolean(GOOGLE_API_KEY) || USE_MOCK;
}

function hasFallbackConfig() {
  return Boolean(FALLBACK_AI_API_URL && FALLBACK_AI_API_KEY);
}

export function hasAIConfig() {
  return hasGeminiConfig() || hasFallbackConfig();
}

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GOOGLE_API_KEY) {
      throw new Error(
        "Gemini not configured. Set GOOGLE_API_KEY environment variable."
      );
    }
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  }
  return genAI;
}

// Mock response for testing (replace with real API when enabled in Google Cloud)
function generateMockResponse(prompt: string): string {
  const isEvaluation = prompt.includes("Respond only with valid JSON");
  
  if (isEvaluation) {
    return JSON.stringify({
      correctness: "partial",
      confidence: "The solution demonstrates understanding of the algorithm and follows a reasonable approach.",
      timeComplexity: "O(n) - iterates through the input once",
      mistakes: "The solution is mostly correct but could improve error handling for edge cases.",
      hint: "Consider what happens when the input is null or undefined. Add validation at the beginning.",
      followUp: "Can you optimize the space complexity further? What if we couldn't use extra memory?",
      assignedDifficulty: "Hard"
    });
  }
  
  // Mock agent response
  return JSON.stringify({
    agentAdvice: "Good progress! Your implementation shows solid understanding of dynamic programming patterns.",
    progressSummary: "You've solved 1 problem with partial correctness. Keep practicing similar patterns.",
    nextAction: "Try a problem with similar complexity to reinforce your understanding."
  });
}

function parseFallbackResponse(responseData: any): string {
  if (!responseData) {
    return "";
  }

  if (typeof responseData === "string") {
    return responseData;
  }

  if (Array.isArray(responseData.choices) && responseData.choices.length > 0) {
    const choice = responseData.choices[0];
    const message = choice.message;
    if (message) {
      if (typeof message.content === "string") return message.content;
      if (Array.isArray(message.content)) return message.content.join("");
    }
    if (typeof choice.text === "string") return choice.text;
  }

  if (typeof responseData.output?.text === "string") {
    return responseData.output.text;
  }

  if (typeof responseData.response?.output_text === "string") {
    return responseData.response.output_text;
  }

  if (Array.isArray(responseData.generations) && responseData.generations[0]?.text) {
    return responseData.generations[0].text;
  }

  return "";
}

async function callFallbackAPI(prompt: string): Promise<string> {
  if (!hasFallbackConfig()) {
    throw new Error("Fallback AI provider is not configured.");
  }

  const fallbackUrl = FALLBACK_AI_API_URL ?? "";
  const apiKey = FALLBACK_AI_API_KEY ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (FALLBACK_AI_TYPE === "azure_openai") {
    headers["api-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body =
    FALLBACK_AI_TYPE === "openai" || FALLBACK_AI_TYPE === "azure_openai"
      ? {
          model: FALLBACK_AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }
      : {
          prompt,
          model: FALLBACK_AI_MODEL,
        };

  const response = await fetch(fallbackUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fallback AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = parseFallbackResponse(data);

  if (!text) {
    throw new Error("Fallback AI provider returned no usable text.");
  }

  return text;
}

export async function callGeminiAPI(
  prompt: string,
  _options?: Record<string, unknown>
): Promise<string> {
  // Avoid hard crash during module evaluation when running endpoints that
  // don't need Gemini (e.g. /api/problems).
  if (!hasGeminiConfig()) {
    if (hasFallbackConfig()) {
      return callFallbackAPI(prompt);
    }

    throw new Error(
      "Gemini not configured. Set GOOGLE_API_KEY environment variable or USE_MOCK_GEMINI=true."
    );
  }

  // Use mock for testing if enabled
  if (USE_MOCK) {
    return generateMockResponse(prompt);
  }

  const client = getGenAI();
  const model = client.getGenerativeModel({ model: GOOGLE_MODEL });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("No response returned from Gemini");
    }

    return responseText;
  } catch (error) {
    if (hasFallbackConfig()) {
      console.warn("Gemini failed, falling back to configured fallback AI provider.");
      return callFallbackAPI(prompt);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API error: ${errorMessage}`);
  }
}

