'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { refreshAccessToken } from '@/lib/api/backend';

// User type matching backend response
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  workosUserId?: string;
}

// Auth state type
export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  workosSessionId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auth context actions
export interface AuthContextType extends AuthState {
  login: (tokens: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    workosSessionId?: string | null;
    user: User;
  }) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  updateAccessToken: (newAccessToken: string) => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'hakivo_access_token',
  REFRESH_TOKEN: 'hakivo_refresh_token',
  SESSION_ID: 'hakivo_session_id',
  WORKOS_SESSION_ID: 'hakivo_workos_session_id',
  USER: 'hakivo_user',
};

// Helper to decode JWT and check expiration
function isTokenExpired(token: string, bufferSeconds: number = 0): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp - (bufferSeconds * 1000);
  } catch {
    return true; // If we can't decode, assume expired
  }
}

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    sessionId: null,
    workosSessionId: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Track refresh in progress to prevent multiple simultaneous refreshes
  const refreshInProgressRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Proactive token refresh function
  const performTokenRefresh = useCallback(async (currentRefreshToken: string) => {
    if (refreshInProgressRef.current) {
      console.log('[Auth] Token refresh already in progress, skipping');
      return;
    }

    refreshInProgressRef.current = true;
    console.log('[Auth] Starting proactive token refresh...');

    try {
      const result = await refreshAccessToken(currentRefreshToken);

      if (result.success && result.accessToken) {
        console.log('[Auth] Proactive token refresh successful');
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
        setAuthState(prev => ({
          ...prev,
          accessToken: result.accessToken!,
        }));
      } else {
        console.error('[Auth] Proactive token refresh failed:', result.error);
      }
    } catch (error) {
      console.error('[Auth] Proactive token refresh error:', error);
    } finally {
      refreshInProgressRef.current = false;
    }
  }, []);

  // Schedule proactive refresh before token expires
  const scheduleTokenRefresh = useCallback((accessToken: string, refreshToken: string) => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();

      // Refresh 5 minutes before expiration
      const refreshTime = exp - now - (5 * 60 * 1000);

      if (refreshTime > 0) {
        console.log(`[Auth] Scheduling token refresh in ${Math.round(refreshTime / 1000 / 60)} minutes`);
        refreshTimerRef.current = setTimeout(() => {
          performTokenRefresh(refreshToken);
        }, refreshTime);
      } else {
        // Token is already expiring soon, refresh now
        console.log('[Auth] Token expiring soon, refreshing now');
        performTokenRefresh(refreshToken);
      }
    } catch (error) {
      console.error('[Auth] Error scheduling token refresh:', error);
    }
  }, [performTokenRefresh]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
        const workosSessionId = localStorage.getItem(STORAGE_KEYS.WORKOS_SESSION_ID);
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);

        console.log('[Auth] Loading from localStorage:');
        console.log('[Auth] - accessToken:', accessToken ? 'exists' : 'null');
        console.log('[Auth] - refreshToken:', refreshToken ? 'exists' : 'null');
        console.log('[Auth] - sessionId:', sessionId ? 'exists' : 'null');
        console.log('[Auth] - workosSessionId:', workosSessionId ? 'exists' : 'null');
        console.log('[Auth] - user:', userStr ? 'exists' : 'null');

        if (accessToken && refreshToken && sessionId && userStr) {
          const user = JSON.parse(userStr) as User;

          // Check if token is expired or expiring soon (within 5 minutes)
          if (isTokenExpired(accessToken, 300)) {
            console.log('[Auth] Access token expired or expiring soon, refreshing...');

            const result = await refreshAccessToken(refreshToken);

            if (result.success && result.accessToken) {
              console.log('[Auth] Token refreshed on load');
              localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);

              setAuthState({
                accessToken: result.accessToken,
                refreshToken,
                sessionId,
                workosSessionId,
                user,
                isAuthenticated: true,
                isLoading: false,
              });

              // Schedule next refresh
              scheduleTokenRefresh(result.accessToken, refreshToken);
            } else {
              console.error('[Auth] Token refresh failed on load, clearing auth');
              // Clear invalid auth state
              localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
              localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
              localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
              localStorage.removeItem(STORAGE_KEYS.WORKOS_SESSION_ID);
              localStorage.removeItem(STORAGE_KEYS.USER);

              setAuthState(prev => ({ ...prev, isLoading: false }));
            }
          } else {
            console.log('[Auth] Token is valid, setting isAuthenticated=true, user:', user.email);
            setAuthState({
              accessToken,
              refreshToken,
              sessionId,
              workosSessionId,
              user,
              isAuthenticated: true,
              isLoading: false,
            });

            // Schedule proactive refresh
            scheduleTokenRefresh(accessToken, refreshToken);
          }
        } else {
          console.log('[Auth] No auth data found, setting isAuthenticated=false');
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading auth state from localStorage:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    }

    initAuth();

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [scheduleTokenRefresh]);

  // Login function - stores tokens and user in state + localStorage
  const login = (tokens: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    workosSessionId?: string | null;
    user: User;
  }) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, tokens.sessionId);
      if (tokens.workosSessionId) {
        localStorage.setItem(STORAGE_KEYS.WORKOS_SESSION_ID, tokens.workosSessionId);
      }
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(tokens.user));

      setAuthState({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        workosSessionId: tokens.workosSessionId || null,
        user: tokens.user,
        isAuthenticated: true,
        isLoading: false,
      });

      // Schedule proactive token refresh
      scheduleTokenRefresh(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      console.error('Error storing auth state:', error);
    }
  };

  // Logout function - clears everything and ends WorkOS session
  const logout = () => {
    try {
      // Clear any scheduled token refresh
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      const workosSessionId = localStorage.getItem(STORAGE_KEYS.WORKOS_SESSION_ID);

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.WORKOS_SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);

      // Clear React state
      setAuthState({
        accessToken: null,
        refreshToken: null,
        sessionId: null,
        workosSessionId: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      // ALWAYS redirect to WorkOS logout endpoint to clear WorkOS session cookies
      // Even if we don't have sessionId, the backend will call WorkOS logout to clear cookies
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const params = new URLSearchParams();

      if (sessionId) params.set('sessionId', sessionId);
      if (workosSessionId) params.set('workosSessionId', workosSessionId);

      const logoutUrl = `${API_URL}/auth/workos/logout${params.toString() ? `?${params}` : ''}`;
      console.log('[Auth] Redirecting to logout URL:', logoutUrl);
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('Error clearing auth state:', error);
      // Still try to hit backend logout even on error
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      window.location.href = `${API_URL}/auth/workos/logout`;
    }
  };

  // Update user function - useful after onboarding
  const updateUser = (user: User) => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      setAuthState(prev => ({
        ...prev,
        user,
      }));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // Update access token function - useful after token refresh
  const updateAccessToken = (newAccessToken: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      setAuthState(prev => ({
        ...prev,
        accessToken: newAccessToken,
      }));
      console.log('[Auth] Access token updated');
    } catch (error) {
      console.error('Error updating access token:', error);
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    updateUser,
    updateAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth hook - access auth context in components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
