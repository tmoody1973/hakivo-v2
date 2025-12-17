"use client";

import { useState, useCallback } from "react";
import { C1Artifact } from "@/components/c1";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Presentation,
  Download,
  Copy,
  Share2,
  Pencil,
  Check,
  X,
  Loader2,
  MoreVertical,
  ExternalLink,
  FileDown,
  Sparkles,
} from "lucide-react";
import { GammaExportModal } from "@/components/gamma";

// Artifact type from the database
export interface Artifact {
  id: string;
  type: "report" | "slides";
  template: string;
  title: string;
  content: string;
  subjectType?: string;
  subjectId?: string;
  audience?: string;
  isPublic?: boolean;
  shareToken?: string;
  createdAt?: string;
  viewCount?: number;
}

interface ArtifactViewerProps {
  /** The artifact to display */
  artifact: Artifact;
  /** Whether the artifact is currently being generated (streaming) */
  isStreaming?: boolean;
  /** Callback when edit is requested */
  onEdit?: (artifactId: string, instructions: string) => Promise<void>;
  /** Callback when share status changes */
  onShare?: (artifactId: string, isPublic: boolean) => Promise<string | null>;
  /** Callback when artifact is deleted */
  onDelete?: (artifactId: string) => void;
  /** Callback when content is updated (during streaming or edit) */
  onContentUpdate?: (content: string) => void;
  /** Whether to show the header with title/metadata */
  showHeader?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Whether viewer is in read-only mode (e.g., public share page) */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ArtifactViewer - Full-featured viewer for C1 artifacts
 *
 * Renders artifacts with:
 * - C1Component for interactive content
 * - Streaming indicator during generation
 * - Action bar (Edit, Export, Copy, Share)
 * - Edit mode with instruction input
 */
export function ArtifactViewer({
  artifact,
  isStreaming = false,
  onEdit,
  onShare,
  onDelete,
  onContentUpdate,
  showHeader = true,
  showActions = true,
  readOnly = false,
  className,
}: ArtifactViewerProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isGammaModalOpen, setIsGammaModalOpen] = useState(false);

  // Get icon based on artifact type
  const TypeIcon = artifact.type === "slides" ? Presentation : FileText;

  // Get template display name
  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      bill_analysis: "Bill Analysis",
      rep_scorecard: "Rep Scorecard",
      vote_breakdown: "Vote Breakdown",
      policy_brief: "Policy Brief",
      lesson_deck: "Lesson Deck",
      advocacy_deck: "Advocacy Deck",
      news_brief: "News Brief",
      district_briefing: "District Briefing",
      week_in_congress: "Week in Congress",
      bill_comparison: "Bill Comparison",
      voting_analysis: "Voting Analysis",
    };
    return labels[template] || template;
  };

  // Handle content updates from C1
  const handleContentUpdate = useCallback(
    (content: string) => {
      onContentUpdate?.(content);
    },
    [onContentUpdate]
  );

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    if (!editInstructions.trim() || !onEdit) return;

    setIsEditing(true);
    try {
      await onEdit(artifact.id, editInstructions);
      setIsEditMode(false);
      setEditInstructions("");
    } catch (err) {
      console.error("Edit failed:", err);
    } finally {
      setIsEditing(false);
    }
  };

  // Handle share toggle
  const handleShare = async () => {
    if (!onShare) return;

    setIsSharing(true);
    try {
      const url = await onShare(artifact.id, !artifact.isPublic);
      if (url) {
        setShareUrl(url);
        // Copy share URL to clipboard
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  };

  // Export as PDF
  const handleExportPDF = () => {
    // Will be implemented when PDF export API is ready
    window.open(`/api/artifacts/export?id=${artifact.id}&format=pdf`, "_blank");
  };

  // Export as PPTX (slides only)
  const handleExportPPTX = () => {
    // Will be implemented when PPTX export API is ready
    window.open(`/api/artifacts/export?id=${artifact.id}&format=pptx`, "_blank");
  };

  return (
    <Card className={className}>
      {/* Header with title and metadata */}
      {showHeader && (
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-lg truncate">{artifact.title}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getTemplateLabel(artifact.template)}
              </Badge>
              {artifact.audience && artifact.audience !== "general" && (
                <Badge variant="outline" className="text-xs capitalize">
                  {artifact.audience}
                </Badge>
              )}
              {artifact.isPublic && (
                <Badge variant="default" className="text-xs">
                  Public
                </Badge>
              )}
              {isStreaming && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </Badge>
              )}
            </div>
          </div>

          {/* Action menu */}
          {showActions && !readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => setIsEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopy}>
                  {isCopied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {isCopied ? "Copied!" : "Copy"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsGammaModalOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Professional Document
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
                {artifact.type === "slides" && (
                  <DropdownMenuItem onClick={handleExportPPTX}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PPTX
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onShare && (
                  <DropdownMenuItem onClick={handleShare} disabled={isSharing}>
                    {isSharing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Share2 className="h-4 w-4 mr-2" />
                    )}
                    {artifact.isPublic ? "Make Private" : "Share Link"}
                  </DropdownMenuItem>
                )}
                {shareUrl && (
                  <DropdownMenuItem
                    onClick={() => window.open(shareUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Share Link
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(artifact.id)}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
      )}

      <CardContent className={!showHeader ? "pt-6" : undefined}>
        {/* Edit mode input */}
        {isEditMode && !readOnly && (
          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Describe your changes (e.g., 'Add more detail to section 2')"
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
              disabled={isEditing}
              className="flex-1"
            />
            <Button
              onClick={handleEditSubmit}
              disabled={!editInstructions.trim() || isEditing}
              size="sm"
            >
              {isEditing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditMode(false);
                setEditInstructions("");
              }}
              disabled={isEditing}
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* C1 Artifact content */}
        <div className="min-h-[200px] overflow-auto">
          <C1Artifact
            response={artifact.content}
            isStreaming={isStreaming}
            onUpdate={handleContentUpdate}
            className={artifact.type === "slides" ? "slides-container" : "report-container"}
          />
        </div>

        {/* Read-only branding for public pages */}
        {readOnly && (
          <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
            Created with{" "}
            <a
              href="https://hakivo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Hakivo
            </a>
          </div>
        )}
      </CardContent>

      {/* Gamma Export Modal */}
      {!readOnly && (
        <GammaExportModal
          isOpen={isGammaModalOpen}
          onClose={() => setIsGammaModalOpen(false)}
          artifact={artifact}
          onSuccess={(result) => {
            console.log("Gamma document created:", result);
            setIsGammaModalOpen(false);
          }}
        />
      )}
    </Card>
  );
}
