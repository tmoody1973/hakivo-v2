"use client";

import { Twitter, Facebook, Linkedin, Share2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// WhatsApp icon since lucide doesn't have it
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// Generate share URLs for each platform
function getTwitterUrl(params: { url: string; text?: string; hashtags?: string[] }) {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("url", params.url);
  if (params.text) url.searchParams.set("text", params.text);
  if (params.hashtags?.length) url.searchParams.set("hashtags", params.hashtags.join(","));
  return url.toString();
}

function getFacebookUrl(params: { url: string }) {
  const url = new URL("https://www.facebook.com/sharer/sharer.php");
  url.searchParams.set("u", params.url);
  return url.toString();
}

function getLinkedinUrl(params: { url: string }) {
  const url = new URL("https://www.linkedin.com/sharing/share-offsite/");
  url.searchParams.set("url", params.url);
  return url.toString();
}

function getWhatsAppUrl(params: { url: string; text?: string }) {
  const url = new URL("https://api.whatsapp.com/send");
  const message = params.text ? `${params.text}${params.url}` : params.url;
  url.searchParams.set("text", message);
  return url.toString();
}

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  hashtags?: string[];
  className?: string;
  variant?: "inline" | "dropdown";
  size?: "sm" | "default" | "lg";
}

export function ShareButtons({
  url,
  title,
  description,
  hashtags = ["Hakivo", "Congress"],
  className,
  variant = "dropdown",
  size = "default",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [url]);

  const shareLinks = {
    twitter: getTwitterUrl({
      url,
      text: title,
      hashtags: hashtags,
    }),
    facebook: getFacebookUrl({ url }),
    linkedin: getLinkedinUrl({ url }),
    whatsapp: getWhatsAppUrl({
      url,
      text: `${title}\n\n`,
    }),
  };

  const buttonSize = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonSize,
            "inline-flex items-center justify-center rounded-full bg-[#1DA1F2] text-white hover:bg-[#1a8cd8] transition-colors"
          )}
          title="Share on X (Twitter)"
        >
          <Twitter className={iconSize} />
        </a>
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonSize,
            "inline-flex items-center justify-center rounded-full bg-[#1877F2] text-white hover:bg-[#166fe5] transition-colors"
          )}
          title="Share on Facebook"
        >
          <Facebook className={iconSize} />
        </a>
        <a
          href={shareLinks.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonSize,
            "inline-flex items-center justify-center rounded-full bg-[#0A66C2] text-white hover:bg-[#095196] transition-colors"
          )}
          title="Share on LinkedIn"
        >
          <Linkedin className={iconSize} />
        </a>
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonSize,
            "inline-flex items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#22c55e] transition-colors"
          )}
          title="Share on WhatsApp"
        >
          <WhatsAppIcon className={iconSize} />
        </a>
        <button
          onClick={copyToClipboard}
          className={cn(
            buttonSize,
            "inline-flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          )}
          title="Copy link"
        >
          {copied ? (
            <Check className={cn(iconSize, "text-green-500")} />
          ) : (
            <Link2 className={iconSize} />
          )}
        </button>
      </div>
    );
  }

  // Dropdown variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
          className={cn("gap-2", className)}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a
            href={shareLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-[#1DA1F2] flex items-center justify-center">
              <Twitter className="h-4 w-4 text-white" />
            </div>
            <span>Share on X (Twitter)</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={shareLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-[#1877F2] flex items-center justify-center">
              <Facebook className="h-4 w-4 text-white" />
            </div>
            <span>Share on Facebook</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={shareLinks.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-[#0A66C2] flex items-center justify-center">
              <Linkedin className="h-4 w-4 text-white" />
            </div>
            <span>Share on LinkedIn</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={shareLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center">
              <WhatsAppIcon className="h-4 w-4 text-white" />
            </div>
            <span>Share on WhatsApp</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard} className="flex items-center gap-3 cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </div>
          <span>{copied ? "Link copied!" : "Copy link"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
