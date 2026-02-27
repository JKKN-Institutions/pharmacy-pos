'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

// Settings sub-items — each has its own role list
const settingsSubItems: SettingsSubItem[] = [
  { href: '/medicine-categories', icon: Tag,     label: 'Medicine Categories', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/settings/taxes',      icon: Percent, label: 'Tax Rates',           roles: ['admin'] },
  { href: '/settings',            icon: Settings,label: 'General',             roles: ['admin'] },
]

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
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map(item => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
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

  // Show this group if: admin (always — has Users + Settings), or any role with ≥1 settings sub-item
  const showUsers    = userRole === 'admin'
  const showSettings = visibleSubItems.length > 0

  if (!showUsers && !showSettings) return null

  const isSettingsActive =
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/medicine-categories'

  return (
    <SidebarGroup>
      {showUsers && <SidebarGroupLabel>Admin</SidebarGroupLabel>}
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
                  <UserCog />
                  <span>Users</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Settings — collapsible, visible to any role with sub-items */}
          {showSettings && (
            <Collapsible
              asChild
              defaultOpen={isSettingsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={isSettingsActive} tooltip="Settings">
                    <Settings />
                    <span>Settings</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
                            <sub.icon />
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="PharmaPOS">
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-amber-500 text-white shrink-0">
                  <Pill className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sm">PharmaPOS</span>
                  <span className="text-xs text-sidebar-foreground/60">Pharmacy Manager</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden scrollbar-hidden scroll-smooth">
        <NavGroup items={mainNavItems} userRole={userRole} pathname={pathname} />
        <SidebarSeparator />
        <NavGroup label="Inventory" items={inventoryItems} userRole={userRole} pathname={pathname} />
        <SidebarSeparator />
        <NavGroup label="Finance"   items={financeItems}   userRole={userRole} pathname={pathname} />
        <SidebarSeparator />
        <AdminGroup userRole={userRole} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}
