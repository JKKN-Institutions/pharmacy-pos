'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CustomerInfoProps {
  name: string
  onNameChange: (v: string) => void
  phone: string
  onPhoneChange: (v: string) => void
  doctor: string
  onDoctorChange: (v: string) => void
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit'
  onPaymentMethodChange: (v: 'cash' | 'upi' | 'card' | 'credit') => void
  note: string
  onNoteChange: (v: string) => void
}

export function CustomerInfo({
  name, onNameChange,
  phone, onPhoneChange,
  doctor, onDoctorChange,
  paymentMethod, onPaymentMethodChange,
  note, onNoteChange,
}: CustomerInfoProps) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Customer & Payment</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Customer Name</Label>
          <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Optional" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder="Optional" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Doctor</Label>
          <Input value={doctor} onChange={e => onDoctorChange(e.target.value)} placeholder="Referring doctor" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Payment Method</Label>
          <Select value={paymentMethod} onValueChange={v => onPaymentMethodChange(v as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-4">
          <Label className="text-xs">Note</Label>
          <Input value={note} onChange={e => onNoteChange(e.target.value)} placeholder="Optional note for this bill" className="h-8" />
        </div>
      </div>
    </div>
  )
}
