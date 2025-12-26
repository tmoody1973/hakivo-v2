'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-context';
import { mixpanel } from '@/lib/analytics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    // Prevent processing the same code multiple times
    if (hasProcessed) {
      return;
    }

    const handleCallback = async () => {
      try {
        setHasProcessed(true);

        // Get the authorization code from URL
        const code = searchParams.get('code');

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Call the backend callback endpoint with the code
        const response = await fetch(`${API_BASE_URL}/auth/workos/callback?code=${code}`, {
          method: 'GET',
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Callback error response:', errorText);
          let errorMessage = 'Authentication failed';
          try {
            const error = JSON.parse(errorText);
            errorMessage = error.error || error.message || errorText;
          } catch {
            errorMessage = errorText || 'Authentication failed';
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Authentication failed');
        }

        // Store authentication data (including workosSessionId for proper logout)
        login({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          sessionId: data.sessionId,
          workosSessionId: data.workosSessionId,
          user: data.user,
        });

        // Track sign in/signup event in Mixpanel
        const isNewUser = !data.user.onboardingCompleted;
        if (isNewUser) {
          mixpanel.track('Sign Up', {
            user_id: data.user.id,
            email: data.user.email,
            signup_method: 'workos',
          });
        } else {
          mixpanel.track('Sign In', {
            user_id: data.user.id,
            login_method: 'workos',
            success: true,
          });
        }

        // Redirect based on onboarding status
        if (!data.user.onboardingCompleted) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, login, router, hasProcessed]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-red-600 dark:text-red-400 text-5xl">✗</div>
            <h2 className="text-2xl font-semibold">Authentication Failed</h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={() => router.push('/auth/signin')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-2xl font-semibold">Completing sign in...</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {isProcessing ? 'Please wait while we set up your account' : 'Redirecting...'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
