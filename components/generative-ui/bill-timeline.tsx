"use client"

import { Check, Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineStage {
  stage: string
  date?: string | null
  completed: boolean
  current?: boolean
  description?: string
}

interface BillTimelineProps {
  billNumber: string
  billTitle?: string
  stages: TimelineStage[]
  className?: string
}

export function BillTimeline({
  billNumber,
  billTitle,
  stages,
  className,
}: BillTimelineProps) {
  const currentStageIndex = stages.findIndex(s => s.current)

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]",
        "overflow-hidden transition-all duration-200",
        "animate-message-in",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--chat-border-subtle)]">
        <span className="font-mono text-sm font-semibold text-primary">
          {billNumber}
        </span>
        {billTitle && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {billTitle}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Legislative Journey
        </p>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="relative">
          {stages.map((stage, index) => {
            const isLast = index === stages.length - 1
            const isCompleted = stage.completed
            const isCurrent = stage.current

            return (
              <div key={stage.stage} className="flex gap-4">
                {/* Line and dot */}
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                      "transition-all duration-300",
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Clock className="h-4 w-4 animate-pulse-soft" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>

                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[24px]",
                        "transition-all duration-500",
                        isCompleted ? "bg-emerald-500" : "bg-muted"
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={cn("pb-6", isLast && "pb-0")}>
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        "font-medium text-sm",
                        isCompleted
                          ? "text-foreground"
                          : isCurrent
                            ? "text-primary"
                            : "text-muted-foreground"
                      )}
                    >
                      {stage.stage}
                    </h4>
                    {isCurrent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary">
                        Current
                      </span>
                    )}
                  </div>

                  {stage.date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stage.date}
                    </p>
                  )}

                  {stage.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="px-4 pb-4">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500"
            style={{
              width: `${((stages.filter(s => s.completed).length) / stages.length) * 100}%`
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {stages.filter(s => s.completed).length} of {stages.length} stages completed
        </p>
      </div>
    </div>
  )
}
