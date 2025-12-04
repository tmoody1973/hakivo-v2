"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Send, Sparkles, Volume2, RotateCcw, FileText, Users, BookOpen, Loader2, ArrowDown, History, X, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  componentRegistry,
  type ComponentName,
} from "@/components/generative-ui"

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

// Storage keys
const STORAGE_KEY = "hakivo_chat_sessions"
const CURRENT_SESSION_KEY = "hakivo_current_session"

// Load sessions from localStorage
const loadSessions = (): ChatSession[] => {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
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

// Save sessions to localStorage
const saveSessions = (sessions: ChatSession[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

// Generate session title from first message
const generateTitle = (content: string): string => {
  const cleaned = content.replace(/\n/g, " ").trim()
  return cleaned.length > 40 ? cleaned.substring(0, 40) + "..." : cleaned
}

// Suggested topics with icons
const suggestedTopics = [
  {
    icon: FileText,
    label: "Current Legislation",
    query: "What are the most important bills being discussed right now?",
    gradient: "from-violet-500/20 to-purple-500/20"
  },
  {
    icon: Users,
    label: "My Representatives",
    query: "Tell me about my representatives' recent voting records",
    gradient: "from-cyan-500/20 to-teal-500/20"
  },
  {
    icon: BookOpen,
    label: "How Congress Works",
    query: "Explain how a bill becomes a law",
    gradient: "from-amber-500/20 to-orange-500/20"
  },
  {
    icon: Sparkles,
    label: "Bill Analysis",
    query: "Can you analyze the infrastructure bill for me?",
    gradient: "from-pink-500/20 to-rose-500/20"
  },
]

// Quick action chips
const quickActions = [
  "What bills are being voted on this week?",
  "Summarize the healthcare reform bill",
  "How has my senator voted on climate issues?",
  "What's the latest on immigration policy?",
]

// Generate unique ID
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * Parse message content to extract text and component segments
 * Supports both self-closing <Component /> and full <Component>...</Component> formats
 */
interface ContentSegment {
  type: "text" | "component"
  content?: string
  componentName?: ComponentName
  props?: Record<string, unknown>
}

function parseMessageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []

  // Pattern to match component markup: <ComponentName prop="value" /> or <ComponentName {...} />
  const componentPattern = /<(BillCard|RepresentativeProfile|VotingChart|BillTimeline|NewsCard|NewsCardGrid)\s+([^>]*?)\/>/g

  let lastIndex = 0
  let match

  while ((match = componentPattern.exec(content)) !== null) {
    // Add text before this component
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        segments.push({ type: "text", content: text })
      }
    }

    const [, componentName, propsStr] = match

    // Parse props from the string
    const props: Record<string, unknown> = {}

    // Match prop="value" or prop={json}
    const propPattern = /(\w+)=\{([^}]+)\}|(\w+)="([^"]*)"/g
    let propMatch

    while ((propMatch = propPattern.exec(propsStr)) !== null) {
      const key = propMatch[1] || propMatch[3]
      const value = propMatch[2] || propMatch[4]

      if (propMatch[2]) {
        // Try to parse JSON for {value} format
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

  // Add remaining text after last component
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      segments.push({ type: "text", content: text })
    }
  }

  // If no components found, return the whole content as text
  if (segments.length === 0) {
    segments.push({ type: "text", content })
  }

  return segments
}

/**
 * Render message content with generative UI components
 */
