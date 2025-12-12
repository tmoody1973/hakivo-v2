"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Mic, Headphones, Menu, X } from 'lucide-react'
import { useState } from "react"
import { HakivoLogo } from "@/components/hakivo-logo"
import Image from "next/image"

export default function HomePage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: "/podcast", label: "Podcast" },
    { href: "/about", label: "About" },
    { href: "/pricing", label: "Pricing" },
    { href: "/faq", label: "FAQ" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Craft-style centered layout */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <HakivoLogo height={28} className="text-primary" />
          </Link>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center justify-center flex-1 px-8">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Button asChild size="sm" className="rounded-full px-5">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-3 rounded-lg hover:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-border/50 space-y-2">
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-3 rounded-lg hover:bg-accent"
                >
                  Log In
                </Link>
                <Button asChild className="w-full rounded-full">
                  <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-8 md:pt-28 md:pb-12">
        {/* Text Content - Centered */}
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <span className="text-base">🎵</span>
            Inspired by a classic you already know
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Your personal<br />
            <span className="relative inline-block">
              <span className="relative z-10">civic command center.</span>
              <span className="absolute bottom-2 left-0 right-0 h-3 md:h-4 bg-primary/30 -z-0 rounded" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Track legislation, hear daily audio briefings, and take action on the issues that matter to you —
            all in one place. AI-powered civic engagement for the podcast generation.
          </p>

          {/* CTA Buttons - Centered */}
          <div className="flex flex-wrap justify-center gap-4 mb-12 md:mb-16">
            <Button size="lg" asChild className="rounded-full px-8 h-12 md:h-14 text-base font-semibold bg-primary hover:bg-primary/90">
              <Link href="/auth/signup">
                <AudioWave />
                Get Started Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-12 md:h-14 text-base font-semibold border-2">
              <Link href="#how-it-works">
                See How It Works
              </Link>
            </Button>
          </div>
        </div>

        {/* Product Mockup - Full width with perspective */}
        <div className="relative max-w-6xl mx-auto px-4 md:px-8">
          {/* Glow effect behind image */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-primary/5 to-transparent blur-3xl -z-10" />

          {/* Browser mockup frame */}
          <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-black/40 bg-card">
            {/* Browser top bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-muted/50 rounded-md px-4 py-1 text-xs text-muted-foreground flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  hakivo.com/dashboard
                </div>
              </div>
              <div className="w-16" /> {/* Spacer for balance */}
            </div>

            {/* Dashboard screenshot */}
            <div className="relative">
              <Image
                src="/hakivo-shot.png"
                alt="Hakivo Dashboard - Track your representatives, daily briefs, and podcast"
                width={1920}
                height={1080}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>

          {/* Fade to background at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
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
                      src="/im-just-a-bill.jpg"
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

      {/* Your Personal Legislative Aide */}
      <section className="px-6 md:px-8 py-20 md:py-28 bg-gradient-to-b from-background to-primary/5">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="text-base">🏛️</span>
              Congressional-level support for everyone
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your personal <span className="text-primary">legislative aide</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Members of Congress rely on legislative aides to track bills, research policy, and keep them informed.
              Now you have the same advantage.
            </p>
          </div>

          {/* What Legislative Aides Do */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: What aides do */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">What does a legislative aide do?</h3>
              <p className="text-muted-foreground leading-relaxed">
                On Capitol Hill, every member of Congress has a team of legislative aides — skilled professionals who
                spend their days monitoring thousands of bills, researching policy implications, tracking committee
                actions, and distilling complex legislation into clear briefings their boss can act on.
              </p>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                    📋
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Monitor legislation</h4>
                    <p className="text-sm text-muted-foreground">Track bills through committee, amendments, and floor votes</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                    🔍
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Research policy</h4>
                    <p className="text-sm text-muted-foreground">Analyze provisions, identify impacts, and summarize key points</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                    📝
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Brief their boss</h4>
                    <p className="text-sm text-muted-foreground">Deliver daily updates on what matters and what's changed</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                    🎯
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Filter the noise</h4>
                    <p className="text-sm text-muted-foreground">Surface only what's relevant based on priorities and interests</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: How Hakivo does it */}
            <div className="bg-card rounded-3xl p-8 border border-border shadow-xl">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
                <span className="text-base">✨</span>
                How Hakivo works for you
              </div>
              <h3 className="text-2xl font-bold mb-6">Same service. Powered by AI.</h3>
              <div className="space-y-5">
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 text-xl text-primary-foreground">
                    🤖
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">AI reads every bill for you</h4>
                    <p className="text-sm text-muted-foreground">Our AI analyzes the full text of legislation, not just summaries — catching details human aides might miss</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 text-xl text-primary-foreground">
                    🎧
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Daily audio briefings</h4>
                    <p className="text-sm text-muted-foreground">Like having an aide brief you each morning — personalized to your policy interests and representatives</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 text-xl text-primary-foreground">
                    💬
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Ask anything, get answers</h4>
                    <p className="text-sm text-muted-foreground">Questions about a bill? Just ask. Hakivo explains legislation in plain English, instantly</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 text-xl text-primary-foreground">
                    ⚡
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Real-time tracking</h4>
                    <p className="text-sm text-muted-foreground">Bills move fast. Hakivo monitors Congress.gov 24/7 and alerts you when things change</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-6 pt-6 border-t border-border">
                Typical congressional staff costs <span className="font-semibold text-foreground">$75,000+/year</span>. Hakivo starts at <span className="font-semibold text-primary">$12/month</span>.
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

      {/* Podcast Section */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Podcast Artwork & Player */}
            <div className="order-2 lg:order-1">
              <div className="relative">
                {/* Podcast Cover */}
                <div className="aspect-square max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/10">
                  <img
                    src="/podcast-hakivo.png"
                    alt="Signed Into Law - 100 Laws That Shaped America Podcast"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Floating Badge */}
                <div className="absolute -top-4 -right-4 md:right-8 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg">
                  <Mic className="w-4 h-4" />
                  A Hakivo Original
                </div>
              </div>

              {/* Spreaker Embed */}
              <div className="mt-8 rounded-2xl overflow-hidden bg-background/50 border border-border">
                <iframe
                  src="https://widget.spreaker.com/player?show_id=6817395&theme=dark&playlist=show&playlist-continuous=true&chapters-image=true&episode_image_position=left&hide-logo=false&hide-likes=true&hide-comments=true&hide-sharing=true&hide-download=true"
                  width="100%"
                  height="200"
                  frameBorder="0"
                  allow="autoplay"
                  title="Signed Into Law Podcast Player"
                  className="w-full"
                />
              </div>
            </div>

            {/* Podcast Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Headphones className="w-4 h-4" />
                New Episodes Daily
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                Signed Into Law:{" "}
                <span className="text-primary">The 100 Bills That Built Modern America</span>
              </h2>

              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                Every law tells a story — of movements that demanded change, crises that forced action,
                and compromises that shaped a nation. <strong>Signed Into Law</strong> is a daily podcast
                that unpacks the 100 most consequential pieces of U.S. legislation from 1900 to 2000.
              </p>

              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                From the Antiquities Act to the Americans with Disabilities Act, each 10-12 minute episode
                explores the debates behind the laws, the provisions within them, and the legacy they left.
                AI-generated voices bring history to life in a format perfect for your commute.
              </p>

              {/* Platform Links */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Button variant="outline" size="lg" asChild className="rounded-full gap-2">
                  <a href="https://podcasts.apple.com/us/podcast/100-laws-that-change-america/id1859402488" target="_blank" rel="noopener noreferrer">
                    <span className="text-lg">🎧</span>
                    Apple Podcasts
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild className="rounded-full gap-2">
                  <a href="https://open.spotify.com/show/0uXNW7aFYmjsihiIDOgVuB" target="_blank" rel="noopener noreferrer">
                    <span className="text-lg">🎵</span>
                    Spotify
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild className="rounded-full gap-2">
                  <a href="https://www.spreaker.com/show/6817395/episodes/feed" target="_blank" rel="noopener noreferrer">
                    <span className="text-lg">📡</span>
                    RSS Feed
                  </a>
                </Button>
              </div>

              {/* CTA */}
              <Button size="lg" asChild className="rounded-full px-8 h-14 text-base font-semibold">
                <Link href="/podcast">
                  Browse All Episodes
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
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
              <HakivoLogo height={24} className="text-foreground mb-1" />
              <div className="text-sm text-muted-foreground">Civic engagement for the podcast generation.</div>
            </div>
            <div className="flex gap-6">
              <Link href="/podcast" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Podcast</Link>
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
