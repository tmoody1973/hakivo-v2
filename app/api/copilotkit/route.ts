import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export const POST = async (req: NextRequest) => {
  // Get local Mastra agents - agent is selected via frontend <CopilotKit agent="...">
  const mastraAgents = MastraAgent.getLocalAgents({ mastra });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
