"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { useRenderToolCall } from "@copilotkit/react-core";

// Import our custom UI components for generative UI
import { BillCard } from "@/components/generative-ui/bill-card";
import { VotingChart } from "@/components/generative-ui/voting-chart";
import { RepresentativeProfile } from "@/components/generative-ui/representative-profile";
import { NewsCard } from "@/components/generative-ui/news-card";

/**
 * CopilotKit Chat Component with Generative UI
 *
 * Uses CopilotKit with Mastra agents to provide:
 * - Intelligent chat with congressional assistant
 * - Generative UI with custom components (BillCard, VotingChart, etc.)
 * - Tool calling for data retrieval
 */
export function CopilotKitChat() {
  // Render tool for showing bill information
  useRenderToolCall({
    name: "showBillCard",
    description: "Display a bill card with bill information",
    parameters: [
      { name: "billNumber", type: "string", description: "Bill number (e.g., H.R. 1234)", required: true },
      { name: "title", type: "string", description: "Bill title", required: true },
      { name: "sponsor", type: "string", description: "Bill sponsor", required: false },
      { name: "status", type: "string", description: "Current status", required: false },
      { name: "lastAction", type: "string", description: "Latest action", required: false },
      { name: "lastActionDate", type: "string", description: "Date of last action", required: false },
    ],
    render: ({ status, args }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }
      return (
        <BillCard
          billNumber={args.billNumber as string}
          title={args.title as string}
          sponsor={args.sponsor as string}
          status={args.status as string}
          lastAction={args.lastAction as string}
          lastActionDate={args.lastActionDate as string}
        />
      );
    },
  });

  // Render tool for showing voting charts
  useRenderToolCall({
    name: "showVotingChart",
    description: "Display a voting chart with vote breakdown",
    parameters: [
      { name: "billNumber", type: "string", description: "Bill number", required: true },
      { name: "billTitle", type: "string", description: "Bill title", required: true },
      { name: "result", type: "string", description: "Vote result (Passed/Failed)", required: true },
      { name: "yea", type: "number", description: "Number of yea votes", required: true },
      { name: "nay", type: "number", description: "Number of nay votes", required: true },
      { name: "present", type: "number", description: "Number of present votes", required: false },
      { name: "notVoting", type: "number", description: "Number not voting", required: false },
    ],
    render: ({ status, args }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-48" />;
      }
      return (
        <VotingChart
          billNumber={args.billNumber as string}
          billTitle={args.billTitle as string}
          result={args.result as string}
          yea={args.yea as number}
          nay={args.nay as number}
          present={(args.present as number) || 0}
          notVoting={(args.notVoting as number) || 0}
        />
      );
    },
  });

  // Render tool for showing representative profiles
  useRenderToolCall({
    name: "showRepresentative",
    description: "Display a representative profile card",
    parameters: [
      { name: "name", type: "string", description: "Representative name", required: true },
      { name: "party", type: "string", description: "Party affiliation (D/R/I)", required: true },
      { name: "state", type: "string", description: "State represented", required: true },
      { name: "chamber", type: "string", description: "Chamber (House/Senate)", required: true },
      { name: "phone", type: "string", description: "Office phone", required: false },
      { name: "website", type: "string", description: "Official website", required: false },
    ],
    render: ({ status, args }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-40" />;
      }
      return (
        <RepresentativeProfile
          name={args.name as string}
          party={args.party as string}
          state={args.state as string}
          chamber={args.chamber as string}
          phone={args.phone as string}
          website={args.website as string}
        />
      );
    },
  });

  // Render tool for showing news cards
  useRenderToolCall({
    name: "showNewsCard",
    description: "Display a news article card",
    parameters: [
      { name: "headline", type: "string", description: "Article headline", required: true },
      { name: "source", type: "string", description: "News source", required: true },
      { name: "date", type: "string", description: "Publication date", required: true },
      { name: "snippet", type: "string", description: "Article snippet", required: false },
      { name: "url", type: "string", description: "Article URL", required: false },
    ],
    render: ({ status, args }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }
      return (
        <NewsCard
          headline={args.headline as string}
          source={args.source as string}
          date={args.date as string}
          snippet={args.snippet as string}
          url={args.url as string}
        />
      );
    },
  });

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="congressionalAssistant">
      <CopilotChat
        labels={{
          title: "Hakivo",
          initial: "Hi! I'm Hakivo, your congressional assistant. I can help you find bills, look up representatives, track legislation, and understand how Congress works. What would you like to know?",
        }}
        className="h-full"
      />
    </CopilotKit>
  );
}
