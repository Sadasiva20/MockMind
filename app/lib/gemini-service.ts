const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY in environment variables");
}

/**
 * NOTE:
 * Google Agent Builder may show "Gemini 3.5 Flash",
 * but the public API currently uses:
 * - gemini-1.5-flash (recommended)
 * - gemini-1.5-pro
 */
const MODEL = process.env.GOOGLE_MODEL ?? "gemini-1.5-flash";

export async function callGeminiAPI(prompt: string): Promise<string> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response returned from Gemini");
  }

  return text;
}