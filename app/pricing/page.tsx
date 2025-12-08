"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Sparkles, Zap, Building2, ArrowRight } from 'lucide-react'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6 md:px-8 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold text-lg">
              H
            </div>
            <span className="text-xl font-bold tracking-tight">Hakivo</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Button asChild className="rounded-full px-5">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Stay informed.{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Stay engaged.</span>
              <span className="absolute bottom-2 left-0 right-0 h-4 bg-primary/30 -z-0 rounded" />
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your civic engagement needs. Start free, upgrade anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 md:px-8 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">

            {/* Free Tier */}
            <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/30 transition-all">
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Free</h3>
                <p className="text-muted-foreground">Perfect for getting started with civic engagement</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <Button variant="outline" size="lg" asChild className="w-full rounded-full h-14 text-base font-semibold border-2 mb-8">
                <Link href="/auth/signup">Get Started Free</Link>
              </Button>

              <ul className="space-y-4">
                <FeatureItem>3 audio briefings per month</FeatureItem>
                <FeatureItem>Track up to 3 bills</FeatureItem>
                <FeatureItem>Follow 3 representatives</FeatureItem>
                <FeatureItem>Basic bill summaries</FeatureItem>
                <FeatureItem>Access to 100 Laws podcast</FeatureItem>
                <FeatureItem>Email support</FeatureItem>
              </ul>
            </div>

            {/* Pro Tier */}
            <div className="relative bg-gradient-to-b from-primary/10 to-card rounded-3xl p-8 border-2 border-primary shadow-xl shadow-primary/10">
              {/* Popular Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Most Popular
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Hakivo Pro</h3>
                <p className="text-muted-foreground">Full access to all civic intelligence features</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$12</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">or $99/year (save 31%)</p>
              </div>

              <Button size="lg" asChild className="w-full rounded-full h-14 text-base font-semibold mb-8">
                <Link href="/auth/signup?plan=pro">
                  Start Pro Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <ul className="space-y-4">
                <FeatureItem highlight>Unlimited audio briefings</FeatureItem>
                <FeatureItem highlight>Unlimited bill tracking</FeatureItem>
                <FeatureItem highlight>Follow unlimited representatives</FeatureItem>
                <FeatureItem highlight>Daily personalized briefings</FeatureItem>
                <FeatureItem highlight>Deep AI bill analysis</FeatureItem>
                <FeatureItem highlight>Real-time vote alerts</FeatureItem>
                <FeatureItem highlight>State legislature tracking</FeatureItem>
                <FeatureItem highlight>Priority support</FeatureItem>
                <FeatureItem highlight>Congressional Assistant AI chat</FeatureItem>
                <FeatureItem highlight>Export reports & presentations</FeatureItem>
              </ul>
            </div>
          </div>

          {/* Enterprise/Team Teaser */}
          <div className="mt-12 bg-card rounded-3xl p-8 border border-border">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 min-w-[56px] rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Teams & Organizations</h3>
                  <p className="text-muted-foreground">
                    Advocacy groups, newsrooms, educators, and government affairs teams.
                    Custom pricing with team features, SSO, and dedicated support.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="lg" asChild className="rounded-full px-8 whitespace-nowrap">
                <Link href="mailto:tarik@hakivo.app?subject=Hakivo Team Inquiry">
                  Contact Sales
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">Compare Plans</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Free</th>
                  <th className="text-center py-4 pl-4 font-semibold text-primary">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <ComparisonRow feature="Audio Briefings" free="3/month" pro="Unlimited" />
                <ComparisonRow feature="Bill Tracking" free="3 bills" pro="Unlimited" />
                <ComparisonRow feature="Follow Representatives" free="3 reps" pro="Unlimited" />
                <ComparisonRow feature="Daily Personalized Briefings" free={false} pro={true} />
                <ComparisonRow feature="Deep AI Bill Analysis" free={false} pro={true} />
                <ComparisonRow feature="Real-time Vote Alerts" free={false} pro={true} />
                <ComparisonRow feature="State Legislature Tracking" free={false} pro={true} />
                <ComparisonRow feature="Congressional Assistant Chat" free="Limited" pro="Unlimited" />
                <ComparisonRow feature="100 Laws Podcast Access" free={true} pro={true} />
                <ComparisonRow feature="Export Reports & Decks" free={false} pro={true} />
                <ComparisonRow feature="Priority Support" free={false} pro={true} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 md:px-8 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <FAQItem
              question="Can I try Pro features before subscribing?"
              answer="Yes! Start with our free tier to explore Hakivo. You can upgrade to Pro anytime to unlock unlimited briefings, bill tracking, and advanced AI features."
            />
            <FAQItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards through Stripe. Your payment information is securely processed and never stored on our servers."
            />
            <FAQItem
              question="Can I cancel anytime?"
              answer="Absolutely. You can cancel your Pro subscription at any time from your account settings. You'll continue to have Pro access until the end of your billing period."
            />
            <FAQItem
              question="Is there a discount for annual billing?"
              answer="Yes! Pay annually and get Hakivo Pro for $99/year — that's $8.25/month, saving you 31% compared to monthly billing."
            />
            <FAQItem
              question="Do you offer discounts for nonprofits or educators?"
              answer="Yes, we offer special pricing for nonprofits, educational institutions, and civic organizations. Contact us at tarik@hakivo.app to learn more."
            />
            <FAQItem
              question="What's included in the free tier?"
              answer="The free tier includes 3 audio briefings per month, tracking up to 3 bills, following 3 representatives, basic bill summaries, and full access to our 100 Laws That Shaped America podcast."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-8 py-24 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />

        <h2 className="text-3xl md:text-4xl font-bold mb-4 max-w-2xl mx-auto">
          Ready to become a more informed citizen?
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
          Join thousands who are taking control of their civic engagement.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild className="rounded-full px-8 h-14 text-base font-semibold">
            <Link href="/auth/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-wrap justify-between items-center gap-6">
            <div>
              <div className="text-lg font-bold mb-1">Hakivo</div>
              <div className="text-sm text-muted-foreground">Civic engagement for the podcast generation.</div>
            </div>
            <div className="flex gap-6">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link href="mailto:tarik@hakivo.app" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureItem({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${highlight ? 'bg-primary' : 'bg-primary/20'}`}>
        <Check className={`w-3 h-3 ${highlight ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
      <span className={highlight ? 'font-medium' : 'text-muted-foreground'}>{children}</span>
    </li>
  )
}

function ComparisonRow({
  feature,
  free,
  pro
}: {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
}) {
  return (
    <tr>
      <td className="py-4 pr-4">{feature}</td>
      <td className="text-center py-4 px-4">
        {typeof free === 'boolean' ? (
          free ? (
            <Check className="w-5 h-5 text-primary mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        ) : (
          <span className="text-muted-foreground">{free}</span>
        )}
      </td>
      <td className="text-center py-4 pl-4">
        {typeof pro === 'boolean' ? (
          pro ? (
            <Check className="w-5 h-5 text-primary mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        ) : (
          <span className="font-medium text-primary">{pro}</span>
        )}
      </td>
    </tr>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h3 className="text-lg font-semibold mb-2">{question}</h3>
      <p className="text-muted-foreground leading-relaxed">{answer}</p>
    </div>
  )
}