function MessageContent({ content }: { content: string }) {
  const segments = useMemo(() => parseMessageContent(content), [content])

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <div key={index} className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style headings
                  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                  // Style paragraphs
                  p: ({ children }) => <p className="text-sm leading-relaxed mb-2">{children}</p>,
                  // Style lists
                  ul: ({ children }) => <ul className="text-sm list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="text-sm list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  // Style bold/italic
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  // Style code
                  code: ({ children }) => <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>,
                  // Style links
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  // Style tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-border">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-muted/50 border-b border-border">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                  tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
                  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 text-muted-foreground">{children}</td>,
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
            <div key={index} className="my-2">
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load sessions on mount
  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)

    // Restore current session if exists
    const savedSessionId = typeof window !== "undefined"
      ? localStorage.getItem(CURRENT_SESSION_KEY)
      : null

    if (savedSessionId && loaded.find(s => s.id === savedSessionId)) {
      setCurrentSessionId(savedSessionId)
      const session = loaded.find(s => s.id === savedSessionId)
      if (session) {
        setMessages(session.messages)
      }
    }
  }, [])

  // Save sessions when they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions)
    }
  }, [sessions])

  // Save current session ID
  useEffect(() => {
    if (currentSessionId && typeof window !== "undefined") {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId)
    }
  }, [currentSessionId])

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
      setShowSidebar(false)
    }
  }, [sessions])

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null)
      setMessages([])
      if (typeof window !== "undefined") {
        localStorage.removeItem(CURRENT_SESSION_KEY)
      }
    }
  }, [currentSessionId])

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
      // Call streaming API
      console.log("[Chat] Sending request...")
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      console.log("[Chat] Response status:", response.status)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // Add empty assistant message for streaming
      setMessages(prev => [...prev, assistantMessage])

      // Read the SSE stream with proper line buffering
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamedContent = ""
      let buffer = "" // Buffer for incomplete lines
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("[Chat] Stream done, total chunks:", chunkCount)
          break
        }

        chunkCount++
        // Append new chunk to buffer
        const decoded = decoder.decode(value, { stream: true })
        buffer += decoded
        console.log("[Chat] Chunk", chunkCount, "raw:", decoded.substring(0, 100))

        // Split buffer by newlines, keeping incomplete last line in buffer
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep last incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6)
            if (data === "[DONE]") {
              console.log("[Chat] Received [DONE]")
              continue
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                streamedContent += parsed.content
                console.log("[Chat] Content so far:", streamedContent.substring(0, 50))
                // Update the assistant message with streamed content
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent }
                      : m
                  )
                )
              }
              if (parsed.error) {
                console.error("[Chat] Stream error:", parsed.error)
              }
            } catch (e) {
              console.warn("[Chat] Parse error:", e, "data:", data)
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

      console.log("[Chat] Final content length:", streamedContent.length)
    } catch (error) {
      console.error("[Chat] Error:", error)
      // Show error message
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

  // Handle topic click
  const handleTopicClick = (query: string) => {
    setInput(query)
    inputRef.current?.focus()
  }

  // Start new chat (keeps history)
  const startNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setInput("")
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_SESSION_KEY)
    }
  }

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const isEmpty = messages.length === 0

  return (
    <div
      className="flex flex-col h-[calc(100vh-4rem)] bg-[var(--chat-background)]"
      style={{ "--chat-background": "oklch(0.14 0.015 240)" } as React.CSSProperties}
    >
      {/* Header - always show with history button */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--chat-border)] bg-[var(--chat-surface)]">
        <div className="flex items-center gap-3">
          {sessions.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground transition-fast"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Congressional Assistant</h1>
            <p className="text-xs text-muted-foreground">AI-powered legislative guide</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={startNewChat}
          className="text-muted-foreground hover:text-foreground transition-fast"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </header>

      {/* Session History Sidebar */}
      {showSidebar && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
            onClick={() => setShowSidebar(false)}
          />
          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--chat-surface)] border-r border-[var(--chat-border)] z-50 animate-slide-up flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--chat-border)]">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat History
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 chat-scrollbar">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 p-3 rounded-lg cursor-pointer",
                    "hover:bg-[var(--chat-surface-elevated)] transition-colors",
                    currentSessionId === session.id && "bg-[var(--chat-surface-elevated)] border border-primary/20"
                  )}
                  onClick={() => switchSession(session.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(session.updatedAt)} · {session.messages.length} messages
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No chat history yet
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto chat-scrollbar"
      >
        {isEmpty ? (
          /* Empty state with welcome UI */
          <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 animate-fade-in">
            <div className="chat-container w-full space-y-8">
              {/* Hero section */}
              <div className="text-center space-y-4">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Congressional Assistant
                  </h1>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto">
                    Your AI-powered guide to understanding legislation and Congress
                  </p>
                </div>
              </div>

              {/* Topic cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => handleTopicClick(topic.query)}
                    className={cn(
                      "group relative flex items-start gap-4 p-4 rounded-xl",
                      "bg-[var(--chat-surface)] border border-[var(--chat-border)]",
                      "hover:border-primary/50 hover:bg-[var(--chat-surface-elevated)]",
                      "transition-all duration-200 text-left",
                      "focus-ring"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      "bg-gradient-to-br",
                      topic.gradient
                    )}>
                      <topic.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                        {topic.label}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {topic.query}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick action chips */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground text-center">
                  Or try asking:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleTopicClick(action)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs",
                        "bg-[var(--chat-surface)] border border-[var(--chat-border)]",
                        "hover:border-primary/50 hover:bg-[var(--chat-surface-elevated)]",
                        "transition-all duration-150",
                        "focus-ring"
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="chat-container py-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start",
                  "animate-message-in"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-[var(--chat-user-bg)] text-[var(--chat-user-text)] rounded-br-md max-w-[85%] sm:max-w-[75%]"
                      : "bg-[var(--chat-assistant-bg)] text-[var(--chat-assistant-text)] rounded-bl-md max-w-[95%] sm:max-w-[85%]"
                  )}
                >
                  {message.role === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <MessageContent content={message.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 animate-message-in">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-[var(--chat-assistant-bg)]">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-foreground/40 typing-dot" />
                    <div className="h-2 w-2 rounded-full bg-foreground/40 typing-dot" />
                    <div className="h-2 w-2 rounded-full bg-foreground/40 typing-dot" />
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
        <button
          onClick={() => scrollToBottom()}
          className={cn(
            "absolute bottom-24 right-6 p-2 rounded-full",
            "bg-[var(--chat-surface-elevated)] border border-[var(--chat-border)]",
            "shadow-lg hover:bg-[var(--chat-surface)]",
            "transition-all duration-200 animate-fade-in",
            "focus-ring"
          )}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-4">
        <div className="chat-container">
          <div className={cn(
            "flex items-end gap-2 p-2 rounded-2xl",
            "bg-[var(--chat-surface-elevated)] border border-[var(--chat-border)]",
            "gradient-border transition-all duration-200",
            "focus-within:border-primary/50"
          )}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about legislation, bills, representatives, or how Congress works..."
              rows={1}
              disabled={isLoading}
              className={cn(
                "flex-1 resize-none bg-transparent px-2 py-2",
                "text-sm placeholder:text-muted-foreground/60",
                "focus:outline-none disabled:opacity-50",
                "max-h-[200px]"
              )}
            />
            <div className="flex gap-1 pb-1">
              <Button
                size="icon"
                variant="ghost"
                disabled={isLoading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground transition-fast"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "h-8 w-8 rounded-xl",
                  "bg-gradient-to-br from-violet-500 to-purple-600",
                  "hover:from-violet-600 hover:to-purple-700",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-all duration-200"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
            Congressional Assistant can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
