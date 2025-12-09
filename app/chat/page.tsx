"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Send, RotateCcw, Loader2, ArrowDown,
  PanelLeftClose, PanelLeft, Search, Paperclip,
  MessageSquare, Trash2, Plus, ChevronDown, Copy, Check
} from 'lucide-react'
import { CongressIcon } from "@/components/icons/congress-icon"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  componentRegistry,
  type ComponentName,
} from "@/components/generative-ui"
import { RepresentativeProfile } from "@/components/generative-ui/representative-profile"
import { BillCard } from "@/components/generative-ui/bill-card"
import { NewsCarousel } from "@/components/generative-ui/news-carousel"
import { BillsCarousel } from "@/components/generative-ui/bills-carousel"
import { ArtifactTrigger } from "@/components/chat/artifact-trigger"
import { ArtifactViewer, type Artifact } from "@/components/artifacts/artifact-viewer"
import { ShareThread } from "@/components/chat/share-thread"
import { type CustomActionEvent } from "@/components/c1/C1Artifact"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth/auth-context"

// Tool result types for structured rendering
interface ToolResult {
  toolName: string
  result: Record<string, unknown>
}

// Tool descriptions for thinking states (friendly user-facing messages)
const TOOL_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  smartSql: { title: "Searching legislation database", description: "Querying congressional bills and voting records..." },
  getBillDetail: { title: "Fetching bill details", description: "Retrieving comprehensive bill information..." },
  getMemberDetail: { title: "Looking up representative", description: "Finding congressional member details..." },
  getUserProfile: { title: "Loading your profile", description: "Retrieving your preferences and interests..." },
  semanticSearch: { title: "Searching legislation", description: "Finding related bills using AI..." },
  billTextRag: { title: "Analyzing bill text", description: "Reading and analyzing bill language..." },
  compareBills: { title: "Comparing legislation", description: "Analyzing similarities between bills..." },
  policyAreaSearch: { title: "Policy area search", description: "Finding bills by policy category..." },
  searchNews: { title: "Searching the news", description: "Finding latest news coverage..." },
  searchCongressionalNews: { title: "Congressional news", description: "Finding latest Capitol Hill news..." },
  searchLegislatorNews: { title: "Legislator news", description: "Finding news about representatives..." },
  geminiSearch: { title: "Searching with Google", description: "Finding latest information..." },
  webSearch: { title: "Web search", description: "Searching the internet..." },
  searchStateBills: { title: "State legislation search", description: "Searching state-level bills..." },
  getStateBillDetails: { title: "State bill details", description: "Fetching state legislation details..." },
  getStateLegislatorsByLocation: { title: "Finding state legislators", description: "Looking up your state representatives..." },
  createArtifact: { title: "Creating document", description: "Generating your report..." },
  generateBillReport: { title: "Generating bill report", description: "Creating comprehensive bill analysis..." },
  generateBriefingSlides: { title: "Creating slides", description: "Building your presentation deck..." },
}

// Message types
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  toolResults?: ToolResult[]  // Tool results for component rendering
}

// Session types for persistence
interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

// Base storage keys (user ID will be appended)
const STORAGE_KEY_BASE = "hakivo_chat_sessions"
const CURRENT_SESSION_KEY_BASE = "hakivo_current_session"
const SIDEBAR_KEY = "hakivo_sidebar_open"

// Get user-specific storage keys
const getStorageKey = (userId: string | null) =>
  userId ? `${STORAGE_KEY_BASE}_${userId}` : STORAGE_KEY_BASE
const getCurrentSessionKey = (userId: string | null) =>
  userId ? `${CURRENT_SESSION_KEY_BASE}_${userId}` : CURRENT_SESSION_KEY_BASE

// Load sessions from localStorage (per-user)
const loadSessions = (userId: string | null): ChatSession[] => {
  if (typeof window === "undefined") return []
  try {
    const storageKey = getStorageKey(userId)
    const stored = localStorage.getItem(storageKey)
    if (!stored) return []
    const sessions = JSON.parse(stored)
    return sessions.map((s: ChatSession) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
    }))
  } catch {
    return []
  }
}

// Save sessions to localStorage (per-user)
const saveSessions = (sessions: ChatSession[], userId: string | null) => {
  if (typeof window === "undefined") return
  const storageKey = getStorageKey(userId)
  localStorage.setItem(storageKey, JSON.stringify(sessions))
}

// Generate session title from first message
const generateTitle = (content: string): string => {
  const cleaned = content.replace(/\n/g, " ").trim()
  return cleaned.length > 50 ? cleaned.substring(0, 50) + "..." : cleaned
}

