#!/usr/bin/env node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL;
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;

console.log('🧪 Testing Google Gemini (API key auth)...\n');
console.log(`Project: ${GOOGLE_PROJECT_ID ?? '(not set)'}`);
console.log(`Model: ${GOOGLE_MODEL}`);
console.log(`API Key: ${GOOGLE_API_KEY ? '✓ Found' : '✗ Missing'}\n`);

if (!GOOGLE_API_KEY) {
  console.error('❌ Error: GOOGLE_API_KEY not found in .env.local');
  process.exit(1);
}

if (!GOOGLE_MODEL) {
  console.error('❌ Error: GOOGLE_MODEL not found in .env.local');
  process.exit(1);
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

async function testGoogleAI() {
// Try both v1beta and v1 GenerativeService.GenerateContent.
  // Your 403s reference:
  // - google.ai.generativelanguage.v1.GenerativeService.GenerateContent
  // - google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent
  const endpoints = [
    {
      label: 'v1beta',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
    },
    {
      label: 'v1',
      url: `https://generativelanguage.googleapis.com/v1/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
    },
  ];

  for (const ep of endpoints) {
    console.log(`📡 Attempt (${ep.label}): ${ep.url}`);

    try {
      const response = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Say "Hello! I am working correctly!" and explain briefly why you exist.',
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const responseText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

        console.log('✅ Success!');
        console.log('Response:');
        console.log('─'.repeat(50));
        console.log(responseText);
        console.log('─'.repeat(50));
        console.log('\n✨ Gemini API is reachable with the current API key.');
        return;
      }

      const bodyText = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        // ignore
      }

      console.error(`❌ HTTP ${response.status} (${ep.label})`);
      if (parsed) {
        console.error(safeJson(parsed));
      } else {
        console.error(bodyText);
      }
    } catch (err) {
      console.error(`❌ Network/Fetch error (${ep.label}):`, err);
    }
  }

  console.error(
    '\n❌ All attempts failed. If you see SERVICE_DISABLED or API_KEY_SERVICE_BLOCKED, you must enable/allow the Gemini/Generative Language API for the project associated with the API key.'
  );
  process.exit(1);
}

testGoogleAI();

