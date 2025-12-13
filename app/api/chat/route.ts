import { createCongressionalAssistant } from "@/mastra/agents/congressional-assistant";
import { generateArtifactWithToolsStream, generateArtifactId } from "@/mastra/tools/thesys";
import { chatProtection, handleArcjetDecision } from "@/lib/security/arcjet";

// Tool descriptions for thinking states
const TOOL_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  smartSql: { title: "Searching legislation database", description: "Querying congressional bills and voting records..." },
  getBillDetail: { title: "Fetching bill details", description: "Retrieving comprehensive bill information..." },
  getMemberDetail: { title: "Looking up representative", description: "Finding congressional member details..." },
  getUserProfile: { title: "Loading your profile", description: "Retrieving your preferences and interests..." },
  semanticSearch: { title: "Semantic search", description: "Finding related legislation using AI..." },
  billTextRag: { title: "Analyzing bill text", description: "Reading and analyzing bill language..." },
  compareBills: { title: "Comparing legislation", description: "Analyzing similarities between bills..." },
  policyAreaSearch: { title: "Policy area search", description: "Finding bills by policy category..." },
  searchNews: { title: "Searching the news", description: "Finding latest news coverage..." },
  searchCongressionalNews: { title: "Congressional news", description: "Finding latest Capitol Hill news..." },
  searchLegislatorNews: { title: "Legislator news", description: "Finding news about representatives..." },
  geminiSearch: { title: "Searching with Google", description: "Finding latest information with Google Search..." },
  webSearch: { title: "Web search", description: "Searching the internet for information..." },
  searchStateBills: { title: "State legislation search", description: "Searching state-level bills..." },
  getStateBillDetails: { title: "State bill details", description: "Fetching state legislation details..." },
  getStateLegislatorsByLocation: { title: "Finding state legislators", description: "Looking up your state representatives..." },
  createArtifact: { title: "Creating document", description: "Generating your report or presentation..." },
  generateBillReport: { title: "Generating bill report", description: "Creating comprehensive bill analysis..." },
  generateBriefingSlides: { title: "Creating slides", description: "Building your presentation deck..." },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string; // Reserved for future session management
}

// Natural language patterns that indicate user wants an artifact
const REPORT_PATTERNS = [
  /\b(create|make|generate|write|build|prepare|draft)\b.*\b(report|brief|briefing|analysis|summary|profile|overview)\b/i,
  /\b(report|brief|briefing|analysis|summary|profile|overview)\b.*\b(on|about|for|regarding)\b/i,
  /\bgive me a\b.*\b(report|brief|briefing|analysis|summary)\b/i,
  /\bcan you (create|make|write|prepare)\b.*\b(report|brief|analysis)\b/i,
  /\bi need a\b.*\b(report|brief|briefing|analysis|summary)\b/i,
  /\bpolicy brief\b/i,
  /\blegislative (report|analysis|summary|profile)\b/i,
  /\b(senator|representative|congressman|congresswoman)\b.*\b(report|profile|analysis)\b/i,
];

const SLIDES_PATTERNS = [
  /\b(create|make|generate|build|prepare)\b.*\b(slides|deck|presentation|slideshow)\b/i,
  /\b(slides|deck|presentation|slideshow)\b.*\b(on|about|for|regarding)\b/i,
  /\bgive me a\b.*\b(presentation|deck|slides)\b/i,
  /\bcan you (create|make|build)\b.*\b(presentation|deck|slides)\b/i,
  /\bi need a\b.*\b(presentation|deck|slides)\b/i,
];

// Detect template type from content
function detectTemplate(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("bill analysis") || lower.includes("legislation analysis")) {
    return "bill_analysis";
  }
  if (lower.includes("week in congress") || lower.includes("weekly")) {
    return "week_in_congress";
  }
  if (lower.includes("district") || lower.includes("local impact")) {
    return "district_briefing";
  }
  if (lower.includes("comparison") || lower.includes("compare")) {
    return "comparison";
  }
  if (lower.includes("profile") || lower.includes("senator") || lower.includes("representative")) {
    return "bill_analysis"; // Use bill_analysis for legislator profiles
  }
  return "policy_brief";
}

// Detect audience from content
function detectAudience(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("for educators") || lower.includes("for teachers") || lower.includes("educational")) {
    return "educator";
  }
  if (lower.includes("for advocates") || lower.includes("advocacy")) {
    return "advocate";
  }
  if (lower.includes("professional") || lower.includes("detailed analysis") || lower.includes("in-depth")) {
    return "professional";
  }
  if (lower.includes("for legislators") || lower.includes("executive summary") || lower.includes("for congress")) {
    return "legislator";
  }
  return "general";
}

