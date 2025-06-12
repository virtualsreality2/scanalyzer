import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { Card } from '../ui/Card';
import { format, subDays } from 'date-fns';

interface TrendChartProps {
  className?: string;
}

export function TrendChart({ className }: TrendChartProps) {
  // Generate sample data for the last 30 days
  const generateData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date: format(date, 'MMM dd'),
        critical: Math.floor(Math.random() * 10) + 5,
        high: Math.floor(Math.random() * 20) + 10,
        medium: Math.floor(Math.random() * 30) + 15,
        low: Math.floor(Math.random() * 40) + 20,
        total: 0
      });
    }
    // Calculate totals
    data.forEach(d => {
      d.total = d.critical + d.high + d.medium + d.low;
    });
    return data;
  };

  const [data] = useState(generateData());

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className={className}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="#ea580c"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="medium"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke="#84cc16"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Brush
              dataKey="date"
              height={30}
              stroke="#8884d8"
              className="mt-4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}