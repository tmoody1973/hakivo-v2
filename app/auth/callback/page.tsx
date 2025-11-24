import { Suspense } from 'react';
import AuthCallbackClient from '@/components/auth/auth-callback-client';
import { Card, CardContent } from '@/components/ui/card';

export default function CallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackClient />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-2xl font-semibold">Completing sign in...</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we set up your account
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
