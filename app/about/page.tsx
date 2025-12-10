"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Heart, Lightbulb, Users, Radio, Mic2, Code2, Zap } from 'lucide-react'

export default function AboutPage() {
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
              href="/podcast"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Podcast
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              FAQ
            </Link>
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
            <Heart className="w-4 h-4" />
            Our Story
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Democracy works better when{" "}
            <span className="relative inline-block">
              <span className="relative z-10">everyone's paying attention.</span>
              <span className="absolute bottom-2 left-0 right-0 h-4 bg-primary/30 -z-0 rounded" />
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Hakivo exists because staying informed about government shouldn't require a law degree,
            a political science background, or hours of free time you don't have.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                The problem is simple:{" "}
                <span className="text-primary">civic engagement is broken.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                Most Americans can name their favorite reality TV contestants but not their state legislators.
                It's not because people don't care — it's because the system makes it nearly impossible to care effectively.
              </p>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                Bills are written in impenetrable legalese. Congressional schedules change without notice.
                Your representatives vote on dozens of issues that affect your daily life, and unless you're
                watching C-SPAN religiously, you'll never know about it.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We built Hakivo to change that. Not by dumbing things down, but by meeting people where they are —
                in their earbuds during their morning commute, in their inbox with clear summaries,
                and on their phones with one-tap action tools.
              </p>
            </div>

            {/* Values Cards */}
            <div className="grid gap-4">
              <div className="flex gap-5 bg-background/50 rounded-2xl p-6 border border-border">
                <div className="w-12 h-12 min-w-[48px] rounded-xl bg-primary flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Clarity Over Complexity</h3>
                  <p className="text-muted-foreground">
                    AI transforms legal jargon into plain English. No PhD required.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 bg-background/50 rounded-2xl p-6 border border-border">
                <div className="w-12 h-12 min-w-[48px] rounded-xl bg-primary flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Nonpartisan by Design</h3>
                  <p className="text-muted-foreground">
                    We present facts, not spin. Democracy works when everyone has the same information.
                  </p>
                </div>
              </div>

              <div className="flex gap-5 bg-background/50 rounded-2xl p-6 border border-border">
                <div className="w-12 h-12 min-w-[48px] rounded-xl bg-primary flex items-center justify-center">
                  <Mic2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Audio-First Experience</h3>
                  <p className="text-muted-foreground">
                    Because informed citizenship should fit into your life, not the other way around.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Origin Story - Hackathon */}
      <section className="px-6 md:px-8 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Origin Story
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Born from a hackathon. Built for a movement.
            </h2>
          </div>

          <div className="bg-card rounded-3xl p-8 md:p-12 border border-border">
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Hakivo was created for the{" "}
              <a
                href="https://liquidmetal.devpost.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                LiquidMetal Devpost Hackathon
              </a>
              , where developers were challenged to build applications that push the boundaries of what's possible
              with serverless edge computing and AI.
            </p>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              But this wasn't just an engineering exercise. The hackathon became a forcing function to build something
              I'd been thinking about for years: a tool that makes civic engagement as seamless as checking your favorite
              podcast app.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The result is a full-stack civic intelligence platform: real-time bill tracking from Congress.gov and
              all 50 state legislatures, AI-powered analysis using Claude, personalized audio briefings with
              Google's Gemini TTS, and the <em>100 Laws That Shaped America</em> podcast auto-published to Spreaker.
              All running on Cloudflare Workers through LiquidMetal's Raindrop framework.
            </p>
          </div>
        </div>
      </section>

      {/* Who Uses Hakivo */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for everyone who cares</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hakivo serves anyone who believes an informed citizenry is the foundation of democracy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Educators */}
            <div className="bg-background/50 rounded-3xl p-8 border border-border hover:border-primary/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                📚
              </div>
              <h3 className="text-xl font-bold mb-3">Educators & Teachers</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Bring civics to life in your classroom. Use Hakivo to track real bills in real time,
                show students how legislation actually moves through Congress, and spark discussions
                about issues affecting their communities.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Real-time bill tracking for current events lessons
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  AI summaries make complex legislation accessible
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  100 Laws podcast for engaging history content
                </li>
              </ul>
            </div>

            {/* Advocacy Groups */}
            <div className="bg-background/50 rounded-3xl p-8 border border-border hover:border-primary/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                📣
              </div>
              <h3 className="text-xl font-bold mb-3">Advocacy Groups & Nonprofits</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Stay ahead of legislation that impacts your mission. Monitor bills across federal and
                state levels, mobilize your community with timely alerts, and give your members the
                tools to contact representatives effectively.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Track unlimited bills across all 50 states
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Deep AI analysis of bill impacts and stakeholders
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  One-tap representative contact tools
                </li>
              </ul>
            </div>

            {/* Journalists */}
            <div className="bg-background/50 rounded-3xl p-8 border border-border hover:border-primary/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                🗞️
              </div>
              <h3 className="text-xl font-bold mb-3">Journalists & Media Outlets</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Never miss a story. Hakivo surfaces legislative activity the moment it happens,
                provides AI-powered context on complex bills, and tracks how representatives vote
                on issues your audience cares about.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Real-time alerts on bill movements and votes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Section-by-section bill breakdowns for reporting
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Representative voting records and contact info
                </li>
              </ul>
            </div>

            {/* Students */}
            <div className="bg-background/50 rounded-3xl p-8 border border-border hover:border-primary/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                🎓
              </div>
              <h3 className="text-xl font-bold mb-3">Students & Young Voters</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Your voice matters — and now you have the tools to use it. Hakivo makes it easy to
                understand what's happening in government, find your representatives, and take action
                on issues that affect your future.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Daily audio briefings fit your busy schedule
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Plain-English explanations of complex issues
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Free tier perfect for getting started
                </li>
              </ul>
            </div>
          </div>

          {/* Team/Enterprise CTA */}
          <div className="mt-12 bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-8 border border-primary/20 text-center">
            <h3 className="text-xl font-bold mb-2">Need Hakivo for your organization?</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              We offer special pricing for nonprofits, educational institutions, newsrooms, and civic organizations.
            </p>
            <Button variant="outline" asChild className="rounded-full px-6">
              <Link href="mailto:info@hakivo.com?subject=Hakivo Team Inquiry">
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Photo/Visual */}
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="aspect-square max-w-md mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-border overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                        <span className="text-5xl font-bold text-primary-foreground">TM</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Radio className="w-4 h-4 text-primary" />
                          <span>20+ years in media</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Code2 className="w-4 h-4 text-primary" />
                          <span>Non-technical founder</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Heart className="w-4 h-4 text-primary" />
                          <span>Louisville → Atlanta → Milwaukee</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio Content */}
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                Hi, I'm Tarik.{" "}
                <span className="text-primary">I'm not a developer.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                At least, not in the traditional sense. I started my career studying architecture at Howard University,
                then spent 14 years in the Army Reserves as a signal officer. For the past two decades, I've worked in
                media and radio — most recently as Director of Innovation at 88Nine Radio Milwaukee, where I launched
                88Nine Labs and helped create HYFIN, an urban music station.
              </p>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                I've always been fascinated by the intersection of different worlds. My Substack,{" "}
                <a
                  href="https://tarikmoody.substack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  The Intersection
                </a>
                , explores how food, music, technology, and culture collide to create something new.
                Hakivo is an extension of that philosophy.
              </p>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                I built Hakivo because I believe the most meaningful work finds you when you're not looking for it.
                After years of watching civic technology remain stuck in the "for wonks, by wonks" paradigm,
                I saw an opportunity to bring the accessibility mindset of media and podcasting to democratic participation.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Sometimes you don't need to be a developer to build something. You just need Claude,
                a clear vision, and the stubborn belief that democracy deserves better tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Acknowledgment */}
      <section className="px-6 md:px-8 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Built with care</h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Hakivo stands on the shoulders of incredible open source projects and APIs.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              "Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui",
              "Cloudflare Workers", "LiquidMetal Raindrop", "Claude AI", "Gemini",
              "Congress.gov API", "OpenStates", "WorkOS", "Stripe", "Spreaker"
            ].map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 bg-card border border-border rounded-full text-sm font-medium text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>

          <p className="text-muted-foreground">
            Special thanks to the LiquidMetal team for creating the infrastructure that makes Hakivo possible.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-8 py-24 md:py-32 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />

        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl mx-auto">
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
          <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-14 text-base font-semibold border-2">
            <Link href="/">Back to Home</Link>
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
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link href="mailto:info@hakivo.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
