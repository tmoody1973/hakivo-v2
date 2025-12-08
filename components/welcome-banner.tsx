'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { X, Sparkles, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Storage key for tracking if banner has been dismissed
const WELCOME_DISMISSED_KEY = 'hakivo_welcome_dismissed';
const NEW_USER_FLAG_KEY = 'hakivo_is_new_user';

interface BriefStatus {
  status: 'pending' | 'processing' | 'content_gathered' | 'script_ready' | 'completed' | 'failed' | 'none';
  briefId?: string;
}

const PROGRESS_MESSAGES = {
  pending: 'Queuing your personalized brief...',
  processing: 'Analyzing legislation matching your interests...',
  content_gathered: 'Gathering the latest news and updates...',
  script_ready: 'Creating your audio brief...',
  completed: 'Your first brief is ready!',
  failed: 'Brief generation encountered an issue',
  none: 'Your personalized brief will be ready soon...',
};

export function WelcomeBanner() {
  const { user, accessToken, isAuthenticated, isLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [briefStatus, setBriefStatus] = useState<BriefStatus>({ status: 'none' });
  const [isComplete, setIsComplete] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Check if this is a new user and if banner should be shown
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    // Check if user just completed onboarding (stored in sessionStorage)
    const isNewUser = sessionStorage.getItem(NEW_USER_FLAG_KEY) === 'true';
    const wasDismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);

    if (isNewUser && !wasDismissed) {
      setIsVisible(true);
    }
  }, [isLoading, isAuthenticated, user]);

  // Poll for brief status
  useEffect(() => {
    if (!isVisible || !accessToken || isComplete) return;

    const pollStatus = async () => {
      try {
        // Check for any in-progress or recently completed brief
        const response = await fetch('/api/briefs?limit=1', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.success && data.briefs && data.briefs.length > 0) {
          const brief = data.briefs[0];
          setBriefStatus({ status: brief.status, briefId: brief.id });

          if (brief.status === 'completed') {
            setIsComplete(true);
            // Auto-dismiss after 5 seconds when complete
            setTimeout(() => {
              handleDismiss();
            }, 5000);
          }
        }
      } catch (err) {
        console.error('Error polling brief status:', err);
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 3 seconds
    const interval = setInterval(pollStatus, 3000);

    return () => clearInterval(interval);
  }, [isVisible, accessToken, isComplete]);

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
      sessionStorage.removeItem(NEW_USER_FLAG_KEY);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl mb-6
        bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
        shadow-lg shadow-blue-500/25
        transition-all duration-300 ease-out
        ${isAnimatingOut ? 'opacity-0 transform -translate-y-4' : 'opacity-100 transform translate-y-0'}
      `}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse delay-75" />
        <div className="absolute -bottom-8 right-1/4 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse delay-150" />
        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-400/20 rounded-full blur-xl animate-bounce" style={{ animationDuration: '3s' }} />
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer" />

      <div className="relative z-10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* Welcome header with animation */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative bg-white/20 backdrop-blur-sm p-2 rounded-full">
                  {isComplete ? (
                    <CheckCircle2 className="h-6 w-6 text-white animate-bounce" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-white animate-pulse" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight animate-fadeIn">
                  Welcome to Hakivo, {user?.firstName || 'there'}! 🎉
                </h2>
                <p className="text-white/90 text-sm mt-0.5">
                  Your personalized civic intelligence platform
                </p>
              </div>
            </div>

            {/* Status section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4 border border-white/20">
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-300 flex-shrink-0" />
                ) : (
                  <div className="relative">
                    <Loader2 className="h-5 w-5 text-white animate-spin flex-shrink-0" />
                    <div className="absolute inset-0 bg-white/20 rounded-full blur animate-ping" style={{ animationDuration: '1.5s' }} />
                  </div>
                )}

                <div className="flex-1">
                  <p className={`text-white font-medium ${isComplete ? 'text-green-100' : ''}`}>
                    {isComplete ? '✨ Your first brief is ready!' : 'Creating your first personalized brief...'}
                  </p>
                  <p className="text-white/70 text-sm mt-1">
                    {PROGRESS_MESSAGES[briefStatus.status]}
                  </p>
                </div>
              </div>

              {/* Progress indicator */}
              {!isComplete && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-500 relative"
                      style={{
                        width: briefStatus.status === 'pending' ? '20%' :
                               briefStatus.status === 'processing' ? '40%' :
                               briefStatus.status === 'content_gathered' ? '60%' :
                               briefStatus.status === 'script_ready' ? '80%' :
                               briefStatus.status === 'completed' ? '100%' : '10%'
                      }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse" />
                    </div>
                  </div>
                  <Zap className="h-4 w-4 text-yellow-300 animate-pulse" />
                </div>
              )}
            </div>

            {/* Quick tips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs text-white/90 border border-white/10">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Bills matching your interests
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs text-white/90 border border-white/10">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                Your representatives' votes
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs text-white/90 border border-white/10">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                Audio briefings ready to listen
              </span>
            </div>
          </div>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add shimmer animation keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

// Helper function to mark user as new (call this after onboarding)
export function markUserAsNew() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(NEW_USER_FLAG_KEY, 'true');
    // Also remove any previous dismissal so returning new users see the banner
    localStorage.removeItem(WELCOME_DISMISSED_KEY);
  }
}
