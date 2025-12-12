"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Crown, FileText, Bookmark, Users, ArrowRight, Loader2 } from 'lucide-react'
import { useSubscription } from "@/lib/subscription/subscription-context"
import Link from "next/link"

export function UsageWidget() {
  const {
    subscription,
    usage,
    isLoading,
    openCheckout,
    getUsagePercentage,
  } = useSubscription()

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-4 w-4 text-primary" />
            Usage
          </CardTitle>
          <CardDescription className="text-xs">Your plan usage this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Pro user - show compact "unlimited" state
  if (subscription.isPro) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-4 w-4 text-primary" />
            Hakivo Pro
          </CardTitle>
          <CardDescription className="text-xs">Unlimited access to all features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">∞</div>
              <div className="text-xs text-muted-foreground">Briefs</div>
            </div>
            <div className="text-center p-3 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">∞</div>
              <div className="text-xs text-muted-foreground">Tracked Bills</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
            <Link href="/settings?tab=subscription">
              Manage Subscription
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Free user - show usage bars
  const usageItems = [
    {
      key: 'briefs' as const,
      label: 'Daily Briefs',
      icon: FileText,
      used: typeof usage.briefs.used === 'number' ? usage.briefs.used : 0,
      limit: typeof usage.briefs.limit === 'number' ? usage.briefs.limit : 3,
    },
    {
      key: 'trackedBills' as const,
      label: 'Tracked Bills',
      icon: Bookmark,
      used: usage.trackedBills.count,
      limit: typeof usage.trackedBills.limit === 'number' ? usage.trackedBills.limit : 3,
    },
    {
      key: 'followedMembers' as const,
      label: 'Followed Members',
      icon: Users,
      used: usage.followedMembers.count,
      limit: typeof usage.followedMembers.limit === 'number' ? usage.followedMembers.limit : 3,
    },
  ]

  const hasAnyLimitReached = usageItems.some(item => item.used >= item.limit)
  const hasWarning = usageItems.some(item => (item.used / item.limit) >= 0.67)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-4 w-4 text-primary" />
              Usage
            </CardTitle>
            <CardDescription className="text-xs">Free plan limits</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Free</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {usageItems.map((item) => {
            const percentage = getUsagePercentage(item.key)
            const isAtLimit = item.used >= item.limit
            const isWarning = percentage >= 67 && !isAtLimit

            return (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className={`font-medium ${isAtLimit ? 'text-destructive' : isWarning ? 'text-yellow-600' : ''}`}>
                    {item.used}/{item.limit}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isAtLimit
                        ? 'bg-destructive'
                        : isWarning
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Upgrade CTA */}
        <div className="pt-2 border-t space-y-2">
          {hasAnyLimitReached ? (
            <div className="bg-destructive/10 text-destructive text-xs p-2 rounded-md text-center">
              You've hit a limit. Upgrade for unlimited access.
            </div>
          ) : hasWarning ? (
            <div className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs p-2 rounded-md text-center">
              Approaching limits. Consider upgrading.
            </div>
          ) : null}

          <Button
            onClick={openCheckout}
            size="sm"
            className="w-full bg-gradient-to-r from-primary to-primary/80 h-9"
          >
            <Crown className="h-3.5 w-3.5 mr-2" />
            Upgrade to Pro - $12/mo
          </Button>

          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
            <Link href="/settings?tab=subscription">
              View Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