// Generate unique ID
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Group sessions by date
const groupSessionsByDate = (sessions: ChatSession[]) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 Days", sessions: [] },
    { label: "Older", sessions: [] },
  ]

  sessions.forEach(session => {
    const sessionDate = new Date(session.updatedAt)
    if (sessionDate >= today) {
      groups[0].sessions.push(session)
    } else if (sessionDate >= yesterday) {
      groups[1].sessions.push(session)
    } else if (sessionDate >= weekAgo) {
      groups[2].sessions.push(session)
    } else {
      groups[3].sessions.push(session)
    }
  })

  return groups.filter(g => g.sessions.length > 0)
}

/**
 * Parse message content to extract text and component segments
 */
interface ContentSegment {
  type: "text" | "component"
  content?: string
  componentName?: ComponentName
  props?: Record<string, unknown>
}

function parseMessageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const componentPattern = /<(BillCard|RepresentativeProfile|VotingChart|BillTimeline|NewsCard|NewsCardGrid)\s+([^>]*?)\/>/g

  let lastIndex = 0
  let match

  while ((match = componentPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        segments.push({ type: "text", content: text })
      }
    }

    const [, componentName, propsStr] = match
    const props: Record<string, unknown> = {}
    const propPattern = /(\w+)=\{([^}]+)\}|(\w+)="([^"]*)"/g
    let propMatch

    while ((propMatch = propPattern.exec(propsStr)) !== null) {
      const key = propMatch[1] || propMatch[3]
      const value = propMatch[2] || propMatch[4]

      if (propMatch[2]) {
        try {
          props[key] = JSON.parse(propMatch[2])
        } catch {
          props[key] = propMatch[2]
        }
      } else {
        props[key] = value
      }
    }

    if (componentName in componentRegistry) {
      segments.push({
        type: "component",
        componentName: componentName as ComponentName,
        props,
      })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      segments.push({ type: "text", content: text })
    }
  }

  if (segments.length === 0) {
    segments.push({ type: "text", content })
  }

  return segments
}

/**
 * Render message content with generative UI components - T3 style typography
 */
