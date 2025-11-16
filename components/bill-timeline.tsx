import { Check, Circle } from "lucide-react"

const timelineEvents = [
  {
    title: "Introduced in House",
    date: "January 3, 2025",
    completed: true,
  },
  {
    title: "Referred to Committee",
    date: "January 5, 2025",
    completed: true,
  },
  {
    title: "Committee Consideration",
    date: "Ongoing",
    completed: false,
    current: true,
  },
  {
    title: "House Floor Vote",
    date: "Pending",
    completed: false,
  },
  {
    title: "Senate Consideration",
    date: "Pending",
    completed: false,
  },
  {
    title: "Presidential Action",
    date: "Pending",
    completed: false,
  },
]

export function BillTimeline() {
  return (
    <div className="relative">
      {timelineEvents.map((event, index) => (
        <div key={index} className="relative flex gap-4 pb-8 last:pb-0">
          {index < timelineEvents.length - 1 && <div className="absolute left-[11px] top-6 h-full w-[2px] bg-border" />}
          <div
            className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              event.completed
                ? "border-primary bg-primary text-primary-foreground"
                : event.current
                  ? "border-primary bg-background text-primary"
                  : "border-border bg-background text-muted-foreground"
            }`}
          >
            {event.completed ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3 fill-current" />}
          </div>
          <div className="flex-1 space-y-1 pt-0.5">
            <p
              className={`text-sm font-medium ${
                event.current ? "text-foreground" : event.completed ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {event.title}
            </p>
            <p className="text-xs text-muted-foreground">{event.date}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
