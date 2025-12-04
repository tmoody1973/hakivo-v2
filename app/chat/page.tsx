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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth/auth-context"

// Message types
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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

export default function ChatPage() {
  const { user } = useAuth()
  const userId = user?.id || null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

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
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewChat}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            New Chat
          </Button>
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

              {/* Loading indicator */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-start gap-4">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <CongressIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="pt-2">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
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
