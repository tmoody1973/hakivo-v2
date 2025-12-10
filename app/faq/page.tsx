"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  HelpCircle,
  User,
  Mic,
  MessageSquare,
  FileText,
  Users,
  Headphones,
  CreditCard,
  AlertCircle,
  Mail,
  ChevronDown
} from 'lucide-react'
import { useState } from "react"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  icon: React.ReactNode
  items: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    title: "General",
    icon: <HelpCircle className="w-5 h-5" />,
    items: [
      {
        question: "What is Hakivo?",
        answer: "Hakivo is a civic engagement platform that transforms Congressional legislation into personalized audio briefings and provides AI-powered tools to help you understand and engage with the legislative process."
      },
      {
        question: "Who is Hakivo for?",
        answer: "Hakivo is for citizens who want to stay informed about legislation, advocates tracking specific policy areas, students learning about civics, journalists covering Congress, and anyone curious about how laws are made."
      },
      {
        question: "Is Hakivo nonpartisan?",
        answer: "Yes. Hakivo provides factual information about legislation and representatives without political bias. We present voting records and bill summaries objectively."
      },
      {
        question: "Where does Hakivo get its data?",
        answer: "We source data from Congress.gov (official federal legislation), OpenSecrets (campaign finance), GovTrack (historical voting records), state legislature APIs, and trusted news sources."
      }
    ]
  },
  {
    title: "Account & Privacy",
    icon: <User className="w-5 h-5" />,
    items: [
      {
        question: "How do I create an account?",
        answer: "Visit hakivo.com and click Sign Up. You can register with email/password or use Google Sign-In for quick access."
      },
      {
        question: "Is my data private?",
        answer: "Yes. We don't sell your personal data. Your tracked bills, policy interests, and chat history are private. See our Privacy Policy for details."
      },
      {
        question: "Can I delete my account?",
        answer: "Yes. Go to Settings > Account > Delete Account. This permanently removes all your data and cannot be undone."
      },
      {
        question: "What happens to my data if I cancel Pro?",
        answer: "Your data is preserved when downgrading. You keep access to existing documents and tracked items within Free tier limits."
      }
    ]
  },
  {
    title: "Daily Briefings",
    icon: <Mic className="w-5 h-5" />,
    items: [
      {
        question: "How are briefings personalized?",
        answer: "Briefings are generated based on your selected policy interests, your location (state/district), bills you're tracking, and representatives you follow."
      },
      {
        question: "When are briefings available?",
        answer: "New briefings generate each morning. You can set your preferred delivery time (6 AM - 10 AM) in Settings > Policy Interests."
      },
      {
        question: "Why is my briefing short?",
        answer: "Briefing length varies based on Congressional activity. Slow legislative periods produce shorter briefings."
      },
      {
        question: "Can I get briefings via email?",
        answer: "Pro subscribers can enable daily email briefings in Settings > Notifications."
      }
    ]
  },
  {
    title: "Congressional Assistant",
    icon: <MessageSquare className="w-5 h-5" />,
    items: [
      {
        question: "What can I ask the Assistant?",
        answer: "You can ask about bill information and summaries, representative voting records, how legislation works, policy area questions, and request document generation."
      },
      {
        question: "Is the Assistant always accurate?",
        answer: "The Assistant uses official Congressional data and AI analysis. While highly accurate, we recommend verifying critical information with primary sources for important decisions."
      },
      {
        question: "Are my conversations private?",
        answer: "Yes. Your conversations are encrypted and not shared with third parties."
      },
      {
        question: "Can I share conversations?",
        answer: "Yes, use the Share Thread feature to create a shareable link to any conversation."
      }
    ]
  },
  {
    title: "Bills & Legislation",
    icon: <FileText className="w-5 h-5" />,
    items: [
      {
        question: "How current is bill information?",
        answer: "Bill data syncs with Congress.gov multiple times daily. Most updates appear within hours of official action."
      },
      {
        question: "What's the difference between federal and state bills?",
        answer: "Federal bills are U.S. Congress legislation available to all users. State bills are state legislature legislation and are a Pro feature."
      },
      {
        question: "Why can't I find a specific bill?",
        answer: "Check the bill number format (H.R. vs HR), verify it's from the current Congress, or try searching by title or sponsor name instead."
      },
      {
        question: "What do bill statuses mean?",
        answer: "Introduced means filed but not yet considered. In Committee means under review. Passed House/Senate means approved by one chamber. Signed means enacted into law. Vetoed means rejected by the President."
      }
    ]
  },
  {
    title: "Representatives",
    icon: <Users className="w-5 h-5" />,
    items: [
      {
        question: "How do you determine my representatives?",
        answer: "Your ZIP code maps to your Congressional district. We then identify your district's House representative and your state's two Senators."
      },
      {
        question: "What if my ZIP code crosses district lines?",
        answer: "Try entering your full address in the search, or contact support for manual assignment to the correct district."
      },
      {
        question: "Can I view any representative, not just mine?",
        answer: "Yes! Use the Representatives search to find and view any member of Congress, regardless of your location."
      }
    ]
  },
  {
    title: "Podcast",
    icon: <Headphones className="w-5 h-5" />,
    items: [
      {
        question: "Is the podcast free?",
        answer: "Yes, all 100 episodes of 'Signed Into Law' covering landmark legislation from 1900-2000 are completely free for all users."
      },
      {
        question: "Can I listen offline?",
        answer: "Subscribe via Apple Podcasts or Spotify to download episodes for offline listening on your mobile device."
      },
      {
        question: "Will there be new episodes?",
        answer: "The 100-episode historical series is complete. We occasionally release bonus episodes covering current events and new legislation."
      }
    ]
  },
  {
    title: "Subscription & Billing",
    icon: <CreditCard className="w-5 h-5" />,
    items: [
      {
        question: "Is there a free trial?",
        answer: "The Free tier provides ongoing access to core features with no time limit. Try it as long as you like before upgrading to Pro."
      },
      {
        question: "How much does Pro cost?",
        answer: "Hakivo Pro is $12/month or $99/year (save 31%). This includes unlimited briefings, bill tracking, representative following, and more."
      },
      {
        question: "How do I cancel Pro?",
        answer: "Go to Settings > Subscription > Manage Subscription > Cancel. Your Pro access continues until the end of your billing period."
      },
      {
        question: "Can I get a refund?",
        answer: "Yes, we offer full refunds within 14 days of purchase. Contact support@hakivo.com."
      },
      {
        question: "Do you offer student/nonprofit discounts?",
        answer: "Yes, we offer 50% off Pro for verified students, teachers, and 501(c)(3) nonprofits. Contact support with verification."
      }
    ]
  },
  {
    title: "Technical Issues",
    icon: <AlertCircle className="w-5 h-5" />,
    items: [
      {
        question: "The audio won't play",
        answer: "Check your internet connection, ensure your browser allows audio playback, try a different browser, or clear your browser cache."
      },
      {
        question: "I'm not receiving emails",
        answer: "Check your spam folder, add support@hakivo.com to your contacts, and verify notifications are enabled in Settings."
      },
      {
        question: "The site is slow",
        answer: "Check your internet connection, clear your browser cache, try a different browser, or contact support if issues persist."
      },
      {
        question: "Bill/representative data seems wrong",
        answer: "Data updates several times daily. Very recent changes may take a few hours. Report persistent errors to support."
      }
    ]
  }
]

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left hover:text-primary transition-colors"
      >
        <span className="font-medium pr-4">{item.question}</span>
        <ChevronDown className={cn(
          "w-5 h-5 text-muted-foreground transition-transform flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isOpen ? "max-h-96 pb-5" : "max-h-0"
      )}>
        <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
      </div>
    </div>
  )
}

