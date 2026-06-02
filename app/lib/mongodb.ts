import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI ?? "";
const MONGODB_DB = process.env.MONGODB_DB ?? "mockmind";

declare global {
  // eslint-disable-next-line no-var
  var _mockmindMongoClientPromise: Promise<MongoClient> | undefined;
}

const mongoClient = new MongoClient(MONGODB_URI || "mongodb://localhost:27017");
let clientPromise: Promise<MongoClient> | undefined = globalThis._mockmindMongoClientPromise;

export async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Set it to a full Mongo connection string (e.g. mongodb+srv://...)."
    );
  }
  if (!clientPromise) {
    clientPromise = mongoClient.connect();
    globalThis._mockmindMongoClientPromise = clientPromise;
  }
  return clientPromise;
}


export { MONGODB_DB };
