"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Bell, Settings, LayoutDashboard, FileText, Users, Radio, Mic, MessageSquare, LogOut, Menu, AlertTriangle, Crown, Zap, Bookmark, Sparkles, Newspaper, Building, Scale, Clock, CheckCheck, ExternalLink } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HakivoLogo } from "@/components/hakivo-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/auth-context"
import { useSubscription } from "@/lib/subscription/subscription-context"
import { useNotifications, FederalNotification, formatNotificationTime } from "@/lib/hooks/use-notifications"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Studio",
    icon: Sparkles,
    href: "/studio",
  },
  {
    label: "Legislation",
    icon: FileText,
    href: "/legislation",
  },
  {
    label: "Representatives",
    icon: Users,
    href: "/representatives",
  },
  {
    label: "Briefs",
    icon: Radio,
    href: "/briefs",
  },
  {
    label: "Podcast",
    icon: Mic,
    href: "/podcast",
  },
  {
    label: "Blog",
    icon: Newspaper,
    href: "/blog",
  },
  {
    label: "Congressional Assistant",
    icon: MessageSquare,
    href: "/chat/c1",
  },
]

export function DashboardHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { subscription, usageAlerts, hasUsageAlerts, openCheckout } = useSubscription()
  const {
    notifications,
    counts,
    hasNotifications,
    hasUrgent,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications()

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (notificationsOpen) {
      fetchNotifications({ limit: 10 })
    }
  }, [notificationsOpen, fetchNotifications])

  // Get icon for usage alert category
  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'briefs':
        return FileText
      case 'trackedBills':
        return Bookmark
      case 'followedMembers':
        return Users
      case 'artifacts':
        return FileText
      default:
        return AlertTriangle
    }
  }

  // Get icon for federal notification type
  const getFederalNotificationIcon = (type: FederalNotification['type']) => {
    switch (type) {
      case 'executive_order':
      case 'significant_action':
        return FileText
      case 'comment_deadline':
        return Clock
      case 'agency_update':
        return Building
      case 'federal_rule':
        return Scale
      case 'interest_match':
      default:
        return Bell
    }
  }

  // Get color for federal notification priority
  const getPriorityColor = (priority: FederalNotification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-destructive/10 text-destructive'
      case 'high':
        return 'bg-orange-500/10 text-orange-600'
      case 'normal':
        return 'bg-primary/10 text-primary'
      case 'low':
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const handleLogout = () => {
    logout()
  }

  // Calculate total notification count
  const totalNotificationCount = counts.unread + (hasUsageAlerts ? usageAlerts.length : 0)
  const hasAnyNotifications = totalNotificationCount > 0

  // Generate user initials for avatar fallback
  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : 'JD'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center">
                  <HakivoLogo height={28} className="text-primary" showBeta />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-6">
                {routes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      pathname === route.href
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground",
                    )}
                  >
                    <route.icon className="h-5 w-5" />
                    {route.label}
                  </Link>
                ))}
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === "/settings"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground",
                  )}
                >
                  <Settings className="h-5 w-5" />
                  Settings
                </Link>
              </nav>
              <div className="absolute bottom-6 left-4 right-4">
                <Button
                  variant="outline"
                  className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center">
            <HakivoLogo height={28} className="text-primary" showBeta />
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors hover:text-foreground rounded-md",
                pathname === route.href ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <route.icon className="h-4 w-4" />
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Notification Bell with Federal Notifications + Usage Alerts */}
          <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {hasAnyNotifications && (
                  <Badge
                    className={cn(
                      "absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]",
                      hasUrgent || usageAlerts.some(a => a.type === 'limit_reached')
                        ? "bg-destructive"
                        : counts.unread > 0
                        ? "bg-primary"
                        : "bg-yellow-500"
                    )}
                  >
                    {totalNotificationCount > 9 ? '9+' : totalNotificationCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold">Notifications</span>
                {counts.unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      markAllAsRead()
                    }}
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />

              <Tabs defaultValue="federal" className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-9 mx-2" style={{ width: 'calc(100% - 16px)' }}>
                  <TabsTrigger value="federal" className="text-xs">
                    Federal Register
                    {counts.federal > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {counts.federal}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="usage" className="text-xs">
                    Usage Alerts
                    {hasUsageAlerts && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {usageAlerts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Federal Register Notifications Tab */}
                <TabsContent value="federal" className="m-0">
                  <ScrollArea className="h-[300px]">
                    {notifications.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {notifications.map((notification) => {
                          const IconComponent = getFederalNotificationIcon(notification.type)
                          return (
                            <div
                              key={notification.id}
                              className={cn(
                                "flex gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                                !notification.read && "bg-primary/5"
                              )}
                              onClick={() => {
                                markAsRead(notification.id)
                                if (notification.actionUrl) {
                                  window.open(notification.actionUrl, '_blank')
                                }
                              }}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                getPriorityColor(notification.priority)
                              )}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={cn(
                                    "text-sm line-clamp-2",
                                    !notification.read && "font-medium"
                                  )}>
                                    {notification.title}
                                  </p>
                                  {notification.actionUrl && (
                                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatNotificationTime(notification.createdAt)}
                                  </span>
                                  {notification.federalData?.documentType && (
                                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                      {notification.federalData.documentType}
                                    </Badge>
                                  )}
                                  {notification.priority === 'urgent' && (
                                    <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                      Urgent
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Building className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">No Federal Register notifications</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          We'll notify you about executive orders, rules, and regulations matching your interests
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Usage Alerts Tab */}
                <TabsContent value="usage" className="m-0">
                  <ScrollArea className="h-[300px]">
                    {!subscription.isPro && hasUsageAlerts ? (
                      <div className="p-2 space-y-1">
                        {usageAlerts.map((alert) => {
                          const IconComponent = getAlertIcon(alert.category)
                          return (
                            <div
                              key={alert.id}
                              className="flex gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent"
                              onClick={openCheckout}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                alert.type === 'limit_reached'
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-yellow-500/10 text-yellow-600"
                              )}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{alert.message}</p>
                                {alert.action && (
                                  <p className="text-xs text-primary mt-1">{alert.action}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        {subscription.isPro ? (
                          <>
                            <Crown className="w-10 h-10 mx-auto text-primary mb-3" />
                            <p className="text-sm font-medium">You're on Hakivo Pro</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Enjoy unlimited access to all features
                            </p>
                          </>
                        ) : (
                          <>
                            <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">No usage alerts</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              You're within your free plan limits
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              {/* Upgrade CTA for Free Users */}
              {!subscription.isPro && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Button
                      onClick={openCheckout}
                      className="w-full bg-gradient-to-r from-primary to-primary/80"
                      size="sm"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="/abstract-geometric-shapes.png" alt="User" />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Guest'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email || 'Not logged in'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
