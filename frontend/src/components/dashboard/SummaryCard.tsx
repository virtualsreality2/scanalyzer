import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card } from '../ui/Card';
import { clsx } from 'clsx';

interface SummaryCardProps {
  title: string;
  value: number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
  };
  onDrillDown?: () => void;
  className?: string;
}

export function SummaryCard({ title, value, trend, onDrillDown, className }: SummaryCardProps) {
  const trendIcon = trend?.direction === 'up' ? <ArrowUp size={16} /> :
                    trend?.direction === 'down' ? <ArrowDown size={16} /> :
                    <Minus size={16} />;

  const trendColor = trend?.direction === 'up' ? 'text-red-600' :
                     trend?.direction === 'down' ? 'text-green-600' :
                     'text-gray-600';

  return (
    <Card
      variant="elevated"
      interactive={!!onDrillDown}
      onClick={onDrillDown}
      className={clsx('transition-all duration-200', className)}
    >
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h4>
        <div className="flex items-end justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {value.toLocaleString()}
            </motion.div>
          </AnimatePresence>
          {trend && (
            <div className={clsx('flex items-center gap-1 text-sm', trendColor)}>
              {trendIcon}
              <span>{trend.percentage > 0 ? `${trend.percentage}%` : ''}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}