"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, Users, Radio, MessageSquare, Settings } from 'lucide-react'

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
    label: "Congressional Assistant",
    icon: MessageSquare,
    href: "/chat",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex h-full w-64 flex-col border-r bg-card">
      <div className="flex-1 overflow-auto py-6">
        <nav className="flex flex-col gap-1 px-4">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === route.href
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground",
              )}
            >
              <route.icon className="h-5 w-5" />
              {route.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
