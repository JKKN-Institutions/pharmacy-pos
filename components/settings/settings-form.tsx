'use client'

import React, { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveSettingsAction } from '@/app/(dashboard)/settings/actions'
import { Save } from 'lucide-react'

interface SettingsFormProps { settings: Record<string, string> }

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await saveSettingsAction(formData)
      if (result?.error) toast.error(result.error)
      else toast.success('Settings saved successfully')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Store Information</CardTitle>
          <CardDescription>Basic information displayed on bills and invoices</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="store_name">Store Name</Label>
            <Input id="store_name" name="store_name" defaultValue={settings.store_name ?? ''} placeholder="e.g. City Pharmacy" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store_phone">Phone Number</Label>
            <Input id="store_phone" name="store_phone" defaultValue={settings.store_phone ?? ''} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store_email">Email Address</Label>
            <Input id="store_email" name="store_email" type="email" defaultValue={settings.store_email ?? ''} placeholder="store@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store_gstin">GSTIN</Label>
            <Input id="store_gstin" name="store_gstin" defaultValue={settings.store_gstin ?? ''} placeholder="29AAAAA0000A1Z5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store_dl">Drug License Number</Label>
            <Input id="store_dl" name="store_dl" defaultValue={settings.store_dl ?? ''} placeholder="MH-MUM-123456" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="store_address">Store Address</Label>
            <Textarea id="store_address" name="store_address" defaultValue={settings.store_address ?? ''} placeholder="Full store address" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">POS Settings</CardTitle>
          <CardDescription>Default values for the POS billing counter</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos_discount_type">Default Discount Type</Label>
            <Select name="pos_discount_type" defaultValue={settings.pos_discount_type ?? 'percent'}>
              <SelectTrigger id="pos_discount_type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="flat">Flat Amount (Rs.)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos_payment_method">Default Payment Method</Label>
            <Select name="pos_payment_method" defaultValue={settings.pos_payment_method ?? 'cash'}>
              <SelectTrigger id="pos_payment_method"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Invoice Settings</CardTitle>
          <CardDescription>Text that appears on credit invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invoice_terms">Terms and Conditions</Label>
            <Textarea id="invoice_terms" name="invoice_terms" defaultValue={settings.invoice_terms ?? ''} placeholder="Payment due within 30 days." rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice_footer">Invoice Footer Note</Label>
            <Textarea id="invoice_footer" name="invoice_footer" defaultValue={settings.invoice_footer ?? ''} placeholder="Thank you for your business!" rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="min-w-32">
          <Save className="w-4 h-4 mr-2" />
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
