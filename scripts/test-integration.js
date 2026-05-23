const path = require("path");
const fs = require("fs");
const { URL } = require("url");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const PROBLEMS_URL = `${BASE_URL}/api/problems?topic=all`;
const API_ROOT_URL = `${BASE_URL}/api`;
const AGENT_URL = `${BASE_URL}/api/agent`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text}`);
  }
  return { response, json };
}

async function main() {
  console.log("Running local integration smoke test...");
  console.log(`Using base url: ${BASE_URL}`);

  if (!fs.existsSync(path.resolve(process.cwd(), ".env.local"))) {
    console.warn("Warning: .env.local file not found in project root.");
  }

  try {
    const rootCheck = await fetchJson(API_ROOT_URL);
    assert(rootCheck.response.ok, `Expected 200 from ${API_ROOT_URL}, got ${rootCheck.response.status}`);
    assert(rootCheck.json.endpoints?.problems, "API root response missing endpoints.problems.");
    console.log("✓ API root is reachable and returned endpoint metadata.");

    const rootPage = await fetch(BASE_URL);
    assert(rootPage.ok, `Expected 200 from ${BASE_URL}, got ${rootPage.status}`);
    const html = await rootPage.text();
    assert(html.includes("Interview modes") || html.includes("InterviewInterface"), "Root page did not return expected app HTML.");
    console.log("✓ Front-end root page is reachable.");

    const problemsCheck = await fetchJson(PROBLEMS_URL);
    assert(problemsCheck.response.ok, `Expected 200 from ${PROBLEMS_URL}, got ${problemsCheck.response.status}`);
    const problem = problemsCheck.json;
    assert(problem?.id, "Problem payload is missing id.");
    assert(problem?.title, "Problem payload is missing title.");
    console.log(`✓ Problem endpoint returned a valid problem (${problem.id}).`);

    const agentPayload = {
      command: "recommend_problem",
      userId: "local-user",
      topic: "all",
      difficulty: "all",
    };

    const agentCheck = await fetchJson(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentPayload),
    });

    assert(agentCheck.response.ok, `Expected 200 from ${AGENT_URL}, got ${agentCheck.response.status}`);
    assert(agentCheck.json.agentAdvice, "Agent response missing agentAdvice.");
    assert(agentCheck.json.problem?.id, "Agent response missing a recommended problem.");
    console.log("✓ Agent endpoint is working and returned a recommended problem.");

    console.log("\nIntegration smoke test passed. Backend and frontend endpoints are reachable.");
    process.exit(0);
  } catch (error) {
    console.error("\nIntegration smoke test failed:", error.message || error);
    process.exit(1);
  }
}

main();
