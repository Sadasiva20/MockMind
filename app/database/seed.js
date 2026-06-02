import "dotenv/config";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { MongoClient } from "mongodb";
import fs from "fs";

// Ensure .env.local is loaded
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const problems = JSON.parse(
  fs.readFileSync(path.join(__dirname, "mockmind_problems.json"), "utf-8")
);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "mockmind";
const COLLECTION_NAME = process.env.MONGODB_PROBLEMS_COLLECTION || "problems";

async function seed() {
  console.log("Starting seed...");
  console.log("MONGODB_URI:", process.env.MONGODB_URI ? "configured" : "missing");
  console.log("DB_NAME:", DB_NAME);
  console.log("COLLECTION_NAME:", COLLECTION_NAME);
  console.log("Problems to insert:", problems.length);

  const client = new MongoClient(MONGODB_URI);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected successfully!");
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    console.log(`Seeding ${problems.length} problems into ${DB_NAME}.${COLLECTION_NAME}...`);
    await collection.deleteMany({});
    console.log("Cleared existing documents");
    
    const result = await collection.insertMany(problems);

    console.log(`Inserted ${result.insertedCount} documents.`);
    console.log("Seed complete.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    console.log("Closing connection...");
    await client.close();
  }
}

seed();
