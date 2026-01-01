'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

export interface FederalNotification {
  id: string;
  type: 'agency_update' | 'significant_action' | 'comment_deadline' | 'interest_match' | 'executive_order' | 'federal_rule';
  title: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  federalData?: {
    documentNumber?: string;
    documentType?: string;
    agencyNames?: string;
    publicationDate?: string;
    commentsCloseOn?: string;
  };
  actionUrl?: string;
  read: boolean;
  createdAt: string;
  source: 'federal' | 'general';
}

export interface NotificationCounts {
  unread: number;
  urgent: number;
  federal: number;
  general: number;
}

// Use local API proxy to avoid CORS issues with Raindrop services
const NOTIFICATIONS_API_URL = '/api/notifications';

export function useNotifications() {
  const { accessToken, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<FederalNotification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ unread: 0, urgent: 0, federal: 0, general: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notification counts (lightweight, for badge)
  const fetchCounts = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API_URL}/count`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (err) {
      console.error('Failed to fetch notification counts:', err);
    }
  }, [isAuthenticated, accessToken]);

  // Fetch full notifications list
  const fetchNotifications = useCallback(async (options?: {
    category?: 'federal' | 'all';
    unreadOnly?: boolean;
    limit?: number;
  }) => {
    if (!isAuthenticated || !accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.category) params.set('category', options.category);
      if (options?.unreadOnly) params.set('unread', 'true');
      if (options?.limit) params.set('limit', options.limit.toString());

      const response = await fetch(
        `${NOTIFICATIONS_API_URL}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        return data.notifications;
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!isAuthenticated || !accessToken) return;

    try {
      const response = await fetch(
        `${NOTIFICATIONS_API_URL}/${notificationId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        // Refresh counts
        fetchCounts();
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [isAuthenticated, accessToken, fetchCounts]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    try {
      const response = await fetch(
        NOTIFICATIONS_API_URL,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        // Reset counts
        setCounts(prev => ({ ...prev, unread: 0, urgent: 0 }));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [isAuthenticated, accessToken]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!isAuthenticated || !accessToken) return;

    try {
      const response = await fetch(
        `${NOTIFICATIONS_API_URL}/${notificationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        // Refresh counts
        fetchCounts();
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, [isAuthenticated, accessToken, fetchCounts]);

  // Initial fetch on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchCounts();
    }
  }, [isAuthenticated, fetchCounts]);

  // Poll for new notifications every 2 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchCounts, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchCounts]);

  return {
    notifications,
    counts,
    isLoading,
    error,
    hasNotifications: counts.unread > 0,
    hasUrgent: counts.urgent > 0,
    fetchNotifications,
    fetchCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

// Helper to get notification icon based on type
export function getNotificationIcon(type: FederalNotification['type']) {
  switch (type) {
    case 'executive_order':
    case 'significant_action':
      return 'FileText';
    case 'comment_deadline':
      return 'Clock';
    case 'agency_update':
      return 'Building';
    case 'federal_rule':
      return 'Scale';
    case 'interest_match':
    default:
      return 'Bell';
  }
}

// Helper to format notification time
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