function FAQSection({ category, openIndex, setOpenIndex, sectionIndex }: {
  category: FAQCategory
  openIndex: string | null
  setOpenIndex: (index: string | null) => void
  sectionIndex: number
}) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
            {category.icon}
          </div>
          <h2 className="text-lg font-bold">{category.title}</h2>
        </div>
      </div>
      <div className="px-6">
        {category.items.map((item, itemIndex) => {
          const key = `${sectionIndex}-${itemIndex}`
          return (
            <FAQAccordion
              key={key}
              item={item}
              isOpen={openIndex === key}
              onToggle={() => setOpenIndex(openIndex === key ? null : key)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)

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
      <section className="pt-32 pb-16 px-6 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <HelpCircle className="w-4 h-4" />
            Help Center
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Frequently Asked{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Questions</span>
              <span className="absolute bottom-2 left-0 right-0 h-4 bg-primary/30 -z-0 rounded" />
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about Hakivo. Can't find what you're looking for?
            Reach out to our support team.
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="px-6 md:px-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-3">
            {faqCategories.map((category, index) => (
              <a
                key={index}
                href={`#section-${index}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
              >
                {category.icon}
                {category.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="px-6 md:px-8 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {faqCategories.map((category, sectionIndex) => (
            <div key={sectionIndex} id={`section-${sectionIndex}`} className="scroll-mt-24">
              <FAQSection
                category={category}
                openIndex={openIndex}
                setOpenIndex={setOpenIndex}
                sectionIndex={sectionIndex}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-6 md:px-8 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-8 md:p-12 border border-primary/20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground mx-auto mb-6">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Still have questions?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Can't find what you're looking for? Our support team is here to help.
              Use the feedback widget or send us an email.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild className="rounded-full px-6">
                <Link href="mailto:support@hakivo.com">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Support
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full px-6">
                <Link href="/about">
                  Learn About Us
                  <ArrowRight className="w-4 h-4 ml-2" />
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
          Ready to get started?
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
          Join thousands of citizens who are taking control of their civic engagement.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild className="rounded-full px-8 h-14 text-base font-semibold">
            <Link href="/auth/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-14 text-base font-semibold border-2">
            <Link href="/pricing">View Pricing</Link>
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
              <Link href="/faq" className="text-sm text-foreground font-medium">FAQ</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link href="mailto:info@hakivo.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
