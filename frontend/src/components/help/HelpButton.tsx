import React, { useState } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';

interface HelpButtonProps {
  className?: string;
}

interface HelpContext {
  path: string;
  title: string;
  docPath: string;
  tips: string[];
}

const HELP_CONTEXTS: HelpContext[] = [
  {
    path: '/',
    title: 'Dashboard Help',
    docPath: '/user-guide/features/dashboard',
    tips: [
      'Summary cards show your security posture at a glance',
      'Click on any metric to filter findings',
      'Use the time range selector to view historical data'
    ]
  },
  {
    path: '/upload',
    title: 'Upload Help',
    docPath: '/user-guide/features/uploading-reports',
    tips: [
      'Drag and drop multiple files at once',
      'Supported formats: JSON, XML, CSV, PDF, DOCX',
      'Files are processed automatically after upload'
    ]
  },
  {
    path: '/findings',
    title: 'Findings Help',
    docPath: '/user-guide/features/analyzing-findings',
    tips: [
      'Use search operators like severity:critical',
      'Right-click any value to filter by it',
      'Press / to focus the search box'
    ]
  },
  {
    path: '/reports',
    title: 'Reports Help',
    docPath: '/user-guide/features/reports',
    tips: [
      'Click on any report to see its findings',
      'Delete old reports to save space',
      'Export reports in multiple formats'
    ]
  },
  {
    path: '/settings',
    title: 'Settings Help',
    docPath: '/user-guide/settings',
    tips: [
      'Enable auto-updates for latest features',
      'Customize appearance and behavior',
      'Manage data storage location'
    ]
  }
];

export const HelpButton: React.FC<HelpButtonProps> = ({ className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const location = useLocation();
  
  const currentContext = HELP_CONTEXTS.find(ctx => ctx.path === location.pathname) || HELP_CONTEXTS[0];

  const openDocumentation = () => {
    // In Electron, open in external browser
    if (window.electron) {
      window.electron.openExternal(`https://docs.scanalyzer.app${currentContext.docPath}`);
    } else {
      window.open(`https://docs.scanalyzer.app${currentContext.docPath}`, '_blank');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Global help shortcut
    if (e.key === '?' && e.shiftKey) {
      openDocumentation();
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress as any);
    return () => window.removeEventListener('keydown', handleKeyPress as any);
  }, [location.pathname]);

  return (
    <div className="relative">
      <button
        onClick={openDocumentation}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
        aria-label="Get help for this page"
      >
        <QuestionMarkCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>

      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <h3 className="font-semibold text-sm mb-2">{currentContext.title}</h3>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {currentContext.tips.map((tip, index) => (
              <li key={index} className="flex items-start">
                <span className="text-indigo-500 mr-1">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">?</kbd> for full documentation
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Context-aware help panel for detailed assistance
export const HelpPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const currentContext = HELP_CONTEXTS.find(ctx => ctx.path === location.pathname) || HELP_CONTEXTS[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">{currentContext.title}</h2>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="prose dark:prose-invert max-w-none">
            <h3>Quick Tips</h3>
            <ul>
              {currentContext.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
            
            <h3>Keyboard Shortcuts</h3>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td><kbd>?</kbd></td>
                  <td>Open help documentation</td>
                </tr>
                <tr>
                  <td><kbd>/</kbd></td>
                  <td>Focus search</td>
                </tr>
                <tr>
                  <td><kbd>Ctrl+E</kbd></td>
                  <td>Export data</td>
                </tr>
                <tr>
                  <td><kbd>Esc</kbd></td>
                  <td>Close dialogs</td>
                </tr>
              </tbody>
            </table>
            
            <h3>Learn More</h3>
            <p>For detailed documentation, visit our <a 
              href={`https://docs.scanalyzer.app${currentContext.docPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              online documentation
            </a>.</p>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};