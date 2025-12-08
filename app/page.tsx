"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from 'lucide-react'
import { useState } from "react"

export default function HomePage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

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
              href="/about"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              About
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Pricing
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
      <section className="min-h-screen flex flex-col justify-center px-6 md:px-8 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8 animate-fade-in">
            <span className="text-base">🎵</span>
            Inspired by a classic you already know
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Your personal<br />
            <span className="relative inline-block">
              <span className="relative z-10">civic command center.</span>
              <span className="absolute bottom-2 left-0 right-0 h-4 bg-primary/30 -z-0 rounded" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Track legislation, hear daily audio briefings, and take action on the issues that matter to you —
            all in one place. AI-powered civic engagement for the podcast generation.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild className="rounded-full px-8 h-14 text-base font-semibold bg-primary hover:bg-primary/90">
              <Link href="/auth/signup">
                <AudioWave />
                Get Started Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-14 text-base font-semibold border-2">
              <Link href="#how-it-works">
                See How It Works
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Schoolhouse Rock Origin Story */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Content */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                Remember learning how a bill becomes a law?{" "}
                <span className="text-primary">We built on that idea.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                In 1975, Schoolhouse Rock taught a generation of Americans how Congress works with a catchy tune
                and a cartoon bill sitting on Capitol Hill. It was brilliant — making civics accessible, memorable,
                and even fun.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Hakivo carries that torch into the AI era. We've built a civic hub that transforms dense
                Congressional legislation into personalized audio briefings, tracks your representatives' votes,
                and puts action at your fingertips — all powered by AI that actually understands what you care about.
              </p>

              {/* Era Comparison */}
              <div className="flex items-center justify-center gap-10 p-8 bg-background/50 rounded-2xl border border-border">
                <div className="text-center">
                  <span className="block text-4xl font-bold text-primary">1975</span>
                  <span className="text-base text-muted-foreground">3-minute cartoon</span>
                </div>
                <div className="text-3xl text-primary">→</div>
                <div className="text-center">
                  <span className="block text-4xl font-bold text-primary">2025</span>
                  <span className="text-base text-muted-foreground">Your personal civic hub</span>
                </div>
              </div>
            </div>

            {/* Video */}
            <div>
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/50 border border-border">
                {isVideoPlaying ? (
                  <iframe
                    src="https://www.youtube.com/embed/Otbml6WIQPo?autoplay=1"
                    title="Schoolhouse Rock - I'm Just a Bill"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                ) : (
                  <div
                    className="absolute inset-0 cursor-pointer group"
                    onClick={() => setIsVideoPlaying(true)}
                  >
                    <img
                      src="https://img.youtube.com/vi/Otbml6WIQPo/hqdefault.jpg"
                      alt="Schoolhouse Rock - I'm Just a Bill"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center mt-4 text-sm text-muted-foreground italic">
                The classic that started it all — "I'm Just a Bill" (1975)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 md:px-8 py-20 md:py-28">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">One hub. Three powerful actions.</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Tell us what matters to you. We bring everything together.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/50 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5">
              <div className="absolute -top-4 left-8 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                1
              </div>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                🎯
              </div>
              <h3 className="text-xl font-bold mb-3">Set Your Interests</h3>
              <p className="text-muted-foreground leading-relaxed">
                Healthcare? Climate? Small business? Choose the topics and your representatives. Hakivo filters the noise to find what matters to you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/50 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5">
              <div className="absolute -top-4 left-8 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                2
              </div>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                🎧
              </div>
              <h3 className="text-xl font-bold mb-3">Listen Daily</h3>
              <p className="text-muted-foreground leading-relaxed">
                Each morning, receive a 5-9 minute audio briefing. Natural voices explain complex bills in plain English, just like your favorite podcast.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-card rounded-3xl p-8 border border-border hover:border-primary/50 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5">
              <div className="absolute -top-4 left-8 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                3
              </div>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-6">
                📣
              </div>
              <h3 className="text-xl font-bold mb-3">Take Action</h3>
              <p className="text-muted-foreground leading-relaxed">
                One tap to contact your representatives. Track their votes. Stay engaged without spending hours researching.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for busy citizens</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Everything you need to stay informed and engaged with Congress.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="flex gap-5 bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 min-w-[56px] rounded-2xl bg-primary flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">AI-Powered Analysis</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Claude AI reads and summarizes legislation so you don't have to wade through legal jargon. Ask questions and get instant, clear explanations.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-5 bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 min-w-[56px] rounded-2xl bg-primary flex items-center justify-center text-2xl">
                🎙️
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Natural Voice Audio</h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI voices deliver your briefings in a warm, NPR-style format. Not robotic — genuinely pleasant to listen to.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-5 bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 min-w-[56px] rounded-2xl bg-primary flex items-center justify-center text-2xl">
                📍
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Your Representatives</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automatically tracks your senators and representative. See how they vote, contact them directly, hold them accountable.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-5 bg-card rounded-3xl p-8 border border-border hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 min-w-[56px] rounded-2xl bg-primary flex items-center justify-center text-2xl">
                ⚡
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Real-Time Updates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Connected directly to Congress.gov. When bills move, you know. No more being caught off guard by legislation that affects you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-8 py-24 md:py-32 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />

        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 max-w-2xl mx-auto">
          Your civic life, finally organized
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
          Start tracking legislation and hearing personalized briefings in minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild className="rounded-full px-8 h-14 text-base font-semibold">
            <Link href="/auth/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-14 text-base font-semibold border-2">
            <Link href="/auth/signin">Log In</Link>
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
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link href="mailto:info@hakivo.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Audio Wave Animation Component
function AudioWave() {
  return (
    <div className="flex items-center gap-0.5 h-5 mr-2">
      {[8, 16, 12, 20, 8].map((height, i) => (
        <span
          key={i}
          className="w-0.5 bg-primary-foreground rounded-full animate-pulse"
          style={{
            height: `${height}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  )
}
