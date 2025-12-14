"use client";

import { useEffect, useState, use, useCallback } from "react";
import { C1ChatViewer, ThemeProvider, Message } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import { hakivoLightTheme, hakivoDarkTheme } from "@/lib/c1-theme";
import { HakivoLogo } from "@/components/hakivo-logo";
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
  const [messages, setMessages] = useState<Message[]>([]);

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

        // Convert shared messages to C1 Message format
        const c1Messages: Message[] = data.messages.map(
          (msg: SharedMessage, index: number) => ({
            id: `shared-${index}`,
            role: msg.role,
            content: msg.content,
          })
        );
        setMessages(c1Messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchThread();
  }, [token]);

  // Load messages callback for C1ChatViewer (returns stored messages)
  const loadMessages = useCallback(async (): Promise<Message[]> => {
    return messages;
  }, [messages]);

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
          <Link href="https://hakivo.com">
            <Button>Try Hakivo</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!thread || messages.length === 0) return null;

  const createdDate = new Date(thread.createdAt);
  const expiresDate = new Date(thread.expiresAt);

  return (
    <ThemeProvider
      theme={hakivoLightTheme}
      darkTheme={hakivoDarkTheme}
      mode="dark"
    >
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="https://hakivo.com" className="flex items-center gap-3">
              <HakivoLogo height={32} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  {thread.messages.length} messages
                  <span className="text-muted-foreground/50">|</span>
                  <Clock className="h-3 w-3" />
                  Shared {createdDate.toLocaleDateString()}
                </p>
              </div>
            </Link>
            <Link href="https://hakivo.com">
              <Button variant="outline" size="sm">
                Try Hakivo
              </Button>
            </Link>
          </div>
        </header>

        {/* Read-only banner */}
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              This is a read-only shared conversation. It will expire on{" "}
              {expiresDate.toLocaleDateString()}.
            </span>
          </div>
        </div>

        {/* C1 Chat Viewer - Read-only mode */}
        <div className="flex-1 max-w-4xl mx-auto w-full">
          <C1ChatViewer
            messages={messages}
            loadMessages={loadMessages}
            formFactor="full-page"
            agentName="Hakivo"
          />
        </div>

        {/* Footer - Promote Hakivo */}
        <footer className="border-t border-border py-8 bg-card/30">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
            <div className="flex items-center justify-center">
              <HakivoLogo height={28} className="text-primary" />
            </div>
            <p className="text-muted-foreground">
              Your intelligent congressional assistant. Stay informed about
              legislation, track your representatives, and understand how
              government affects you.
            </p>
            <Link href="https://hakivo.com">
              <Button size="lg" className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700">
                Try Hakivo Free
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              <Link href="https://hakivo.com" className="hover:underline">
                hakivo.com
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