function MessageContent({ content }: { content: string }) {
  const segments = useMemo(() => parseMessageContent(content), [content])

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <div key={index} className="prose prose-invert prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="text-base leading-7 mb-4 text-foreground/90">{children}</p>,
                  ul: ({ children }) => <ul className="text-base list-disc ml-6 mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="text-base list-decimal ml-6 mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="text-foreground/90 leading-7">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  code: ({ children }) => <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-foreground">{children}</code>,
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-lg border border-border">
                      <table className="w-full text-base">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-muted/50 border-b border-border">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                  tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
                  th: ({ children }) => <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>,
                  td: ({ children }) => <td className="px-4 py-3 text-foreground/80">{children}</td>,
                }}
              >
                {segment.content || ""}
              </ReactMarkdown>
            </div>
          )
        }

        if (segment.type === "component" && segment.componentName) {
          const Component = componentRegistry[segment.componentName]
          if (!Component) return null

          return (
            <div key={index} className="my-4">
              {/* @ts-expect-error - Dynamic props based on component type */}
              <Component {...segment.props} />
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

/**
 * Copy button component
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

/**
 * Helper: Get member name with field mapping (camelCase + snake_case support)
 */
function getMemberName(member: Record<string, unknown>): string {
  return (member.fullName as string) ||
    (member.full_name as string) ||
    (member.name as string) ||
    (member.firstName && member.lastName
      ? `${member.firstName} ${member.lastName}`
      : member.first_name && member.last_name
        ? `${member.first_name} ${member.last_name}`
        : "Unknown")
}

/**
 * Render tool results as UI components with proper field mapping
 * Priority: C1 templates (if available) > Custom components (fallback)
 */
function ToolResultsRenderer({
  toolResults,
  onCustomAction,
  onSendMessage,
}: {
  toolResults: ToolResult[]
  onCustomAction?: (action: CustomActionEvent) => void
  onSendMessage?: (message: string) => void
}) {
  if (!toolResults || toolResults.length === 0) return null

  return (
    <div className="space-y-3 my-4">
      {toolResults.map((tr, trIdx) => {
        const { toolName, result } = tr
        if (!result) return null

        // NOTE: c1Template rendering disabled - our custom templates use a format
        // that the C1Component SDK doesn't fully support. The C1 SDK is designed
        // for streaming C1 API responses, not pre-generated JSON templates.
        // Our custom components (NewsCard, BillCard, etc.) provide better UX.

        // Use custom components for all tool results
        // smartSql - database queries for bills or members
        if (toolName === "smartSql") {
          const data = (result as { data?: unknown[] }).data
          const queryType = (result as { query_type?: string }).query_type || ""
          if (!data || !Array.isArray(data) || data.length === 0) return null

          // Render members
          if (queryType.includes("members") || (data[0] && ((data[0] as Record<string, unknown>).bioguideId || (data[0] as Record<string, unknown>).bioguide_id))) {
            return (
              <div key={trIdx} className="space-y-3">
                {data.slice(0, 5).map((member: unknown, idx: number) => {
                  const m = member as Record<string, unknown>
                  return (
                    <RepresentativeProfile
                      key={(m.bioguideId as string) || (m.bioguide_id as string) || idx}
                      name={getMemberName(m)}
                      party={(m.party as string) || "Unknown"}
                      state={(m.state as string) || "Unknown"}
                      chamber={(m.chamber as string) || (m.type as string) || "Congress"}
                      phone={(m.phone as string) || undefined}
                      website={(m.website as string) || (m.url as string) || undefined}
                    />
                  )
                })}
                {data.length > 5 && (
                  <p className="text-sm text-muted-foreground">Showing 5 of {data.length} results</p>
                )}
              </div>
            )
          }

          // Render bills
          if (queryType.includes("bills") || queryType.includes("sponsor") || (data[0] && (data[0] as Record<string, unknown>).bill_type)) {
            return (
              <div key={trIdx} className="space-y-3">
                {data.slice(0, 5).map((bill: unknown, idx: number) => {
                  const b = bill as Record<string, unknown>
                  return (
                    <BillCard
                      key={(b.id as string) || idx}
                      billNumber={`${((b.bill_type as string) || "").toUpperCase()} ${b.bill_number || ""}`}
                      title={(b.title as string) || (b.short_title as string) || "Untitled Bill"}
                      sponsor={(b.sponsor_name as string) || (b.sponsor as string) || "Unknown Sponsor"}
                      status={(b.status as string) || (b.latest_action_text as string) || "Status Unknown"}
                      lastAction={(b.latest_action_text as string) || undefined}
                      lastActionDate={(b.latest_action_date as string) || undefined}
                    />
                  )
                })}
                {data.length > 5 && (
                  <p className="text-sm text-muted-foreground">Showing 5 of {data.length} results</p>
                )}
              </div>
            )
          }
        }

        // semanticSearch - SmartBucket vector search for bills (carousel view)
        if (toolName === "semanticSearch") {
          const bills = (result as { bills?: unknown[] }).bills
          const query = (result as { query?: string }).query
          const summary = (result as { summary?: string }).summary
          if (!bills || !Array.isArray(bills) || bills.length === 0) return null

          // Map bills to expected interface format
          const normalizedBills = bills.map((bill: unknown) => {
            const b = bill as Record<string, unknown>
            return {
              id: (b.id as string) || (b.bill_id as string),
              bill_id: (b.bill_id as string) || (b.id as string),
              congress: (b.congress as number) || 119,
              bill_type: (b.bill_type as string) || (b.type as string),
              bill_number: (b.bill_number as number) || (b.number as number),
              title: (b.title as string) || (b.short_title as string) || "Untitled Bill",
              short_title: b.short_title as string,
              sponsor_name: (b.sponsor_name as string) || (b.sponsor as string),
              sponsor_party: b.sponsor_party as string,
              sponsor_state: b.sponsor_state as string,
              policy_area: (b.policy_area as string) || (b.policyArea as string),
              latest_action_text: b.latest_action_text as string,
              latest_action_date: b.latest_action_date as string,
              similarity_score: (b.similarity_score as number) || (b.relevanceScore as number),
              matched_content: (b.matched_content as string) || (b.matchedChunk as string),
              cosponsors_count: b.cosponsors_count as number,
            }
          })

          return (
            <BillsCarousel
              key={trIdx}
              bills={normalizedBills}
              query={query}
              summary={summary}
            />
          )
        }

        // getMemberDetail - single member
        if (toolName === "getMemberDetail") {
          const member = (result as { member?: Record<string, unknown> }).member
          if (!member) return null
          return (
            <RepresentativeProfile
              key={trIdx}
              name={getMemberName(member)}
              party={(member.party as string) || "Unknown"}
              state={(member.state as string) || "Unknown"}
              chamber={(member.chamber as string) || "Congress"}
              phone={(member.phone as string) || undefined}
              website={(member.website as string) || (member.url as string) || undefined}
            />
          )
        }

        // getBillDetail - single bill
        if (toolName === "getBillDetail") {
          const bill = (result as { bill?: Record<string, unknown> }).bill
          if (!bill) return null
          return (
            <BillCard
              key={trIdx}
              billNumber={`${((bill.bill_type as string) || "").toUpperCase()} ${bill.bill_number || ""}`}
              title={(bill.title as string) || (bill.short_title as string) || "Untitled Bill"}
              sponsor={(bill.sponsor_name as string) || (bill.sponsor as string) || "Unknown Sponsor"}
              status={(bill.status as string) || (bill.latest_action_text as string) || "Status Unknown"}
              lastAction={(bill.latest_action_text as string) || undefined}
              lastActionDate={(bill.latest_action_date as string) || undefined}
            />
          )
        }

        // searchNews, searchCongressionalNews, searchLegislatorNews, geminiSearch, webSearch
        if (toolName === "searchNews" || toolName === "searchCongressionalNews" || toolName === "searchLegislatorNews" || toolName === "geminiSearch" || toolName === "webSearch") {
          const articles = (result as { articles?: unknown[] }).articles
          const summary = (result as { summary?: string }).summary
          const query = (result as { query?: string }).query
          if (!articles || articles.length === 0) return null
          return (
            <NewsCarousel
              key={trIdx}
              articles={articles.map((article: unknown) => {
                const a = article as Record<string, unknown>
                return {
                  title: (a.title as string) || "News Article",
                  source: (a.source as string) || "News",
                  date: (a.date as string) || null,
                  snippet: (a.snippet as string) || "",
                  url: (a.url as string) || "#",
                  image: (a.image as string) || (a.imageUrl as string) || undefined,
                }
              })}
              title={query ? `News: ${query}` : "Latest News"}
              summary={summary}
            />
          )
        }

        // searchStateBills
        if (toolName === "searchStateBills") {
          const bills = (result as { bills?: unknown[] }).bills
          if (!bills || bills.length === 0) return null
          return (
            <div key={trIdx} className="space-y-3">
              {bills.slice(0, 5).map((bill: unknown, idx: number) => {
                const b = bill as Record<string, unknown>
                const latestAction = b.latest_action as Record<string, unknown> | undefined
                return (
                  <BillCard
                    key={(b.id as string) || idx}
                    billNumber={(b.identifier as string) || (b.id as string) || ""}
                    title={(b.title as string) || "Untitled State Bill"}
                    sponsor={(b.sponsor as string) || "Unknown Sponsor"}
                    status={(latestAction?.description as string) || "Status Unknown"}
                    lastAction={(latestAction?.description as string) || undefined}
                    lastActionDate={(latestAction?.date as string) || undefined}
                  />
                )
              })}
            </div>
          )
        }

        // getStateLegislatorsByLocation
        if (toolName === "getStateLegislatorsByLocation") {
          const legislators = (result as { legislators?: unknown[] }).legislators
          if (!legislators || legislators.length === 0) return null
          return (
            <div key={trIdx} className="space-y-3">
              {legislators.map((leg: unknown, idx: number) => {
                const l = leg as Record<string, unknown>
                return (
                  <RepresentativeProfile
                    key={(l.id as string) || idx}
                    name={getMemberName(l)}
                    party={(l.party as string) || "Unknown"}
                    state={(l.state as string) || "Unknown"}
                    chamber={(l.chamber as string) || "State Legislature"}
                    phone={(l.phone as string) || undefined}
                    website={(l.url as string) || undefined}
                  />
                )
              })}
            </div>
          )
        }

        // getUserRepresentatives
        if (toolName === "getUserRepresentatives") {
          const reps = (result as { representatives?: Record<string, unknown> }).representatives
          if (!reps) return null
          const allReps = [
            ...((reps.senators as unknown[]) || []),
            ...(reps.representative ? [reps.representative] : []),
            ...((reps.stateLegislators as unknown[]) || []),
          ]
          if (allReps.length === 0) return null
          return (
            <div key={trIdx} className="space-y-3">
              {allReps.map((rep: unknown, idx: number) => {
                const r = rep as Record<string, unknown>
                return (
                  <RepresentativeProfile
                    key={(r.bioguideId as string) || (r.bioguide_id as string) || (r.id as string) || idx}
                    name={getMemberName(r)}
                    party={(r.party as string) || "Unknown"}
                    state={(r.state as string) || "Unknown"}
                    chamber={(r.chamber as string) || "Congress"}
                    phone={(r.phone as string) || undefined}
                    website={(r.website as string) || (r.url as string) || undefined}
                  />
                )
              })}
            </div>
          )
        }

        // getTrackedBills
        if (toolName === "getTrackedBills") {
          const trackedBills = (result as { trackedBills?: unknown[] }).trackedBills
          if (!trackedBills || trackedBills.length === 0) return null
          return (
            <div key={trIdx} className="space-y-3">
              {trackedBills.map((item: unknown, idx: number) => {
                const i = item as Record<string, unknown>
                const bill = i.bill as Record<string, unknown> | undefined
                return (
                  <BillCard
                    key={bill?.id as string || idx}
                    billNumber={(bill?.bill_number as string) || (i.identifier as string) || ""}
                    title={(bill?.title as string) || "Tracked Bill"}
                    sponsor={(bill?.sponsor as string) || "Unknown Sponsor"}
                    status={(bill?.status as string) || "Tracked"}
                    lastAction={(bill?.latest_action_text as string) || undefined}
                    lastActionDate={(bill?.latest_action_date as string) || undefined}
                  />
                )
              })}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuth()
  const userId = user?.id || null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Thinking state - shows what tool is currently being called
  const [thinkingState, setThinkingState] = useState<{ title: string; description: string } | null>(null)

  // Artifact state
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null)
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false)

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load sessions and sidebar state on mount (per-user)
  useEffect(() => {
    const loaded = loadSessions(userId)
    setSessions(loaded)

    // Restore sidebar state (shared across users)
    const savedSidebar = typeof window !== "undefined"
      ? localStorage.getItem(SIDEBAR_KEY)
      : null
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === "true")
    }

    // Restore current session if exists (per-user)
    const currentSessionKey = getCurrentSessionKey(userId)
    const savedSessionId = typeof window !== "undefined"
      ? localStorage.getItem(currentSessionKey)
      : null

    if (savedSessionId && loaded.find(s => s.id === savedSessionId)) {
      setCurrentSessionId(savedSessionId)
      const session = loaded.find(s => s.id === savedSessionId)
      if (session) {
        setMessages(session.messages)
      }
    }
  }, [userId])

  // Save sessions when they change (per-user)
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions, userId)
    }
  }, [sessions, userId])

  // Save current session ID (per-user)
  useEffect(() => {
    if (currentSessionId && typeof window !== "undefined") {
      const currentSessionKey = getCurrentSessionKey(userId)
      localStorage.setItem(currentSessionKey, currentSessionId)
    }
  }, [currentSessionId, userId])

  // Save sidebar state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen))
    }
  }, [sidebarOpen])

  // Update current session when messages change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId
          ? { ...s, messages, updatedAt: new Date() }
          : s
      ))
    }
  }, [messages, currentSessionId])

  // Create new session
  const createNewSession = useCallback((firstMessage: string) => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: generateTitle(firstMessage),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    return newSession.id
  }, [])

  // Switch to a session
  const switchSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      setCurrentSessionId(sessionId)
      setMessages(session.messages)
    }
  }, [sessions])

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null)
      setMessages([])
      if (typeof window !== "undefined") {
        const currentSessionKey = getCurrentSessionKey(userId)
        localStorage.removeItem(currentSessionKey)
      }
    }
  }, [currentSessionId, userId])

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  // Handle scroll to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom && messages.length > 0)
  }, [messages.length])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInput(textarea.value)
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  // Send message handler with streaming
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    // Create a new session if this is the first message
    if (!currentSessionId) {
      createNewSession(input.trim())
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }

    // Create placeholder for streaming response
    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // Add empty assistant message for streaming
      setMessages(prev => [...prev, assistantMessage])

      // Read the SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamedContent = ""
      let buffer = ""
      const collectedToolResults: ToolResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const decoded = decoder.decode(value, { stream: true })
        buffer += decoded

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)

              // Handle text content streaming - but NOT for artifact events
              // Artifact events have content field but it should go to artifact viewer, not chat text
              if (parsed.content && !parsed.type) {
                // Only stream plain content events (no type field = chat text)
                streamedContent += parsed.content
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent, toolResults: [...collectedToolResults] }
                      : m
                  )
                )
              }

              // Handle error events
              if (parsed.error && !parsed.type) {
                console.error("[Chat] Stream error:", parsed.error)
                // Don't append error to content, just log it
              }

              // Handle tool-result events for custom component rendering
              if (parsed.type === "tool-result" && parsed.toolName && parsed.result) {
                console.log("[Chat] Received tool-result:", parsed.toolName, "articles:", (parsed.result as any)?.articles?.length || 0)
                const newToolResult: ToolResult = {
                  toolName: parsed.toolName,
                  result: parsed.result,
                }
                collectedToolResults.push(newToolResult)
                console.log("[Chat] Tool results collected:", collectedToolResults.length)

                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent, toolResults: [...collectedToolResults] }
                      : m
                  )
                )
              }

              // Handle streaming artifact events (progressive rendering)
              if (parsed.type === "artifact-stream" && parsed.content) {
                console.log("[Chat] Streaming artifact:", {
                  id: parsed.artifactId,
                  contentLength: parsed.content?.length,
                })
                // Update artifact progressively as it streams in
                setCurrentArtifact({
                  id: parsed.artifactId || `artifact-${Date.now()}`,
                  type: parsed.artifactType || "report",
                  template: parsed.template || "policy_brief",
                  title: parsed.title || "Generated Document",
                  content: parsed.content,
                })
              }

              // Handle final artifact events
              if (parsed.type === "artifact" && parsed.content) {
                console.log("[Chat] Received complete artifact:", {
                  id: parsed.artifactId,
                  type: parsed.artifactType,
                  template: parsed.template,
                  contentLength: parsed.content?.length,
                  isComplete: parsed.isComplete,
                })
                setIsGeneratingArtifact(false)
                setCurrentArtifact({
                  id: parsed.artifactId || `artifact-${Date.now()}`,
                  type: parsed.artifactType || "report",
                  template: parsed.template || "policy_brief",
                  title: parsed.title || "Generated Document",
                  content: parsed.content,
                })
              }

              // Handle thinking states - show what tool is being called
              if (parsed.type === "thinking") {
                const artifactTools = ["createArtifact", "generateBillReport", "generateBriefingSlides"];
                // Show artifact spinner for artifact tools
                if (!parsed.toolName || artifactTools.includes(parsed.toolName)) {
                  setIsGeneratingArtifact(true)
                }
                // Always show thinking state for user feedback
                const toolInfo = parsed.toolName
                  ? TOOL_DESCRIPTIONS[parsed.toolName] || { title: parsed.title || "Processing", description: parsed.description || "Working on your request..." }
                  : { title: parsed.title || "Processing", description: parsed.description || "Working on your request..." }
                setThinkingState(toolInfo)
              }
              if (parsed.type === "thinking-complete") {
                setIsGeneratingArtifact(false)
                setThinkingState(null)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim().startsWith("data: ")) {
        const data = buffer.trim().slice(6)
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              streamedContent += parsed.content
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: streamedContent, toolResults: [...collectedToolResults] }
                    : m
                )
              )
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error("[Chat] Error:", error)
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantMessageId),
        {
          id: assistantMessageId,
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      setThinkingState(null)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Send message programmatically from actions (follow-up queries, explore actions)
  const sendMessageFromAction = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    // Create a new session if this is the first message
    if (!currentSessionId) {
      createNewSession(content.trim())
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setIsLoading(true)

    // Create placeholder for streaming response
    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // Add empty assistant message for streaming
      setMessages(prev => [...prev, assistantMessage])

      // Read the SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamedContent = ""
      let buffer = ""
      const collectedToolResults: ToolResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const decoded = decoder.decode(value, { stream: true })
        buffer += decoded

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.content && parsed.type !== "artifact") {
                streamedContent += parsed.content
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent, toolResults: [...collectedToolResults] }
                      : m
                  )
                )
              }

              if (parsed.type === "tool-result" && parsed.toolName && parsed.result) {
                console.log("[Chat] Received tool-result:", parsed.toolName, "articles:", (parsed.result as { articles?: unknown[] })?.articles?.length || 0)
                const newToolResult: ToolResult = {
                  toolName: parsed.toolName,
                  result: parsed.result,
                }
                collectedToolResults.push(newToolResult)
                console.log("[Chat] Tool results collected:", collectedToolResults.length)
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent, toolResults: [...collectedToolResults] }
                      : m
                  )
                )
              }

              // Handle streaming artifacts
              if (parsed.type === "artifact-stream" && parsed.content) {
                setCurrentArtifact({
                  id: parsed.artifactId || `artifact-${Date.now()}`,
                  type: parsed.artifactType || "report",
                  template: parsed.template || "policy_brief",
                  title: parsed.title || "Generated Document",
                  content: parsed.content,
                })
              }

              if (parsed.type === "artifact" && parsed.content) {
                setIsGeneratingArtifact(false)
                setCurrentArtifact({
                  id: parsed.artifactId || `artifact-${Date.now()}`,
                  type: parsed.artifactType || "report",
                  template: parsed.template || "policy_brief",
                  title: parsed.title || "Generated Document",
                  content: parsed.content,
                })
              }

              if (parsed.type === "thinking") {
                const artifactTools = ["createArtifact", "generateBillReport", "generateBriefingSlides"];
                if (!parsed.toolName || artifactTools.includes(parsed.toolName)) {
                  setIsGeneratingArtifact(true)
                }
                // Always show thinking state for user feedback
                const toolInfo = parsed.toolName
                  ? TOOL_DESCRIPTIONS[parsed.toolName] || { title: parsed.title || "Processing", description: parsed.description || "Working on your request..." }
                  : { title: parsed.title || "Processing", description: parsed.description || "Working on your request..." }
                setThinkingState(toolInfo)
              }
              if (parsed.type === "thinking-complete") {
                setIsGeneratingArtifact(false)
                setThinkingState(null)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("[Chat] Error from action:", error)
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantMessageId),
        {
          id: assistantMessageId,
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      setThinkingState(null)
    }
  }, [messages, isLoading, currentSessionId, createNewSession])

  // Handle custom actions from C1 artifacts (track bill, share, explore, etc.)
  const handleCustomAction = useCallback((action: CustomActionEvent) => {
    console.log("[Chat] Custom action:", action.type, action.params)

    switch (action.type) {
      case "track_bill": {
        // TODO: Implement bill tracking via API
        const { billId, billTitle } = action.params
        console.log("[Chat] Track bill:", billId, billTitle)
        // Could open a modal or send to an API endpoint
        alert(`Bill "${billTitle}" (${billId}) would be added to your tracked legislation.`)
        break
      }

      case "view_bill_details": {
        // Send a follow-up query to get more details
        const { billId } = action.params
        sendMessageFromAction(`Tell me more details about bill ${billId}`)
        break
      }

      case "view_sponsor": {
        // Send a follow-up query about the sponsor
        const { bioguideId, name } = action.params
        sendMessageFromAction(`Tell me about ${name || "this representative"} (bioguide: ${bioguideId})`)
        break
      }

      case "share_result": {
        // Handle sharing - could open share dialog
        const { shareType, content } = action.params
        console.log("[Chat] Share:", shareType, content)
        if (shareType === "link") {
          // Copy link to clipboard
          navigator.clipboard.writeText(window.location.href)
          alert("Link copied to clipboard!")
        } else if (shareType === "twitter") {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(String(content || "Check this out!"))}`, "_blank")
        } else if (shareType === "email") {
          window.location.href = `mailto:?subject=Hakivo Congressional Insight&body=${encodeURIComponent(String(content || ""))}`
        }
        break
      }

      case "explore_related": {
        // Send a follow-up query to explore related content
        const { query, type } = action.params
        const searchQuery = type === "bills"
          ? `Find bills related to: ${query}`
          : type === "news"
          ? `What's the latest news about ${query}?`
          : type === "members"
          ? `Show me Congress members related to ${query}`
          : String(query)
        sendMessageFromAction(searchQuery)
        break
      }

      case "download_report": {
        // TODO: Implement report download
        const { format } = action.params
        console.log("[Chat] Download report as:", format)
        alert(`Report download as ${format} is coming soon!`)
        break
      }

      default:
        // For any other actions, try sending as a follow-up message
        console.log("[Chat] Unknown action type:", action.type)
        if (action.params.query) {
          sendMessageFromAction(String(action.params.query))
        }
    }
  }, [sendMessageFromAction])

  // Start new chat
  const startNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setInput("")
    if (typeof window !== "undefined") {
      const currentSessionKey = getCurrentSessionKey(userId)
      localStorage.removeItem(currentSessionKey)
    }
  }

  // Regenerate last response
  const regenerateLastResponse = async () => {
    if (messages.length < 2 || isLoading) return

    // Find the last user message
    const lastUserMessageIndex = messages.map(m => m.role).lastIndexOf("user")
    if (lastUserMessageIndex === -1) return

    // Keep messages up to and including the last user message
    const messagesUntilLastUser = messages.slice(0, lastUserMessageIndex + 1)
    setMessages(messagesUntilLastUser)

    // Simulate sending the last user message again
    const lastUserMessage = messages[lastUserMessageIndex]
    setIsLoading(true)

    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesUntilLastUser.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error("Failed to regenerate")
      }

      setMessages(prev => [...prev, assistantMessage])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamedContent = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const decoded = decoder.decode(value, { stream: true })
        buffer += decoded

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                streamedContent += parsed.content
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent }
                      : m
                  )
                )
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch (error) {
      console.error("[Chat] Regenerate error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter sessions based on search
  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions

  const groupedSessions = groupSessionsByDate(filteredSessions)
  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">Hakivo</span>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Button
            onClick={startNewChat}
            className="w-full justify-start gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search your threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2">
          {groupedSessions.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              {group.sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-1",
                    "hover:bg-muted/50 transition-colors",
                    currentSessionId === session.id && "bg-muted"
                  )}
                  onClick={() => switchSession(session.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{session.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
          {filteredSessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? "No matching threads" : "No chat history yet"}
            </p>
          )}
        </div>

      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-8 w-8"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <CongressIcon className="h-4 w-4 text-white" />
              </div>
              <span className="font-medium">Congressional Assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShareThread
              sessionId={currentSessionId || ""}
              title={sessions.find(s => s.id === currentSessionId)?.title || "Shared Conversation"}
              messages={messages.map(m => ({ role: m.role, content: m.content }))}
              disabled={messages.length === 0}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewChat}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
        </header>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pb-20"
        >
          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
              <div className="max-w-2xl w-full space-y-8 text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                  <CongressIcon className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    Congressional Assistant
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Your AI-powered guide to understanding legislation and Congress
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message) => (
                <div key={message.id} className="group">
                  {message.role === "user" ? (
                    /* User message - compact pill style */
                    <div className="flex justify-end mb-6">
                      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl max-w-[80%]">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant message - clean typography, no bubble */
                    <div className="relative">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <CongressIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <MessageContent content={message.content} />
                          {/* Render tool results as UI components */}
                          {message.toolResults && message.toolResults.length > 0 && (
                            <ToolResultsRenderer
                              toolResults={message.toolResults}
                              onCustomAction={handleCustomAction}
                              onSendMessage={sendMessageFromAction}
                            />
                          )}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 mt-2 ml-12">
                        <CopyButton text={message.content} />
                        {message === messages[messages.length - 1] && !isLoading && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={regenerateLastResponse}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Regenerate response"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator with thinking state */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-start gap-4 animate-message-in">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <CongressIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="pt-1.5">
                    {thinkingState ? (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{thinkingState.title}</p>
                          <p className="text-xs text-muted-foreground">{thinkingState.description}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border">
                        <div className="flex gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Artifact Viewer - display generated documents */}
              {(currentArtifact || isGeneratingArtifact) && (
                <div className="mt-6">
                  {currentArtifact ? (
                    <ArtifactViewer
                      artifact={currentArtifact}
                      isStreaming={isGeneratingArtifact}
                      showHeader={true}
                      showActions={true}
                      onDelete={() => setCurrentArtifact(null)}
                    />
                  ) : (
                    // Loading state while generating
                    <div className="p-6 border border-border rounded-lg bg-card">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="font-medium">Generating your document...</p>
                          <p className="text-sm text-muted-foreground">This may take a moment</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
            <Button
              onClick={() => scrollToBottom()}
              variant="secondary"
              size="sm"
              className="shadow-lg gap-2"
            >
              <ArrowDown className="h-4 w-4" />
              Scroll to bottom
            </Button>
          </div>
        )}

        {/* Input Area - T3 Style */}
        <div className="border-t border-border bg-background p-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl border border-border bg-card shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                rows={1}
                disabled={isLoading}
                className={cn(
                  "w-full resize-none bg-transparent px-4 py-3 pr-32",
                  "text-base placeholder:text-muted-foreground",
                  "focus:outline-none disabled:opacity-50",
                  "max-h-[200px]"
                )}
              />
              {/* Bottom bar with model selector and buttons */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-foreground">
                        <CongressIcon className="h-3.5 w-3.5" />
                        <span className="text-xs">Cerebras GPT</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem>
                        <CongressIcon className="h-4 w-4 mr-2" />
                        Cerebras GPT (Fast)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1">
                  {/* Artifact/Document trigger dropdown */}
                  <ArtifactTrigger
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onSelect={(message) => {
                      setInput(message)
                      // Auto-submit after a brief delay to show the input
                      setTimeout(() => {
                        handleSend()
                      }, 100)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Search"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Attach"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Congressional Assistant can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
