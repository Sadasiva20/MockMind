/**
 * Vertex AI Agent Engine (Agent Builder) client
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

/**
 * THIS is the key missing piece:
 * Your deployed Agent Engine / Agent Builder ID
 *
 * Example format:
 * projects/PROJECT_ID/locations/LOCATION/reasoningEngines/AGENT_ID
 */
const AGENT_RESOURCE =
  process.env.GOOGLE_AGENT_RESOURCE ||
  process.env.GOOGLE_AGENT_ID;

if (!PROJECT_ID) {
  throw new Error("Missing GOOGLE_CLOUD_PROJECT");
}

if (!AGENT_RESOURCE) {
  throw new Error(
    "Missing GOOGLE_AGENT_RESOURCE (Agent Builder deployment id)"
  );
}

/**
 * Get OAuth token using ADC (Vercel / GCP service account)
 */
async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import(
    "google-auth-library"
  );

  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token?.token) {
    throw new Error(
      "Failed to obtain Google access token"
    );
  }

  return token.token;
}

/**
 * Calls your Agent Builder / Agent Engine agent
 */
export async function callGeminiAPI(
  prompt: string
): Promise<string> {
  const token = await getAccessToken();

  /**
   * Agent Engine runtime endpoint
   */
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/${AGENT_RESOURCE}:streamQuery`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query: prompt,
      input: {
        text: prompt,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();

    throw new Error(
      `Agent Engine error (${response.status}): ${err}`
    );
  }

  const data = await response.json();

  /**
   * Agent Engine responses vary depending on configuration,
   * so we safely extract text.
   */
  const text =
    data?.output?.text ||
    data?.response?.text ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    JSON.stringify(data);

  return text;
}