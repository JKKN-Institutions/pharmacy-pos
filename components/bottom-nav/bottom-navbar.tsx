'use client'

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  ClipboardList,
  Archive,
  Users,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  Pill,
  Receipt,
  BookOpen,
  UserCog,
  Percent,
  Tag,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBottomNav, useBottomNavHydration } from '@/hooks/use-bottom-nav'
import { BottomNavItem } from './bottom-nav-item'
import { BottomNavSubmenu } from './bottom-nav-submenu'
import { BottomNavMoreMenu } from './bottom-nav-more-menu'
import type { BottomNavGroup, FlatMenuItem, ActivePageInfo } from './types'

interface BottomNavbarProps {
  userRole: string
}

/** Build nav groups from the pharmacy sidebar nav definition, role-filtered. */
function getNavGroups(pathname: string, userRole: string): BottomNavGroup[] {
  const groups: BottomNavGroup[] = []

  // ── Main ──────────────────────────────────────────────────────────────────
  const mainMenus: FlatMenuItem[] = []
  if (['admin', 'manager'].includes(userRole)) {
    mainMenus.push({
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
    })
  }
  mainMenus.push({
    href: '/pos',
    label: 'POS / Bill',
    icon: ShoppingCart,
    active: pathname === '/pos' || pathname.startsWith('/pos/'),
  })
  if (['admin', 'manager', 'pharmacist'].includes(userRole)) {
    mainMenus.push({
      href: '/invoices',
      label: 'Invoices',
      icon: FileText,
      active: pathname === '/invoices' || pathname.startsWith('/invoices/'),
    })
    mainMenus.push({
      href: '/purchases',
      label: 'Purchases',
      icon: ClipboardList,
      active: pathname === '/purchases' || pathname.startsWith('/purchases/'),
    })
  }
  if (mainMenus.length > 0) {
    groups.push({
      id: 'main',
      groupLabel: 'Main',
      icon: LayoutDashboard,
      menus: mainMenus,
    })
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  if (['admin', 'manager', 'pharmacist'].includes(userRole)) {
    groups.push({
      id: 'inventory',
      groupLabel: 'Inventory',
      icon: Archive,
      menus: [
        {
          href: '/stock',
          label: 'Live Stock',
          icon: Archive,
          active: pathname.startsWith('/stock'),
        },
        {
          href: '/medicines',
          label: 'Medicines',
          icon: Pill,
          active: pathname.startsWith('/medicines'),
        },
        {
          href: '/customers',
          label: 'Customers',
          icon: Users,
          active: pathname.startsWith('/customers'),
        },
        {
          href: '/suppliers',
          label: 'Suppliers',
          icon: Truck,
          active: pathname.startsWith('/suppliers'),
        },
      ],
    })
  }

  // ── Finance ───────────────────────────────────────────────────────────────
  if (['admin', 'manager'].includes(userRole)) {
    groups.push({
      id: 'finance',
      groupLabel: 'Finance',
      icon: DollarSign,
      menus: [
        {
          href: '/expenses',
          label: 'Expenses',
          icon: DollarSign,
          active: pathname.startsWith('/expenses'),
        },
        {
          href: '/salary',
          label: 'Salary',
          icon: Receipt,
          active: pathname.startsWith('/salary'),
        },
        {
          href: '/accounts',
          label: 'Accounts',
          icon: BookOpen,
          active: pathname.startsWith('/accounts'),
        },
        {
          href: '/reports',
          label: 'Reports',
          icon: BarChart3,
          active: pathname.startsWith('/reports'),
        },
      ],
    })
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  const adminMenus: FlatMenuItem[] = []
  if (userRole === 'admin') {
    adminMenus.push({
      href: '/users',
      label: 'Users',
      icon: UserCog,
      active: pathname.startsWith('/users'),
    })
  }
  if (['admin', 'manager', 'pharmacist'].includes(userRole)) {
    adminMenus.push({
      href: '/medicine-categories',
      label: 'Categories',
      icon: Tag,
      active: pathname.startsWith('/medicine-categories'),
    })
  }
  if (userRole === 'admin') {
    adminMenus.push({
      href: '/settings/taxes',
      label: 'Tax Rates',
      icon: Percent,
      active: pathname.startsWith('/settings/taxes'),
    })
    adminMenus.push({
      href: '/settings',
      label: 'General',
      icon: Settings,
      active: pathname === '/settings',
    })
  }
  if (adminMenus.length > 0) {
    groups.push({
      id: 'settings',
      groupLabel: 'Settings',
      icon: Settings,
      menus: adminMenus,
    })
  }

  return groups
}

export function BottomNavbar({ userRole }: BottomNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const hasHydrated = useBottomNavHydration()

  const {
    activeNavId,
    isExpanded,
    isMoreMenuOpen,
    setActiveNav,
    switchToNav,
    setExpanded,
    setMoreMenuOpen,
    setMinimized,
    setActivePage,
  } = useBottomNav()

  // Compute all groups (re-runs whenever pathname or role changes)
  const allNavGroups = useMemo(
    () => getNavGroups(pathname, userRole),
    [pathname, userRole]
  )

  // First 4 groups appear as primary tabs; the rest go into "More"
  const primaryNavGroups = useMemo(() => allNavGroups.slice(0, 4), [allNavGroups])
  const moreNavGroups = useMemo(() => allNavGroups.slice(4), [allNavGroups])

  // Detect which group owns the current pathname
  const currentActiveGroup = useMemo(() => {
    for (const group of allNavGroups) {
      for (const menu of group.menus) {
        if (pathname === menu.href || pathname.startsWith(menu.href + '/')) {
          return group
        }
      }
    }
    return allNavGroups[0] ?? null
  }, [pathname, allNavGroups])

  // Derive the active page info for Zustand store
  const currentActivePage = useMemo((): ActivePageInfo | null => {
    if (!currentActiveGroup) return null
    for (const menu of currentActiveGroup.menus) {
      if (pathname === menu.href || pathname.startsWith(menu.href + '/')) {
        return {
          href: menu.href,
          label: menu.label,
          icon: menu.icon,
          groupLabel: currentActiveGroup.groupLabel,
        }
      }
    }
    return null
  }, [pathname, currentActiveGroup])

  // Effective active tab: user selection (while submenu open) or pathname match
  const effectiveActiveNavId = useMemo(() => {
    if (isExpanded && activeNavId) return activeNavId
    return currentActiveGroup?.id ?? activeNavId
  }, [currentActiveGroup, activeNavId, isExpanded])

  // Items shown in the expanded submenu grid
  const activeSubmenus = useMemo(() => {
    if (effectiveActiveNavId) {
      const selected = allNavGroups.find((g) => g.id === effectiveActiveNavId)
      if (selected) return selected.menus
    }
    return currentActiveGroup?.menus ?? []
  }, [effectiveActiveNavId, allNavGroups, currentActiveGroup])

  // Sync active page info (before paint to avoid flash)
  useLayoutEffect(() => {
    if (currentActivePage) {
      setActivePage(currentActivePage)
      setMinimized(false)
    }
  }, [currentActivePage, setActivePage, setMinimized])

  // Keep stored activeNavId in sync with pathname (but not while browsing submenu)
  useEffect(() => {
    if (!isExpanded && currentActiveGroup && currentActiveGroup.id !== activeNavId) {
      setActiveNav(currentActiveGroup.id)
    }
  }, [currentActiveGroup, activeNavId, setActiveNav, isExpanded])

  // Nav tab click — direct navigate for single-item groups, submenu for multi
  const handleNavClick = useCallback(
    (groupId: string) => {
      const group = allNavGroups.find((g) => g.id === groupId)
      if (!group) return

      if (group.menus.length === 1) {
        // Single-item group: navigate directly, no submenu
        router.push(group.menus[0].href)
        setExpanded(false)
        return
      }

      if (isExpanded && activeNavId === groupId) {
        // Same tab pressed while open → close submenu
        setExpanded(false)
        setMoreMenuOpen(false)
      } else {
        // Open this group's submenu
        switchToNav(groupId)
      }
    },
    [allNavGroups, activeNavId, isExpanded, router, switchToNav, setExpanded, setMoreMenuOpen]
  )

  const handleSubmenuClick = useCallback(
    (href: string) => {
      router.push(href)
      setExpanded(false)
    },
    [router, setExpanded]
  )

  const handleMoreClick = useCallback(() => {
    setExpanded(false)
    setMoreMenuOpen(!isMoreMenuOpen)
  }, [setMoreMenuOpen, setExpanded, isMoreMenuOpen])

  const handleMoreItemClick = useCallback(
    (href: string) => {
      router.push(href)
      setMoreMenuOpen(false)
    },
    [router, setMoreMenuOpen]
  )

  // Close submenu when tapping outside the nav
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-bottom-nav]')) {
        setExpanded(false)
      }
    }
    if (isExpanded) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isExpanded, setExpanded])

  // Don't render until Zustand store has hydrated (prevents flash)
  if (!hasHydrated) return null
  if (primaryNavGroups.length === 0) return null

  return (
    <>
      {/* Backdrop when submenu is open */}
      <AnimatePresence>
        {isExpanded && !isMoreMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[75] lg:hidden"
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Bottom navigation bar — hidden on lg+ (sidebar takes over) */}
      <motion.nav
        data-bottom-nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[80] lg:hidden',
          'bg-background border-t border-border',
          'shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Submenu grid — expands above the nav bar */}
        <BottomNavSubmenu
          items={activeSubmenus}
          isOpen={isExpanded}
          onItemClick={handleSubmenuClick}
        />

        {/* Nav tab row */}
        <div className="flex items-center justify-around">
          {primaryNavGroups.map((group) => (
            <BottomNavItem
              key={group.id}
              id={group.id}
              icon={group.icon}
              label={group.groupLabel}
              isActive={effectiveActiveNavId === group.id}
              hasSubmenu={group.menus.length > 1}
              onClick={() => handleNavClick(group.id)}
            />
          ))}

          {moreNavGroups.length > 0 && (
            <BottomNavItem
              id="more"
              icon={MoreHorizontal}
              label="More"
              isActive={isMoreMenuOpen}
              hasSubmenu={true}
              badgeCount={moreNavGroups.length}
              onClick={handleMoreClick}
            />
          )}
        </div>
      </motion.nav>

      {/* More menu — bottom sheet with accordion + icon grid */}
      <BottomNavMoreMenu
        groups={moreNavGroups}
        isOpen={isMoreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onItemClick={handleMoreItemClick}
      />
    </>
  )
}
