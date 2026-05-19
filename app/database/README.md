# MockMind Database Seed

This folder contains the MongoDB seed data for MockMind interview problems.

## Seed the database

1. Set the MongoDB connection string in `MONGODB_URI`.
2. Optionally set `MONGODB_DB` and `MONGODB_PROBLEMS_COLLECTION`.
3. Run:

```bash
npm run seed:db
```

Default values:
- `MONGODB_URI`: `mongodb://localhost:27017`
- `MONGODB_DB`: `mockmind`
- `MONGODB_PROBLEMS_COLLECTION`: `problems`

The script imports data from `mockmind_problems.json` and writes it into MongoDB.