// Detect natural language artifact requests
function detectNaturalLanguageArtifact(content: string): {
  hasRequest: boolean;
  type?: "report" | "slides";
  template?: string;
  audience?: string;
  context?: string;
} {
  // Check for slides/deck patterns first
  for (const pattern of SLIDES_PATTERNS) {
    if (pattern.test(content)) {
      return {
        hasRequest: true,
        type: "slides",
        template: detectTemplate(content),
        audience: detectAudience(content),
        context: content,
      };
    }
  }

  // Check for report patterns
  for (const pattern of REPORT_PATTERNS) {
    if (pattern.test(content)) {
      return {
        hasRequest: true,
        type: "report",
        template: detectTemplate(content),
        audience: detectAudience(content),
        context: content,
      };
    }
  }

  return { hasRequest: false };
}

// Parse ARTIFACT_REQUEST from message content (explicit tags)
function parseArtifactRequest(content: string): {
  hasRequest: boolean;
  type?: "report" | "slides";
  template?: string;
  audience?: string;
  title?: string;
  context?: string;
} {
  // First check for explicit ARTIFACT_REQUEST tags
  const artifactMatch = content.match(/\[ARTIFACT_REQUEST\]([\s\S]*?)\[\/ARTIFACT_REQUEST\]/);
  if (artifactMatch) {
    const requestContent = artifactMatch[1];
    const typeMatch = requestContent.match(/type:\s*(report|slides)/i);
    const templateMatch = requestContent.match(/template:\s*(\w+)/i);
    const audienceMatch = requestContent.match(/audience:\s*(\w+)/i);
    const titleMatch = requestContent.match(/title:\s*([^\n]+)/i);

    // Extract context from the message before the ARTIFACT_REQUEST
    const contextBefore = content.substring(0, content.indexOf("[ARTIFACT_REQUEST]")).trim();

    return {
      hasRequest: true,
      type: (typeMatch?.[1]?.toLowerCase() as "report" | "slides") || "report",
      template: templateMatch?.[1]?.toLowerCase() || "policy_brief",
      audience: audienceMatch?.[1]?.toLowerCase() || "general",
      title: titleMatch?.[1]?.trim(),
      context: contextBefore || undefined,
    };
  }

  // Then check for natural language patterns
  return detectNaturalLanguageArtifact(content);
}

// Get system prompt for artifact generation
function getArtifactSystemPrompt(template: string, audience: string): string {
  const audienceDescriptions: Record<string, string> = {
    general: "the general public with clear, accessible language",
    educator: "educators who need to teach this content",
    advocate: "policy advocates who need persuasive, action-oriented content",
    professional: "policy professionals who want detailed analysis",
    legislator: "legislators and their staff who need executive summaries",
  };

  const templateDescriptions: Record<string, string> = {
    policy_brief: "a comprehensive policy brief with executive summary, background, analysis, and recommendations",
    bill_analysis: "a detailed legislative analysis with bill summary, key provisions, fiscal impact, and stakeholder perspectives",
    week_in_congress: "a weekly legislative roundup highlighting key votes, bills, and congressional activities",
    district_briefing: "a district-focused briefing connecting federal legislation to local impacts",
    comparison: "a comparative analysis of multiple bills or policies",
  };

  return `You are an expert policy analyst creating ${templateDescriptions[template] || "a policy document"} for ${audienceDescriptions[audience] || "general readers"}.

Generate a well-structured, professional document using C1 DSL format. The document should:
- Be factual and non-partisan
- Use clear headings and sections
- Include relevant data and citations where appropriate
- Be engaging and accessible to the target audience`;
}

