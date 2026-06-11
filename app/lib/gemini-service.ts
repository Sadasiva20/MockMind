import { GoogleAuth } from "google-auth-library";

export async function callGeminiAPI(
  prompt: string,
  options?: Record<string, unknown>
): Promise<string> {
  const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
  const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  const MODEL = process.env.GOOGLE_MODEL ?? "gemini-1.5-flash";

  if (!PROJECT_ID) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT environment variable is missing"
    );
  }

  console.log("[Gemini] Project:", PROJECT_ID);
  console.log("[Gemini] Location:", LOCATION);
  console.log("[Gemini] Model:", MODEL);

  const accessToken = await getAccessToken();

  const endpoint =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  console.log("[Gemini] Endpoint:", endpoint);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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

  const responseText = await response.text();

  console.log("[Gemini] Status:", response.status);
  console.log("[Gemini] Raw Response:", responseText);

  if (!response.ok) {
    throw new Error(
      `Vertex AI error ${response.status}: ${responseText}`
    );
  }

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Vertex AI returned non-JSON response: ${responseText}`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error(
      "[Gemini] Missing candidate text:",
      JSON.stringify(data, null, 2)
    );

    throw new Error(
      "Vertex AI returned no candidate text"
    );
  }

  return text;
}

async function getAccessToken(): Promise<string> {
  try {
    const auth = new GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
      ],
    });

    const client = await auth.getClient();

    const tokenResponse = await client.getAccessToken();

    const token =
      typeof tokenResponse === "string"
        ? tokenResponse
        : tokenResponse?.token;

    if (!token) {
      throw new Error(
        "GoogleAuth returned an empty access token"
      );
    }

    console.log("[Gemini] Access token acquired");

    return token;
  } catch (error) {
    console.error(
      "[Gemini] Failed to obtain access token:",
      error
    );

    throw new Error(
      `Failed to obtain Google access token: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}