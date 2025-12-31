'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { ErrorState } from "@/components/ui/error-state";
import { useOnline } from "@/lib/hooks/use-online";
import { useSubscription } from "@/lib/subscription/subscription-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Crown, Check, Zap, Bell, FileText, Users, Bookmark, Loader2, ExternalLink, Download, Presentation, Globe, RefreshCw, FolderOpen } from 'lucide-react';

/**
 * Document type from gamma_documents table
 */
interface GammaDocument {
  id: string;
  gamma_url: string | null;
  gamma_thumbnail_url: string | null;
  title: string;
  format: 'presentation' | 'document' | 'webpage';
  card_count: number;
  pdf_url: string | null;
  pptx_url: string | null;
  status: string;
  created_at: number;
}

const POLICY_INTERESTS = [
  { id: 'environment-energy', label: 'Environment & Energy', icon: '🌱' },
  { id: 'health-welfare', label: 'Health & Social Welfare', icon: '🏥' },
  { id: 'economy-finance', label: 'Economy & Finance', icon: '💰' },
  { id: 'education-science', label: 'Education & Science', icon: '🎓' },
  { id: 'civil-rights-law', label: 'Civil Rights & Law', icon: '⚖️' },
  { id: 'commerce-labor', label: 'Commerce & Labor', icon: '🏭' },
  { id: 'government-politics', label: 'Government & Politics', icon: '🏛️' },
  { id: 'foreign-policy-defense', label: 'Foreign Policy & Defense', icon: '🌍' },
  { id: 'housing-urban', label: 'Housing & Urban Development', icon: '🏘️' },
  { id: 'agriculture-food', label: 'Agriculture & Food', icon: '🌾' },
  { id: 'sports-arts-culture', label: 'Sports, Arts & Culture', icon: '🎨' },
  { id: 'immigration-indigenous', label: 'Immigration & Indigenous Issues', icon: '🗽' },
];

interface SettingsPageClientProps {
  initialFirstName?: string;
  initialLastName?: string;
  initialEmail?: string;
  initialZipCode?: string;
  initialCity?: string;
  initialInterests?: string[];
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const SettingsPageClient: FC<SettingsPageClientProps> = ({
  initialFirstName = 'Jane',
  initialLastName = 'Doe',
  initialEmail = 'jane@example.com',
  initialZipCode = '02108',
  initialCity = 'Boston',
  initialInterests = ['health-welfare', 'education-science', 'climate-environment'],
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isOnline = useOnline();
  const { accessToken } = useAuth();

  // Documents state
  const [documents, setDocuments] = useState<GammaDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Fetch documents when documents tab is active
  const fetchDocuments = useCallback(async () => {
    if (!accessToken) return;

    setIsLoadingDocs(true);
    setDocsError(null);

    try {
      const response = await fetch('/api/gamma/documents', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('[Settings] Error fetching documents:', err);
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoadingDocs(false);
    }
  }, [accessToken]);

  // Load documents when tab changes
  useEffect(() => {
    if (activeTab === 'documents') {
      fetchDocuments();
    }
  }, [activeTab, fetchDocuments]);

  // Subscription state
  const {
    subscription,
    usage,
    features,
    isLoading: isSubscriptionLoading,
    openCheckout,
    openBillingPortal,
    getUsagePercentage,
  } = useSubscription();

  // Profile state
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [zipCode, setZipCode] = useState(initialZipCode);
  const [city, setCity] = useState(initialCity);

  // Policy interests state
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialInterests);

  // Preferences state
  const [briefingTime, setBriefingTime] = useState('08:00');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoplay, setAutoplay] = useState(false);

  const handleInterestToggle = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleSaveProfile = async () => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/user/profile', {
      //   method: 'PUT',
      //   body: JSON.stringify({ firstName, lastName, email, zipCode, city }),
      // });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      setSuccessMessage('Profile saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Get auth token
      const token = localStorage.getItem("hakivo_access_token");
      if (!token) {
        setError("Please sign in to save preferences.");
        return;
      }

      // Save interests to SmartMemory profile via chat service
      const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_API_URL ||
        "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

      const response = await fetch(`${chatServiceUrl}/memory/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          interests: selectedInterests,
          briefingTime,
          emailNotifications,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save: ${response.status}`);
      }

