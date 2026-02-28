'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Mail, Phone, Stethoscope, CreditCard, CalendarDays } from 'lucide-react'

interface CustomerInfoProps {
  name: string
  onNameChange: (v: string) => void
  email: string
  onEmailChange: (v: string) => void
  phone: string
  onPhoneChange: (v: string) => void
  doctor: string
  onDoctorChange: (v: string) => void
  billDate: string
  onBillDateChange: (v: string) => void
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit'
  onPaymentMethodChange: (v: 'cash' | 'upi' | 'card' | 'credit') => void
  note: string
  onNoteChange: (v: string) => void
}

// Reusable icon-adornment input group — same pattern as purchase form header
function IconInput({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon: React.ElementType
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        <div className="flex items-center px-3 bg-muted border-r shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {children}
      </div>
    </div>
  )
}

export function CustomerInfo({
  name, onNameChange,
  email, onEmailChange,
  phone, onPhoneChange,
  doctor, onDoctorChange,
  billDate, onBillDateChange,
  paymentMethod, onPaymentMethodChange,
  note, onNoteChange,
}: CustomerInfoProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

      {/* Row 1: Name* | Email Address | Mobile Number */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 border-b border-border/60">

        <IconInput icon={User} label="Name" required>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Name"
            className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
          />
        </IconInput>

        <IconInput icon={Mail} label="Email Address">
          <Input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Email Address"
            className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
          />
        </IconInput>

        <IconInput icon={Phone} label="Mobile Number">
          <Input
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="Mobile Number"
            className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
          />
        </IconInput>

      </div>

      {/* Row 2: Doctor | Date | Payment Method */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 border-b border-border/60">

        <IconInput icon={Stethoscope} label="Doctor">
          <Input
            value={doctor}
            onChange={(e) => onDoctorChange(e.target.value)}
            placeholder="Referring doctor"
            className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
          />
        </IconInput>

        <IconInput icon={CalendarDays} label="Date">
          <Input
            type="date"
            value={billDate}
            onChange={(e) => onBillDateChange(e.target.value)}
            className="border-0 rounded-none flex-1 focus-visible:ring-0 shadow-none h-9"
          />
        </IconInput>

        <IconInput icon={CreditCard} label="Payment Method">
          <Select
            value={paymentMethod}
            onValueChange={(v) => onPaymentMethodChange(v as 'cash' | 'upi' | 'card' | 'credit')}
          >
            <SelectTrigger className="border-0 rounded-none flex-1 focus:ring-0 shadow-none h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </IconInput>

      </div>

      {/* Note — full width textarea */}
      <div className="px-4 py-3 space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Note</Label>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Once Goods Sold Can Not Be Taken Back"
          rows={3}
          className="resize-none text-sm border-border/60 focus-visible:ring-1"
        />
      </div>

    </div>
  )
}
