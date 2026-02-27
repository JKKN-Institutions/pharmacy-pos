'use client'

import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatINR } from '@/lib/utils/currency'

const COLORS = [
  'hsl(221 83% 53%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(262 83% 58%)',
  'hsl(0 72% 51%)',
  'hsl(197 71% 52%)',
]

export function ExpenseByTypeChart({ data }: { data: { type: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)

  if (data.length === 0) {
    return (
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Expense by Type</CardTitle>
          <CardDescription>No expense data</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
          No expenses recorded yet
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Expense by Type</CardTitle>
        <CardDescription>Total: {formatINR(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <PieChart width={160} height={160}>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [formatINR(v as number), '']}
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
            />
          </PieChart>

          <div className="flex-1 space-y-1.5 min-w-0">
            {data.slice(0, 6).map((d, i) => (
              <div key={d.type} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate">{d.type || 'Other'}</span>
                </div>
                <span className="font-medium tabular-nums shrink-0">{formatINR(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
