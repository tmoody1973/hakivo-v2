'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserPreferences, updateUserProfile, updateUserPreferences } from '@/lib/api/backend';
import { useTracking, TrackedFederalBill, TrackedStateBill } from '@/lib/hooks/use-tracking';
import { subscriptionApi, SubscriptionStatus } from '@/lib/raindrop-client';

// Artifact type from API
interface UserArtifact {
  id: string;
  user_id: string;
  type: 'report' | 'slides';
  template: string;
  title: string;
  subject_type?: string;
  subject_id?: string;
  audience?: string;
  is_public: boolean;
  share_token?: string;
  view_count: number;
  created_at: string;
}

// Gamma Document type from API
interface GammaDocument {
  id: string;
  user_id: string;
  artifact_id?: string;
  gamma_generation_id: string;
  gamma_url?: string;
  gamma_thumbnail_url?: string;
  title: string;
  format: 'presentation' | 'document' | 'webpage' | 'social';
  template?: string;
  card_count: number;
  pdf_url?: string;
  pptx_url?: string;
  is_public: boolean;
  share_token?: string;
  view_count: number;
  subject_type?: string;
  subject_id?: string;
  audience?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

const POLICY_INTERESTS = [
  { name: 'Environment & Energy', icon: '🌱' },
  { name: 'Health & Social Welfare', icon: '🏥' },
  { name: 'Economy & Finance', icon: '💰' },
  { name: 'Education & Science', icon: '🎓' },
  { name: 'Civil Rights & Law', icon: '⚖️' },
  { name: 'Commerce & Labor', icon: '🏭' },
  { name: 'Government & Politics', icon: '🏛️' },
  { name: 'Foreign Policy & Defense', icon: '🌍' },
  { name: 'Housing & Urban Development', icon: '🏘️' },
  { name: 'Agriculture & Food', icon: '🌾' },
  { name: 'Sports, Arts & Culture', icon: '🎨' },
  { name: 'Immigration & Indigenous Issues', icon: '🗽' },
];

const US_STATES = [
  { abbr: '', name: 'Select your state' },
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'PR', name: 'Puerto Rico' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { accessToken, refreshToken, user, updateAccessToken } = useAuth();
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [untrackingId, setUntrackingId] = useState<string | null>(null);

  // Tracking hook
  const {
    trackedItems,
    counts,
    loading: trackingLoading,
    untrackFederalBill,
    untrackStateBill,
  } = useTracking({ token: accessToken });

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [userState, setUserState] = useState('');
  const [congressionalDistrict, setCongressionalDistrict] = useState('');

  // Policy interests state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Preferences state
  const [briefingTime, setBriefingTime] = useState('08:00');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoplay, setAutoplay] = useState(false);

