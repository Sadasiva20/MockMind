// Simple MongoDB connection test
require("dotenv").config({ path: ".env.local" });

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "mockmind";

async function testConnection() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in .env.local");
    process.exit(1);
  }

  console.log("Testing MongoDB connection...");
  console.log(`Database: ${MONGODB_DB}`);
  console.log(`URI: ${MONGODB_URI.substring(0, 50)}...`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB);
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach((col) => console.log(`   - ${col.name}`));

    const adminDb = client.db("admin");
    const serverStatus = await adminDb.admin().serverStatus();
    console.log("Server is running");

    return true;
  } catch (error) {
    console.error("Connection failed:");
    console.error(error.message);
    return false;
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

testConnection().then((success) => {
  process.exit(success ? 0 : 1);
});
