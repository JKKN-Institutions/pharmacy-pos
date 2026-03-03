'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  LayoutDashboard, ShoppingCart, FileText, ClipboardList,
  Archive, Users, Truck, DollarSign, BarChart3, Settings,
  Pill, Receipt, BookOpen, UserCog, Percent, ChevronRight, Tag,
} from 'lucide-react'

type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  roles: string[]
}

type SettingsSubItem = {
  href: string
  icon: React.ElementType
  label: string
  roles: string[]
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  roles: ['admin', 'manager'] },
  { href: '/pos',       icon: ShoppingCart,    label: 'POS / Bill', roles: ['admin', 'manager', 'pharmacist', 'cashier'] },
  { href: '/invoices',  icon: FileText,        label: 'Invoices',   roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/purchases', icon: ClipboardList,   label: 'Purchases',  roles: ['admin', 'manager', 'pharmacist'] },
]

const inventoryItems: NavItem[] = [
  { href: '/stock',     icon: Archive, label: 'Live Stock', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/medicines', icon: Pill,    label: 'Medicines',  roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/customers', icon: Users,   label: 'Customers',  roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/suppliers', icon: Truck,   label: 'Suppliers',  roles: ['admin', 'manager', 'pharmacist'] },
]

const financeItems: NavItem[] = [
  { href: '/expenses', icon: DollarSign, label: 'Expenses', roles: ['admin', 'manager'] },
  { href: '/salary',   icon: Receipt,    label: 'Salary',   roles: ['admin', 'manager'] },
  { href: '/accounts', icon: BookOpen,   label: 'Accounts', roles: ['admin', 'manager'] },
  { href: '/reports',  icon: BarChart3,  label: 'Reports',  roles: ['admin', 'manager'] },
]

const settingsSubItems: SettingsSubItem[] = [
  { href: '/medicine-categories', icon: Tag,     label: 'Medicine Categories', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/settings/taxes',      icon: Percent, label: 'Tax Rates',           roles: ['admin'] },
  { href: '/settings',            icon: Settings,label: 'General',             roles: ['admin'] },
]

/** Adaptive icon box — bg uses currentColor so it stays subtle on white
 *  and becomes a faint white tint when the button turns green on hover/active */
function NavItemIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-current/[0.08] transition-colors duration-150">
      <Icon className="size-3.5" />
    </span>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/35 px-3 mb-0.5">
      {children}
    </SidebarGroupLabel>
  )
}

function NavGroup({
  label,
  items,
  userRole,
  pathname,
}: {
  label?: string
  items: NavItem[]
  userRole: string
  pathname: string
}) {
  const visible = items.filter(i => i.roles.includes(userRole))
  if (visible.length === 0) return null

  return (
    <SidebarGroup className="px-2 py-1">
      {label && <GroupLabel>{label}</GroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map(item => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                }
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <NavItemIcon icon={item.icon} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AdminGroup({ userRole, pathname }: { userRole: string; pathname: string }) {
  const visibleSubItems = settingsSubItems.filter(i => i.roles.includes(userRole))

  const showUsers    = userRole === 'admin'
  const showSettings = visibleSubItems.length > 0

  if (!showUsers && !showSettings) return null

  const isSettingsActive =
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/medicine-categories'

  return (
    <SidebarGroup className="px-2 py-1">
      {showUsers && <GroupLabel>Admin</GroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>

          {/* Users — admin only */}
          {showUsers && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/users' || pathname.startsWith('/users/')}
                tooltip="Users"
              >
                <Link href="/users">
                  <NavItemIcon icon={UserCog} />
                  <span className="font-medium">Users</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Settings collapsible */}
          {showSettings && (
            <Collapsible
              asChild
              defaultOpen={isSettingsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={isSettingsActive} tooltip="Settings">
                    <NavItemIcon icon={Settings} />
                    <span className="font-medium">Settings</span>
                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {visibleSubItems.map(sub => (
                      <SidebarMenuSubItem key={sub.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === sub.href ||
                            (sub.href !== '/settings' && pathname.startsWith(sub.href + '/'))
                          }
                        >
                          <Link href={sub.href}>
                            <sub.icon className="size-3.5 shrink-0" />
                            <span>{sub.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">

      {/* ── Header: Brand ── */}
      <SidebarHeader className="border-b border-sidebar-border pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Om Sakthi Medicals">
              <Link href="/dashboard">
                {/* Green gradient pill icon */}
                <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.62_0.20_150)] to-[var(--color-sidebar-primary)] shadow-sm shadow-[var(--color-sidebar-primary)]/20">
                  <Pill className="size-5 text-white" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold tracking-tight text-sm">Om Sakthi Medicals</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
                    {/* Online status dot */}
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-sidebar-primary)]" />
                    Pharmacy Manager
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="overflow-x-hidden overflow-y-auto scrollbar-hidden scroll-smooth py-2">
        <NavGroup items={mainNavItems} userRole={userRole} pathname={pathname} />
        <SidebarSeparator className="mx-3 my-1 opacity-50" />
        <NavGroup label="Inventory" items={inventoryItems} userRole={userRole} pathname={pathname} />
        <SidebarSeparator className="mx-3 my-1 opacity-50" />
        <NavGroup label="Finance"   items={financeItems}   userRole={userRole} pathname={pathname} />
        <SidebarSeparator className="mx-3 my-1 opacity-50" />
        <AdminGroup userRole={userRole} pathname={pathname} />
      </SidebarContent>

      {/* ── Footer: App version ── */}
      <SidebarFooter className="border-t border-sidebar-border py-3">
        <div className="px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/25">
            Om Sakthi Medicals &middot; v2.0
          </p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
