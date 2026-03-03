import { db } from './db'

/** Tracks whether a sync is currently in progress — prevents double sync */
let syncInProgress = false

export async function syncMedicines(): Promise<boolean> {
  // Guard against concurrent syncs
  if (syncInProgress) return false
  syncInProgress = true

  try {
    // Check for last sync timestamp (incremental sync)
    const meta = await db.sync_meta.get('medicines')
    const since = meta?.value ?? ''
    const url = since ? `/api/pos/sync?since=${encodeURIComponent(since)}` : '/api/pos/sync'

    const res = await fetch(url)
    if (!res.ok) return false

    const { medicines, deleted_ids, synced_at } = await res.json()

    await db.transaction('rw', [db.medicines, db.sync_meta], async () => {
      // Upsert changed medicines (preserves existing data during sync — no clear())
      if (medicines.length > 0) {
        await db.medicines.bulkPut(
          medicines.map((m: any) => ({
            ...m,
            name_lower: (m.name ?? '').toLowerCase(),
            last_synced_at: synced_at,
          }))
        )
      }

      // Remove deactivated medicines
      if (deleted_ids?.length > 0) {
        await db.medicines.bulkDelete(deleted_ids)
      }

      // Update sync checkpoint
      await db.sync_meta.put({ key: 'medicines', value: synced_at })
    })

    return true
  } catch {
    return false
  } finally {
    syncInProgress = false
  }
}

export function isSyncInProgress(): boolean {
  return syncInProgress
}

export async function flushOfflineBills(): Promise<void> {
  const pending = await db.offline_bills
    .where('sync_status').equals('pending')
    .toArray()

  for (const bill of pending) {
    try {
      const res = await fetch('/api/pos/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill.bill_data),
      })

      if (res.ok) {
        const { bill_no } = await res.json()
        await db.offline_bills.update(bill.id, {
          sync_status: 'synced',
          synced_bill_no: bill_no,
        })
      } else {
        await db.offline_bills.update(bill.id, {
          sync_status: 'error',
          error_message: 'Server rejected bill',
        })
      }
    } catch {
      // Still offline — leave as pending
    }
  }
}
