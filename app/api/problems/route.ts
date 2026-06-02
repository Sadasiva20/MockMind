import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";

export const dynamic = "force-dynamic"; // Prevent caching issues

const PROBLEMS_COLLECTION = process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";

function escapeRegExp(value: string) {
  // Escape user input so it can be used safely inside a Mongo $regex.
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


export async function GET(request: NextRequest) {
  const problemId = request.nextUrl.searchParams.get("problemId");
  const topic = request.nextUrl.searchParams.get("topic");
  const difficulty = request.nextUrl.searchParams.get("difficulty");

  let mongoClient;
  try {
    mongoClient = await getMongoClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const db = mongoClient.db(MONGODB_DB);
  const collection = db.collection(PROBLEMS_COLLECTION);

  if (problemId) {
    const problem = await collection.findOne({ id: problemId });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }
    return NextResponse.json(problem);
  }

  // Build filters using case-insensitive matching.
  // This avoids 404s when Mongo fields are stored with different casing (e.g. "Trees" vs "trees").
  const filter: Record<string, unknown> = {};
  if (topic && topic !== "all") {
    filter.topic = { $regex: `^${escapeRegExp(topic)}$`, $options: "i" };
  }
  if (difficulty && difficulty !== "all") {
    filter.difficulty = { $regex: `^${escapeRegExp(difficulty)}$`, $options: "i" };
  }


  const pipeline: Record<string, unknown>[] = [];
  if (Object.keys(filter).length > 0) {
    pipeline.push({ $match: filter });
  }
  pipeline.push({ $sample: { size: 1 } });

  const results = await collection.aggregate(pipeline).toArray();
  const problem = results[0];
  if (!problem) {
    return NextResponse.json(
      { error: "No matching problems found for the selected filters." },
      { status: 404 }
    );
  }

  return NextResponse.json(problem);
}
