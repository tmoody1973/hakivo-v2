"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Bell, Settings, LayoutDashboard, FileText, Users, Radio, Mic, MessageSquare, LogOut, Menu, AlertTriangle, Crown, Zap, Bookmark } from 'lucide-react'
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

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
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
    label: "Congressional Assistant",
    icon: MessageSquare,
    href: "/chat/c1",
  },
]

export function DashboardHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { subscription, usageAlerts, hasUsageAlerts, openCheckout } = useSubscription()

  // Get icon for alert category
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

  const handleLogout = () => {
    // The auth context's logout() handles:
    // 1. Clearing localStorage (tokens, session IDs, user data)
    // 2. Clearing React state
    // 3. Redirecting to backend WorkOS logout endpoint with both sessionId and workosSessionId
    // 4. WorkOS logout endpoint terminates the SSO session and redirects to app
    logout()
  }

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
                  <HakivoLogo height={28} className="text-primary" />
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
            <HakivoLogo height={28} className="text-primary" />
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
          {/* Notification Bell with Usage Alerts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {hasUsageAlerts && (
                  <Badge
                    className={cn(
                      "absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]",
                      usageAlerts.some(a => a.type === 'limit_reached')
                        ? "bg-destructive"
                        : "bg-yellow-500"
                    )}
                  >
                    {usageAlerts.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {!subscription.isPro && (
                  <span className="text-xs font-normal text-muted-foreground">Free Plan</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Usage Alerts for Free Users */}
              {!subscription.isPro && hasUsageAlerts && (
                <>
                  {usageAlerts.map((alert) => {
                    const IconComponent = getAlertIcon(alert.category)
                    return (
                      <DropdownMenuItem
                        key={alert.id}
                        className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                        onClick={openCheckout}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            alert.type === 'limit_reached'
                              ? "bg-destructive/10 text-destructive"
                              : "bg-yellow-500/10 text-yellow-600"
                          )}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{alert.message}</p>
                            {alert.action && (
                              <p className="text-xs text-primary">{alert.action}</p>
                            )}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Pro User or No Alerts */}
              {(subscription.isPro || !hasUsageAlerts) && (
                <div className="p-4 text-center">
                  {subscription.isPro ? (
                    <div className="flex flex-col items-center gap-2">
                      <Crown className="w-8 h-8 text-primary" />
                      <p className="text-sm font-medium">You're on Hakivo Pro</p>
                      <p className="text-xs text-muted-foreground">Enjoy unlimited access to all features</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Bell className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No new notifications</p>
                    </div>
                  )}
                </div>
              )}

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
