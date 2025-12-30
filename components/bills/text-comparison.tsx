'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Loader2, GitCompareArrows, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface TextVersion {
  code: string;
  name: string;
  date: string | null;
}

interface DiffChunk {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

interface CompareResult {
  diff: DiffChunk[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
  aiAnalysis: string | null;
  versions: {
    version1: { code: string; name: string };
    version2: { code: string; name: string };
  };
}

interface TextComparisonProps {
  congress: number;
  billType: string;
  billNumber: number;
}

export function TextComparison({ congress, billType, billNumber }: TextComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [versions, setVersions] = useState<TextVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);

  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'inline' | 'side-by-side'>('inline');

  // Fetch available versions when expanded
  useEffect(() => {
    if (isExpanded && versions.length === 0 && !versionsLoading) {
      fetchVersions();
    }
  }, [isExpanded]);

  const fetchVersions = async () => {
    setVersionsLoading(true);
    setVersionsError(null);

    try {
      const response = await fetch(
        `/api/congress/bill-text?congress=${congress}&type=${billType}&number=${billNumber}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch text versions');
      }

      const data = await response.json();
      setVersions(data.versions || []);

      // Auto-select first two versions if available
      if (data.versions?.length >= 2) {
        setSelectedVersion1(data.versions[data.versions.length - 1].code);
        setSelectedVersion2(data.versions[0].code);
      }
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedVersion1 || !selectedVersion2) return;

    setCompareLoading(true);
    setCompareError(null);
    setCompareResult(null);

    try {
      const response = await fetch('/api/congress/bill-text/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          congress,
          type: billType,
          number: billNumber,
          version1: selectedVersion1,
          version2: selectedVersion2
        })
      });

      if (!response.ok) {
        throw new Error('Failed to compare text versions');
      }

      const data = await response.json();
      setCompareResult(data);
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setCompareLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5" />
            <CardTitle className="text-lg">Compare Text Versions</CardTitle>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </div>
        <CardDescription>
          Compare different versions of this bill's text to see what changed
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {versionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading available versions...</span>
            </div>
          ) : versionsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{versionsError}</AlertDescription>
            </Alert>
          ) : versions.length < 2 ? (
            <Alert>
              <AlertDescription>
                {versions.length === 0
                  ? 'No text versions available for this bill yet.'
                  : 'Only one text version is available. Comparison requires at least two versions.'}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Version Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Earlier Version</label>
                  <Select
                    value={selectedVersion1 || undefined}
                    onValueChange={setSelectedVersion1}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version..." />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem
                          key={v.code}
                          value={v.code}
                          disabled={v.code === selectedVersion2}
                        >
                          {v.name} {v.date && `(${formatDate(v.date)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Later Version</label>
                  <Select
                    value={selectedVersion2 || undefined}
                    onValueChange={setSelectedVersion2}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version..." />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem
                          key={v.code}
                          value={v.code}
                          disabled={v.code === selectedVersion1}
                        >
                          {v.name} {v.date && `(${formatDate(v.date)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Compare Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleCompare}
                  disabled={!selectedVersion1 || !selectedVersion2 || compareLoading}
                >
                  {compareLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <GitCompareArrows className="h-4 w-4 mr-2" />
                      Compare Versions
                    </>
                  )}
                </Button>

                {compareResult && (
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'inline' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('inline')}
                    >
                      Inline
                    </Button>
                    <Button
                      variant={viewMode === 'side-by-side' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('side-by-side')}
                    >
                      Side by Side
                    </Button>
                  </div>
                )}
              </div>

              {/* Compare Error */}
              {compareError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{compareError}</AlertDescription>
                </Alert>
              )}

              {/* Compare Results */}
              {compareResult && (
                <div className="space-y-4 mt-4">
                  {/* AI Analysis */}
                  {compareResult.aiAnalysis && (
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-900 dark:text-blue-100">
                          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          AI Analysis of Changes
                        </CardTitle>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {compareResult.versions.version1.name} → {compareResult.versions.version2.name}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none
                            prose-headings:text-blue-900 dark:prose-headings:text-blue-100
                            prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                            prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-relaxed prose-p:my-2
                            prose-strong:text-blue-900 dark:prose-strong:text-blue-100 prose-strong:font-semibold
                            prose-ul:my-2 prose-ul:space-y-1
                            prose-li:text-gray-800 dark:prose-li:text-gray-200 prose-li:marker:text-blue-600 dark:prose-li:marker:text-blue-400
                            [&>*:first-child]:mt-0"
                          role="region"
                          aria-label="AI analysis of legislative changes"
                        >
                          <ReactMarkdown
                            components={{
                              // Custom heading styles with proper hierarchy
                              h1: ({ children }) => (
                                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mt-4 mb-2 first:mt-0">
                                  {children}
                                </h3>
                              ),
                              h2: ({ children }) => (
                                <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 mt-4 mb-2 first:mt-0">
                                  {children}
                                </h4>
                              ),
                              h3: ({ children }) => (
                                <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mt-3 mb-1">
                                  {children}
                                </h5>
                              ),
                              // Properly styled paragraphs
                              p: ({ children }) => (
                                <p className="text-gray-800 dark:text-gray-200 leading-relaxed my-2">
                                  {children}
                                </p>
                              ),
                              // Accessible list styling
                              ul: ({ children }) => (
                                <ul className="space-y-2 my-3 ml-1" role="list">
                                  {children}
                                </ul>
                              ),
                              li: ({ children }) => (
                                <li className="flex gap-2 text-gray-800 dark:text-gray-200">
                                  <span className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" aria-hidden="true">•</span>
                                  <span className="flex-1">{children}</span>
                                </li>
                              ),
                              // Bold text with high contrast
                              strong: ({ children }) => (
                                <strong className="font-semibold text-blue-900 dark:text-blue-100">
                                  {children}
                                </strong>
                              ),
                              // Emphasis styling
                              em: ({ children }) => (
                                <em className="italic text-gray-700 dark:text-gray-300">
                                  {children}
                                </em>
                              ),
                            }}
                          >
                            {compareResult.aiAnalysis}
                          </ReactMarkdown>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Summary Stats */}
                  <div className="flex gap-4 text-sm">
                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                      +{compareResult.summary.added.toLocaleString()} chars added
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
                      -{compareResult.summary.removed.toLocaleString()} chars removed
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      {compareResult.summary.unchanged.toLocaleString()} chars unchanged
                    </Badge>
                  </div>

                  {/* Diff View */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 border-b text-sm font-medium">
                      {compareResult.versions.version1.name} → {compareResult.versions.version2.name}
                    </div>
                    <div className="max-h-[500px] overflow-auto">
                      {viewMode === 'inline' ? (
                        <InlineDiffView diff={compareResult.diff} />
                      ) : (
                        <SideBySideDiffView diff={compareResult.diff} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function InlineDiffView({ diff }: { diff: DiffChunk[] }) {
  return (
    <pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
      {diff.map((chunk, i) => (
        <span
          key={i}
          className={cn(
            chunk.type === 'insert' && 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
            chunk.type === 'delete' && 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through'
          )}
        >
          {chunk.text}
        </span>
      ))}
    </pre>
  );
}

function SideBySideDiffView({ diff }: { diff: DiffChunk[] }) {
  // Split diff into old and new columns
  const oldText: { text: string; type: 'equal' | 'delete' }[] = [];
  const newText: { text: string; type: 'equal' | 'insert' }[] = [];

  diff.forEach((chunk) => {
    if (chunk.type === 'equal') {
      oldText.push({ text: chunk.text, type: 'equal' });
      newText.push({ text: chunk.text, type: 'equal' });
    } else if (chunk.type === 'delete') {
      oldText.push({ text: chunk.text, type: 'delete' });
    } else if (chunk.type === 'insert') {
      newText.push({ text: chunk.text, type: 'insert' });
    }
  });

  return (
    <div className="grid grid-cols-2 divide-x">
      <div className="p-4 overflow-auto bg-red-50/30 dark:bg-red-950/10">
        <div className="text-xs font-semibold text-muted-foreground mb-2">REMOVED</div>
        <pre className="text-sm font-mono whitespace-pre-wrap">
          {oldText.map((chunk, i) => (
            <span
              key={i}
              className={cn(
                chunk.type === 'delete' && 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
              )}
            >
              {chunk.text}
            </span>
          ))}
        </pre>
      </div>
      <div className="p-4 overflow-auto bg-green-50/30 dark:bg-green-950/10">
        <div className="text-xs font-semibold text-muted-foreground mb-2">ADDED</div>
        <pre className="text-sm font-mono whitespace-pre-wrap">
          {newText.map((chunk, i) => (
            <span
              key={i}
              className={cn(
                chunk.type === 'insert' && 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
              )}
            >
              {chunk.text}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
