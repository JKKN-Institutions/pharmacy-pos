'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { UserProfile } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  profile: UserProfile
  children: React.ReactNode
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        userRole={profile.role}
        isExpanded={isExpanded}
      />
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out',
          isExpanded ? 'ml-56' : 'ml-16'
        )}
      >
        <Topbar user={profile} isExpanded={isExpanded} onToggle={() => setIsExpanded(prev => !prev)} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
