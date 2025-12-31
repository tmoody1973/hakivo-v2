'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  ChevronRight,
  FileText,
  Presentation,
  Globe,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Wand2,
  Eye,
  Loader2,
  Library,
  Plus,
} from 'lucide-react';

// Import template presets
import {
  TEMPLATE_PRESETS,
  CATEGORY_LABELS,
  type TemplatePreset,
  type ImageSource,
} from '@/lib/gamma/templates';

// Image source options for user selection
const IMAGE_SOURCE_OPTIONS: { value: ImageSource; label: string; description: string }[] = [
  { value: 'unsplash', label: 'Stock Photos', description: 'High-quality photos from Unsplash' },
  { value: 'aiGenerated', label: 'AI Generated', description: 'Custom images created by AI' },
  { value: 'webFreeToUse', label: 'Web Images', description: 'Free-to-use images from the web' },
  { value: 'pictographic', label: 'Icons & Graphics', description: 'Clean pictographic illustrations' },
  { value: 'noImages', label: 'No Images', description: 'Text-only document' },
];

// Import studio components
import {
  DataSourceSelector,
  EnrichmentOptionsPanel,
  ContentPreview,
  GenerationProgress,
  StudioLibrary,
  getDefaultEnrichmentOptions,
  detectSubjectType,
  type DataSource,
  type EnrichmentOptions,
  type SubjectType,
} from '@/components/studio';

// Import generation hook
import { useReportGenerator, type GammaOptions } from '@/hooks/useReportGenerator';

type StudioView = 'library' | 'create';
type StudioStep = 'template' | 'data' | 'enrich' | 'preview';

const STEPS: { id: StudioStep; label: string; description: string }[] = [
  { id: 'template', label: 'Choose Template', description: 'Select a document format' },
  { id: 'data', label: 'Select Data', description: 'Pick your content source' },
  { id: 'enrich', label: 'Enrich Content', description: 'Add context from data sources' },
  { id: 'preview', label: 'Preview & Generate', description: 'Review and create' },
];

