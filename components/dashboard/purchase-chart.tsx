'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatINR } from '@/lib/utils/currency'

const chartConfig = {
  amount: { label: 'Purchases', color: 'hsl(262 83% 58%)' },
} satisfies ChartConfig

export function PurchaseChart({ data }: { data: { month: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Purchase — 12 Months</CardTitle>
        <CardDescription>{formatINR(total)} total</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[160px] w-full">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="text-muted-foreground mb-0.5">{payload[0].payload.month}</p>
                    <p className="font-semibold text-foreground">{formatINR(payload[0].value as number)}</p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-amount)"
              fill="var(--color-amount)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
