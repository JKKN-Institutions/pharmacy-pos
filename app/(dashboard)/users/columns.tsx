'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { UserProfile } from '@/lib/types/database'
import { deleteUserAction } from './actions'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UserEditDialog } from '@/components/users/user-edit-dialog'

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pharmacist: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cashier: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

export const userColumns: ColumnDef<UserProfile>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div className="text-muted-foreground text-sm">{row.getValue('email')}</div>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => (
      <div className="text-sm">{row.getValue('phone') ?? '—'}</div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.getValue('role') as string
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[role] ?? ''}`}>
          {role}
        </span>
      )
    },
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.getValue('is_active') ? 'default' : 'secondary'}>
        {row.getValue('is_active') ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-1">
          <UserEditDialog user={user} />
          <ConfirmDialog
            title="Delete user?"
            description={`Remove ${user.name} from the system. This cannot be undone.`}
            onConfirm={async () => {
              const result = await deleteUserAction(user.id)
              if (result?.error) {
                toast.error(result.error)
              } else {
                toast.success('User deleted')
              }
            }}
          />
        </div>
      )
    },
  },
]
