import { db } from './db'

export async function syncMedicines(): Promise<boolean> {
  try {
    const res = await fetch('/api/pos/sync')
    if (!res.ok) return false

    const { medicines, synced_at } = await res.json()

    await db.transaction('rw', db.medicines, async () => {
      await db.medicines.clear()
      await db.medicines.bulkAdd(
        // New sync API already returns `batches` directly (pre-grouped, numeric-coerced)
        medicines.map((m: any) => ({ ...m, last_synced_at: synced_at }))
      )
    })
    return true
  } catch {
    return false
  }
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
