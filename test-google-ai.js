#!/usr/bin/env node
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL;

console.log('🧪 Testing Google AI Model Connection (Service Account Auth)...\n');
console.log(`Model: ${GOOGLE_MODEL}`);
console.log(`Service Account Credentials: ${GOOGLE_APPLICATION_CREDENTIALS ? '✓ Found' : '✗ Missing'}\n`);

if (!GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ Error: GOOGLE_APPLICATION_CREDENTIALS not found in .env.local');
  process.exit(1);
}

if (!GOOGLE_MODEL) {
  console.error('❌ Error: GOOGLE_MODEL not found in .env.local');
  process.exit(1);
}

async function testGoogleAI() {
  try {
    // Initialize Google Auth with service account
    const auth = new GoogleAuth({
      keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language',
      ],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    console.log('📡 Sending test prompt to Google AI...\n');

    // Send a simple test prompt via REST API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GOOGLE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    console.log('✅ Success! Google AI Model is working correctly.\n');
    console.log('Response:');
    console.log('─'.repeat(50));
    console.log(responseText);
    console.log('─'.repeat(50));
    console.log('\n✨ Service account authentication test passed!');

  } catch (error) {
    console.error('❌ Error connecting to Google AI Model:');
    console.error(error.message);
    process.exit(1);
  }
}

testGoogleAI();
