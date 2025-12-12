"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Zap,
  Crown,
  FileText,
  Bookmark,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight
} from 'lucide-react'
import { useSubscription } from "@/lib/subscription/subscription-context"
import { cn } from "@/lib/utils"
import Link from "next/link"

const STORAGE_KEY = "hakivo-usage-banner-state"

type BannerState = "expanded" | "collapsed" | "hidden"

export function UsageBanner() {
  const {
    subscription,
    usage,
    isLoading,
    openCheckout,
    getUsagePercentage,
  } = useSubscription()

  const [bannerState, setBannerState] = useState<BannerState>("collapsed")
  const [mounted, setMounted] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ["expanded", "collapsed", "hidden"].includes(saved)) {
      setBannerState(saved as BannerState)
    }
  }, [])

  // Save preference to localStorage
  const updateState = (newState: BannerState) => {
    setBannerState(newState)
    localStorage.setItem(STORAGE_KEY, newState)
  }

  // Don't render anything for Pro users or while loading initial state
  if (!mounted || isLoading || subscription.isPro) {
    return null
  }

  // Don't render if user dismissed the banner
  if (bannerState === "hidden") {
    return (
      <button
        onClick={() => updateState("collapsed")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <Zap className="h-3 w-3" />
        <span>Show usage</span>
      </button>
    )
  }

  const usageItems = [
    {
      key: 'briefs' as const,
      label: 'Briefs',
      fullLabel: 'Daily Briefs',
      icon: FileText,
      used: typeof usage.briefs.used === 'number' ? usage.briefs.used : 0,
      limit: typeof usage.briefs.limit === 'number' ? usage.briefs.limit : 3,
    },
    {
      key: 'trackedBills' as const,
      label: 'Tracked',
      fullLabel: 'Tracked Bills',
      icon: Bookmark,
      used: usage.trackedBills.count,
      limit: typeof usage.trackedBills.limit === 'number' ? usage.trackedBills.limit : 3,
    },
    {
      key: 'followedMembers' as const,
      label: 'Following',
      fullLabel: 'Followed Members',
      icon: Users,
      used: usage.followedMembers.count,
      limit: typeof usage.followedMembers.limit === 'number' ? usage.followedMembers.limit : 3,
    },
  ]

  const hasAnyLimitReached = usageItems.some(item => item.used >= item.limit)
  const hasWarning = usageItems.some(item => (item.used / item.limit) >= 0.67)

  // Collapsed state - slim one-liner
  if (bannerState === "collapsed") {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg mb-4 transition-all",
        hasAnyLimitReached
          ? "bg-destructive/10 border border-destructive/20"
          : hasWarning
          ? "bg-yellow-500/10 border border-yellow-500/20"
          : "bg-muted/50 border border-border/50"
      )}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Zap className={cn(
              "h-3.5 w-3.5",
              hasAnyLimitReached ? "text-destructive" : hasWarning ? "text-yellow-600" : "text-primary"
            )} />
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Free</Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {usageItems.map((item, index) => {
              const isAtLimit = item.used >= item.limit
              const isWarning = (item.used / item.limit) >= 0.67 && !isAtLimit
              return (
                <span key={item.key} className="flex items-center gap-1">
                  <item.icon className="h-3 w-3" />
                  <span className={cn(
                    "font-medium",
                    isAtLimit ? "text-destructive" : isWarning ? "text-yellow-600" : "text-foreground"
                  )}>
                    {item.used}/{item.limit}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {index < usageItems.length - 1 && <span className="text-border ml-2">•</span>}
                </span>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={openCheckout}
            className="h-7 px-2.5 text-xs gap-1 text-primary hover:text-primary"
          >
            <Crown className="h-3 w-3" />
            <span className="hidden sm:inline">Upgrade</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateState("expanded")}
            className="h-7 w-7"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateState("hidden")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Expanded state - full details
  return (
    <div className={cn(
      "rounded-lg mb-4 transition-all overflow-hidden",
      hasAnyLimitReached
        ? "bg-destructive/10 border border-destructive/20"
        : hasWarning
        ? "bg-yellow-500/10 border border-yellow-500/20"
        : "bg-muted/50 border border-border/50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Zap className={cn(
            "h-4 w-4",
            hasAnyLimitReached ? "text-destructive" : hasWarning ? "text-yellow-600" : "text-primary"
          )} />
          <span className="font-medium text-sm">Usage</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Free Plan</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateState("collapsed")}
            className="h-7 w-7"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => updateState("hidden")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {usageItems.map((item) => {
            const percentage = getUsagePercentage(item.key)
            const isAtLimit = item.used >= item.limit
            const isWarning = percentage >= 67 && !isAtLimit

            return (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.fullLabel}
                  </span>
                  <span className={cn(
                    "font-medium text-xs",
                    isAtLimit ? "text-destructive" : isWarning ? "text-yellow-600" : ""
                  )}>
                    {item.used}/{item.limit}
                  </span>
                </div>
                <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isAtLimit ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Warning/Limit message */}
        {(hasAnyLimitReached || hasWarning) && (
          <div className={cn(
            "mt-3 text-xs text-center py-1.5 rounded",
            hasAnyLimitReached ? "text-destructive" : "text-yellow-700 dark:text-yellow-400"
          )}>
            {hasAnyLimitReached
              ? "You've hit a limit. Upgrade for unlimited access."
              : "Approaching limits. Consider upgrading."}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/settings?tab=subscription">
              View Details
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
          <Button
            onClick={openCheckout}
            size="sm"
            className="h-8 px-4 text-xs bg-gradient-to-r from-primary to-primary/80"
          >
            <Crown className="h-3.5 w-3.5 mr-1.5" />
            Upgrade to Pro - $12/mo
          </Button>
        </div>
      </div>
    </div>
  )
}
