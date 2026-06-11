export async function callGeminiAPI(
  prompt: string,
  options?: Record<string, unknown>
): Promise<string> {
  const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
  const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  const MODEL = process.env.GOOGLE_MODEL ?? "gemini-1.5-flash";

  if (!PROJECT_ID) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT");
  }

  // ✅ Vertex AI expects ADC automatically on Vercel (NO key files)
  const endpoint =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  // ⚠️ IMPORTANT: Vercel must have GOOGLE_APPLICATION_CREDENTIALS implicitly via runtime identity
  // OR you must rely on "gcloud auth" locally

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // ⚠️ This is REQUIRED in most Vertex setups on Vercel:
      Authorization: `Bearer ${await getAccessToken()}`,
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
    throw new Error(`Vertex AI error ${response.status}: ${err}`);
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty Gemini response");
  }

  return text;
}

// 🔑 FIXED TOKEN METHOD (ADC SAFE)
async function getAccessToken(): Promise<string> {
  // On Vercel this works ONLY if runtime has Vertex AI permissions
  const { GoogleAuth } = await import("google-auth-library");

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token?.token) {
    throw new Error("Failed to get Vertex AI access token");
  }

  return token.token;
}