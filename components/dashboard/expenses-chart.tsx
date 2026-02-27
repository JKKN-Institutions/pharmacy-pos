'use client'

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatINR } from '@/lib/utils/currency'

const chartConfig = {
  amount: { label: 'Expenses', color: 'hsl(0 72% 51%)' },
} satisfies ChartConfig

export function ExpensesChart({ data }: { data: { month: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Expenses — Last 12 Months</CardTitle>
        <CardDescription>Total: {formatINR(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
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
            <Line
              dataKey="amount"
              type="monotone"
              stroke="var(--color-amount)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
