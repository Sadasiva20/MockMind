import { GoogleAuth } from "google-auth-library";

const GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT;

const LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

const GOOGLE_MODEL =
  process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";

if (!PROJECT_ID) {
  throw new Error(
    "GOOGLE_CLOUD_PROJECT environment variable is missing"
  );
}

let googleAuthClient: GoogleAuth | null = null;

function getGoogleAuthClient(): GoogleAuth {
  if (!googleAuthClient) {
    googleAuthClient = new GoogleAuth({
      keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
      ],
    });
  }

  return googleAuthClient;
}

async function getAccessToken(): Promise<string> {
  const auth = getGoogleAuthClient();

  const client = await auth.getClient();

  const accessTokenResponse =
    await client.getAccessToken();

  const token =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token;

  if (!token) {
    throw new Error(
      "Failed to obtain Google access token"
    );
  }

  return token;
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
  const token = await getAccessToken();

  const endpoint =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/locations/${LOCATION}/publishers/google/models/${GOOGLE_MODEL}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
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
    const errorText = await response.text();

    throw new Error(
      `Vertex AI Gemini error (${response.status}): ${errorText}`
    );
  }

  const data =
    (await response.json()) as GeminiResponse;

  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error(
      "No response returned from Gemini"
    );
  }

  return responseText;
}