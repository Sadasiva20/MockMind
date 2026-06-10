import { NextRequest, NextResponse } from "next/server";
import { getMongoClient, MONGODB_DB } from "../../lib/mongodb";

export const dynamic = "force-dynamic";

const PROBLEMS_COLLECTION =
  process.env.MONGODB_PROBLEMS_COLLECTION ?? "problems";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    console.log("=== /api/problems called ===");

    console.log("Environment check:", {
      hasMongoUri: !!process.env.MONGODB_URI,
      dbName: MONGODB_DB,
      collection: PROBLEMS_COLLECTION,
    });

    const problemId = request.nextUrl.searchParams.get("problemId");
    const topic = request.nextUrl.searchParams.get("topic");
    const difficulty = request.nextUrl.searchParams.get("difficulty");

    console.log("Request params:", {
      problemId,
      topic,
      difficulty,
    });

    const mongoClient = await getMongoClient();

    console.log("Mongo connection successful");

    const db = mongoClient.db(MONGODB_DB);
    const collection = db.collection(PROBLEMS_COLLECTION);

    // Fetch specific problem by ID
    if (problemId) {
      const problem = await collection.findOne({ id: problemId });

      if (!problem) {
        return NextResponse.json(
          { error: "Problem not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(problem);
    }

    const filter: Record<string, unknown> = {};

    if (topic && topic !== "all") {
      filter.topic = {
        $regex: `^${escapeRegExp(topic)}$`,
        $options: "i",
      };
    }

    if (difficulty && difficulty !== "all") {
      filter.difficulty = {
        $regex: `^${escapeRegExp(difficulty)}$`,
        $options: "i",
      };
    }

    console.log("Mongo filter:", filter);

    // Avoid expensive aggregation + $sample
    const results = await collection
      .find(filter)
      .limit(25)
      .toArray();

    console.log(`Found ${results.length} matching problems`);

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: "No matching problems found for the selected filters.",
        },
        { status: 404 }
      );
    }

    const randomIndex = Math.floor(
      Math.random() * results.length
    );

    const problem = results[randomIndex];

    return NextResponse.json(problem);
  } catch (err) {
    console.error("=== /api/problems ERROR ===");
    console.error(err);

    const message =
      err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: message,
      },
      { status: 500 }
    );
  }
}