      setSuccessMessage('Preferences saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    if (activeTab === 'profile') {
      handleSaveProfile();
    } else {
      handleSavePreferences();
    }
  };

  return (
    <div className="w-full px-6 md:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M5 13l4 4L19 7"></path>
          </svg>
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <ErrorState
          message={error}
          type={!isOnline ? "network" : "server"}
          retry={handleRetry}
        />
      )}

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex md:flex-col gap-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'profile'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left flex items-center gap-2 ${
              activeTab === 'subscription'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <Crown className="w-4 h-4" />
            Subscription
          </button>
          <button
            onClick={() => setActiveTab('interests')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'interests'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Policy Interests
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'notifications'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'audio'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Audio
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <Presentation className="w-4 h-4" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'account'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Account
          </button>
        </nav>

        <div className="space-y-6">
          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {/* Current Plan Card */}
              <div className="rounded-lg border bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">
                        {subscription.isPro ? 'Hakivo Pro' : 'Free Plan'}
                      </h2>
                      {subscription.isPro && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Crown className="w-3 h-3" />
                          Pro
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subscription.isPro
                        ? 'Full access to all features'
                        : 'Limited access with usage restrictions'}
                    </p>
                  </div>
                  {!subscription.isPro && (
                    <button
                      onClick={openCheckout}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Upgrade to Pro
                    </button>
                  )}
                </div>

                {subscription.isPro && subscription.endsAt && (
                  <div className="bg-muted/50 p-3 rounded-md text-sm">
                    <p className="text-muted-foreground">
                      Your subscription renews on{' '}
                      <span className="text-foreground font-medium">
                        {new Date(subscription.endsAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </p>
                  </div>
                )}

                {/* Pro Features List */}
                {!subscription.isPro && (
                  <div className="border-t pt-6">
                    <h3 className="font-medium mb-4">Upgrade to Pro for:</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {[
                        { icon: FileText, text: 'Unlimited daily briefs' },
                        { icon: Bookmark, text: 'Unlimited bill tracking' },
                        { icon: Users, text: 'Unlimited member follows' },
                        { icon: FileText, text: 'Unlimited document exports' },
                        { icon: Bell, text: 'Real-time bill alerts' },
                        { icon: Zap, text: 'Priority AI processing' },
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span>{feature.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">$12</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cancel anytime. No commitment required.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Usage Statistics */}
              <div className="rounded-lg border bg-card p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Usage This Month</h2>
                  <p className="text-sm text-muted-foreground">
                    {subscription.isPro
                      ? 'Unlimited usage on your Pro plan'
                      : 'Your current usage against free tier limits'}
                  </p>
                </div>

                {isSubscriptionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Briefs Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Daily Briefs
                        </span>
                        <span className="text-muted-foreground">
                          {subscription.isPro ? (
                            'Unlimited'
                          ) : (
                            `${usage.briefs.used} / ${usage.briefs.limit}`
                          )}
                        </span>
                      </div>
                      {!subscription.isPro && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              getUsagePercentage('briefs') >= 100
                                ? 'bg-destructive'
                                : getUsagePercentage('briefs') >= 67
                                ? 'bg-yellow-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, getUsagePercentage('briefs'))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Tracked Bills Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-muted-foreground" />
                          Tracked Bills
                        </span>
                        <span className="text-muted-foreground">
                          {subscription.isPro ? (
                            'Unlimited'
                          ) : (
                            `${usage.trackedBills.count} / ${usage.trackedBills.limit}`
                          )}
                        </span>
                      </div>
                      {!subscription.isPro && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              getUsagePercentage('trackedBills') >= 100
                                ? 'bg-destructive'
                                : getUsagePercentage('trackedBills') >= 67
                                ? 'bg-yellow-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, getUsagePercentage('trackedBills'))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Followed Members Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          Followed Members
                        </span>
                        <span className="text-muted-foreground">
                          {subscription.isPro ? (
                            'Unlimited'
                          ) : (
                            `${usage.followedMembers.count} / ${usage.followedMembers.limit}`
                          )}
                        </span>
                      </div>
                      {!subscription.isPro && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              getUsagePercentage('followedMembers') >= 100
                                ? 'bg-destructive'
                                : getUsagePercentage('followedMembers') >= 67
                                ? 'bg-yellow-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, getUsagePercentage('followedMembers'))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Artifacts Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Documents Created
                        </span>
                        <span className="text-muted-foreground">
                          {subscription.isPro ? (
                            'Unlimited'
                          ) : (
                            `${usage.artifacts.used} / ${usage.artifacts.limit}`
                          )}
                        </span>
                      </div>
                      {!subscription.isPro && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              getUsagePercentage('artifacts') >= 100
                                ? 'bg-destructive'
                                : getUsagePercentage('artifacts') >= 67
                                ? 'bg-yellow-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, getUsagePercentage('artifacts'))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!subscription.isPro && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={openCheckout}
                      className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Upgrade for Unlimited Access
                    </button>
                  </div>
                )}
              </div>

              {/* Billing Management (Pro only) */}
              {subscription.isPro && (
                <div className="rounded-lg border bg-card p-6 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Billing</h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your subscription and payment method
                    </p>
                  </div>
                  <button
                    onClick={openBillingPortal}
                    className="px-4 py-2 border rounded-md hover:bg-accent font-medium"
                  >
                    Manage Billing
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Profile Information</h2>
                <p className="text-sm text-muted-foreground">
                  Update your personal information and location
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSaving}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ZIP Code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      maxLength={5}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Congressional District</label>
                  <input
                    type="text"
                    defaultValue="MA-08"
                    disabled
                    className="w-full px-3 py-2 bg-muted border rounded-md text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically determined from your ZIP code
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !isOnline}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="px-4 py-2 border rounded-md hover:bg-accent" disabled={isSaving}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Policy Interests Tab */}
          {activeTab === 'interests' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Policy Interests</h2>
                <p className="text-sm text-muted-foreground">
                  Select topics you'd like to follow in your daily briefings
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {POLICY_INTERESTS.map((interest) => (
                  <button
                    key={interest.id}
                    onClick={() => handleInterestToggle(interest.id)}
                    disabled={isSaving}
                    className={`p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedInterests.includes(interest.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{interest.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{interest.label}</div>
                      </div>
                      {selectedInterests.includes(interest.id) && (
                        <svg
                          className="w-5 h-5 text-primary"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  <strong>{selectedInterests.length}</strong> interest{selectedInterests.length !== 1 ? 's' : ''} selected
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brief Delivery Time</label>
                  <select
                    value={briefingTime}
                    onChange={(e) => setBriefingTime(e.target.value)}
                    disabled={isSaving}
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="06:00">6:00 AM</option>
                    <option value="07:00">7:00 AM</option>
                    <option value="08:00">8:00 AM</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  disabled={isSaving || !isOnline}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Notifications</h2>
                <p className="text-sm text-muted-foreground">
                  Manage how you receive updates
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive daily brief notifications via email
                    </p>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      emailNotifications ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Bill Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when tracked bills have new actions
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary" disabled={isSaving}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Summary</p>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly recap of legislative activity
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary" disabled={isSaving}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  disabled={isSaving || !isOnline}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Audio Preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Customize your listening experience
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Playback Speed</label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    disabled={isSaving}
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="0.75">0.75x</option>
                    <option value="1.0">1.0x (Normal)</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.75">1.75x</option>
                    <option value="2.0">2.0x</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Autoplay Next Brief</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play the next brief after current one ends
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoplay(!autoplay)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      autoplay ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoplay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Skip Intro/Outro</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically skip intro and outro segments
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted" disabled={isSaving}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  disabled={isSaving || !isOnline}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Generated Documents</h2>
                  <p className="text-sm text-muted-foreground">
                    View and access your Gamma documents
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchDocuments}
                    disabled={isLoadingDocs}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <a
                    href="/studio"
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Create New
                  </a>
                </div>
              </div>

              {/* Loading State */}
              {isLoadingDocs && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Error State */}
              {docsError && !isLoadingDocs && (
                <div className="text-center py-8">
                  <p className="text-destructive mb-2">{docsError}</p>
                  <button
                    onClick={fetchDocuments}
                    className="text-sm text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!isLoadingDocs && !docsError && documents.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Documents Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Create professional documents from your legislative data in Hakivo Studio.
                  </p>
                  <a
                    href="/studio"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    <FileText className="h-4 w-4" />
                    Go to Studio
                  </a>
                </div>
              )}

              {/* Documents List */}
              {!isLoadingDocs && !docsError && documents.length > 0 && (
                <div className="space-y-4">
                  {documents.map((doc) => {
                    const FormatIcon = doc.format === 'presentation' ? Presentation : doc.format === 'webpage' ? Globe : FileText;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="w-24 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                          {doc.gamma_thumbnail_url ? (
                            <img
                              src={doc.gamma_thumbnail_url}
                              alt={doc.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FormatIcon className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-1">{doc.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 capitalize">
                              <FormatIcon className="h-3.5 w-3.5" />
                              {doc.format}
                            </span>
                            {doc.card_count > 0 && (
                              <span>{doc.card_count} slides</span>
                            )}
                            <span>{formatDate(doc.created_at)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {doc.gamma_url && (
                            <a
                              href={doc.gamma_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent flex items-center gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View in Gamma
                            </a>
                          )}
                          {doc.pdf_url && (
                            <a
                              href={doc.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent flex items-center gap-1.5"
                            >
                              <Download className="h-3.5 w-3.5" />
                              PDF
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Account Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your account and security
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Change Password</h3>
                  <button className="px-4 py-2 border rounded-md hover:bg-accent" disabled={isSaving}>
                    Update Password
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Connected Accounts</h3>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        G
                      </div>
                      <div>
                        <p className="font-medium">Google</p>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    <button className="text-sm text-destructive hover:underline" disabled={isSaving}>
                      Disconnect
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-medium text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                  <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90" disabled={isSaving}>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
