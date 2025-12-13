import posthog from 'posthog-js';

/**
 * Analytics tracking utilities for Hakivo
 * All events are sent to PostHog for analysis
 */
export const analytics = {
  // ============================================
  // User Identification
  // ============================================

  /**
   * Identify a user after login
   */
  identify: (userId: string, properties?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    plan?: 'free' | 'pro';
    createdAt?: string;
    onboardingCompleted?: boolean;
  }) => {
    if (typeof window === 'undefined') return;
    posthog.identify(userId, properties);
  },

  /**
   * Reset user identity on logout
   */
  reset: () => {
    if (typeof window === 'undefined') return;
    posthog.reset();
  },

  // ============================================
  // Bill Events
  // ============================================

  /**
   * Track when a user views a bill detail page
   */
  billViewed: (billId: string, billTitle: string, chamber?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('bill_viewed', {
      bill_id: billId,
      bill_title: billTitle,
      chamber,
    });
  },

  /**
   * Track when a user adds a bill to their tracking list
   */
  billTracked: (billId: string, billTitle?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('bill_tracked', {
      bill_id: billId,
      bill_title: billTitle,
    });
  },

  /**
   * Track when a user removes a bill from tracking
   */
  billUntracked: (billId: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('bill_untracked', { bill_id: billId });
  },

  /**
   * Track bill search
   */
  billSearched: (query: string, resultsCount: number) => {
    if (typeof window === 'undefined') return;
    posthog.capture('bill_searched', {
      query,
      results_count: resultsCount,
    });
  },

  // ============================================
  // Representative/Member Events
  // ============================================

  /**
   * Track when a user views a representative's profile
   */
  memberViewed: (memberId: string, memberName: string, chamber?: string, party?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('member_viewed', {
      member_id: memberId,
      member_name: memberName,
      chamber,
      party,
    });
  },

  /**
   * Track when a user follows a representative
   */
  memberFollowed: (memberId: string, memberName?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('member_followed', {
      member_id: memberId,
      member_name: memberName,
    });
  },

  /**
   * Track when a user unfollows a representative
   */
  memberUnfollowed: (memberId: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('member_unfollowed', { member_id: memberId });
  },

  // ============================================
  // Brief/Audio Events
  // ============================================

  /**
   * Track when a user starts playing an audio brief
   */
  briefPlayed: (briefId: string, briefType: string, briefTitle?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('brief_played', {
      brief_id: briefId,
      brief_type: briefType,
      brief_title: briefTitle,
    });
  },

  /**
   * Track when a user completes an audio brief
   */
  briefCompleted: (briefId: string, durationSeconds: number, briefType?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('brief_completed', {
      brief_id: briefId,
      duration_seconds: durationSeconds,
      brief_type: briefType,
    });
  },

  /**
   * Track brief playback progress (for engagement analysis)
   */
  briefProgress: (briefId: string, progressPercent: number) => {
    if (typeof window === 'undefined') return;
    // Only track at key milestones to reduce event volume
    if ([25, 50, 75, 90].includes(progressPercent)) {
      posthog.capture('brief_progress', {
        brief_id: briefId,
        progress_percent: progressPercent,
      });
    }
  },

  // ============================================
  // Chat/AI Events
  // ============================================

  /**
   * Track when a user sends a chat message
   */
  chatMessageSent: (sessionId?: string, messageLength?: number) => {
    if (typeof window === 'undefined') return;
    posthog.capture('chat_message_sent', {
      session_id: sessionId,
      message_length: messageLength,
    });
  },

  /**
   * Track when an AI artifact is created
   */
  artifactCreated: (artifactType: string, artifactId?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('artifact_created', {
      artifact_type: artifactType,
      artifact_id: artifactId,
    });
  },

  /**
   * Track chat session started
   */
  chatSessionStarted: (sessionId?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('chat_session_started', { session_id: sessionId });
  },

  // ============================================
  // Subscription/Conversion Events
  // ============================================

  /**
   * Track when upgrade modal is shown
   */
  upgradeModalViewed: (trigger?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('upgrade_modal_viewed', { trigger });
  },

  /**
   * Track when user starts checkout process
   */
  checkoutStarted: (plan?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('checkout_started', { plan });
  },

  /**
   * Track successful subscription
   */
  subscriptionStarted: (plan: string, interval?: 'monthly' | 'yearly') => {
    if (typeof window === 'undefined') return;
    posthog.capture('subscription_started', { plan, interval });
  },

  /**
   * Track subscription cancelled
   */
  subscriptionCancelled: (reason?: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('subscription_cancelled', { reason });
  },

  // ============================================
  // Onboarding Events
  // ============================================

  /**
   * Track onboarding started
   */
  onboardingStarted: () => {
    if (typeof window === 'undefined') return;
    posthog.capture('onboarding_started');
  },

  /**
   * Track onboarding step completed
   */
  onboardingStepCompleted: (step: string, stepNumber: number) => {
    if (typeof window === 'undefined') return;
    posthog.capture('onboarding_step_completed', {
      step,
      step_number: stepNumber,
    });
  },

  /**
   * Track onboarding completed
   */
  onboardingCompleted: (totalSteps?: number) => {
    if (typeof window === 'undefined') return;
    posthog.capture('onboarding_completed', { total_steps: totalSteps });
  },

  // ============================================
  // Feature Usage Events
  // ============================================

  /**
   * Track feature usage (generic)
   */
  featureUsed: (featureName: string, properties?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    posthog.capture('feature_used', {
      feature_name: featureName,
      ...properties,
    });
  },

  /**
   * Track CTA click
   */
  ctaClicked: (ctaName: string, location: string) => {
    if (typeof window === 'undefined') return;
    posthog.capture('cta_clicked', {
      cta_name: ctaName,
      location,
    });
  },

  // ============================================
  // Error Events
  // ============================================

  /**
   * Track client-side errors
   */
  errorOccurred: (errorType: string, errorMessage: string, context?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    posthog.capture('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    });
  },
};

export default analytics;
