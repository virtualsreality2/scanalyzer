import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { clsx } from 'clsx';

interface SeverityData {
  severity: string;
  count: number;
  percentage: number;
}

interface SeverityDistributionProps {
  data: SeverityData[];
  onFilter?: (severity: string) => void;
  className?: string;
}

const COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#f59e0b',
  low: '#84cc16',
  info: '#06b6d4'
};

export function SeverityDistribution({ data, onFilter, className }: SeverityDistributionProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold capitalize">{data.severity}</p>
        <p className="text-sm">Count: {data.count}</p>
        <p className="text-sm">Percentage: {data.percentage.toFixed(1)}%</p>
      </div>
    );
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, index }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (value === 0) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-semibold"
      >
        {value}
      </text>
    );
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <ul className="flex flex-col gap-2 mt-4">
        {payload.map((entry: any, index: number) => (
          <li
            key={`item-${index}`}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={() => onFilter?.(entry.value)}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm capitalize">
              {entry.value} ({entry.payload.count})
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const chartData = data.filter(d => d.count > 0);

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No findings to display
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="h-64" role="img" aria-label="Severity distribution chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.severity as keyof typeof COLORS] || '#8884d8'}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onFilter?.(entry.severity)}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}