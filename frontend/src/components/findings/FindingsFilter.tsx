import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { ChevronDown, ChevronUp, X, Save, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterState {
  severity?: string[];
  tool?: string[];
  category?: string[];
  dateRange?: { from: Date | null; to: Date | null };
  status?: string[];
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

interface FindingsFilterProps {
  onFilterChange?: (filters: FilterState) => void;
  onSavePreset?: (preset: { name: string; filters: FilterState }) => void;
  presets?: FilterPreset[];
  className?: string;
}

export function FindingsFilter({
  onFilterChange,
  onSavePreset,
  presets = [],
  className
}: FindingsFilterProps) {
  const [filters, setFilters] = useState<FilterState>({
    severity: [],
    tool: [],
    category: [],
    status: []
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['severity', 'tool', 'dateRange', 'categories'])
  );
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const severityOptions = ['critical', 'high', 'medium', 'low', 'info'];
  const toolOptions = ['Prowler', 'Checkov', 'Bandit', 'Trivy', 'Custom'];
  const categoryOptions = ['Security', 'Compliance', 'Best Practices', 'Performance'];
  const statusOptions = ['open', 'resolved', 'false_positive', 'accepted_risk'];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentValues = (prev[category] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      const newFilters = {
        ...prev,
        [category]: newValues
      };
      
      onFilterChange?.(newFilters);
      return newFilters;
    });
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      severity: [],
      tool: [],
      category: [],
      status: []
    };
    setFilters(clearedFilters);
    onFilterChange?.(clearedFilters);
  };

  const savePreset = () => {
    if (presetName.trim()) {
      onSavePreset?.({
        name: presetName.trim(),
        filters
      });
      setShowPresetDialog(false);
      setPresetName('');
    }
  };

  const loadPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
    onFilterChange?.(preset.filters);
  };

  const activeFilterCount = Object.values(filters).reduce((count, values) => {
    if (Array.isArray(values)) return count + values.length;
    if (values && typeof values === 'object' && (values.from || values.to)) return count + 1;
    return count;
  }, 0);

  const renderFilterSection = (
    title: string,
    key: keyof FilterState,
    options: string[]
  ) => {
    const isExpanded = expandedSections.has(key);
    const selectedCount = (filters[key] as string[])?.length || 0;

    return (
      <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <button
          onClick={() => toggleSection(key)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{title}</span>
            {selectedCount > 0 && (
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-2">
                {options.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <input
                      type="checkbox"
                      checked={(filters[key] as string[])?.includes(option) || false}
                      onChange={() => toggleFilter(key, option)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{option}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <Card className={className}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={18} />
            <h3 className="font-medium">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter sections */}
      <div>
        {renderFilterSection('Severity', 'severity', severityOptions)}
        {renderFilterSection('Tool', 'tool', toolOptions)}
        {renderFilterSection('Categories', 'category', categoryOptions)}
        {renderFilterSection('Status', 'status', statusOptions)}
        
        {/* Date Range */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('dateRange')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="font-medium text-sm">Date Range</span>
            {expandedSections.has('dateRange') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          <AnimatePresence>
            {expandedSections.has('dateRange') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-2">
                  <input
                    type="date"
                    placeholder="From"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, from: date }
                      }));
                    }}
                  />
                  <input
                    type="date"
                    placeholder="To"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, to: date }
                      }));
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Presets */}
      <div className="px-4 py-3 space-y-3">
        {presets.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Saved Presets</p>
            <div className="space-y-1">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <button
          onClick={() => setShowPresetDialog(true)}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
        >
          Save Preset
        </button>
      </div>

      {/* Save preset dialog */}
      <AnimatePresence>
        {showPresetDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowPresetDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Save Filter Preset</h3>
              <input
                type="text"
                placeholder="Preset Name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 mb-4"
                aria-label="Preset Name"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPresetDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={savePreset}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}