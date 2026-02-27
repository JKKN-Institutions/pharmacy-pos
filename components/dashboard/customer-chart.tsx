'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  count: { label: 'New Customers', color: 'hsl(142 71% 45%)' },
} satisfies ChartConfig

export function CustomerChart({ data }: { data: { month: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Customers — 12 Months</CardTitle>
        <CardDescription>{total} new registrations</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[160px] w-full">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="text-muted-foreground mb-0.5">{payload[0].payload.month}</p>
                    <p className="font-semibold text-foreground">{payload[0].value} customers</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
