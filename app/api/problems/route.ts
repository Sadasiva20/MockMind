import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";

const PROBLEMS_COLLECTION = process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";

export async function GET(request: NextRequest) {
  const problemId = request.nextUrl.searchParams.get("problemId");
  const topic = request.nextUrl.searchParams.get("topic");
  const difficulty = request.nextUrl.searchParams.get("difficulty");

  const mongoClient = await getMongoClient();
  const db = mongoClient.db(MONGODB_DB);
  const collection = db.collection(PROBLEMS_COLLECTION);

  if (problemId) {
    const problem = await collection.findOne({ id: problemId });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }
    return NextResponse.json(problem);
  }

  const filter: Record<string, unknown> = {};
  if (topic && topic !== "all") {
    filter.topic = topic.toLowerCase();
  }
  if (difficulty && difficulty !== "all") {
    filter.difficulty = difficulty.toLowerCase();
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
