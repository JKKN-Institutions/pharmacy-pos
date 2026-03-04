import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './sidebar'
import { Topbar } from './topbar'
import { BottomNavbar } from '@/components/bottom-nav'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import type { UserProfile } from '@/lib/types/database'

interface DashboardShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Sidebar only on desktop (lg+) — mobile/tablet uses bottom nav */}
      <div className="hidden lg:block print:hidden">
        <AppSidebar userRole={profile.role} />
      </div>
      <SidebarInset className="h-svh overflow-hidden print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <Topbar user={profile} />
        </div>
        {/* pb-20 adds space for the bottom nav on mobile; lg:pb-6 resets on desktop */}
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6 overflow-y-auto pb-20 lg:pb-6 bg-muted/30 dark:bg-background print:overflow-visible print:p-0 print:pb-0">
          {/* PWA banners — shown inline at the top of the content area */}
          <div className="print:hidden">
            <UpdatePrompt />
            <InstallPrompt />
          </div>
          {children}
        </div>
      </SidebarInset>
      {/* Mobile bottom navigation — hidden on lg+ screens */}
      <div className="print:hidden">
        <BottomNavbar userRole={profile.role} />
      </div>
    </SidebarProvider>
  )
}
