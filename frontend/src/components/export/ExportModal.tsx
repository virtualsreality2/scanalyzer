import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, FileSpreadsheet, FileJson, Download } from 'lucide-react';
import { Card } from '../ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface ExportField {
  key: string;
  label: string;
  included: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  findings: any[];
  onClose?: () => void;
  onExport?: (format: string, fields: string[]) => Promise<void>;
  className?: string;
}

const FORMAT_OPTIONS = [
  { id: 'csv', label: 'CSV', icon: FileText, description: 'Comma-separated values' },
  { id: 'json', label: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' },
  { id: 'pdf', label: 'PDF', icon: FileText, description: 'Portable Document Format' },
  { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: 'Excel Spreadsheet' }
];

export function ExportModal({ isOpen, findings, onClose, onExport }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [fields, setFields] = useState<ExportField[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);

  useEffect(() => {
    if (findings.length > 0) {
      const sampleFinding = findings[0];
      const availableFields = Object.keys(sampleFinding).map(key => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        included: ['title', 'severity', 'tool', 'created_at'].includes(key)
      }));
      setFields(availableFields);
    }
  }, [findings]);

  const toggleField = (key: string) => {
    setFields(prev => prev.map(field => 
      field.key === key ? { ...field, included: !field.included } : field
    ));
  };

  const getSelectedFields = () => fields.filter(f => f.included).map(f => f.key);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportComplete(false);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      await onExport?.(selectedFormat, getSelectedFields());

      clearInterval(progressInterval);
      setExportProgress(100);
      setExportComplete(true);

      setTimeout(() => {
        onClose?.();
        setIsExporting(false);
        setExportComplete(false);
        setExportProgress(0);
      }, 2000);
    } catch (error) {
      setIsExporting(false);
      console.error('Export failed:', error);
    }
  };

  const generatePreview = () => {
    const selectedFields = getSelectedFields();
    const previewData = findings.slice(0, 3);

    switch (selectedFormat) {
      case 'csv':
        const headers = selectedFields.map(f => `"${f}"`).join(',');
        const rows = previewData.map(item =>
          selectedFields.map(field => `"${item[field] || ''}"`).join(',')
        );
        return [headers, ...rows].join('\n');

      case 'json':
        const jsonData = previewData.map(item =>
          selectedFields.reduce((acc, field) => ({
            ...acc,
            [field]: item[field]
          }), {})
        );
        return JSON.stringify(jsonData, null, 2);

      default:
        return 'Preview not available for this format';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Export Findings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Format selection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Select Format</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {FORMAT_OPTIONS.map(format => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={clsx(
                      'p-4 rounded-lg border-2 transition-all',
                      selectedFormat === format.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <format.icon className="mx-auto mb-2" size={24} />
                    <p className="font-medium text-sm">{format.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{format.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Field selection */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Select Fields</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {fields.map(field => (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={field.included}
                      onChange={() => toggleField(field.key)}
                      className="rounded"
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Preview</h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre>{generatePreview()}</pre>
              </div>
            </div>

            {/* Export progress */}
            {isExporting && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {exportComplete ? 'Export Complete' : 'Exporting...'}
                  </span>
                  <span className="text-sm text-gray-500">{exportProgress}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${exportProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Exporting {findings.length} findings
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || getSelectedFields().length === 0}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2',
                  'bg-blue-600 text-white hover:bg-blue-700',
                  'disabled:bg-gray-300 disabled:cursor-not-allowed'
                )}
              >
                <Download size={16} />
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}