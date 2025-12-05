"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { useRenderToolCall } from "@copilotkit/react-core";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";

// Import our custom UI components for generative UI
import { BillCard } from "@/components/generative-ui/bill-card";
import { RepresentativeProfile } from "@/components/generative-ui/representative-profile";
import { NewsCard } from "@/components/generative-ui/news-card";

/**
 * CopilotKit Chat Component with Generative UI
 *
 * Uses CopilotKit with Mastra agents to provide:
 * - Intelligent chat with congressional assistant
 * - Generative UI with custom components when backend tools are called
 * - SmartSQL, SmartBucket, and SmartMemory tool integration
 *
 * Key: useRenderToolCall hooks render custom UI when Mastra backend tools execute
 */
export function CopilotKitChat() {
  // Get auth token and user from context to pass to agent tools
  const { accessToken, user } = useAuth();

  // Memoize properties to avoid unnecessary re-renders
  // These properties are forwarded to agents via AG-UI runtimeContext
  const copilotProperties = useMemo(() => ({
    authorization: accessToken || undefined,
    // Pass user info so agent can query user-specific data from database
    userId: user?.id || undefined,
    userEmail: user?.email || undefined,
  }), [accessToken, user?.id, user?.email]);

  // Render UI for smartSql tool - main database query tool
  // Returns bills, members, or other congressional data
  useRenderToolCall({
    name: "smartSql",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="animate-pulse space-y-2">
            <div className="bg-muted rounded-lg h-8 w-48" />
            <div className="bg-muted rounded-lg h-32" />
          </div>
        );
      }

      // smartSql returns different data based on query intent
      if (!result || !result.success) {
        return <></>;
      }

      // Render bills if available
      if (result.bills && result.bills.length > 0) {
        return (
          <div className="space-y-3">
            {result.bills.slice(0, 5).map((bill: any, idx: number) => (
              <BillCard
                key={bill.id || idx}
                billNumber={`${bill.bill_type?.toUpperCase() || ''} ${bill.bill_number || ''}`}
                title={bill.title || bill.short_title || 'Untitled Bill'}
                sponsor={bill.sponsor_name || bill.sponsor || undefined}
                status={bill.status || bill.latest_action_text || undefined}
                lastAction={bill.latest_action_text || undefined}
                lastActionDate={bill.latest_action_date || undefined}
              />
            ))}
            {result.bills.length > 5 && (
              <p className="text-sm text-muted-foreground">
                Showing 5 of {result.bills.length} results
              </p>
            )}
          </div>
        );
      }

      // Render members if available
      if (result.members && result.members.length > 0) {
        return (
          <div className="space-y-3">
            {result.members.slice(0, 5).map((member: any, idx: number) => (
              <RepresentativeProfile
                key={member.bioguide_id || idx}
                name={member.name || `${member.first_name} ${member.last_name}`}
                party={member.party || 'Unknown'}
                state={member.state || 'Unknown'}
                chamber={member.chamber || 'Congress'}
                phone={member.phone || undefined}
                website={member.website || member.url || undefined}
              />
            ))}
          </div>
        );
      }

      return <></>;
    },
  });

  // Render UI for getBillDetail tool - comprehensive bill information
  useRenderToolCall({
    name: "getBillDetail",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-40" />;
      }

      if (!result?.success || !result?.bill) {
        return <></>;
      }

      const bill = result.bill;
      return (
        <BillCard
          billNumber={`${bill.bill_type?.toUpperCase() || ''} ${bill.bill_number || ''}`}
          title={bill.title || bill.short_title || 'Untitled Bill'}
          sponsor={bill.sponsor_name || bill.sponsor || undefined}
          status={bill.status || bill.latest_action_text || undefined}
          lastAction={bill.latest_action_text || undefined}
          lastActionDate={bill.latest_action_date || undefined}
        />
      );
    },
  });

  // Render UI for getMemberDetail tool - comprehensive member information
  useRenderToolCall({
    name: "getMemberDetail",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-40" />;
      }

      if (!result?.success || !result?.member) {
        return <></>;
      }

      const member = result.member;
      return (
        <RepresentativeProfile
          name={member.name || `${member.first_name} ${member.last_name}`}
          party={member.party || 'Unknown'}
          state={member.state || 'Unknown'}
          chamber={member.chamber || 'Congress'}
          phone={member.phone || undefined}
          website={member.website || member.url || undefined}
        />
      );
    },
  });

  // Render UI for searchNews tool - Perplexity news search
  useRenderToolCall({
    name: "searchNews",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="animate-pulse space-y-2">
            <div className="bg-muted rounded-lg h-24" />
            <div className="bg-muted rounded-lg h-24" />
          </div>
        );
      }

      if (!result?.success) {
        return <></>;
      }

      // Show summary and articles
      return (
        <div className="space-y-3">
          {result.summary && (
            <div className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
              {result.summary.substring(0, 300)}...
            </div>
          )}
          {result.articles?.slice(0, 3).map((article: any, idx: number) => (
            <NewsCard
              key={idx}
              headline={article.title || `Source ${idx + 1}`}
              source={article.source || 'News'}
              date={article.date || 'Recent'}
              snippet={article.snippet || undefined}
              url={article.url || undefined}
            />
          ))}
        </div>
      );
    },
  });

  // Render UI for searchCongressionalNews tool
  useRenderToolCall({
    name: "searchCongressionalNews",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }

      if (!result?.success) return <></>;

      return (
        <div className="space-y-3">
          {result.articles?.slice(0, 3).map((article: any, idx: number) => (
            <NewsCard
              key={idx}
              headline={article.title || `Source ${idx + 1}`}
              source={article.source || 'Congressional News'}
              date={article.date || 'Recent'}
              snippet={article.snippet || undefined}
              url={article.url || undefined}
            />
          ))}
        </div>
      );
    },
  });

  // Render UI for searchStateBills tool - OpenStates state legislation
  useRenderToolCall({
    name: "searchStateBills",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }

      if (!result?.success || !result?.bills) return <></>;

      return (
        <div className="space-y-3">
          {result.bills.slice(0, 5).map((bill: any, idx: number) => (
            <BillCard
              key={bill.id || idx}
              billNumber={bill.identifier || bill.id || ''}
              title={bill.title || 'Untitled State Bill'}
              sponsor={bill.sponsor || undefined}
              status={bill.latest_action?.description || undefined}
              lastAction={bill.latest_action?.description || undefined}
              lastActionDate={bill.latest_action?.date || undefined}
            />
          ))}
        </div>
      );
    },
  });

  // Render UI for getStateLegislatorsByLocation tool
  useRenderToolCall({
    name: "getStateLegislatorsByLocation",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }

      if (!result?.success || !result?.legislators) return <></>;

      return (
        <div className="space-y-3">
          {result.legislators.map((legislator: any, idx: number) => (
            <RepresentativeProfile
              key={legislator.id || idx}
              name={legislator.name || 'Unknown'}
              party={legislator.party || 'Unknown'}
              state={legislator.state || 'Unknown'}
              chamber={legislator.chamber || 'State Legislature'}
              phone={legislator.phone || undefined}
              website={legislator.url || undefined}
            />
          ))}
        </div>
      );
    },
  });

  // Render UI for getUserRepresentatives tool - SmartMemory user's reps
  useRenderToolCall({
    name: "getUserRepresentatives",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-40" />;
      }

      if (!result?.success || !result?.representatives) return <></>;

      const reps = result.representatives;
      const allReps = [
        ...(reps.senators || []),
        ...(reps.representative ? [reps.representative] : []),
        ...(reps.stateLegislators || []),
      ];

      return (
        <div className="space-y-3">
          {allReps.map((rep: any, idx: number) => (
            <RepresentativeProfile
              key={rep.bioguide_id || rep.id || idx}
              name={rep.name || `${rep.first_name} ${rep.last_name}`}
              party={rep.party || 'Unknown'}
              state={rep.state || 'Unknown'}
              chamber={rep.chamber || 'Congress'}
              phone={rep.phone || undefined}
              website={rep.website || rep.url || undefined}
            />
          ))}
        </div>
      );
    },
  });

  // Render UI for getTrackedBills tool - SmartMemory tracked bills
  useRenderToolCall({
    name: "getTrackedBills",
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <div className="animate-pulse bg-muted rounded-lg h-32" />;
      }

      if (!result?.success || !result?.trackedBills) return <></>;

      return (
        <div className="space-y-3">
          {result.trackedBills.map((item: any, idx: number) => (
            <BillCard
              key={item.bill?.id || idx}
              billNumber={item.bill?.bill_number || item.identifier || ''}
              title={item.bill?.title || 'Tracked Bill'}
              sponsor={item.bill?.sponsor || undefined}
              status={item.bill?.status || undefined}
              lastAction={item.bill?.latest_action_text || undefined}
              lastActionDate={item.bill?.latest_action_date || undefined}
            />
          ))}
        </div>
      );
    },
  });

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="congressionalAssistant"
      properties={copilotProperties}
    >
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
