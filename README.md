# mockmind

mockmind is an AI-backed coding coach that helps developers practice interview-style problems, tracks their progress in MongoDB, and provides Gemini-powered feedback and next-step recommendations.

## About

Mockmind enables users to choose coding problems, submit text-based solutions, and receive AI evaluations for correctness, complexity, hints, and follow-up questions. The app also includes an agent coaching layer that can review progress and recommend the next best practice problem.

## Inspiration

This project was inspired by interview prep tools and AI-assisted learning platforms that combine problem practice with feedback loops. The goal is to make interview preparation more interactive and personalized by using a database of problems and a generative AI coach.

## Technologies Used

- Next.js 16
- React 19
- Tailwind CSS
- MongoDB
- Google Generative AI (`@google/generative-ai`)
- TypeScript
- Node.js
- dotenv

## Getting Started

1. Install dependencies:


```bash
npm install
```

2. Create a `.env.local` file with these values:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=mockmind
MONGODB_DB=mockmind
MONGODB_PROBLEMS_COLLECTION=problems
MONGODB_COLLECTION=interview_results

GOOGLE_API_KEY=your_google_api_key_here
# Optional fallback if your key is stored under a different name
MODEL_API_KEY=your_google_api_key_here
GOOGLE_MODEL=gemini-1.5-pro
```

> Make sure your `.env.local` includes `GOOGLE_API_KEY` or `MODEL_API_KEY` for the Google Gemini integration.

3. Seed MongoDB and start the development server:

```bash
npm run seed:db
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Troubleshooting

- If `http://localhost:3000/api` returns 404 or the app fails to load problems, confirm the server is running and the correct port is used.
- Verify `.env.local` is loaded and contains:
  - `MONGODB_URI`
  - `MONGODB_DB` (optional; defaults to `mockmind`)
  - `MONGODB_PROBLEMS_COLLECTION` (optional; defaults to `problems`)
  - `GOOGLE_API_KEY` or `MODEL_API_KEY`
- If `/api/problems` returns 404, the most common causes are:
  - the database was not seeded with `npm run seed:db`
  - the collection name in `MONGODB_PROBLEMS_COLLECTION` does not match the seeded collection
  - the database name in `MONGODB_DB` does not match the target database
- To confirm seed data was added correctly:
  1. Run `npm run seed:db`
  2. Check MongoDB for the `problems` collection in the `mockmind` database (or your configured database)
  3. Verify documents exist in that collection
- If a problem-specific request returns `404` from `/api/problems?problemId=...`, it usually means the requested `problemId` is not present in the seeded data or the query parameters are malformed.
- For API route troubleshooting, use the root endpoint first:

```bash
curl http://localhost:3000/api
```

It should return a JSON object with endpoints for `/api/problems`, `/api/agent`, and `/api/feedback`.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Notes

- The app uses MongoDB to store practice problems and evaluation history.
- The coaching agent is designed to recommend next actions based on past sessions.
- For production, use a secure MongoDB instance and keep API keys private.
