'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, LogOut, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { UserProfile } from '@/lib/types/database'

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  pos: 'POS / Bill',
  invoices: 'Invoices',
  purchases: 'Purchases',
  stock: 'Live Stock',
  medicines: 'Medicines',
  customers: 'Customers',
  suppliers: 'Suppliers',
  expenses: 'Expenses',
  salary: 'Salary',
  accounts: 'Accounts',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
}

function useBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: routeLabels[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    current: i === segments.length - 1,
  }))
}

interface TopbarProps {
  user: UserProfile
}

export function Topbar({ user }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const crumbs = useBreadcrumbs(pathname)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Sidebar trigger only visible on desktop — hidden on mobile/tablet */}
      <SidebarTrigger className="-ml-1 hidden lg:flex" />
      <Separator orientation="vertical" className="mr-2 h-4 hidden lg:block" />

      <Breadcrumb className="flex">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.current ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2 ml-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
