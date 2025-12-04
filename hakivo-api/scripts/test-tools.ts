#!/usr/bin/env npx tsx
/**
 * End-to-End Tool Testing Script
 *
 * Tests all Mastra tools for the Congressional Assistant.
 * Run with: npx tsx scripts/test-tools.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Import all tools (from root mastra folder)
import {
  smartSqlTool,
  getBillDetailTool,
  getMemberDetailTool,
} from "../../mastra/tools/smartsql";

import {
  semanticSearchTool,
  billTextRagTool,
  policyAreaSearchTool,
} from "../../mastra/tools/smartbucket";

import {
  getUserContextTool,
  getUserRepresentativesTool,
  getTrackedBillsTool,
  storeWorkingMemoryTool,
} from "../../mastra/tools/smartmemory";

import {
  searchNewsTool,
  searchCongressionalNewsTool,
} from "../../mastra/tools/tavily";

import {
  searchStateBillsTool,
  getStateLegislatorsByLocationTool,
} from "../../mastra/tools/openstates";

// Test result tracking
interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<unknown>,
  skipCondition?: boolean
): Promise<void> {
  if (skipCondition) {
    results.push({ name, status: "skip", duration: 0 });
    console.log(`⏭️  SKIP: ${name}`);
    return;
  }

  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    results.push({ name, status: "pass", duration, data });
    console.log(`✅ PASS: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "fail", duration, error: errorMsg });
    console.log(`❌ FAIL: ${name} (${duration}ms)`);
    console.log(`   Error: ${errorMsg}`);
  }
}

async function main() {
  console.log("\n🧪 Hakivo Congressional Assistant - Tool Testing\n");
  console.log("=".repeat(60));

  // Check environment
  const hasRaindropKey = !!process.env.RAINDROP_API_KEY;
  const hasTavilyKey = !!process.env.TAVILY_API_KEY;
  const hasOpenStatesKey = !!process.env.OPENSTATES_API_KEY;
  const hasThesysKey = !!process.env.THESYS_API_KEY;
  const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;

  console.log("\n📋 Environment Check:");
  console.log(`   RAINDROP_API_KEY: ${hasRaindropKey ? "✓" : "✗"}`);
  console.log(`   TAVILY_API_KEY: ${hasTavilyKey ? "✓" : "✗"}`);
  console.log(`   OPENSTATES_API_KEY: ${hasOpenStatesKey ? "✓" : "✗"}`);
  console.log(`   THESYS_API_KEY: ${hasThesysKey ? "✓" : "✗"}`);
  console.log(`   ELEVENLABS_API_KEY: ${hasElevenLabsKey ? "✓" : "✗"}`);

  // ========================================
  // SmartSQL Tools
  // ========================================
  console.log("\n📊 SmartSQL Tools");
  console.log("-".repeat(40));

  await runTest("smartSqlTool - Query bills", async () => {
    const result = await smartSqlTool.execute({
      context: {
        query: "Show 5 recent healthcare bills from Congress 119",
        maxResults: 5,
      },
    });
    if (!result.success) throw new Error(result.error || "Query failed");
    return result;
  });

  await runTest("getBillDetailTool - Get specific bill", async () => {
    const result = await getBillDetailTool.execute({
      context: {
        congress: 119,
        billType: "hr",
        billNumber: 1,
      },
    });
    if (!result.success) throw new Error(result.error || "Query failed");
    return result;
  });

  await runTest("getMemberDetailTool - Get member info", async () => {
    const result = await getMemberDetailTool.execute({
      context: {
        bioguideId: "P000197", // Nancy Pelosi
      },
    });
    if (!result.success) throw new Error(result.error || "Query failed");
    return result;
  });

  // ========================================
  // SmartBucket Tools (RAG)
  // ========================================
  console.log("\n📚 SmartBucket Tools");
  console.log("-".repeat(40));

  await runTest("semanticSearchTool - Search bill text", async () => {
    const result = await semanticSearchTool.execute({
      context: {
        query: "tax credits for renewable energy",
        limit: 5,
      },
    });
    return result;
  }, !hasRaindropKey);

  await runTest("billTextRagTool - RAG query on bill", async () => {
    const result = await billTextRagTool.execute({
      context: {
        billId: "hr1-119",
        question: "What are the main provisions of this bill?",
      },
    });
    return result;
  }, !hasRaindropKey);

  await runTest("policyAreaSearchTool - Search by policy area", async () => {
    const result = await policyAreaSearchTool.execute({
      context: {
        policyArea: "Healthcare",
        query: "prescription drug pricing",
        limit: 5,
      },
    });
    return result;
  }, !hasRaindropKey);

  // ========================================
  // SmartMemory Tools
  // ========================================
  console.log("\n🧠 SmartMemory Tools");
  console.log("-".repeat(40));

  const testUserId = "test-user-123";
  const testSessionId = `test-session-${Date.now()}`;

  await runTest("storeWorkingMemoryTool - Store memory", async () => {
    const result = await storeWorkingMemoryTool.execute({
      context: {
        sessionId: testSessionId,
        content: "User asked about healthcare legislation in California",
        key: "last_query",
      },
    });
    return result;
  }, !hasRaindropKey);

  await runTest("getUserContextTool - Get user context", async () => {
    const result = await getUserContextTool.execute({
      context: {
        userId: testUserId,
      },
    });
    return result;
  }, !hasRaindropKey);

  await runTest("getUserRepresentativesTool - Get user reps", async () => {
    const result = await getUserRepresentativesTool.execute({
      context: {
        userId: testUserId,
      },
    });
    return result;
  }, !hasRaindropKey);

  await runTest("getTrackedBillsTool - Get tracked bills", async () => {
    const result = await getTrackedBillsTool.execute({
      context: {
        userId: testUserId,
      },
    });
    return result;
  }, !hasRaindropKey);

  // ========================================
  // Tavily Tools (News)
  // ========================================
  console.log("\n📰 Tavily News Tools");
  console.log("-".repeat(40));

  await runTest("searchNewsTool - General news search", async () => {
    const result = await searchNewsTool.execute({
      context: {
        query: "Congress budget 2024",
        maxResults: 5,
        searchDepth: "basic",
      },
    });
    if (!result.success) throw new Error(result.error || "Search failed");
    return result;
  }, !hasTavilyKey);

  await runTest("searchCongressionalNewsTool - Congressional news", async () => {
    const result = await searchCongressionalNewsTool.execute({
      context: {
        topic: "healthcare reform",
        maxResults: 5,
      },
    });
    if (!result.success) throw new Error(result.error || "Search failed");
    return result;
  }, !hasTavilyKey);

  // ========================================
  // OpenStates Tools (State Legislation)
  // ========================================
  console.log("\n🏛️  OpenStates Tools");
  console.log("-".repeat(40));

  await runTest("searchStateBillsTool - Search state bills", async () => {
    const result = await searchStateBillsTool.execute({
      context: {
        state: "CA",
        query: "climate change",
        maxResults: 5,
      },
    });
    if (!result.success) throw new Error(result.error || "Search failed");
    return result;
  }, !hasOpenStatesKey);

  await runTest("getStateLegislatorsByLocationTool - Get state legislators", async () => {
    const result = await getStateLegislatorsByLocationTool.execute({
      context: {
        latitude: 34.0522,
        longitude: -118.2437, // Los Angeles
      },
    });
    if (!result.success) throw new Error(result.error || "Search failed");
    return result;
  }, !hasOpenStatesKey);

  // ========================================
  // Summary
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary\n");

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const skipped = results.filter(r => r.status === "skip").length;
  const total = results.length;

  console.log(`   Total:   ${total}`);
  console.log(`   Passed:  ${passed} ✅`);
  console.log(`   Failed:  ${failed} ❌`);
  console.log(`   Skipped: ${skipped} ⏭️`);
  console.log(`   Success: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter(r => r.status === "fail")
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
  }

  // Detailed results for passed tests
  console.log("\n📋 Detailed Results:");
  results
    .filter(r => r.status === "pass")
    .forEach(r => {
      console.log(`\n   ${r.name}:`);
      if (r.data && typeof r.data === "object") {
        const preview = JSON.stringify(r.data).slice(0, 200);
        console.log(`   ${preview}${preview.length >= 200 ? "..." : ""}`);
      }
    });

  console.log("\n");

  // Exit with error if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
