import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

const GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash";

let googleAuthClient: GoogleAuth | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function getGoogleAuthClient(): GoogleAuth {
  if (!googleAuthClient) {
    googleAuthClient = new GoogleAuth({
      keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/generative-language",
      ],
    });
  }
  return googleAuthClient;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if valid
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const auth = getGoogleAuthClient();
  const client = await auth.getClient();
  const { token, expiry } = await client.getAccessToken();

  cachedToken = {
    token: token || "",
    expiresAt: expiry || Date.now() + 3600000,
  };

  return cachedToken.token;
}

export async function callGeminiAPI(
  prompt: string,
  _options?: Record<string, unknown>
): Promise<string> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${GOOGLE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Gemini API error: ${response.status} - ${JSON.stringify(error)}`
    );
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return responseText;
}
