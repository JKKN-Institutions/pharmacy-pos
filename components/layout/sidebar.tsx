'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ShoppingCart, FileText,
  ClipboardList, Archive, Users, Truck, DollarSign,
  BarChart3, Settings, Pill, Receipt, BookOpen, UserCog,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager'] },
  { href: '/pos', icon: ShoppingCart, label: 'POS / Bill', roles: ['admin', 'manager', 'pharmacist', 'cashier'] },
  { href: '/invoices', icon: FileText, label: 'Invoices', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/purchases', icon: ClipboardList, label: 'Purchase', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/stock', icon: Archive, label: 'Live Stock', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/medicines', icon: Pill, label: 'Medicines', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['admin', 'manager', 'pharmacist'] },
  { href: '/expenses', icon: DollarSign, label: 'Expenses', roles: ['admin', 'manager'] },
  { href: '/salary', icon: Receipt, label: 'Salary', roles: ['admin', 'manager'] },
  { href: '/accounts', icon: BookOpen, label: 'Accounts', roles: ['admin', 'manager'] },
  { href: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'manager'] },
  { href: '/users', icon: UserCog, label: 'Users', roles: ['admin'] },
  { href: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
]

interface SidebarProps {
  userRole: string
  isExpanded: boolean
}

export function Sidebar({ userRole, isExpanded }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item =>
    item.roles.includes(userRole)
  )

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed left-0 top-0 h-full flex flex-col py-4 z-40',
          'border-r border-sidebar-border bg-sidebar',
          'transition-all duration-300 ease-in-out overflow-hidden',
          isExpanded ? 'w-56' : 'w-16'
        )}
      >
        {/* Logo row */}
        <div
          className={cn(
            'flex items-center shrink-0 mb-4 px-3',
            isExpanded ? 'gap-2' : 'justify-center'
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5 text-white" />
          </div>
          {isExpanded && (
            <span className="text-sm font-semibold text-sidebar-foreground flex-1 truncate">
              PharmaPOS
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden w-full px-2">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const linkClass = cn(
              'flex items-center h-10 rounded-lg transition-colors',
              isExpanded ? 'gap-3 px-3' : 'justify-center',
              'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
              isActive && 'bg-sidebar-accent text-sidebar-foreground'
            )

            if (isExpanded) {
              return (
                <Link key={item.href} href={item.href} className={linkClass}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </Link>
              )
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href} className={linkClass}>
                    <item.icon className="w-5 h-5 shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

      </aside>
    </TooltipProvider>
  )
}
