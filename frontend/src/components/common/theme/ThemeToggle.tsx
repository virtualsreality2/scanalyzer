import React from 'react';
import { useTheme } from './useTheme';
import { ColorScheme } from '../../../styles/design-system';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', showLabel = false, size = 'md' }: ThemeToggleProps) {
  const { colorScheme, setColorScheme, systemColorScheme } = useTheme();
  
  const options: Array<{ value: ColorScheme | 'system'; label: string; icon: React.ReactNode }> = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg
          className="theme-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 2V4M10 16V18M4 10H2M6.31412 6.31412L4.8999 4.8999M13.6859 6.31412L15.1001 4.8999M6.31412 13.69L4.8999 15.1001M13.6859 13.69L15.1001 15.1001M18 10H16M14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6C12.2091 6 14 7.79086 14 10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg
          className="theme-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg
          className="theme-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V11C17 12.1046 16.1046 13 15 13H5C3.89543 13 3 12.1046 3 11V5Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M7 17H13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 13V17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  const currentValue = localStorage.getItem('scanalyzer-theme') || 'system';
  
  const sizeClasses = {
    sm: 'theme-toggle-sm',
    md: 'theme-toggle-md',
    lg: 'theme-toggle-lg',
  };

  return (
    <div className={`theme-toggle ${sizeClasses[size]} ${className}`}>
      {showLabel && (
        <span className="theme-toggle-label">Theme</span>
      )}
      <div className="theme-toggle-group" role="radiogroup" aria-label="Theme selection">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={currentValue === option.value}
            className={`theme-toggle-button ${currentValue === option.value ? 'active' : ''}`}
            onClick={() => setColorScheme(option.value)}
            title={`${option.label} theme${option.value === 'system' ? ` (currently ${systemColorScheme})` : ''}`}
            aria-label={`${option.label} theme${option.value === 'system' ? ` (currently ${systemColorScheme})` : ''}`}
          >
            {option.icon}
            {showLabel && <span className="theme-toggle-button-label">{option.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Export a compact version for toolbars
export function ThemeToggleCompact({ className = '' }: { className?: string }) {
  const { setColorScheme, systemColorScheme } = useTheme();
  const currentValue = localStorage.getItem('scanalyzer-theme') || 'system';
  
  const handleToggle = () => {
    const order: Array<ColorScheme | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(currentValue as ColorScheme | 'system');
    const nextIndex = (currentIndex + 1) % order.length;
    setColorScheme(order[nextIndex]);
  };

  const getIcon = () => {
    const effectiveTheme = currentValue === 'system' ? systemColorScheme : currentValue;
    
    if (currentValue === 'system') {
      return (
        <svg className="theme-icon" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V11C17 12.1046 16.1046 13 15 13H5C3.89543 13 3 12.1046 3 11V5Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M7 17H13M10 13V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }
    
    if (effectiveTheme === 'dark') {
      return (
        <svg className="theme-icon" viewBox="0 0 20 20" fill="none">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" fill="currentColor" />
        </svg>
      );
    }
    
    return (
      <svg className="theme-icon" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2V4M10 16V18M4 10H2M6.31412 6.31412L4.8999 4.8999M13.6859 6.31412L15.1001 4.8999M6.31412 13.69L4.8999 15.1001M13.6859 13.69L15.1001 15.1001M18 10H16M14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6C12.2091 6 14 7.79086 14 10Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <button
      type="button"
      className={`theme-toggle-compact ${className}`}
      onClick={handleToggle}
      title={`Current: ${currentValue}${currentValue === 'system' ? ` (${systemColorScheme})` : ''}`}
      aria-label={`Toggle theme. Current: ${currentValue}${currentValue === 'system' ? ` (${systemColorScheme})` : ''}`}
    >
      {getIcon()}
    </button>
  );
}