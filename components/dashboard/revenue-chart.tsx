'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatINR } from '@/lib/utils/currency'

interface RevenueChartProps {
  data: { month: string; pos: number; invoice: number }[]
}

const chartConfig = {
  pos:     { label: 'POS Bills', color: 'hsl(142 71% 45%)' },
  invoice: { label: 'Invoices',  color: 'hsl(142 71% 45%)' },
} satisfies ChartConfig

export function RevenueChart({ data }: RevenueChartProps) {
  const totalRevenue = data.reduce((sum, d) => sum + d.pos + d.invoice, 0)

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue — Last 12 Months</CardTitle>
        <CardDescription>
          Total: {formatINR(totalRevenue)} · POS + Invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="text-muted-foreground mb-1 font-medium">{payload[0].payload.month}</p>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="font-semibold">{formatINR(p.value as number)}</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            <Bar dataKey="pos"     fill="var(--color-pos)"     radius={[0, 0, 0, 0]} stackId="revenue" />
            <Bar dataKey="invoice" fill="var(--color-invoice)" radius={[3, 3, 0, 0]} stackId="revenue" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