  // Document generation preferences state
  const [docDefaultFormat, setDocDefaultFormat] = useState<'presentation' | 'document' | 'webpage'>('presentation');
  const [docDefaultTemplate, setDocDefaultTemplate] = useState<string>('policy_brief');
  const [docDefaultAudience, setDocDefaultAudience] = useState('General audience');
  const [docDefaultTone, setDocDefaultTone] = useState('Professional and informative');
  const [docAutoExportPdf, setDocAutoExportPdf] = useState(false);
  const [docAutoEnrich, setDocAutoEnrich] = useState(true);
  const [docTextAmount, setDocTextAmount] = useState<'brief' | 'medium' | 'detailed' | 'extensive'>('medium');
  const [docImageSource, setDocImageSource] = useState<'stock' | 'ai' | 'none'>('stock');

  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Documents/Artifacts state
  const [artifacts, setArtifacts] = useState<UserArtifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsPagination, setArtifactsPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
  });
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);
  const [sharingArtifactId, setSharingArtifactId] = useState<string | null>(null);

  // Gamma Documents state
  const [documentFilter, setDocumentFilter] = useState<'all' | 'artifacts' | 'gamma'>('all');
  const [gammaDocuments, setGammaDocuments] = useState<GammaDocument[]>([]);
  const [gammaLoading, setGammaLoading] = useState(false);
  const [gammaPagination, setGammaPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
  });
  const [deletingGammaId, setDeletingGammaId] = useState<string | null>(null);
  const [sharingGammaId, setSharingGammaId] = useState<string | null>(null);
  const [downloadingExportId, setDownloadingExportId] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'pptx' | null>(null);

  // Load subscription status
  useEffect(() => {
    const loadSubscription = async () => {
      if (!user?.id) return;

      setSubscriptionLoading(true);
      try {
        const status = await subscriptionApi.getStatus(user.id);
        setSubscriptionStatus(status);
      } catch (error) {
        console.error('[Settings] Error loading subscription:', error);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, [user?.id]);

  // Load user artifacts
  const loadArtifacts = useCallback(async (page = 1) => {
    if (!accessToken) return;

    setArtifactsLoading(true);
    try {
      const response = await fetch(`/api/artifacts?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.artifacts || []);
        setArtifactsPagination(data.pagination || {
          page: 1,
          limit: 10,
          totalCount: 0,
          totalPages: 0,
        });
      }
    } catch (error) {
      console.error('[Settings] Error loading artifacts:', error);
    } finally {
      setArtifactsLoading(false);
    }
  }, [accessToken]);

  // Load Gamma documents
  const loadGammaDocuments = useCallback(async (page = 1) => {
    if (!accessToken) return;

    setGammaLoading(true);
    try {
      const response = await fetch(`/api/gamma/documents?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGammaDocuments(data.documents || []);
        setGammaPagination({
          page: page,
          limit: data.limit || 10,
          totalCount: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / (data.limit || 10)),
        });
      }
    } catch (error) {
      console.error('[Settings] Error loading Gamma documents:', error);
    } finally {
      setGammaLoading(false);
    }
  }, [accessToken]);

  // Load artifacts and gamma documents when documents tab is active
  useEffect(() => {
    if (activeTab === 'documents' && accessToken) {
      loadArtifacts(1);
      loadGammaDocuments(1);
    }
  }, [activeTab, accessToken, loadArtifacts, loadGammaDocuments]);

  // Handle artifact deletion
  const handleDeleteArtifact = async (artifactId: string) => {
    if (!accessToken) return;
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;

    setDeletingArtifactId(artifactId);
    try {
      const response = await fetch(`/api/artifacts?id=${artifactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        setArtifacts(prev => prev.filter(a => a.id !== artifactId));
        setArtifactsPagination(prev => ({
          ...prev,
          totalCount: prev.totalCount - 1,
        }));
      } else {
        alert('Failed to delete document. Please try again.');
      }
    } catch (error) {
      console.error('[Settings] Error deleting artifact:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingArtifactId(null);
    }
  };

  // Handle artifact share toggle
  const handleToggleShare = async (artifactId: string, currentlyPublic: boolean) => {
    if (!accessToken) return;

    setSharingArtifactId(artifactId);
    try {
      const response = await fetch('/api/artifacts', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artifactId,
          isPublic: !currentlyPublic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setArtifacts(prev => prev.map(a =>
          a.id === artifactId
            ? { ...a, is_public: data.artifact.is_public, share_token: data.artifact.share_token }
            : a
        ));
        if (data.shareUrl) {
          await navigator.clipboard.writeText(data.shareUrl);
          alert('Share link copied to clipboard!');
        }
      } else {
        alert('Failed to update sharing status. Please try again.');
      }
    } catch (error) {
      console.error('[Settings] Error toggling share:', error);
      alert('Failed to update sharing status. Please try again.');
    } finally {
      setSharingArtifactId(null);
    }
  };

  // Handle Gamma document deletion
  const handleDeleteGammaDoc = async (docId: string) => {
    if (!accessToken) return;
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;

    setDeletingGammaId(docId);
    try {
      const response = await fetch(`/api/gamma/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        setGammaDocuments(prev => prev.filter(d => d.id !== docId));
        setGammaPagination(prev => ({
          ...prev,
          totalCount: prev.totalCount - 1,
        }));
      } else {
        alert('Failed to delete document. Please try again.');
      }
    } catch (error) {
      console.error('[Settings] Error deleting Gamma document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingGammaId(null);
    }
  };

  // Handle Gamma document share toggle
  const handleToggleGammaShare = async (docId: string, currentlyPublic: boolean) => {
    if (!accessToken) return;

    setSharingGammaId(docId);
    try {
      const response = await fetch(`/api/gamma/documents/${docId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPublic: !currentlyPublic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGammaDocuments(prev => prev.map(d =>
          d.id === docId
            ? { ...d, is_public: data.isPublic, share_token: data.shareToken }
            : d
        ));
        if (data.shareUrl) {
          await navigator.clipboard.writeText(data.shareUrl);
          alert('Share link copied to clipboard!');
        }
      } else {
        alert('Failed to update sharing status. Please try again.');
      }
    } catch (error) {
      console.error('[Settings] Error toggling Gamma share:', error);
      alert('Failed to update sharing status. Please try again.');
    } finally {
      setSharingGammaId(null);
    }
  };

  // Handle downloading export (PDF or PPTX) from Gamma
  const handleDownloadExport = async (doc: GammaDocument, format: 'pdf' | 'pptx') => {
    if (!accessToken) return;

    // If URL already exists, open directly
    const existingUrl = format === 'pdf' ? doc.pdf_url : doc.pptx_url;
    if (existingUrl) {
      window.open(existingUrl, '_blank');
      return;
    }

    // Fetch export URL from Gamma and save to database
    setDownloadingExportId(doc.id);
    setDownloadingFormat(format);
    try {
      const response = await fetch(`/api/gamma/save/${doc.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exportFormats: [format] }),
      });

      if (response.ok) {
        const data = await response.json();
        const url = format === 'pdf' ? data.exports?.pdf : data.exports?.pptx;

        if (url) {
          // Update local state with the new URL
          setGammaDocuments(prev => prev.map(d =>
            d.id === doc.id
              ? { ...d, [format === 'pdf' ? 'pdf_url' : 'pptx_url']: url }
              : d
          ));
          // Open the download in a new tab
          window.open(url, '_blank');
        } else if (data.gammaUrl) {
          // Export not available from API - offer to open Gamma directly
          const openGamma = confirm(
            `${format.toUpperCase()} export is not available for this document (it may have been created before export support was added).\n\nWould you like to open it in Gamma to download manually?`
          );
          if (openGamma) {
            window.open(data.gammaUrl, '_blank');
          }
        } else {
          alert(`${format.toUpperCase()} export is not available. Please try regenerating the document.`);
        }
      } else {
        const error = await response.json();
        console.error('[Settings] Error downloading export:', error);
        alert(`Failed to download ${format.toUpperCase()}. Please try again.`);
      }
    } catch (error) {
      console.error('[Settings] Error downloading export:', error);
      alert(`Failed to download ${format.toUpperCase()}. Please try again.`);
    } finally {
      setDownloadingExportId(null);
      setDownloadingFormat(null);
    }
  };

  // Get Gamma format icon
  const getGammaFormatIcon = (format: string) => {
    switch (format) {
      case 'presentation':
        return '📊';
      case 'document':
        return '📄';
      case 'webpage':
        return '🌐';
      case 'social':
        return '📱';
      default:
        return '📄';
    }
  };

  // Get template display label
  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      bill_analysis: 'Bill Analysis',
      rep_scorecard: 'Rep Scorecard',
      vote_breakdown: 'Vote Breakdown',
      policy_brief: 'Policy Brief',
      lesson_deck: 'Lesson Deck',
      advocacy_deck: 'Advocacy Deck',
      news_brief: 'News Brief',
      district_briefing: 'District Briefing',
      week_in_congress: 'Week in Congress',
      bill_comparison: 'Bill Comparison',
      voting_analysis: 'Voting Analysis',
    };
    return labels[template] || template;
  };

  // Handle upgrade to Pro
  const handleUpgrade = async () => {
    if (!user?.id) return;

    setUpgradeLoading(true);
    try {
      // Get checkout URL from our API (server creates the Stripe session)
      const checkoutInfo = await subscriptionApi.createCheckout(
        user.id,
        `${window.location.origin}/settings?tab=subscription&upgrade=success`,
        `${window.location.origin}/settings?tab=subscription&upgrade=canceled`
      );

      // Redirect to Stripe Checkout
      if (checkoutInfo.checkoutUrl) {
        window.location.href = checkoutInfo.checkoutUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('[Settings] Upgrade error:', error);
      alert('Failed to start checkout. Please try again.');
      setUpgradeLoading(false);
    }
  };

  // Handle manage subscription (billing portal)
  const handleManageSubscription = async () => {
    if (!user?.id) return;

    setPortalLoading(true);
    try {
      const portalInfo = await subscriptionApi.createPortal(
        user.id,
        `${window.location.origin}/settings?tab=subscription`
      );

      // Redirect to Stripe billing portal
      if (portalInfo.portalUrl) {
        window.location.href = portalInfo.portalUrl;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('[Settings] Portal error:', error);
      alert('Failed to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!accessToken) return;

      try {
        console.log('[Settings] Loading user preferences...');
        console.log('[Settings] Access token:', accessToken ? 'present' : 'missing');
        console.log('[Settings] Refresh token:', refreshToken ? 'present' : 'missing');

        // Pass refresh token and callback to update access token if it expires
        const response = await getUserPreferences(
          accessToken,
          refreshToken || undefined,
          (newAccessToken) => {
            console.log('[Settings] Access token refreshed, updating auth context');
            updateAccessToken(newAccessToken);
          }
        );

        console.log('[Settings] Response:', response);
        if (response.success && response.data) {
          console.log('[Settings] User preferences loaded:', response.data);

          // Set user profile data
          setFirstName(user?.firstName || '');
          setLastName(user?.lastName || '');
          setEmail(user?.email || '');
          setCity(response.data.city || '');
          setZipCode(response.data.zipCode || '');
          setUserState(response.data.state || '');
          setCongressionalDistrict(
            response.data.congressionalDistrict ||
            (response.data.state && response.data.district
              ? `${response.data.state}-${response.data.district}`
              : '')
          );

          // Set policy interests
          setSelectedInterests(response.data.policyInterests || []);

          // Set other preferences
          setBriefingTime(response.data.briefingTime || '08:00');
          setEmailNotifications(response.data.emailNotifications !== false);
          setPlaybackSpeed(response.data.playbackSpeed || 1.0);
          setAutoplay(response.data.autoPlay || false);

          // Set document generation preferences
          setDocDefaultFormat(response.data.docDefaultFormat || 'presentation');
          setDocDefaultTemplate(response.data.docDefaultTemplate || 'policy_brief');
          setDocDefaultAudience(response.data.docDefaultAudience || 'General audience');
          setDocDefaultTone(response.data.docDefaultTone || 'Professional and informative');
          setDocAutoExportPdf(response.data.docAutoExportPdf || false);
          setDocAutoEnrich(response.data.docAutoEnrich !== false);
          setDocTextAmount(response.data.docTextAmount || 'medium');
          setDocImageSource(response.data.docImageSource || 'stock');
        }
      } catch (error) {
        console.error('[Settings] Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [accessToken, refreshToken, user, updateAccessToken]);

  const handleInterestToggle = (interestName: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestName)
        ? prev.filter((name) => name !== interestName)
        : [...prev, interestName]
    );
  };

  const handleSaveProfile = async () => {
    if (!accessToken) {
      alert('Not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      // Update user profile (name only)
      await updateUserProfile(accessToken, {
        firstName,
        lastName,
      });

      // Update preferences (includes zipCode and state if changed)
      await updateUserPreferences(accessToken, {
        policyInterests: selectedInterests,
        zipCode,
        state: userState,
        briefingTime,
        emailNotifications,
        playbackSpeed,
        autoPlay: autoplay,
        // Document generation preferences
        docDefaultFormat,
        docDefaultTemplate,
        docDefaultAudience,
        docDefaultTone,
        docAutoExportPdf,
        docAutoEnrich,
        docTextAmount,
        docImageSource,
      });

      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!accessToken) {
      alert('Not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      // Save to main auth/preferences endpoint (for dashboard)
      await updateUserPreferences(accessToken, {
        policyInterests: selectedInterests,
        briefingTime,
        emailNotifications,
        playbackSpeed,
        autoPlay: autoplay,
        // Document generation preferences
        docDefaultFormat,
        docDefaultTemplate,
        docDefaultAudience,
        docDefaultTone,
        docAutoExportPdf,
        docAutoEnrich,
        docTextAmount,
        docImageSource,
      });

      // ALSO sync interests to chat service's memory/profile (for C1 chat personalization)
      // C1 chat reads from /memory/profile, so we need to keep both in sync
      const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_API_URL ||
        "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

      try {
        const memoryResponse = await fetch(`${chatServiceUrl}/memory/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            interests: selectedInterests,
            briefingTime,
            emailNotifications,
          }),
        });

        if (!memoryResponse.ok) {
          console.warn('[Settings] Failed to sync interests to chat service:', memoryResponse.status);
        } else {
          console.log('[Settings] Interests synced to chat service memory/profile');
        }
      } catch (memoryError) {
        // Don't fail the whole save if chat service sync fails
        console.warn('[Settings] Error syncing to chat service:', memoryError);
      }

      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUntrackFederal = async (bill: TrackedFederalBill) => {
    setUntrackingId(bill.trackingId);
    await untrackFederalBill(bill.billId, bill.trackingId);
    setUntrackingId(null);
  };

  const handleUntrackState = async (bill: TrackedStateBill) => {
    setUntrackingId(bill.trackingId);
    await untrackStateBill(bill.billId, bill.trackingId);
    setUntrackingId(null);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPartyColor = (party?: string) => {
    switch (party?.toUpperCase()) {
      case 'D':
      case 'DEMOCRAT':
      case 'DEMOCRATIC':
        return 'text-blue-600';
      case 'R':
      case 'REPUBLICAN':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
            onClick={() => setActiveTab('tracked')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'tracked'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Tracked Items
            {counts && counts.total > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                {counts.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'documents'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Documents
            {artifactsPagination.totalCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                {artifactsPagination.totalCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'subscription'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Subscription
            {subscriptionStatus?.subscription.isPro && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                Pro
              </span>
            )}
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
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <select
                    value={userState}
                    onChange={(e) => setUserState(e.target.value)}
                    className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {US_STATES.map((state) => (
                      <option key={state.abbr} value={state.abbr}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Used to show state legislation relevant to you
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Congressional District</label>
                  <input
                    type="text"
                    value={congressionalDistrict || 'Not set'}
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Changes
                </button>
                <button className="px-4 py-2 border rounded-md hover:bg-accent">
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
                    key={interest.name}
                    onClick={() => handleInterestToggle(interest.name)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedInterests.includes(interest.name)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{interest.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{interest.name}</div>
                      </div>
                      {selectedInterests.includes(interest.name) && (
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
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Preferences
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
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
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Settings
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
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Document Generation Preferences */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-1">Document Generation</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Default settings for professional documents created via Gamma
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Default Format */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Format</label>
                    <select
                      value={docDefaultFormat}
                      onChange={(e) => setDocDefaultFormat(e.target.value as 'presentation' | 'document' | 'webpage')}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="presentation">Presentation (Slides)</option>
                      <option value="document">Document (Report)</option>
                      <option value="webpage">Webpage</option>
                    </select>
                  </div>

                  {/* Default Template */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Template</label>
                    <select
                      value={docDefaultTemplate}
                      onChange={(e) => setDocDefaultTemplate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="lesson_guide">Lesson Guide (Education)</option>
                      <option value="advocacy_deck">Advocacy Presentation</option>
                      <option value="policy_brief">Policy Brief</option>
                      <option value="citizen_explainer">Citizen Explainer</option>
                      <option value="news_summary">News Summary</option>
                      <option value="executive_summary">Executive Summary</option>
                      <option value="research_report">Research Report</option>
                      <option value="social_share">Social Media Shareable</option>
                    </select>
                  </div>

                  {/* Default Audience */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Audience</label>
                    <input
                      type="text"
                      value={docDefaultAudience}
                      onChange={(e) => setDocDefaultAudience(e.target.value)}
                      placeholder="e.g., General audience, Teachers, Policy makers"
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Default Tone */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Tone</label>
                    <select
                      value={docDefaultTone}
                      onChange={(e) => setDocDefaultTone(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Professional and informative">Professional</option>
                      <option value="Educational and engaging">Educational</option>
                      <option value="Persuasive and compelling">Persuasive</option>
                      <option value="Simple and accessible">Simple</option>
                      <option value="Formal and analytical">Formal</option>
                      <option value="Journalistic and factual">Journalistic</option>
                    </select>
                  </div>

                  {/* Text Amount */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content Amount</label>
                    <select
                      value={docTextAmount}
                      onChange={(e) => setDocTextAmount(e.target.value as 'brief' | 'medium' | 'detailed' | 'extensive')}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="brief">Brief (Concise)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="detailed">Detailed (Comprehensive)</option>
                      <option value="extensive">Extensive (In-depth)</option>
                    </select>
                  </div>

                  {/* Image Source */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Image Source</label>
                    <select
                      value={docImageSource}
                      onChange={(e) => setDocImageSource(e.target.value as 'stock' | 'ai' | 'none')}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="stock">Stock Photos</option>
                      <option value="ai">AI Generated</option>
                      <option value="none">No Images</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Auto Export PDF */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-export to PDF</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate PDF when document is created
                      </p>
                    </div>
                    <button
                      onClick={() => setDocAutoExportPdf(!docAutoExportPdf)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        docAutoExportPdf ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          docAutoExportPdf ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto Enrich */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-enrich Content</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically add bill details, news, and related legislation
                      </p>
                    </div>
                    <button
                      onClick={() => setDocAutoEnrich(!docAutoEnrich)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        docAutoEnrich ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          docAutoEnrich ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Tracked Items Tab */}
          {activeTab === 'tracked' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Tracked Items</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your tracked legislation and bookmarked articles
                </p>
              </div>

              {trackingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Federal Bills Section */}
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      Federal Bills
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {trackedItems?.federalBills.length || 0}
                      </span>
                    </h3>
                    {(!trackedItems?.federalBills || trackedItems.federalBills.length === 0) ? (
                      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                        No federal bills tracked.{' '}
                        <Link href="/legislation" className="text-primary hover:underline">
                          Browse legislation
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trackedItems.federalBills.map((bill) => (
                          <div
                            key={bill.trackingId}
                            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/bills/${bill.billId}`}
                                  className="font-medium hover:underline block"
                                >
                                  {bill.billType.toUpperCase()} {bill.billNumber}: {bill.title}
                                </Link>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                                  <span>Congress {bill.congress}</span>
                                  {bill.sponsor && (
                                    <span className={getPartyColor(bill.sponsor.party)}>
                                      {bill.sponsor.firstName} {bill.sponsor.lastName} ({bill.sponsor.party}-{bill.sponsor.state})
                                    </span>
                                  )}
                                  {bill.policyArea && <span>{bill.policyArea}</span>}
                                  {bill.latestActionDate && (
                                    <span>Last action: {formatDate(bill.latestActionDate)}</span>
                                  )}
                                </div>
                                {bill.latestActionText && (
                                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                    {bill.latestActionText}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleUntrackFederal(bill)}
                                disabled={untrackingId === bill.trackingId}
                                className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {untrackingId === bill.trackingId ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* State Bills Section */}
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      State Bills
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {trackedItems?.stateBills.length || 0}
                      </span>
                    </h3>
                    {(!trackedItems?.stateBills || trackedItems.stateBills.length === 0) ? (
                      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                        No state bills tracked.{' '}
                        <Link href="/legislation?tab=state" className="text-primary hover:underline">
                          Browse state legislation
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trackedItems.stateBills.map((bill) => (
                          <div
                            key={bill.trackingId}
                            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/state-bills/${encodeURIComponent(bill.billId)}`}
                                  className="font-medium hover:underline block"
                                >
                                  {bill.identifier}: {bill.title || 'Untitled'}
                                </Link>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                                  <span className="font-medium">{bill.stateName}</span>
                                  {bill.session && <span>{bill.session}</span>}
                                  {bill.chamber && <span className="capitalize">{bill.chamber}</span>}
                                  {bill.latestActionDate && (
                                    <span>Last action: {formatDate(bill.latestActionDate)}</span>
                                  )}
                                </div>
                                {bill.latestActionDescription && (
                                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                    {bill.latestActionDescription}
                                  </p>
                                )}
                                {bill.subjects && bill.subjects.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {bill.subjects.slice(0, 3).map((subject) => (
                                      <span
                                        key={subject}
                                        className="text-xs px-2 py-0.5 bg-muted rounded"
                                      >
                                        {subject}
                                      </span>
                                    ))}
                                    {bill.subjects.length > 3 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{bill.subjects.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleUntrackState(bill)}
                                disabled={untrackingId === bill.trackingId}
                                className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {untrackingId === bill.trackingId ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {counts && counts.total > 0 && (
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm">
                        <strong>Total tracked:</strong> {counts.total} item{counts.total !== 1 ? 's' : ''}
                        {counts.federalBills > 0 && ` (${counts.federalBills} federal)`}
                        {counts.stateBills > 0 && ` (${counts.stateBills} state)`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Your Documents</h2>
                <p className="text-sm text-muted-foreground">
                  Manage reports, slide decks, and professional documents generated in chat
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                <button
                  onClick={() => setDocumentFilter('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    documentFilter === 'all'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                  {(artifactsPagination.totalCount + gammaPagination.totalCount) > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {artifactsPagination.totalCount + gammaPagination.totalCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDocumentFilter('artifacts')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    documentFilter === 'artifacts'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Chat Artifacts
                  {artifactsPagination.totalCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                      {artifactsPagination.totalCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDocumentFilter('gamma')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    documentFilter === 'gamma'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pro Documents
                  {gammaPagination.totalCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                      {gammaPagination.totalCount}
                    </span>
                  )}
                </button>
              </div>

              {(artifactsLoading || gammaLoading) ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (artifacts.length === 0 && gammaDocuments.length === 0) ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate reports and slides in chat to see them here
                  </p>
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Start a Chat
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Chat Artifacts Section */}
                  {(documentFilter === 'all' || documentFilter === 'artifacts') && artifacts.length > 0 && (
                    <div className="space-y-4">
                      {documentFilter === 'all' && (
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Chat Artifacts
                        </h3>
                      )}
                      <div className="space-y-3">
                        {artifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Type Icon */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  artifact.type === 'slides'
                                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                  {artifact.type === 'slides' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  )}
                                </div>

                                {/* Document Info */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">{artifact.title}</h4>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                                    <span className="px-2 py-0.5 bg-muted rounded text-xs">
                                      {getTemplateLabel(artifact.template)}
                                    </span>
                                    <span>
                                      {new Date(artifact.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    {artifact.view_count > 0 && (
                                      <span>{artifact.view_count} view{artifact.view_count !== 1 ? 's' : ''}</span>
                                    )}
                                    {artifact.is_public && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                                        Public
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* View */}
                                <Link
                                  href={`/artifacts/${artifact.share_token || artifact.id}`}
                                  className="p-2 hover:bg-accent rounded-md"
                                  title="View document"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </Link>

                                {/* Download PDF */}
                                <a
                                  href={`/api/artifacts/export?id=${artifact.id}&format=pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-accent rounded-md"
                                  title="Download PDF"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </a>

                                {/* Download PPTX (slides only) */}
                                {artifact.type === 'slides' && (
                                  <a
                                    href={`/api/artifacts/export?id=${artifact.id}&format=pptx`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-accent rounded-md"
                                    title="Download PowerPoint"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </a>
                                )}

                                {/* Share Toggle */}
                                <button
                                  onClick={() => handleToggleShare(artifact.id, artifact.is_public)}
                                  disabled={sharingArtifactId === artifact.id}
                                  className="p-2 hover:bg-accent rounded-md disabled:opacity-50"
                                  title={artifact.is_public ? 'Make private' : 'Share document'}
                                >
                                  {sharingArtifactId === artifact.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                  ) : (
                                    <svg className={`w-4 h-4 ${artifact.is_public ? 'text-green-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                  )}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteArtifact(artifact.id)}
                                  disabled={deletingArtifactId === artifact.id}
                                  className="p-2 hover:bg-destructive/10 text-destructive rounded-md disabled:opacity-50"
                                  title="Delete document"
                                >
                                  {deletingArtifactId === artifact.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-destructive border-t-transparent"></div>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Artifacts Pagination */}
                      {documentFilter === 'artifacts' && artifactsPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Showing {((artifactsPagination.page - 1) * artifactsPagination.limit) + 1} to{' '}
                            {Math.min(artifactsPagination.page * artifactsPagination.limit, artifactsPagination.totalCount)} of{' '}
                            {artifactsPagination.totalCount} artifacts
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadArtifacts(artifactsPagination.page - 1)}
                              disabled={artifactsPagination.page === 1 || artifactsLoading}
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => loadArtifacts(artifactsPagination.page + 1)}
                              disabled={artifactsPagination.page >= artifactsPagination.totalPages || artifactsLoading}
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gamma Pro Documents Section */}
                  {(documentFilter === 'all' || documentFilter === 'gamma') && gammaDocuments.length > 0 && (
                    <div className="space-y-4">
                      {documentFilter === 'all' && (
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          Pro Documents (Gamma)
                        </h3>
                      )}
                      <div className="space-y-3">
                        {gammaDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Format Icon with Thumbnail */}
                                <div className="relative flex-shrink-0">
                                  {doc.gamma_thumbnail_url ? (
                                    <img
                                      src={doc.gamma_thumbnail_url}
                                      alt={doc.title}
                                      className="w-16 h-12 rounded-lg object-cover border"
                                    />
                                  ) : (
                                    <div className="w-16 h-12 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-xl">
                                      {getGammaFormatIcon(doc.format)}
                                    </div>
                                  )}
                                  {doc.status === 'processing' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    </div>
                                  )}
                                </div>

                                {/* Document Info */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">{doc.title}</h4>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs capitalize">
                                      {doc.format}
                                    </span>
                                    {doc.template && (
                                      <span className="px-2 py-0.5 bg-muted rounded text-xs">
                                        {getTemplateLabel(doc.template)}
                                      </span>
                                    )}
                                    <span>
                                      {new Date(doc.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    {doc.card_count > 0 && (
                                      <span>{doc.card_count} slides</span>
                                    )}
                                    {doc.view_count > 0 && (
                                      <span>{doc.view_count} view{doc.view_count !== 1 ? 's' : ''}</span>
                                    )}
                                    {doc.is_public && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">
                                        Public
                                      </span>
                                    )}
                                    {doc.status === 'processing' && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs animate-pulse">
                                        Processing...
                                      </span>
                                    )}
                                    {doc.status === 'failed' && (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs">
                                        Failed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Open in Gamma */}
                                {doc.gamma_url && doc.status === 'completed' && (
                                  <a
                                    href={doc.gamma_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-accent rounded-md"
                                    title="Open in Gamma"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}

                                {/* Download PDF */}
                                {doc.status === 'completed' && (
                                  <button
                                    onClick={() => handleDownloadExport(doc, 'pdf')}
                                    disabled={downloadingExportId === doc.id && downloadingFormat === 'pdf'}
                                    className="p-2 hover:bg-accent rounded-md disabled:opacity-50"
                                    title={doc.pdf_url ? 'Download PDF' : 'Generate & Download PDF'}
                                  >
                                    {downloadingExportId === doc.id && downloadingFormat === 'pdf' ? (
                                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                                    ) : (
                                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    )}
                                  </button>
                                )}

                                {/* Download PPTX */}
                                {doc.status === 'completed' && (
                                  <button
                                    onClick={() => handleDownloadExport(doc, 'pptx')}
                                    disabled={downloadingExportId === doc.id && downloadingFormat === 'pptx'}
                                    className="p-2 hover:bg-accent rounded-md disabled:opacity-50"
                                    title={doc.pptx_url ? 'Download PowerPoint' : 'Generate & Download PowerPoint'}
                                  >
                                    {downloadingExportId === doc.id && downloadingFormat === 'pptx' ? (
                                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
                                    ) : (
                                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    )}
                                  </button>
                                )}

                                {/* Share Toggle */}
                                <button
                                  onClick={() => handleToggleGammaShare(doc.id, doc.is_public)}
                                  disabled={sharingGammaId === doc.id || doc.status !== 'completed'}
                                  className="p-2 hover:bg-accent rounded-md disabled:opacity-50"
                                  title={doc.is_public ? 'Make private' : 'Share document'}
                                >
                                  {sharingGammaId === doc.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                  ) : (
                                    <svg className={`w-4 h-4 ${doc.is_public ? 'text-green-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                  )}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteGammaDoc(doc.id)}
                                  disabled={deletingGammaId === doc.id}
                                  className="p-2 hover:bg-destructive/10 text-destructive rounded-md disabled:opacity-50"
                                  title="Delete document"
                                >
                                  {deletingGammaId === doc.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-destructive border-t-transparent"></div>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Gamma Pagination */}
                      {documentFilter === 'gamma' && gammaPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Showing {((gammaPagination.page - 1) * gammaPagination.limit) + 1} to{' '}
                            {Math.min(gammaPagination.page * gammaPagination.limit, gammaPagination.totalCount)} of{' '}
                            {gammaPagination.totalCount} documents
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadGammaDocuments(gammaPagination.page - 1)}
                              disabled={gammaPagination.page === 1 || gammaLoading}
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => loadGammaDocuments(gammaPagination.page + 1)}
                              disabled={gammaPagination.page >= gammaPagination.totalPages || gammaLoading}
                              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty states for filtered views */}
                  {documentFilter === 'artifacts' && artifacts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No chat artifacts yet. Generate reports and slides in chat to see them here.</p>
                    </div>
                  )}

                  {documentFilter === 'gamma' && gammaDocuments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No pro documents yet. Use the &quot;Create Pro Document&quot; button on any artifact to generate professional presentations.</p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">
                      {documentFilter === 'all' && (
                        <>
                          <strong>{artifactsPagination.totalCount + gammaPagination.totalCount}</strong> total documents
                          {artifactsPagination.totalCount > 0 && ` (${artifactsPagination.totalCount} artifacts`}
                          {gammaPagination.totalCount > 0 && `, ${gammaPagination.totalCount} pro)`}
                          {artifactsPagination.totalCount > 0 && gammaPagination.totalCount === 0 && ')'}
                        </>
                      )}
                      {documentFilter === 'artifacts' && (
                        <>
                          <strong>{artifactsPagination.totalCount}</strong> chat artifact{artifactsPagination.totalCount !== 1 ? 's' : ''}
                        </>
                      )}
                      {documentFilter === 'gamma' && (
                        <>
                          <strong>{gammaPagination.totalCount}</strong> pro document{gammaPagination.totalCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="rounded-lg border bg-card p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Your Subscription</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage your Hakivo Pro subscription
                  </p>
                </div>

                {subscriptionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : subscriptionStatus ? (
                  <div className="space-y-6">
                    {/* Plan Badge */}
                    <div className="flex items-center gap-4">
                      <div className={`px-4 py-2 rounded-lg ${
                        subscriptionStatus.subscription.isPro
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className="font-semibold text-lg">
                          {subscriptionStatus.subscription.isPro ? 'Hakivo Pro' : 'Free Plan'}
                        </span>
                      </div>
                      {subscriptionStatus.subscription.isPro && (
                        <span className="text-sm text-muted-foreground">
                          $12/month
                        </span>
                      )}
                    </div>

                    {/* Pro Features List */}
                    {!subscriptionStatus.subscription.isPro && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                          Upgrade to Hakivo Pro - $12/month
                        </h3>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Unlimited audio briefs (vs 3/month)
                          </li>
                          <li className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Unlimited bill tracking (vs 3 bills)
                          </li>
                          <li className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Unlimited member following (vs 3 members)
                          </li>
                          <li className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Daily briefing emails
                          </li>
                          <li className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Real-time vote alerts
                          </li>
                        </ul>
                        <button
                          onClick={handleUpgrade}
                          disabled={upgradeLoading}
                          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {upgradeLoading ? 'Processing...' : 'Upgrade to Pro'}
                        </button>
                      </div>
                    )}

                    {/* Pro Management */}
                    {subscriptionStatus.subscription.isPro && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 dark:bg-green-900/10">
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-200">
                              Thank you for being a Pro member!
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              You have access to all premium features.
                            </p>
                          </div>
                          <button
                            onClick={handleManageSubscription}
                            disabled={portalLoading}
                            className="px-4 py-2 border rounded-md hover:bg-accent text-sm disabled:opacity-50"
                          >
                            {portalLoading ? 'Loading...' : 'Manage Subscription'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Unable to load subscription status. Please try again later.
                  </div>
                )}
              </div>

              {/* Usage Stats */}
              {subscriptionStatus && (
                <div className="rounded-lg border bg-card p-6 space-y-4">
                  <h3 className="font-semibold">Your Usage</h3>

                  <div className="grid gap-4 md:grid-cols-4">
                    {/* Briefs Usage */}
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Audio Briefs</div>
                      <div className="text-2xl font-bold">
                        {subscriptionStatus.usage.briefs.limit === 'unlimited'
                          ? 'Unlimited'
                          : `${subscriptionStatus.usage.briefs.used} / ${subscriptionStatus.usage.briefs.limit}`
                        }
                      </div>
                      {subscriptionStatus.usage.briefs.limit !== 'unlimited' && (
                        <div className="mt-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (subscriptionStatus.usage.briefs.used / (subscriptionStatus.usage.briefs.limit as number)) * 100)}%`
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {subscriptionStatus.usage.briefs.remaining} remaining this month
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bills Usage */}
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Tracked Bills</div>
                      <div className="text-2xl font-bold">
                        {subscriptionStatus.usage.trackedBills.limit === 'unlimited'
                          ? subscriptionStatus.usage.trackedBills.count
                          : `${subscriptionStatus.usage.trackedBills.count} / ${subscriptionStatus.usage.trackedBills.limit}`
                        }
                      </div>
                      {subscriptionStatus.usage.trackedBills.limit !== 'unlimited' && (
                        <div className="mt-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                subscriptionStatus.usage.trackedBills.canTrackMore ? 'bg-primary' : 'bg-destructive'
                              }`}
                              style={{
                                width: `${Math.min(100, (subscriptionStatus.usage.trackedBills.count / (subscriptionStatus.usage.trackedBills.limit as number)) * 100)}%`
                              }}
                            />
                          </div>
                          {!subscriptionStatus.usage.trackedBills.canTrackMore && (
                            <p className="text-xs text-destructive mt-1">
                              Limit reached - upgrade to track more
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Members Usage */}
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Followed Members</div>
                      <div className="text-2xl font-bold">
                        {subscriptionStatus.usage.followedMembers.limit === 'unlimited'
                          ? subscriptionStatus.usage.followedMembers.count
                          : `${subscriptionStatus.usage.followedMembers.count} / ${subscriptionStatus.usage.followedMembers.limit}`
                        }
                      </div>
                      {subscriptionStatus.usage.followedMembers.limit !== 'unlimited' && (
                        <div className="mt-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                subscriptionStatus.usage.followedMembers.canFollowMore ? 'bg-primary' : 'bg-destructive'
                              }`}
                              style={{
                                width: `${Math.min(100, (subscriptionStatus.usage.followedMembers.count / (subscriptionStatus.usage.followedMembers.limit as number)) * 100)}%`
                              }}
                            />
                          </div>
                          {!subscriptionStatus.usage.followedMembers.canFollowMore && (
                            <p className="text-xs text-destructive mt-1">
                              Limit reached - upgrade to follow more
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Documents Usage */}
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Documents</div>
                      <div className="text-2xl font-bold">
                        {subscriptionStatus.usage.artifacts?.limit === 'unlimited'
                          ? 'Unlimited'
                          : `${subscriptionStatus.usage.artifacts?.used || 0} / ${subscriptionStatus.usage.artifacts?.limit || 3}`
                        }
                      </div>
                      {subscriptionStatus.usage.artifacts && subscriptionStatus.usage.artifacts.limit !== 'unlimited' && (
                        <div className="mt-2">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                subscriptionStatus.usage.artifacts.canCreateMore ? 'bg-primary' : 'bg-destructive'
                              }`}
                              style={{
                                width: `${Math.min(100, (subscriptionStatus.usage.artifacts.used / (subscriptionStatus.usage.artifacts.limit as number)) * 100)}%`
                              }}
                            />
                          </div>
                          {subscriptionStatus.usage.artifacts.remaining !== 'unlimited' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {subscriptionStatus.usage.artifacts.remaining} remaining this month
                            </p>
                          )}
                          {!subscriptionStatus.usage.artifacts.canCreateMore && (
                            <p className="text-xs text-destructive mt-1">
                              Limit reached - upgrade for more
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features Status */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Premium Features</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        {subscriptionStatus.features.dailyBriefing ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={subscriptionStatus.features.dailyBriefing ? '' : 'text-muted-foreground'}>
                          Daily Briefing Emails
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {subscriptionStatus.features.realtimeAlerts ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={subscriptionStatus.features.realtimeAlerts ? '' : 'text-muted-foreground'}>
                          Real-time Vote Alerts
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {subscriptionStatus.features.audioDigests ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={subscriptionStatus.features.audioDigests ? '' : 'text-muted-foreground'}>
                          Audio Digests
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {subscriptionStatus.features.unlimitedTracking ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={subscriptionStatus.features.unlimitedTracking ? '' : 'text-muted-foreground'}>
                          Unlimited Tracking
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {subscriptionStatus.features.unlimitedArtifacts ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={subscriptionStatus.features.unlimitedArtifacts ? '' : 'text-muted-foreground'}>
                          Unlimited Documents
                        </span>
                      </div>
                    </div>
                  </div>
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
                  <button className="px-4 py-2 border rounded-md hover:bg-accent">
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
                    <button className="text-sm text-destructive hover:underline">
                      Disconnect
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-medium text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                  <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">
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
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
