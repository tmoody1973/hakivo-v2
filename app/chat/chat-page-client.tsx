"use client";

import { FC, useState, useRef, useEffect } from "react";
import { Send, Sparkles, Volume2, RotateCcw, BookOpen, FileText, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { useOnline } from "@/lib/hooks/use-online";
import { C1Artifact, isC1Response } from "@/components/c1";

const suggestedTopics = [
  { icon: FileText, label: "Current Legislation", query: "What are the most important bills being discussed right now?" },
  { icon: Users, label: "My Representatives", query: "Tell me about my representatives' recent voting records" },
  { icon: BookOpen, label: "How Congress Works", query: "Explain how a bill becomes a law" },
  { icon: Sparkles, label: "Bill Analysis", query: "Can you analyze the infrastructure bill for me?" },
];

const exampleQuestions = [
  "What bills are being voted on this week?",
  "Summarize the healthcare reform bill",
  "How has my senator voted on climate issues?",
  "What's the latest on immigration policy?",
  "Explain the budget reconciliation process",
  "Which committees oversee education policy?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const ChatPageClient: FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnline();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    const userMessage = input;
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Call the C1 API with streaming
      const response = await fetch('/api/chat/c1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // C1 SDK sends events in SSE format
          if (line.startsWith('event:')) {
            // Event type line - skip for now
            continue;
          }

          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              setIsStreaming(false);
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              // C1 SDK format: { type: "content" | "think", content: string }
              if (parsed.type === "content" && parsed.content) {
                assistantContent += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              } else if (parsed.type === "think") {
                // Think items are progress indicators - could show in UI
                console.log('[Chat] Think:', parsed.title, parsed.description);
              } else if (parsed.content) {
                // Fallback for legacy format
                assistantContent += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (parseErr) {
              // Ignore JSON parse errors for incomplete chunks
              if (data !== '' && !data.startsWith('[')) {
                console.warn('[Chat] Parse warning:', parseErr);
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
      // Remove the empty assistant message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleTopicClick = (query: string) => {
    setInput(query);
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    if (input.trim()) {
      handleSend();
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] px-6 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        {messages.length === 0 ? (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Congressional Assistant</h1>
                <p className="text-muted-foreground text-lg">
                  Your AI-powered guide to understanding legislation and Congress
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {suggestedTopics.map((topic) => (
                <Card
                  key={topic.label}
                  className="cursor-pointer transition-all hover:bg-accent/50 hover:border-primary/50"
                  onClick={() => handleTopicClick(topic.query)}
                >
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <topic.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{topic.label}</h3>
                      <p className="text-sm text-muted-foreground">{topic.query}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Example questions:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((question, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent py-1.5 px-3"
                    onClick={() => handleTopicClick(question)}
                  >
                    {question}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Congressional Assistant</h1>
                  <p className="text-sm text-muted-foreground">AI-powered legislative guide</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] p-6" ref={scrollRef}>
                  <div className="space-y-6">
                    {messages.map((message, index) => {
                      const isLastMessage = index === messages.length - 1;
                      const showC1 = message.role === "assistant" && isC1Response(message.content);

                      return (
                        <div
                          key={index}
                          className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {message.role === "assistant" && (
                            <Avatar className="h-10 w-10 bg-primary text-primary-foreground flex-shrink-0">
                              <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`rounded-lg px-4 py-3 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground max-w-[75%]"
                                : showC1 ? "bg-muted w-full max-w-[90%]" : "bg-muted max-w-[75%]"
                            }`}
                          >
                            {message.role === "assistant" && showC1 ? (
                              <C1Artifact
                                response={message.content}
                                isStreaming={isLastMessage && isStreaming}
                                onAction={(action) => {
                                  // Handle C1 UI interactions - send follow-up message
                                  console.log("[Chat] C1 action:", action.humanFriendlyMessage);
                                  setInput(action.llmFriendlyMessage);
                                }}
                                className="c1-artifact"
                              />
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                          {message.role === "user" && (
                            <Avatar className="h-10 w-10 bg-accent flex-shrink-0">
                              <AvatarFallback>You</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      );
                    })}
                    {isLoading && messages[messages.length - 1]?.content === "" && (
                      <div className="flex gap-4">
                        <Avatar className="h-10 w-10 bg-primary text-primary-foreground flex-shrink-0">
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-4 py-3 bg-muted">
                          <div className="flex gap-1">
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" />
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.2s]" />
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="flex justify-center">
                        <ErrorState
                          message={error}
                          type={!isOnline ? "network" : "server"}
                          retry={handleRetry}
                          className="max-w-md"
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about legislation, bills, representatives, or how Congress works..."
                  className="flex-1"
                  disabled={isLoading || !isOnline}
                />
                <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim() || !isOnline}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" disabled={isLoading}>
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
