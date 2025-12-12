"use client"

import { useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, Check, Zap, FileText, Bookmark, Users, Radio, Sparkles, X } from 'lucide-react'
import { useSubscription } from "@/lib/subscription/subscription-context"

export type UpgradeModalTrigger =
  | 'briefs_limit'
  | 'tracked_bills_limit'
  | 'followed_members_limit'
  | 'artifacts_limit'
  | 'general'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: UpgradeModalTrigger
}

const triggerMessages: Record<UpgradeModalTrigger, { title: string; description: string; icon: typeof FileText }> = {
  briefs_limit: {
    title: "You've reached your daily brief limit",
    description: "Upgrade to Pro for unlimited personalized daily briefs tailored to your interests.",
    icon: Radio,
  },
  tracked_bills_limit: {
    title: "You've reached your tracked bills limit",
    description: "Upgrade to Pro to track unlimited bills and stay informed on all legislation that matters to you.",
    icon: Bookmark,
  },
  followed_members_limit: {
    title: "You've reached your followed members limit",
    description: "Upgrade to Pro to follow unlimited representatives and track their voting records.",
    icon: Users,
  },
  artifacts_limit: {
    title: "You've reached your artifact limit",
    description: "Upgrade to Pro for unlimited AI-generated summaries, analyses, and research artifacts.",
    icon: FileText,
  },
  general: {
    title: "Unlock the full Hakivo experience",
    description: "Get unlimited access to all features with Hakivo Pro.",
    icon: Crown,
  },
}

const proFeatures = [
  { icon: Radio, label: "Unlimited daily briefs", description: "Personalized to your interests" },
  { icon: Bookmark, label: "Unlimited bill tracking", description: "Never miss important legislation" },
  { icon: Users, label: "Unlimited member follows", description: "Track all your representatives" },
  { icon: FileText, label: "Unlimited artifacts", description: "AI summaries and analyses" },
  { icon: Sparkles, label: "Priority AI processing", description: "Faster responses and generation" },
  { icon: Zap, label: "Early access to new features", description: "Be the first to try new tools" },
]

export function UpgradeModal({ open, onOpenChange, trigger = 'general' }: UpgradeModalProps) {
  const { openCheckout } = useSubscription()

  const triggerInfo = triggerMessages[trigger]
  const TriggerIcon = triggerInfo.icon

  const handleUpgrade = useCallback(() => {
    onOpenChange(false)
    openCheckout()
  }, [onOpenChange, openCheckout])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TriggerIcon className="w-6 h-6 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                <Crown className="w-3 h-3 mr-1" />
                Pro Feature
              </Badge>
            </div>
            <DialogTitle className="text-xl">{triggerInfo.title}</DialogTitle>
            <DialogDescription className="text-base">
              {triggerInfo.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Features list */}
        <div className="px-6 py-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Everything included in Pro:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {proFeatures.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <Check className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer with pricing and CTA */}
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t flex-col sm:flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-2xl font-bold">$12<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              <p className="text-xs text-muted-foreground">Cancel anytime</p>
            </div>
            <Button
              onClick={handleUpgrade}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground w-full">
            Secure checkout powered by Stripe. 30-day money-back guarantee.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook to easily use the upgrade modal throughout the app
import { useState } from "react"

export function useUpgradeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [trigger, setTrigger] = useState<UpgradeModalTrigger>('general')

  const showUpgradeModal = useCallback((newTrigger: UpgradeModalTrigger = 'general') => {
    setTrigger(newTrigger)
    setIsOpen(true)
  }, [])

  const hideUpgradeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    trigger,
    showUpgradeModal,
    hideUpgradeModal,
    setIsOpen,
  }
}
