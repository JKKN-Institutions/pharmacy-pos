import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  /** Force title + actions onto one row even on mobile (use for Back-button pages) */
  inline?: boolean
}

export function PageHeader({ title, description, children, className, inline }: PageHeaderProps) {
  return (
    <div
      className={cn(
        inline
          ? 'flex items-center justify-between gap-3'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
