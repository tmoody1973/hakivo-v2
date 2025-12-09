"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Presentation,
  Scale,
  UserCheck,
  Vote,
  BookOpen,
  GraduationCap,
  Megaphone,
  Newspaper,
  MapPin,
  Calendar,
  GitCompare,
  BarChart3,
} from "lucide-react";

// Template definitions with metadata
const TEMPLATES = {
  reports: [
    {
      id: "bill_analysis",
      label: "Bill Analysis",
      icon: Scale,
      description: "Comprehensive analysis of a specific bill",
    },
    {
      id: "rep_scorecard",
      label: "Rep Scorecard",
      icon: UserCheck,
      description: "Voting record and performance of a representative",
    },
    {
      id: "vote_breakdown",
      label: "Vote Breakdown",
      icon: Vote,
      description: "Detailed analysis of a specific vote",
    },
    {
      id: "policy_brief",
      label: "Policy Brief",
      icon: BookOpen,
      description: "Summary of a policy area or issue",
    },
    {
      id: "news_brief",
      label: "News Brief",
      icon: Newspaper,
      description: "Summary of recent congressional news",
    },
    {
      id: "district_briefing",
      label: "District Briefing",
      icon: MapPin,
      description: "Overview of a congressional district",
    },
    {
      id: "week_in_congress",
      label: "Week in Congress",
      icon: Calendar,
      description: "Weekly summary of congressional activity",
    },
    {
      id: "bill_comparison",
      label: "Bill Comparison",
      icon: GitCompare,
      description: "Side-by-side comparison of similar bills",
    },
    {
      id: "voting_analysis",
      label: "Voting Analysis",
      icon: BarChart3,
      description: "Analysis of voting patterns and trends",
    },
  ],
  slides: [
    {
      id: "lesson_deck",
      label: "Lesson Deck",
      icon: GraduationCap,
      description: "Educational slides about a topic",
    },
    {
      id: "advocacy_deck",
      label: "Advocacy Deck",
      icon: Megaphone,
      description: "Persuasive slides for advocacy purposes",
    },
  ],
};

// Audience options
const AUDIENCES = [
  { id: "general", label: "General Public", description: "Accessible to everyone" },
  { id: "journalist", label: "Journalist", description: "For media professionals" },
  { id: "educator", label: "Educator", description: "For teachers and professors" },
  { id: "student", label: "Student", description: "For learners and researchers" },
  { id: "advocate", label: "Advocate", description: "For policy advocates and activists" },
  { id: "staffer", label: "Congressional Staffer", description: "For Hill staff" },
];

interface ArtifactTriggerProps {
  className?: string;
  onSelect?: (message: string) => void;
}

interface LimitStatus {
  allowed: boolean;
  isPro: boolean;
  reason: string | null;
  currentCount?: number;
  limit?: number;
}

export function ArtifactTrigger({ className, onSelect }: ArtifactTriggerProps) {
  const { accessToken } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(false);

  // Check artifact limit when dropdown opens
  useEffect(() => {
    if (isOpen && accessToken) {
      checkArtifactLimit();
    }
  }, [isOpen, accessToken]);

  const checkArtifactLimit = async () => {
    if (!accessToken) return;

    setCheckingLimit(true);
    try {
      const response = await fetch('/api/subscription/check-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'generate_artifact' }),
      });

      if (response.ok) {
        const data = await response.json();
        setLimitStatus(data);
      }
    } catch (error) {
      console.error('Error checking artifact limit:', error);
    } finally {
      setCheckingLimit(false);
    }
  };

  // Get template info by id
  const getTemplateInfo = (templateId: string) => {
    const allTemplates = [...TEMPLATES.reports, ...TEMPLATES.slides];
    return allTemplates.find((t) => t.id === templateId);
  };

  // Handle template selection - show audience picker
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  // Handle final selection with audience
  const handleAudienceSelect = (audienceId: string) => {
    if (!selectedTemplate) return;

    const template = getTemplateInfo(selectedTemplate);
    const audience = AUDIENCES.find((a) => a.id === audienceId);

    if (!template || !audience) return;

    // Determine artifact type based on template
    const artifactType = TEMPLATES.slides.some((t) => t.id === selectedTemplate)
      ? "slides"
      : "report";

    // Create the structured request message
    const messageContent = `Create a ${template.label} ${artifactType === "slides" ? "presentation" : "document"} for a ${audience.label.toLowerCase()} audience.

[ARTIFACT_REQUEST]
type: ${artifactType}
template: ${selectedTemplate}
audience: ${audienceId}
[/ARTIFACT_REQUEST]`;

    // Call onSelect callback with the message content
    if (onSelect) {
      onSelect(messageContent);
    }

    // Reset state and close menu
    setSelectedTemplate(null);
    setIsOpen(false);
  };

  // Handle going back to template selection
  const handleBack = () => {
    setSelectedTemplate(null);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={className}
          title="Create Document or Presentation"
        >
          <FileText className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Loading state */}
        {checkingLimit && (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Checking limits...</p>
          </div>
        )}

        {/* Limit reached - show upgrade prompt */}
        {!checkingLimit && limitStatus && !limitStatus.allowed && (
          <div className="p-4">
            <div className="text-center mb-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="font-semibold">Document Limit Reached</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {limitStatus.reason || `You've used ${limitStatus.currentCount || 0} of ${limitStatus.limit || 3} free documents this month.`}
              </p>
            </div>
            <Link
              href="/pricing"
              className="block w-full text-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
              onClick={() => setIsOpen(false)}
            >
              Upgrade to Pro
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Unlimited documents, audio digests & more
            </p>
          </div>
        )}

        {/* Normal flow - template/audience selection */}
        {!checkingLimit && (!limitStatus || limitStatus.allowed) && selectedTemplate ? (
          // Audience selection view
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleBack}
              >
                ←
              </Button>
              <span>Select Audience</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Creating: {getTemplateInfo(selectedTemplate)?.label}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {AUDIENCES.map((audience) => (
                <DropdownMenuItem
                  key={audience.id}
                  onClick={() => handleAudienceSelect(audience.id)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="font-medium">{audience.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {audience.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : !checkingLimit && (!limitStatus || limitStatus.allowed) ? (
          // Template selection view
          <>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Create Document</span>
              {limitStatus && !limitStatus.isPro && (
                <span className="text-xs text-muted-foreground font-normal">
                  {limitStatus.currentCount || 0}/{limitStatus.limit || 3} used
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Reports */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Reports & Analysis
              </DropdownMenuLabel>
              {TEMPLATES.reports.map((template) => {
                const Icon = template.icon;
                return (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{template.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Slides */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Presentations
              </DropdownMenuLabel>
              {TEMPLATES.slides.map((template) => {
                const Icon = template.icon;
                return (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="flex items-center gap-2"
                  >
                    <Presentation className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{template.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { TEMPLATES, AUDIENCES };
