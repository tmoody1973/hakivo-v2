import { DailyBriefWidget } from "@/components/widgets/daily-brief-widget"
import { RepresentativesHorizontalWidget } from "@/components/widgets/representatives-horizontal-widget"
import { BillActionsWidget } from "@/components/widgets/bill-actions-widget"
import { PersonalizedNewsWidget } from "@/components/widgets/personalized-news-widget"

export default function DashboardPage() {
  return (
    <div className="py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Good morning, Jane</h1>
        <p className="text-muted-foreground mt-1">Here's your civic engagement dashboard for today</p>
      </div>

      <div className="space-y-6">
        <RepresentativesHorizontalWidget />

        <DailyBriefWidget />

        <div className="grid gap-6 md:grid-cols-2">
          <BillActionsWidget />

          <PersonalizedNewsWidget />
        </div>
      </div>
    </div>
  )
}