export default function StudioContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [view, setView] = useState<StudioView>('library');
  const [currentStep, setCurrentStep] = useState<StudioStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [subjectType, setSubjectType] = useState<SubjectType>('general');
  const [enrichmentOptions, setEnrichmentOptions] = useState<EnrichmentOptions>(
    getDefaultEnrichmentOptions('general')
  );
  const [showPreview, setShowPreview] = useState(false);
  const [selectedImageSource, setSelectedImageSource] = useState<ImageSource>('unsplash');

  // Report generation hook
  const {
    state: generationState,
    enrichContent,
    generate,
    saveExports,
    cancel,
    reset,
    isLoading: isGenerating,
    isCompleted,
  } = useReportGenerator();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, authLoading, router]);

  // Preview enriched content
  const handlePreviewEnrichment = useCallback(async () => {
    if (!selectedDataSource) return;
    setShowPreview(true);
    await enrichContent(selectedDataSource, enrichmentOptions);
  }, [selectedDataSource, enrichmentOptions, enrichContent]);

  // Generate document
  const handleGenerate = useCallback(async () => {
    if (!selectedDataSource || !selectedTemplate) return;

    const template = TEMPLATE_PRESETS[selectedTemplate];
    const gammaOptions: GammaOptions = {
      format: template.defaults.format,
      textMode: 'generate', // Default text generation mode
      numCards: template.defaults.cardCount,
      textOptions: {
        amount: template.defaults.textAmount,
        tone: template.defaults.tone,
        audience: template.defaults.audience,
      },
      imageOptions: {
        // Use pictographic source with Gemini model for best results
        source: 'pictographic',
        model: 'gemini-2.5-flash-image',
      },
      // Request PDF export by default
      exportAs: 'pdf',
    };

    await generate(
      selectedDataSource,
      enrichmentOptions,
      gammaOptions,
      selectedDataSource.title
    );
    // Note: Export URLs are saved by the background function
    // Downloads will work once the generation completes and exports are available
  }, [selectedDataSource, selectedTemplate, enrichmentOptions, generate, selectedImageSource]);

  // Open document in Gamma
  const handleViewDocument = useCallback(() => {
    if (generationState.generationResult?.url) {
      window.open(generationState.generationResult.url, '_blank');
    }
  }, [generationState.generationResult]);

  // Force download a file from URL
  const forceDownload = useCallback(async (url: string, filename: string) => {
    console.log('[Studio] Starting download:', { url, filename });
    try {
      // Use download proxy to avoid CORS issues
      const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      console.log('[Studio] Using download proxy:', proxyUrl);

      const response = await fetch(proxyUrl);
      console.log('[Studio] Proxy response status:', response.status);

      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('[Studio] Blob created, size:', blob.size);

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      console.log('[Studio] Download triggered successfully');
    } catch (error) {
      console.error('[Studio] Download failed:', error);
      // Fallback to opening in new tab
      console.log('[Studio] Falling back to opening in new tab');
      window.open(url, '_blank');
    }
  }, []);

  // Download export
  const handleDownload = useCallback(async (format: 'pdf' | 'pptx') => {
    const exports = generationState.generationResult?.exports;
    let url = format === 'pdf' ? exports?.pdf : exports?.pptx;
    const title = generationState.generationResult?.title || 'document';
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;
    let gammaUrl = generationState.generationResult?.url;

    // If URL is available, download it
    if (url) {
      await forceDownload(url, filename);
      return;
    }

    // If no URL but we have a generationId, try to fetch/save exports
    // IMPORTANT: The save API expects the Gamma generation ID, not Hakivo's document ID
    const generationId = generationState.generationResult?.generationId;
    if (generationId) {
      console.log(`[Studio] No ${format} URL available, checking exports with generationId: ${generationId}`);
      const result = await saveExports(generationId, [format]);

      if (result) {
        // Update gammaUrl if we got one from the API
        if (result.gammaUrl) {
          gammaUrl = result.gammaUrl;
        }

        // Check if we got the export
        url = format === 'pdf' ? result.exports?.pdf : result.exports?.pptx;
        if (url) {
          await forceDownload(url, filename);
          return;
        }

        // Handle exports_pending status
        if (result.status === 'exports_pending') {
          const retryMinutes = result.retryAfter ? Math.ceil(result.retryAfter / 60) : 1;
          const openGamma = window.confirm(
            `${format.toUpperCase()} export is still being prepared by Gamma.\n\n` +
            `This usually takes 1-2 minutes after document creation.\n\n` +
            `You can:\n` +
            `• Click OK to open in Gamma and export manually\n` +
            `• Click Cancel and try again in ${retryMinutes} minute(s)`
          );
          if (openGamma && gammaUrl) {
            window.open(gammaUrl, '_blank');
          }
          return;
        }

        // Handle other non-success cases with message
        if (!result.success && result.message) {
          console.log(`[Studio] Export not ready: ${result.message}`);
        }
      }
    }

    // If still no URL, offer Gamma fallback
    console.log(`[Studio] ${format.toUpperCase()} export not available, offering Gamma fallback`);
    if (gammaUrl) {
      const openGamma = window.confirm(
        `${format.toUpperCase()} export is not available yet.\n\n` +
        `Would you like to open it in Gamma where you can export manually?`
      );
      if (openGamma) {
        window.open(gammaUrl, '_blank');
      }
    } else {
      alert(`${format.toUpperCase()} export is not available. The document may need to be regenerated.`);
    }
  }, [generationState.generationResult, saveExports, forceDownload]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'presentation':
        return Presentation;
      case 'document':
        return FileText;
      case 'webpage':
        return Globe;
      default:
        return FileText;
    }
  };

  // Filter templates by category
  const filteredTemplates = Object.values(TEMPLATE_PRESETS).filter(
    (t) => !categoryFilter || t.category === categoryFilter
  );

  // Get unique categories
  const categories = [...new Set(Object.values(TEMPLATE_PRESETS).map((t) => t.category))];

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    // Set default image source from template
    const template = TEMPLATE_PRESETS[templateId];
    if (template?.defaults.imageSource) {
      setSelectedImageSource(template.defaults.imageSource);
    }
  };

  // Update subject type and enrichment defaults when data source changes
  const handleDataSourceSelect = (source: DataSource | null) => {
    setSelectedDataSource(source);
    if (source) {
      const detected = detectSubjectType(source);
      setSubjectType(detected);
      setEnrichmentOptions(getDefaultEnrichmentOptions(detected));
    }
  };

  // Switch to create mode
  const handleCreateNew = useCallback(() => {
    setView('create');
    setCurrentStep('template');
    setSelectedTemplate(null);
    setSelectedDataSource(null);
    setShowPreview(false);
    reset();
  }, [reset]);

  // Switch back to library
  const handleBackToLibrary = useCallback(() => {
    setView('library');
    setCurrentStep('template');
    setSelectedTemplate(null);
    setSelectedDataSource(null);
    setShowPreview(false);
    reset();
  }, [reset]);

  const handleNext = () => {
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('data');
    } else if (currentStep === 'data' && selectedDataSource) {
      setCurrentStep('enrich');
    } else if (currentStep === 'enrich') {
      setCurrentStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'data') {
      setCurrentStep('template');
    } else if (currentStep === 'enrich') {
      setCurrentStep('data');
    } else if (currentStep === 'preview') {
      setCurrentStep('enrich');
      reset(); // Reset generation state when going back
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hakivo Studio</h1>
                <p className="text-sm text-muted-foreground">
                  {view === 'library'
                    ? 'Your generated documents'
                    : 'Create professional documents from your legislative data'}
                </p>
              </div>
            </div>
            {/* View Toggle */}
            <div className="flex gap-2">
              <Button
                variant={view === 'library' ? 'default' : 'outline'}
                size="sm"
                onClick={handleBackToLibrary}
                className="gap-2"
              >
                <Library className="h-4 w-4" />
                <span className="hidden sm:inline">Library</span>
              </Button>
              <Button
                variant={view === 'create' ? 'default' : 'outline'}
                size="sm"
                onClick={handleCreateNew}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            </div>
          </div>

          {/* Step Indicator - only show in create mode */}
          {view === 'create' && (
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      currentStep === step.id
                        ? 'bg-primary text-primary-foreground'
                        : index < currentStepIndex
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index < currentStepIndex ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Library View */}
        {view === 'library' && (
          <StudioLibrary
            onCreateNew={handleCreateNew}
          />
        )}

        {/* Step 1: Template Selection */}
        {view === 'create' && currentStep === 'template' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Choose a Template</h2>
              <p className="text-muted-foreground">
                Select the type of document you want to create
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={categoryFilter === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(null)}
              >
                All Templates
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={categoryFilter === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(category)}
                >
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </Button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => {
                const FormatIcon = getFormatIcon(template.defaults.format);
                const isSelected = selectedTemplate === template.id;

                return (
                  <Card
                    key={template.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      isSelected && 'ring-2 ring-primary border-primary'
                    )}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{template.icon}</span>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <div className="flex items-center gap-1.5 mt-1">
                              <FormatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground capitalize">
                                {template.defaults.format}
                              </span>
                              {template.defaults.cardCount && (
                                <span className="text-xs text-muted-foreground">
                                  {' '}
                                  &bull; {template.defaults.cardCount} slides
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm mb-3">
                        {template.description}
                      </CardDescription>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_LABELS[template.category as keyof typeof CATEGORY_LABELS]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.defaults.audience}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Data Selection */}
        {view === 'create' && currentStep === 'data' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Your Data Source</h2>
              <p className="text-muted-foreground">
                Choose what content to include in your{' '}
                {selectedTemplate && TEMPLATE_PRESETS[selectedTemplate]?.name}
              </p>
            </div>

            <DataSourceSelector
              selectedSource={selectedDataSource}
              onSelect={handleDataSourceSelect}
            />

            {/* Selected source preview */}
            {selectedDataSource && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Selected: {selectedDataSource.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {selectedDataSource.content}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Enrich Content */}
        {view === 'create' && currentStep === 'enrich' && selectedDataSource && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Enrich Your Content</h2>
              <p className="text-muted-foreground">
                Add real-time data and context to make your{' '}
                {selectedTemplate && TEMPLATE_PRESETS[selectedTemplate]?.name} more comprehensive
              </p>
            </div>

            {/* Show what's being enriched */}
            <Card className="border-muted bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Enriching:</span>
                  <span className="font-medium">{selectedDataSource.title}</span>
                  <Badge variant="outline" className="text-xs capitalize ml-auto">
                    {subjectType}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <EnrichmentOptionsPanel
              options={enrichmentOptions}
              onChange={setEnrichmentOptions}
              subjectType={subjectType}
            />
          </div>
        )}

        {/* Step 4: Preview & Generate */}
        {view === 'create' && currentStep === 'preview' && selectedDataSource && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Preview & Generate</h2>
                <p className="text-muted-foreground">
                  Review your enriched content and generate your document
                </p>
              </div>
              {!isGenerating && !isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewEnrichment}
                  disabled={generationState.phase === 'enriching'}
                  className="gap-2"
                >
                  {generationState.phase === 'enriching' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Preview Enrichment
                </Button>
              )}
            </div>

            {/* Summary of selections */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">
                    {selectedTemplate && TEMPLATE_PRESETS[selectedTemplate]?.name}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Data Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium truncate">
                    {selectedDataSource?.title}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground font-normal">Enrichments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">
                    {[
                      enrichmentOptions.includeNewsContext && 'News',
                      enrichmentOptions.includeRelatedBills && 'Related Bills',
                      enrichmentOptions.includeCampaignFinance && 'Finance',
                      enrichmentOptions.includeBillDetails && 'Details',
                      enrichmentOptions.includeVotingRecords && 'Votes',
                    ].filter(Boolean).join(', ') || 'None'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Image Source Selector */}
            {!isGenerating && !isCompleted && generationState.phase !== 'failed' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Image Style</CardTitle>
                  <CardDescription>Choose how images will appear in your document</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {IMAGE_SOURCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedImageSource(option.value)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all hover:border-primary/50',
                          selectedImageSource === option.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-muted hover:bg-muted/50'
                        )}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generation Progress (shown when generating) */}
            {(isGenerating || isCompleted || generationState.phase === 'failed') && (
              <GenerationProgress
                state={generationState}
                result={generationState.generationResult}
                onCancel={cancel}
                onRetry={handleGenerate}
                onViewDocument={handleViewDocument}
                onDownload={handleDownload}
              />
            )}

            {/* Content Preview (shown when not generating) */}
            {!isGenerating && !isCompleted && generationState.phase !== 'failed' && (
              <>
                {showPreview || generationState.enrichmentResult ? (
                  <ContentPreview
                    dataSource={selectedDataSource}
                    enrichmentOptions={enrichmentOptions}
                    enrichmentResult={generationState.enrichmentResult}
                    isLoading={generationState.phase === 'enriching'}
                    error={generationState.error}
                    onRefresh={handlePreviewEnrichment}
                  />
                ) : (
                  <Card className="p-8 text-center">
                    <div className="text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Ready to Generate</p>
                      <p className="text-sm mb-4">
                        Your content will be enriched with{' '}
                        {[
                          enrichmentOptions.includeNewsContext && 'recent news from Perplexity',
                          enrichmentOptions.includeRelatedBills && 'related bills',
                          enrichmentOptions.includeCampaignFinance && 'campaign finance data',
                        ].filter(Boolean).join(', ') || 'your selected data'}.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click &quot;Preview Enrichment&quot; to see the data or &quot;Generate Document&quot; to create your{' '}
                        {selectedTemplate && TEMPLATE_PRESETS[selectedTemplate]?.defaults.format}.
                      </p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Navigation Buttons - only show in create mode */}
        {view === 'create' && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 'template' ? handleBackToLibrary : handleBack}
              disabled={isGenerating}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 'template' ? 'Library' : 'Back'}
            </Button>

            {currentStep === 'preview' ? (
              <div className="flex items-center gap-2">
                {isCompleted && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      reset();
                      setCurrentStep('template');
                      setSelectedTemplate(null);
                      setSelectedDataSource(null);
                      setShowPreview(false);
                    }}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Create Another
                  </Button>
                )}
                {!isCompleted && (
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate Document
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === 'template' && !selectedTemplate) ||
                  (currentStep === 'data' && !selectedDataSource)
                }
                className="gap-2"
              >
                {currentStep === 'enrich' ? (
                  <>
                    Preview Document
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
