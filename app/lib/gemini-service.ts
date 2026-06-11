const API_KEY = process.env.GOOGLE_API_KEY;

// You said "gemini-3.5-flash" — Google usually exposes this as:
const MODEL = process.env.GOOGLE_MODEL ?? "gemini-1.5-flash";

if (!API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY in environment variables");
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function callGeminiAPI(
  prompt: string,
  options?: Record<string, unknown>
): Promise<string> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      ...options,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as GeminiResponse;

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini");
  }

  return text;
}