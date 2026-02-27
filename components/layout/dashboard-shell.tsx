'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './sidebar'
import { Topbar } from './topbar'
import { BottomNavbar } from '@/components/bottom-nav'
import type { UserProfile } from '@/lib/types/database'

interface DashboardShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Sidebar only on desktop (lg+) — mobile/tablet uses bottom nav */}
      <div className="hidden lg:block">
        <AppSidebar userRole={profile.role} />
      </div>
      <SidebarInset className="h-svh overflow-hidden">
        <Topbar user={profile} />
        {/* pb-20 adds space for the bottom nav on mobile; lg:pb-6 resets on desktop */}
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6 overflow-y-auto pb-20 lg:pb-6">
          {children}
        </div>
      </SidebarInset>
      {/* Mobile bottom navigation — hidden on lg+ screens */}
      <BottomNavbar userRole={profile.role} />
    </SidebarProvider>
  )
}