export async function POST(request: Request) {
  try {
    // Arcjet rate limiting and bot protection
    const decision = await chatProtection.protect(request);
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return new Response(
        JSON.stringify({ error: arcjetResult.message }),
        { status: arcjetResult.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: ChatRequest = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return new Response(
        JSON.stringify({ error: "Last message must be from user" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for artifact request pattern
    const artifactRequest = parseArtifactRequest(lastMessage.content);

    if (artifactRequest.hasRequest) {
      console.log("[API] Detected ARTIFACT_REQUEST:", artifactRequest);

      // Handle artifact generation with STREAMING
      const encoder = new TextEncoder();
      const artifactStream = new ReadableStream({
        async start(controller) {
          try {
            const artifactId = generateArtifactId();
            const topic = artifactRequest.context || artifactRequest.title || "current policy topics";

            // Stream thinking state: Analyzing request
            const thinkingAnalyze = {
              type: "thinking",
              title: "Analyzing your request",
              description: `Preparing to create a ${artifactRequest.type === "slides" ? "presentation" : "report"}...`,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingAnalyze)}\n\n`));

            const systemPrompt = getArtifactSystemPrompt(
              artifactRequest.template || "policy_brief",
              artifactRequest.audience || "general"
            );

            // Enhanced user prompt
            const userPrompt = `Create a comprehensive ${artifactRequest.type === "slides" ? "presentation" : "report"} about: ${topic}

IMPORTANT: Before writing the report, use the available tools to gather real data:
1. Use search_bills or semantic_search_bills to find relevant federal legislation
2. Use search_news to find recent news coverage and developments
3. Use search_members if discussing specific legislators
4. Use get_latest_actions to show recent congressional activity
5. Use search_state_bills if state-level legislation is relevant

Include specific bill numbers, dates, sponsor names, and factual information from the tool results.
Make the report data-driven with citations to actual legislation and news sources.`;

            console.log("[API] Calling Thesys API with STREAMING:", {
              type: artifactRequest.type,
              template: artifactRequest.template,
              topic,
            });

            // Use streaming generator
            const stream = generateArtifactWithToolsStream({
              id: artifactId,
              type: artifactRequest.type || "report",
              systemPrompt,
              userPrompt,
            });

            let accumulatedContent = "";
            let finalResult = null;

            // Consume the stream and forward to client
            for await (const event of stream) {
              if (event.type === "phase") {
                // Update thinking state based on phase
                const thinkingEvent = {
                  type: "thinking",
                  title: event.phase === "gathering" ? "Gathering research data" : "Generating your document",
                  description: event.message,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingEvent)}\n\n`));
              } else if (event.type === "content") {
                // Stream artifact content progressively
                accumulatedContent += event.content;

                // Send streaming artifact update
                const artifactStreamEvent = {
                  type: "artifact-stream",
                  artifactId,
                  artifactType: artifactRequest.type || "report",
                  template: artifactRequest.template,
                  content: accumulatedContent,
                  isComplete: false,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(artifactStreamEvent)}\n\n`));
              } else if (event.type === "complete") {
                finalResult = event.result;
              }
            }

            console.log("[API] Thesys streaming complete:", {
              contentLength: accumulatedContent.length,
              id: artifactId,
            });

            // Stream thinking complete
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking-complete" })}\n\n`));

            // Send final complete artifact
            const artifactData = {
              type: "artifact",
              artifactType: finalResult?.type || artifactRequest.type || "report",
              artifactId: finalResult?.id || artifactId,
              template: artifactRequest.template,
              content: accumulatedContent,
              isComplete: true,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(artifactData)}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("[API] Artifact generation error:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking-complete" })}\n\n`));

            // Provide user-friendly error messages
            let errorMsg = "An error occurred while generating your document. Please try again.";
            if (error instanceof Error) {
              if (error.message.includes("network") || error.message.includes("Network")) {
                errorMsg = "Network error: Unable to connect to the document generation service. Please check your connection and try again.";
              } else if (error.message.includes("API key") || error.message.includes("THESYS_API_KEY")) {
                errorMsg = "Configuration error: Document generation service is not properly configured.";
              } else if (error.message.includes("timeout")) {
                errorMsg = "The request timed out. Please try a simpler query.";
              } else {
                errorMsg = error.message;
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          }
        },
      });

      return new Response(artifactStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create the congressional assistant agent for non-artifact requests
    const agent = createCongressionalAssistant();

    // Build conversation context from previous messages
    const conversationContext = messages
      .slice(0, -1) // All messages except the last one
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Create the prompt with context
    const promptWithContext = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${lastMessage.content}`
      : lastMessage.content;

    // Stream the response
    console.log("[API] Starting stream for query:", promptWithContext.substring(0, 100));
    console.log("[API] CEREBRAS_API_KEY set:", !!process.env.CEREBRAS_API_KEY);
    console.log("[API] OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
    console.log("[API] ANTHROPIC_API_KEY set:", !!process.env.ANTHROPIC_API_KEY);
    console.log("[API] THESYS_API_KEY set:", !!process.env.THESYS_API_KEY);
    console.log("[API] PERPLEXITY_API_KEY set:", !!process.env.PERPLEXITY_API_KEY);

    let stream;
    let streamError: Error | null = null;

    console.log("[API] Agent model info:", agent.model);

    try {
      console.log("[API] Calling agent.stream()...");
      stream = await agent.stream(promptWithContext, {
        onError: ({ error }) => {
          console.error("[API] Stream onError callback:", error);
          streamError = error instanceof Error ? error : new Error(String(error));
        },
        onFinish: (result) => {
          console.log("[API] Stream onFinish callback, text length:", result?.text?.length || 0);
        },
      });
      console.log("[API] Stream created successfully, type:", typeof stream);
    } catch (err) {
      console.error("[API] Failed to create stream:", err);
      console.error("[API] Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      streamError = err instanceof Error ? err : new Error(String(err));
    }

    if (streamError || !stream) {
      // Return error as SSE
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          const errorMsg = streamError?.message || "Failed to create stream";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create a ReadableStream for SSE using fullStream to properly handle tool execution
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;
          let totalContent = "";
          let hasStreamedToolResults = false; // Track if we've shown tool results to user

          console.log("[API] Starting to consume fullStream");

          // Send immediate start event for instant feedback
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start", message: "Processing..." })}\n\n`));

          // Use fullStream to get proper tool execution results
          // fullStream yields events including text-delta, tool-call, tool-result, etc.
          let hasActiveThinking = false;

          for await (const event of stream.fullStream) {
            if (event.type === "text-delta") {
              // If we were showing thinking state, mark it complete before showing text
              if (hasActiveThinking) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking-complete" })}\n\n`));
                hasActiveThinking = false;
              }

              // Only stream actual text deltas, not tool calls
              const chunk = event.textDelta;
              if (chunk) {
                chunkCount++;
                totalContent += chunk;
                if (chunkCount <= 5 || chunkCount % 10 === 0) {
                  console.log("[API] Text chunk", chunkCount, ":", chunk?.substring(0, 50));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
              }
            } else if (event.type === "tool-call") {
              // Mastra wraps tool info in payload: event.payload.toolName
              const payload = (event as any).payload || {};
              const toolName = payload.toolName || event.toolName || "unknown";
              console.log("[API] Tool call:", toolName);
              // Stream thinking state for tool calls
              const toolInfo = TOOL_DESCRIPTIONS[toolName] || {
                title: `Running ${toolName}`,
                description: "Processing your request...",
              };
              const thinkingEvent = {
                type: "thinking",
                title: toolInfo.title,
                description: toolInfo.description,
                toolName: toolName,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingEvent)}\n\n`));
              hasActiveThinking = true;
            } else if (event.type === "tool-result") {
              // Debug: Log full event structure to understand Mastra's format
              console.log("[API] Tool result event keys:", Object.keys(event));
              console.log("[API] Tool result event:", JSON.stringify(event).substring(0, 500));

              const resultPayload = (event as any).payload || {};
              const resultToolName = resultPayload.toolName || (event as any).toolName || "unknown";
              const toolResult = resultPayload.result || (event as any).result;
              console.log("[API] Extracted toolName:", resultToolName, "- result type:", typeof toolResult, "- has articles:", !!(toolResult as any)?.articles);

              // Stream tool results for client-side component rendering
              // Tools that should render UI components
              const uiRenderingTools = [
                "smartSql", "getBillDetail", "getMemberDetail",
                "searchNews", "searchCongressionalNews", "searchLegislatorNews",
                "geminiSearch", "webSearch",
                "searchStateBills", "getStateLegislatorsByLocation",
                "getUserRepresentatives", "getTrackedBills",
                "createArtifact", "generateBillReport", "generateBriefingSlides",
                "semanticSearch", "billTextRag", "compareBills", "policyAreaSearch", // SmartBucket tools
              ];

              if (uiRenderingTools.includes(resultToolName) && toolResult) {
                const toolResultEvent = {
                  type: "tool-result",
                  toolName: resultToolName,
                  result: toolResult,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolResultEvent)}\n\n`));
                hasStreamedToolResults = true; // Mark that we've shown UI results
              }
            } else if (event.type === "finish") {
              console.log("[API] Stream finished, reason:", event.finishReason);
              // Ensure thinking state is cleared
              if (hasActiveThinking) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking-complete" })}\n\n`));
                hasActiveThinking = false;
              }
            }
          }

          console.log("[API] Stream complete, text chunks:", chunkCount, "total length:", totalContent.length, "hasToolResults:", hasStreamedToolResults);

          // Handle responses based on what we have
          if (hasStreamedToolResults && totalContent.length === 0) {
            // Tool results were streamed - don't fetch stream.text as it contains redundant markdown
            // Just provide a brief message to accompany the UI components
            const defaultResponse = "Here are the results I found:";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: defaultResponse })}\n\n`));
            console.log("[API] Tool results sent, using brief intro message");
          } else if (totalContent.length === 0) {
            console.log("[API] No text content generated, no tool results");
            // Only use stream.text fallback when we have NO tool results
            try {
              const fullText = await stream.text;
              console.log("[API] stream.text result:", fullText?.substring(0, 100) || "empty");
              if (fullText) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullText })}\n\n`));
                totalContent = fullText;
              }
            } catch (textError) {
              console.error("[API] stream.text failed:", textError);
            }

            if (totalContent.length === 0) {
              // No text AND no tool results - show error
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No response generated. Please try rephrasing your question." })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("[API] Streaming error:", error);
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : "Streaming failed",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
