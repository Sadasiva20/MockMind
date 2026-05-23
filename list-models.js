#!/usr/bin/env node
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log('Listing available models from service account...\n');

async function listModels() {
  try {
    const auth = new GoogleAuth({
      keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language',
      ],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    // Try v1
    console.log('Trying v1 endpoint...');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1/models',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Available models:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
