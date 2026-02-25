import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { DataMigrationForm } from '@/components/settings/data-migration-form'
import { ArrowLeft, DatabaseZap } from 'lucide-react'
import Link from 'next/link'

export default function DataMigrationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Migration"
        description="Import bulk data from CSV files into the system"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <DatabaseZap className="w-4 h-4" />
            <span>CSV Import Tool</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Settings
            </Link>
          </Button>
        </div>
      </PageHeader>

      <DataMigrationForm />
    </div>
  )
}
