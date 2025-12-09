"use client";

import { useEffect, useState, use } from "react";
import { CongressIcon } from "@/components/icons/congress-icon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, AlertCircle, Clock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SharedMessage {
  role: "user" | "assistant";
  content: string;
}

interface SharedThread {
  title: string;
  messages: SharedMessage[];
  createdAt: string;
  expiresAt: string;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function SharedThreadPage({ params }: PageProps) {
  const { token } = use(params);
  const [thread, setThread] = useState<SharedThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchThread() {
      try {
        const response = await fetch(`/api/share?token=${token}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load shared conversation");
        }

        const data = await response.json();
        setThread(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchThread();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Conversation Not Found</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Link href="/chat">
            <Button>Start a New Conversation</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!thread) return null;

  const createdDate = new Date(thread.createdAt);
  const expiresDate = new Date(thread.expiresAt);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <CongressIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">{thread.title}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-3 w-3" />
                {thread.messages.length} messages
                <span className="text-muted-foreground/50">|</span>
                <Clock className="h-3 w-3" />
                Shared {createdDate.toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link href="/chat">
            <Button variant="outline" size="sm">
              Start Your Own Chat
            </Button>
          </Link>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Read-only banner */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            This is a read-only shared conversation. It will expire on{" "}
            {expiresDate.toLocaleDateString()}.
          </span>
        </div>

        {thread.messages.map((message, index) => (
          <div key={index} className="group">
            {message.role === "user" ? (
              <div className="flex justify-end mb-6">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl max-w-[80%]">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <CongressIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="prose prose-invert prose-lg max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-bold mt-5 mb-3 text-foreground">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-base leading-7 mb-4 text-foreground/90">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="text-base list-disc ml-6 mb-4 space-y-2">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="text-base list-decimal ml-6 mb-4 space-y-2">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-foreground/90 leading-7">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">
                            {children}
                          </strong>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            className="text-primary hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-foreground">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-4">
          <p className="text-muted-foreground">
            Want to have your own conversation with the Congressional Assistant?
          </p>
          <Link href="/chat">
            <Button size="lg">
              Start a Conversation
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
