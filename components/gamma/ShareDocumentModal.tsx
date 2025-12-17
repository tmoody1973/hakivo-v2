"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Check,
  Mail,
  Link2,
  Twitter,
  Linkedin,
  Loader2,
  Globe,
  Lock,
  ExternalLink,
  Eye,
} from "lucide-react";
import type { GammaDocument } from "./GammaDocumentViewer";

interface ShareDocumentModalProps {
  document: GammaDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onShareToggle?: (isPublic: boolean) => Promise<{ shareUrl?: string; shareToken?: string }>;
}

export function ShareDocumentModal({
  document,
  isOpen,
  onClose,
  onShareToggle,
}: ShareDocumentModalProps) {
  // Share state
  const [isPublic, setIsPublic] = useState(document?.is_public || false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Email state
  const [emailTab, setEmailTab] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Initialize share URL when document changes
  useEffect(() => {
    if (document) {
      setIsPublic(document.is_public || false);
      if (document.share_token) {
        setShareUrl(`${typeof window !== "undefined" ? window.location.origin : ""}/gamma/${document.share_token}`);
      } else if (document.gamma_url) {
        setShareUrl(document.gamma_url);
      }
    }
  }, [document]);

  const getAuthToken = useCallback(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hakivo_access_token");
    }
    return null;
  }, []);

  const handleShareToggle = async () => {
    if (!document || !onShareToggle) return;

    const newValue = !isPublic;
    setToggling(true);
    try {
      const result = await onShareToggle(newValue);
      setIsPublic(newValue);
      if (result.shareUrl) {
        setShareUrl(result.shareUrl);
      }
    } catch (error) {
      console.error("Failed to toggle sharing:", error);
    } finally {
      setToggling(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleSendEmail = async () => {
    if (!document || !recipientEmail) return;

    const token = getAuthToken();
    if (!token) {
      setEmailError("Please sign in to send emails");
      return;
    }

    setSending(true);
    setEmailError(null);

    try {
      const response = await fetch(`/api/gamma/documents/${document.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientEmail,
          recipientName: recipientName || undefined,
          message: emailMessage || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      setEmailSent(true);
      setTimeout(() => {
        setEmailSent(false);
        setRecipientEmail("");
        setRecipientName("");
        setEmailMessage("");
        setEmailTab(false);
      }, 2000);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleSocialShare = (platform: "twitter" | "linkedin") => {
    if (!document) return;

    const url = encodeURIComponent(shareUrl || document.gamma_url || "");
    const text = encodeURIComponent(`Check out this ${document.format}: ${document.title}`);

    let shareLink = "";

    if (platform === "twitter") {
      shareLink = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === "linkedin") {
      shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=400");
    }
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            Share &quot;{document.title}&quot; with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Public Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-green-600" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isPublic ? "Public Link" : "Private"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPublic
                    ? "Anyone with the link can view"
                    : "Only you can access this document"}
                </p>
              </div>
            </div>
            <Button
              variant={isPublic ? "default" : "outline"}
              size="sm"
              onClick={handleShareToggle}
              disabled={toggling}
              className={isPublic ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPublic ? (
                "Public"
              ) : (
                "Make Public"
              )}
            </Button>
          </div>

          {/* View Count */}
          {isPublic && document.view_count !== undefined && document.view_count > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Eye className="h-4 w-4" />
              <span>{document.view_count} view{document.view_count !== 1 ? "s" : ""}</span>
            </div>
          )}

          {/* Share Link */}
          {isPublic && shareUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{shareUrl}</span>
                </div>
                <Button
                  onClick={handleCopyLink}
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
            </div>
          )}

          <Separator />

          {/* Social Sharing */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Share on Social Media</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSocialShare("twitter")}
                disabled={!isPublic && !document.gamma_url}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSocialShare("linkedin")}
                disabled={!isPublic && !document.gamma_url}
              >
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>

          <Separator />

          {/* Email Sharing */}
          {emailTab ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Send via Email</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailTab(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="recipient@email.com"
                  type="email"
                  value={recipientEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                />
                <Input
                  placeholder="Recipient name (optional)"
                  value={recipientName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientName(e.target.value)}
                />
                <textarea
                  placeholder="Add a personal message (optional)"
                  value={emailMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmailMessage(e.target.value)}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}

              {emailSent && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Email sent successfully!
                </div>
              )}

              <Button
                onClick={handleSendEmail}
                disabled={!recipientEmail || sending}
                className="w-full"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEmailTab(true)}
            >
              <Mail className="h-4 w-4 mr-2" />
              Share via Email
            </Button>
          )}

          {/* Open in Gamma */}
          {document.gamma_url && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(document.gamma_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Gamma
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDocumentModal;
