'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[SignIn] Auth state:', { isAuthenticated, authLoading });
    if (!authLoading && isAuthenticated) {
      console.log('[SignIn] User is authenticated, redirecting to dashboard');
      router.push('/dashboard');
    } else if (!authLoading) {
      console.log('[SignIn] User is NOT authenticated, staying on signin page');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSignIn = () => {
    setIsRedirecting(true);
    // Add force=true to show login screen even if user has an existing WorkOS session
    const loginUrl = `${API_BASE_URL}/auth/workos/login?force=true`;
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('Full login URL:', loginUrl);
    // Redirect to backend WorkOS login endpoint
    window.location.href = loginUrl;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              H
            </div>
          </div>
          <CardTitle className="text-3xl">Welcome to Hakivo</CardTitle>
          <CardDescription>
            Transform Congressional legislation into personalized audio briefings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            onClick={handleSignIn}
            disabled={isRedirecting}
            size="lg"
            className="w-full"
          >
            {isRedirecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Redirecting...
              </>
            ) : (
              'Sign in with WorkOS'
            )}
          </Button>

          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
