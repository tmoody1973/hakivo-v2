"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Link2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareThreadProps {
  sessionId: string;
  title: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  className?: string;
  disabled?: boolean;
}

/**
 * ShareThread - Generate shareable links for chat conversations
 *
 * Creates a unique share token and URL that allows others to view
 * a read-only version of the conversation thread.
 */
export function ShareThread({
  sessionId,
  title,
  messages,
  className,
  disabled = false,
}: ShareThreadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    if (messages.length === 0) {
      setError("No messages to share");
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          title,
          messages: messages.slice(0, 100), // Limit to 100 messages
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const data = await response.json();
      const url = `${window.location.origin}/share/${data.token}`;
      setShareUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !shareUrl) {
      handleShare();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          disabled={disabled || messages.length === 0}
          title="Share this conversation"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share Conversation
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can view this conversation (read-only)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSharing && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {shareUrl && !isSharing && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{shareUrl}</span>
                </div>
                <Button
                  onClick={handleCopy}
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  {messages.length} message{messages.length !== 1 ? "s" : ""} will be shared
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  Link expires in 7 days
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareThread;
