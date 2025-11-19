'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  USER: 'hakivo_user',
};

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    sessionId: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);

      console.log('[Auth] Loading from localStorage:');
      console.log('[Auth] - accessToken:', accessToken ? 'exists' : 'null');
      console.log('[Auth] - refreshToken:', refreshToken ? 'exists' : 'null');
      console.log('[Auth] - sessionId:', sessionId ? 'exists' : 'null');
      console.log('[Auth] - user:', userStr ? 'exists' : 'null');

      if (accessToken && refreshToken && sessionId && userStr) {
        const user = JSON.parse(userStr) as User;
        console.log('[Auth] Setting isAuthenticated=true, user:', user.email);
        setAuthState({
          accessToken,
          refreshToken,
          sessionId,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        console.log('[Auth] No auth data found, setting isAuthenticated=false');
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error loading auth state from localStorage:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Login function - stores tokens and user in state + localStorage
  const login = (tokens: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    user: User;
  }) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, tokens.sessionId);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(tokens.user));

      setAuthState({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        user: tokens.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error storing auth state:', error);
    }
  };

  // Logout function - clears everything
  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);

      setAuthState({
        accessToken: null,
        refreshToken: null,
        sessionId: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error clearing auth state:', error);
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
