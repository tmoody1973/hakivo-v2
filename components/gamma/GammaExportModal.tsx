"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  FileText,
  Presentation,
  Globe,
  Download,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { Artifact } from "@/components/artifacts/artifact-viewer";
import {
  TEMPLATE_PRESETS,
  type GammaFormat,
  type TextAmount,
  type TemplatePreset,
} from "@/lib/gamma/templates";

// Local type for preset keys
type TemplatePresetKey = keyof typeof TEMPLATE_PRESETS;

interface GammaExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: Artifact;
  onSuccess?: (result: GammaGenerationResult) => void;
}

interface GammaGenerationResult {
  documentId: string;
  generationId: string;
  status: string;
  url?: string;
  exports?: {
    pdf?: string;
    pptx?: string;
  };
}

interface GammaTheme {
  id: string;
  name: string;
  previewUrl?: string;
  category?: string;
}

type GenerationStatus = "idle" | "generating" | "polling" | "saving" | "completed" | "error";

export function GammaExportModal({
  isOpen,
  onClose,
  artifact,
  onSuccess,
}: GammaExportModalProps) {
  // Form state
  const [selectedPreset, setSelectedPreset] = useState<TemplatePresetKey | "custom">("policy_brief");
  const [format, setFormat] = useState<GammaFormat>("presentation");
  const [textAmount, setTextAmount] = useState<TextAmount>("medium");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [title, setTitle] = useState("");
  const [exportPdf, setExportPdf] = useState(true);
  const [exportPptx, setExportPptx] = useState(false);

  // Themes state
  const [themes, setThemes] = useState<GammaTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [loadingThemes, setLoadingThemes] = useState(false);

  // Generation state
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GammaGenerationResult | null>(null);

  // Initialize form with artifact data
  useEffect(() => {
    if (isOpen && artifact) {
      setTitle(artifact.title || "Untitled Document");
      // Try to match artifact template to preset
      const matchedPreset = Object.keys(TEMPLATE_PRESETS).find(
        (key) => artifact.template?.includes(key)
      ) as TemplatePresetKey | undefined;

      if (matchedPreset) {
        setSelectedPreset(matchedPreset);
        applyPreset(matchedPreset);
      }
    }
  }, [isOpen, artifact]);

  // Load themes on mount
  useEffect(() => {
    if (isOpen && themes.length === 0) {
      loadThemes();
    }
  }, [isOpen]);

  const loadThemes = async () => {
    setLoadingThemes(true);
    try {
      const response = await fetch("/api/gamma/themes");
      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
      }
    } catch (err) {
      console.error("Failed to load themes:", err);
    } finally {
      setLoadingThemes(false);
    }
  };

  const applyPreset = (preset: TemplatePresetKey) => {
    const config = TEMPLATE_PRESETS[preset];
    setFormat(config.defaults.format);
    setTextAmount(config.defaults.textAmount);
    setAudience(config.defaults.audience);
    setTone(config.defaults.tone);
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value as TemplatePresetKey | "custom");
    if (value !== "custom" && value in TEMPLATE_PRESETS) {
      applyPreset(value as TemplatePresetKey);
    }
  };

  const getAuthToken = useCallback(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hakivo_access_token");
    }
    return null;
  }, []);

  const handleGenerate = async () => {
    setStatus("generating");
    setProgress(10);
    setError(null);

    const token = getAuthToken();
    if (!token) {
      setError("Please sign in to generate documents");
      setStatus("error");
      return;
    }

    try {
      // Step 1: Start generation
      const generateResponse = await fetch("/api/gamma/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inputText: artifact.content,
          textMode: "generate",
          format,
          title,
          template: selectedPreset !== "custom" ? selectedPreset : undefined,
          themeId: selectedTheme || undefined,
          textOptions: {
            amount: textAmount,
            audience,
            tone,
          },
          exportAs: exportPdf ? "pdf" : exportPptx ? "pptx" : undefined,
          artifactId: artifact.id,
          subjectType: artifact.subjectType,
          subjectId: artifact.subjectId,
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || "Failed to start generation");
      }

      const generateData = await generateResponse.json();
      setProgress(30);
      setStatus("polling");

      // Step 2: Poll for completion
      const generationId = generateData.generationId;
      const documentId = generateData.documentId;
      let pollCount = 0;
      const maxPolls = 60; // 2 minutes with 2s intervals

      while (pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        pollCount++;

        const statusResponse = await fetch(`/api/gamma/status/${generationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error("Failed to check generation status");
        }

        const statusData = await statusResponse.json();
        setProgress(30 + Math.min((pollCount / maxPolls) * 50, 50));

        if (statusData.status === "completed") {
          setProgress(80);
          setStatus("saving");

          // Step 3: Save exports
          const exportFormats: string[] = [];
          if (exportPdf) exportFormats.push("pdf");
          if (exportPptx && format === "presentation") exportFormats.push("pptx");

          if (exportFormats.length > 0) {
            const saveResponse = await fetch(`/api/gamma/save/${documentId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ exportFormats }),
            });

            if (saveResponse.ok) {
              const saveData = await saveResponse.json();
              statusData.exports = saveData.exports;
            }
          }

          setProgress(100);
          setStatus("completed");
          setResult({
            documentId,
            generationId,
            status: "completed",
            url: statusData.url,
            exports: statusData.exports,
          });

          onSuccess?.({
            documentId,
            generationId,
            status: "completed",
            url: statusData.url,
            exports: statusData.exports,
          });

          return;
        }

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "Generation failed");
        }
      }

      throw new Error("Generation timed out");
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  };

  const handleClose = () => {
    if (status === "generating" || status === "polling" || status === "saving") {
      // Don't allow closing during generation
      return;
    }
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
    onClose();
  };

  const FormatIcon = {
    presentation: Presentation,
    document: FileText,
    webpage: Globe,
  }[format];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Professional Document
          </DialogTitle>
          <DialogDescription>
            Transform your artifact into a polished, downloadable document with Gamma.
          </DialogDescription>
        </DialogHeader>

        {status === "completed" && result ? (
          // Success state
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Document Created!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your professional document is ready.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {result.url && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(result.url, "_blank")}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  View in Gamma
                </Button>
              )}
              {result.exports?.pdf && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(result.exports?.pdf, "_blank")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              {result.exports?.pptx && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(result.exports?.pptx, "_blank")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PowerPoint
                </Button>
              )}
            </div>
          </div>
        ) : status !== "idle" ? (
          // Generating state
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">
                {status === "generating" && "Starting generation..."}
                {status === "polling" && "Creating your document..."}
                {status === "saving" && "Saving exports..."}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a minute or two.
              </p>
            </div>
            <Progress value={progress} className="w-full" />
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        ) : (
          // Form state
          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>

            {/* Template Preset */}
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TEMPLATE_PRESETS) as [string, TemplatePreset][]).map(
                  ([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handlePresetChange(key)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedPreset === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{preset.icon}</span>
                        <span className="font-medium text-sm">{preset.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preset.description}
                      </p>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label>Output Format</Label>
              <div className="flex gap-2">
                {(["presentation", "document", "webpage"] as GammaFormat[]).map((f) => {
                  const Icon = {
                    presentation: Presentation,
                    document: FileText,
                    webpage: Globe,
                  }[f];
                  return (
                    <Button
                      key={f}
                      variant={format === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormat(f)}
                      className="flex-1"
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g., High school civics teachers"
              />
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label htmlFor="tone">Tone & Style</Label>
              <Input
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g., Educational and engaging"
              />
            </div>

            {/* Detail Level */}
            <div className="space-y-2">
              <Label>Detail Level</Label>
              <Select value={textAmount} onValueChange={(v) => setTextAmount(v as TextAmount)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief - Key points only</SelectItem>
                  <SelectItem value="medium">Medium - Balanced coverage</SelectItem>
                  <SelectItem value="detailed">Detailed - In-depth analysis</SelectItem>
                  <SelectItem value="extensive">Extensive - Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Options */}
            <div className="space-y-2">
              <Label>Export Files</Label>
              <div className="flex gap-2">
                <Button
                  variant={exportPdf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExportPdf(!exportPdf)}
                >
                  {exportPdf && <Check className="h-3 w-3 mr-1" />}
                  PDF
                </Button>
                {format === "presentation" && (
                  <Button
                    variant={exportPptx ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportPptx(!exportPptx)}
                  >
                    {exportPptx && <Check className="h-3 w-3 mr-1" />}
                    PowerPoint
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {status === "completed" ? (
            <Button onClick={handleClose}>Done</Button>
          ) : status !== "idle" ? (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!title.trim()}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Document
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
