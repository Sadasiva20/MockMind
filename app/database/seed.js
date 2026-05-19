const { MongoClient } = require("mongodb");
const problems = require("./mockmind_problems.json");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "mockmind";
const COLLECTION_NAME = process.env.MONGODB_PROBLEMS_COLLECTION || "problems";

async function seed() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    console.log(`Seeding ${problems.length} problems into ${DB_NAME}.${COLLECTION_NAME}...`);
    await collection.deleteMany({});
    const result = await collection.insertMany(problems);

    console.log(`Inserted ${result.insertedCount} documents.`);
    console.log("Seed complete.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seed();
