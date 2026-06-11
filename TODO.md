## Task: Remove google-auth-library / GOOGLE_APPLICATION_CREDENTIALS / getAccessToken / Vertex AI endpoint usage

### Plan
- Information Gathered: No usage found in `app/lib/gemini-service.ts` and `app/lib/gemini-service-safe.ts`.
- Found usage in `test-google-ai.js` only.

### Steps
1. Remove `google-auth-library` usage and related env vars/token retrieval from `test-google-ai.js`.
2. Update the script to use the same API key-based approach as `app/lib/gemini-service-safe.ts` (or convert to a lightweight connectivity check).
3. Re-run `npm test` / any existing lint/build commands if present.
4. Spot-check remaining files for the removed strings.

