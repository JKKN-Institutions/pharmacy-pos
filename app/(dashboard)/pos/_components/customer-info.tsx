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
import { User, Phone, Stethoscope, CreditCard, FileText } from 'lucide-react'

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
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Customer &amp; Payment</h3>
        <span className="text-xs text-muted-foreground ml-1">(optional)</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="w-3 h-3" /> Customer Name
          </Label>
          <Input
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Walk-in customer"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> Phone
          </Label>
          <Input
            value={phone}
            onChange={e => onPhoneChange(e.target.value)}
            placeholder="10-digit number"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="w-3 h-3" /> Referring Doctor
          </Label>
          <Input
            value={doctor}
            onChange={e => onDoctorChange(e.target.value)}
            placeholder="Doctor name"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="w-3 h-3" /> Payment Method
          </Label>
          <Select value={paymentMethod} onValueChange={v => onPaymentMethodChange(v as any)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">💵 Cash</SelectItem>
              <SelectItem value="upi">📱 UPI</SelectItem>
              <SelectItem value="card">💳 Card</SelectItem>
              <SelectItem value="credit">🏦 Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Note
          </Label>
          <Input
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Optional note for this bill..."
            className="h-9"
          />
        </div>
      </div>
    </div>
  )
}
