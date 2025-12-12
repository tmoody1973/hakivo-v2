"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, ArrowRight } from 'lucide-react'
import { HakivoLogo } from "@/components/hakivo-logo"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6 md:px-8 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center">
            <HakivoLogo height={32} className="text-primary" showBeta />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/podcast"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block"
            >
              Podcast
            </Link>
            <Link
              href="/about"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block"
            >
              About
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block"
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
      <section className="pt-32 pb-12 px-6 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            Your Privacy Matters
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Privacy Policy
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Last updated: December 2024
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 md:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg prose-invert max-w-none">

            {/* Introduction */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Hakivo ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our civic engagement platform and related services.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-0">
                By using Hakivo, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </div>

            {/* Information We Collect */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Information We Collect</h2>

              <h3 className="text-lg font-semibold mb-3 mt-6">Information You Provide</h3>
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
                <li><strong>Profile Information:</strong> ZIP code, state, city, and policy interests to personalize your experience</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through Stripe (we do not store full card numbers)</li>
                <li><strong>Communications:</strong> Messages you send through our support channels or feedback widget</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">Information Collected Automatically</h3>
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the platform</li>
                <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
                <li><strong>Log Data:</strong> IP address, access times, referring URLs</li>
                <li><strong>Cookies:</strong> Session cookies for authentication and preferences</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">Information from Third Parties</h3>
              <ul className="text-muted-foreground space-y-2 mb-0">
                <li><strong>Authentication Providers:</strong> If you sign in with Google, we receive your name and email</li>
                <li><strong>Legislative Data:</strong> Public information from Congress.gov, state legislatures, and other government sources</li>
              </ul>
            </div>

            {/* How We Use Your Information */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-0">
                <li>Provide, maintain, and improve our services</li>
                <li>Generate personalized daily audio briefings based on your interests and location</li>
                <li>Identify your Congressional representatives based on your ZIP code</li>
                <li>Track legislation and send notifications about bills you follow</li>
                <li>Process payments and manage subscriptions</li>
                <li>Respond to your comments, questions, and support requests</li>
                <li>Send you technical notices, updates, and administrative messages</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
              </ul>
            </div>

            {/* AI and Data Processing */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">AI and Data Processing</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Hakivo uses artificial intelligence to provide our services:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li><strong>Daily Briefings:</strong> AI analyzes public legislative data against your interests to generate personalized audio summaries</li>
                <li><strong>Congressional Assistant:</strong> Your questions are processed by AI to provide relevant answers about legislation and representatives</li>
                <li><strong>Document Generation:</strong> AI creates reports and presentations based on public legislative data</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-0">
                <strong>Important:</strong> Your conversations with the Congressional Assistant are private and encrypted. We do not use your personal conversations to train AI models or share them with third parties.
              </p>
            </div>

            {/* Information Sharing */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Information Sharing</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not sell your personal information. We may share information in the following circumstances:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-0">
                <li><strong>Service Providers:</strong> With vendors who perform services on our behalf (payment processing, hosting, analytics)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to respond to legal process</li>
                <li><strong>Safety:</strong> To protect the rights, property, or safety of Hakivo, our users, or others</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you explicitly choose to share (e.g., sharing a document via public link)</li>
              </ul>
            </div>

            {/* Data Security */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information, including:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li>Encryption of data in transit (HTTPS/TLS)</li>
                <li>Secure authentication and session management</li>
                <li>Regular security assessments</li>
                <li>Limited employee access to personal data</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-0">
                However, no method of transmission over the Internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </div>

            {/* Your Rights and Choices */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Your Rights and Choices</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information in Settings</li>
                <li><strong>Deletion:</strong> Delete your account and associated data via Settings &gt; Account</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails or disable notifications</li>
                <li><strong>Data Portability:</strong> Request your data in a portable format</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-0">
                To exercise these rights, contact us at privacy@hakivo.com or use the relevant features in your account settings.
              </p>
            </div>

            {/* Data Retention */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed mb-0">
                We retain your personal information for as long as your account is active or as needed to provide services. If you delete your account, we will delete or anonymize your personal information within 30 days, except where retention is required by law or for legitimate business purposes (such as resolving disputes or enforcing agreements).
              </p>
            </div>

            {/* Children's Privacy */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed mb-0">
                Hakivo is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly. If you believe we have information from a child under 13, please contact us at privacy@hakivo.com.
              </p>
            </div>

            {/* Third-Party Services */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Our platform integrates with third-party services that have their own privacy policies:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-0">
                <li><strong>Stripe:</strong> Payment processing (<a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
                <li><strong>Google:</strong> Authentication and analytics (<a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>)</li>
                <li><strong>WorkOS:</strong> Authentication services (<a href="https://workos.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">WorkOS Privacy Policy</a>)</li>
                <li><strong>Anthropic:</strong> AI services (<a href="https://www.anthropic.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Anthropic Privacy Policy</a>)</li>
              </ul>
            </div>

            {/* Changes to This Policy */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed mb-0">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
              </p>
            </div>

            {/* Contact Us */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-8">
              <h2 className="text-2xl font-bold mb-4 mt-0">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="text-muted-foreground space-y-2 mb-0">
                <li><strong>Email:</strong> <a href="mailto:privacy@hakivo.com" className="text-primary hover:underline">privacy@hakivo.com</a></li>
                <li><strong>General Support:</strong> <a href="mailto:support@hakivo.com" className="text-primary hover:underline">support@hakivo.com</a></li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 md:px-8 py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Ready to get started?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Join Hakivo and take control of your civic engagement.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild className="rounded-full px-8">
            <Link href="/auth/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-full px-8">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-wrap justify-between items-center gap-6">
            <div>
              <HakivoLogo height={24} className="text-foreground mb-1" showBeta />
              <div className="text-sm text-muted-foreground">Civic engagement for the podcast generation.</div>
            </div>
            <div className="flex gap-6">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/privacy" className="text-sm text-foreground font-medium">Privacy</Link>
              <Link href="mailto:info@hakivo.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
