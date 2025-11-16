"use client"

import { useState } from "react"
import { Send, Sparkles, Volume2, RotateCcw, BookOpen, FileText, Users } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const suggestedTopics = [
  { icon: FileText, label: "Current Legislation", query: "What are the most important bills being discussed right now?" },
  { icon: Users, label: "My Representatives", query: "Tell me about my representatives' recent voting records" },
  { icon: BookOpen, label: "How Congress Works", query: "Explain how a bill becomes a law" },
  { icon: Sparkles, label: "Bill Analysis", query: "Can you analyze the infrastructure bill for me?" },
]

const exampleQuestions = [
  "What bills are being voted on this week?",
  "Summarize the healthcare reform bill",
  "How has my senator voted on climate issues?",
  "What's the latest on immigration policy?",
  "Explain the budget reconciliation process",
  "Which committees oversee education policy?",
]

export default function CongressionalAssistantPage() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setMessages([...messages, { role: "user", content: userMessage }])
    setInput("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm your Congressional Assistant, powered by AI to help you understand legislation and civic processes. In production, I would provide detailed analysis of bills, track legislative activity, and answer questions about Congress using real-time data from the legislative database.",
        },
      ])
      setIsLoading(false)
    }, 1200)
  }

  const handleTopicClick = (query: string) => {
    setInput(query)
  }

  const handleReset = () => {
    setMessages([])
    setInput("")
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] px-6 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        {messages.length === 0 ? (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Congressional Assistant</h1>
                <p className="text-muted-foreground text-lg">
                  Your AI-powered guide to understanding legislation and Congress
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {suggestedTopics.map((topic) => (
                <Card
                  key={topic.label}
                  className="cursor-pointer transition-all hover:bg-accent/50 hover:border-primary/50"
                  onClick={() => handleTopicClick(topic.query)}
                >
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <topic.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{topic.label}</h3>
                      <p className="text-sm text-muted-foreground">{topic.query}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Example questions:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((question, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent py-1.5 px-3"
                    onClick={() => handleTopicClick(question)}
                  >
                    {question}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Congressional Assistant</h1>
                  <p className="text-sm text-muted-foreground">AI-powered legislative guide</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] p-6">
                  <div className="space-y-6">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <Avatar className="h-10 w-10 bg-primary text-primary-foreground">
                            <AvatarFallback>AI</AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`rounded-lg px-4 py-3 max-w-[75%] ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === "user" && (
                          <Avatar className="h-10 w-10 bg-accent">
                            <AvatarFallback>You</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-4">
                        <Avatar className="h-10 w-10 bg-primary text-primary-foreground">
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg px-4 py-3 bg-muted">
                          <div className="flex gap-1">
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" />
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.2s]" />
                            <div className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about legislation, bills, representatives, or how Congress works..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" disabled={isLoading}>
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
