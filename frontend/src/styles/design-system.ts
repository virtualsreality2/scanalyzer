/**
 * Scanalyzer Design System
 * A comprehensive design system that provides native feel on both Windows and macOS
 * while maintaining a consistent security-focused experience.
 * 
 * Design Principles:
 * - Information density without clutter
 * - Clear visual hierarchy for security findings
 * - Native feel on both Windows and macOS
 * - WCAG 2.1 AA compliance for accessibility
 */

export type Platform = 'windows' | 'macos' | 'linux';
export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

// Severity levels for security findings
export const SeverityLevels = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
} as const;

export type SeverityLevel = typeof SeverityLevels[keyof typeof SeverityLevels];

// Base color primitives
const colorPrimitives = {
  // Brand colors
  brand: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    200: '#91CAFF',
    300: '#69B4FF',
    400: '#4096FF',
    500: '#1677FF', // Primary brand blue
    600: '#0958D9',
    700: '#003EB3',
    800: '#002C8C',
    900: '#001D66',
  },
  
  // Neutral colors
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E8E8E8',
    300: '#D9D9D9',
    400: '#BFBFBF',
    500: '#8C8C8C',
    600: '#595959',
    700: '#434343',
    800: '#262626',
    900: '#1F1F1F',
    950: '#141414',
    1000: '#000000',
  },
  
  // Severity colors
  severity: {
    critical: '#DC2626', // Red-600
    high: '#F59E0B',    // Amber-500
    medium: '#3B82F6',  // Blue-500
    low: '#10B981',     // Emerald-500
    info: '#6B7280',    // Gray-500
  },
  
  // Semantic colors (WCAG AA compliant)
  semantic: {
    success: '#059669', // Emerald-600
    successLight: '#10B981', // Emerald-500
    warning: '#D97706', // Amber-600
    warningLight: '#F59E0B', // Amber-500
    error: '#DC2626', // Red-600
    errorLight: '#EF4444', // Red-500
    info: '#2563EB', // Blue-600
    infoLight: '#3B82F6', // Blue-500
  },
  
  // System colors (will be overridden by platform)
  system: {
    accentColor: '#1677FF',
    focusColor: '#4096FF',
    selectionBackground: '#E6F4FF',
    selectionText: '#1677FF',
  },
} as const;

// Typography scale
const typography = {
  fontFamily: {
    // Platform-specific font stacks
    windows: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    macos: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.01em',
    wider: '0.02em',
  },
} as const;

// Spacing scale (based on 8px grid for better alignment)
const spacing = {
  0: '0',
  0.5: '0.25rem', // 4px
  1: '0.5rem',    // 8px
  1.5: '0.75rem', // 12px
  2: '1rem',      // 16px
  3: '1.5rem',    // 24px
  4: '2rem',      // 32px
  5: '2.5rem',    // 40px
  6: '3rem',      // 48px
  8: '4rem',      // 64px
  10: '5rem',     // 80px
  12: '6rem',     // 96px
} as const;

// Border radius
const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
} as const;

// Shadow definitions
const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
} as const;

// Z-index scale
const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// Animation durations
const animation = {
  duration: {
    instant: '0ms',
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// Transitions
const transitions = {
  none: 'none',
  all: `all ${animation.duration.base} ${animation.easing.easeInOut}`,
  colors: `background-color ${animation.duration.fast} ${animation.easing.easeInOut}, border-color ${animation.duration.fast} ${animation.easing.easeInOut}, color ${animation.duration.fast} ${animation.easing.easeInOut}`,
  opacity: `opacity ${animation.duration.base} ${animation.easing.easeInOut}`,
  shadow: `box-shadow ${animation.duration.base} ${animation.easing.easeInOut}`,
  transform: `transform ${animation.duration.base} ${animation.easing.easeInOut}`,
} as const;

// Light theme color tokens
const lightThemeColors = {
  // Background colors
  background: {
    primary: colorPrimitives.neutral[0],
    secondary: colorPrimitives.neutral[50],
    tertiary: colorPrimitives.neutral[100],
    inverse: colorPrimitives.neutral[900],
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Surface colors (cards, panels, etc.)
  surface: {
    primary: colorPrimitives.neutral[0],
    secondary: colorPrimitives.neutral[50],
    tertiary: colorPrimitives.neutral[100],
    elevated: colorPrimitives.neutral[0],
  },
  
  // Text colors
  text: {
    primary: colorPrimitives.neutral[900],
    secondary: colorPrimitives.neutral[600],
    tertiary: colorPrimitives.neutral[500],
    disabled: colorPrimitives.neutral[400],
    inverse: colorPrimitives.neutral[0],
    link: colorPrimitives.brand[600],
    linkHover: colorPrimitives.brand[700],
  },
  
  // Border colors
  border: {
    primary: colorPrimitives.neutral[200],
    secondary: colorPrimitives.neutral[300],
    tertiary: colorPrimitives.neutral[400],
    focus: colorPrimitives.brand[500],
    error: colorPrimitives.semantic.error,
  },
  
  // Severity colors with proper contrast
  severity: {
    critical: {
      background: '#FEE2E2',
      border: '#FECACA',
      text: '#991B1B',
      icon: colorPrimitives.severity.critical,
    },
    high: {
      background: '#FEF3C7',
      border: '#FDE68A',
      text: '#92400E',
      icon: colorPrimitives.severity.high,
    },
    medium: {
      background: '#DBEAFE',
      border: '#BFDBFE',
      text: '#1E40AF',
      icon: colorPrimitives.severity.medium,
    },
    low: {
      background: '#D1FAE5',
      border: '#A7F3D0',
      text: '#065F46',
      icon: colorPrimitives.severity.low,
    },
    info: {
      background: '#F3F4F6',
      border: '#E5E7EB',
      text: '#374151',
      icon: colorPrimitives.severity.info,
    },
  },
  
  // Interactive states
  interactive: {
    primary: colorPrimitives.brand[500],
    primaryHover: colorPrimitives.brand[600],
    primaryActive: colorPrimitives.brand[700],
    secondary: colorPrimitives.neutral[100],
    secondaryHover: colorPrimitives.neutral[200],
    secondaryActive: colorPrimitives.neutral[300],
  },
} as const;

// Dark theme color tokens
const darkThemeColors = {
  // Background colors
  background: {
    primary: colorPrimitives.neutral[950],
    secondary: colorPrimitives.neutral[900],
    tertiary: colorPrimitives.neutral[800],
    inverse: colorPrimitives.neutral[50],
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  
  // Surface colors
  surface: {
    primary: colorPrimitives.neutral[900],
    secondary: colorPrimitives.neutral[800],
    tertiary: colorPrimitives.neutral[700],
    elevated: colorPrimitives.neutral[800],
  },
  
  // Text colors
  text: {
    primary: colorPrimitives.neutral[50],
    secondary: colorPrimitives.neutral[300],
    tertiary: colorPrimitives.neutral[400],
    disabled: colorPrimitives.neutral[600],
    inverse: colorPrimitives.neutral[900],
    link: colorPrimitives.brand[400],
    linkHover: colorPrimitives.brand[300],
  },
  
  // Border colors
  border: {
    primary: colorPrimitives.neutral[700],
    secondary: colorPrimitives.neutral[600],
    tertiary: colorPrimitives.neutral[500],
    focus: colorPrimitives.brand[400],
    error: colorPrimitives.semantic.error,
  },
  
  // Severity colors with proper contrast for dark mode
  severity: {
    critical: {
      background: '#7F1D1D',
      border: '#991B1B',
      text: '#FEE2E2',
      icon: '#FCA5A5',
    },
    high: {
      background: '#78350F',
      border: '#92400E',
      text: '#FEF3C7',
      icon: '#FCD34D',
    },
    medium: {
      background: '#1E3A8A',
      border: '#1E40AF',
      text: '#DBEAFE',
      icon: '#93BBFE',
    },
    low: {
      background: '#064E3B',
      border: '#065F46',
      text: '#D1FAE5',
      icon: '#6EE7B7',
    },
    info: {
      background: '#374151',
      border: '#4B5563',
      text: '#F3F4F6',
      icon: '#D1D5DB',
    },
  },
  
  // Interactive states
  interactive: {
    primary: colorPrimitives.brand[400],
    primaryHover: colorPrimitives.brand[300],
    primaryActive: colorPrimitives.brand[200],
    secondary: colorPrimitives.neutral[800],
    secondaryHover: colorPrimitives.neutral[700],
    secondaryActive: colorPrimitives.neutral[600],
  },
} as const;

// Component-specific tokens
const components = {
  button: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: `${spacing[2]} ${spacing[3]}`,
      md: `${spacing[2]} ${spacing[4]}`,
      lg: `${spacing[3]} ${spacing[5]}`,
    },
  },
  
  input: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: `${spacing[1]} ${spacing[2]}`,
      md: `${spacing[2]} ${spacing[3]}`,
      lg: `${spacing[3]} ${spacing[4]}`,
    },
  },
  
  card: {
    padding: {
      sm: spacing[3],
      md: spacing[4],
      lg: spacing[6],
    },
  },
  
  modal: {
    width: {
      sm: '24rem',    // 384px
      md: '32rem',    // 512px
      lg: '48rem',    // 768px
      xl: '64rem',    // 1024px
    },
  },
  
  toast: {
    width: '20rem',   // 320px
    maxWidth: '90vw',
  },
} as const;

// Platform-specific overrides
const platformOverrides = {
  windows: {
    // Windows 11 style adjustments
    borderRadius: {
      base: '0.25rem',  // 4px - Windows 11 uses subtle radius
      md: '0.5rem',     // 8px
      lg: '0.75rem',    // 12px
    },
    shadows: {
      // Softer shadows for Windows 11 style
      base: '0 2px 4px 0 rgba(0, 0, 0, 0.08)',
      md: '0 4px 8px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    },
    typography: {
      fontFamily: {
        primary: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
      },
    },
  },
  
  macos: {
    // macOS style adjustments
    borderRadius: {
      base: '0.375rem', // 6px - macOS uses slightly larger radius
      md: '0.625rem',   // 10px
      lg: '0.875rem',   // 14px
    },
    shadows: {
      // Stronger shadows for macOS depth
      base: '0 1px 3px 0 rgba(0, 0, 0, 0.12), 0 1px 2px 0 rgba(0, 0, 0, 0.08)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08)',
    },
    typography: {
      fontFamily: {
        primary: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
      },
    },
  },
} as const;

// Main theme interface
export interface Theme {
  name: string;
  platform: Platform;
  colorScheme: ColorScheme;
  colors: typeof lightThemeColors | typeof darkThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  animation: typeof animation;
  transitions: typeof transitions;
  components: typeof components;
}

// Helper function to create a theme
export function createTheme(
  colorScheme: ColorScheme,
  platform: Platform = 'windows'
): Theme {
  const colors = colorScheme === 'light' ? lightThemeColors : darkThemeColors;
  const overrides = platformOverrides[platform as keyof typeof platformOverrides];
  
  return {
    name: `${colorScheme}-${platform}`,
    platform,
    colorScheme,
    colors,
    typography: {
      ...typography,
      fontFamily: {
        ...typography.fontFamily,
        ...(overrides?.typography?.fontFamily || {}),
      },
    },
    spacing,
    borderRadius: {
      ...borderRadius,
      ...(overrides?.borderRadius || {}),
    },
    shadows: {
      ...shadows,
      ...(overrides?.shadows || {}),
    },
    zIndex,
    animation,
    transitions,
    components,
  };
}

// Utility functions
export const utils = {
  // Get contrasting text color for a background
  getContrastText: (backgroundColor: string): string => {
    // Simple implementation - can be enhanced with proper color contrast calculation
    const rgb = backgroundColor.match(/\d+/g);
    if (!rgb) return colorPrimitives.neutral[900];
    
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    return brightness > 128 ? colorPrimitives.neutral[900] : colorPrimitives.neutral[0];
  },
  
  // Get severity color based on level
  getSeverityColor: (level: SeverityLevel, element: 'background' | 'border' | 'text' | 'icon' = 'background') => {
    return (theme: Theme) => theme.colors.severity[level][element];
  },
  
  // Generate CSS variables from theme
  generateCSSVariables: (theme: Theme): Record<string, string> => {
    const vars: Record<string, string> = {};
    
    // Colors
    Object.entries(theme.colors).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === 'string') {
          vars[`--color-${category}-${key}`] = value;
        } else {
          // Handle nested objects like severity colors
          Object.entries(value).forEach(([subKey, subValue]) => {
            vars[`--color-${category}-${key}-${subKey}`] = subValue as string;
          });
        }
      });
    });
    
    // Spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      vars[`--spacing-${key}`] = value;
    });
    
    // Border radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      vars[`--radius-${key}`] = value;
    });
    
    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      vars[`--shadow-${key}`] = value;
    });
    
    return vars;
  },
  
  // Media queries
  media: {
    sm: '@media (min-width: 640px)',
    md: '@media (min-width: 768px)',
    lg: '@media (min-width: 1024px)',
    xl: '@media (min-width: 1280px)',
    '2xl': '@media (min-width: 1536px)',
    prefersReducedMotion: '@media (prefers-reduced-motion: reduce)',
    prefersDark: '@media (prefers-color-scheme: dark)',
    prefersLight: '@media (prefers-color-scheme: light)',
    hover: '@media (hover: hover) and (pointer: fine)',
  },
};

// Export default themes
export const themes = {
  lightWindows: createTheme('light', 'windows'),
  darkWindows: createTheme('dark', 'windows'),
  lightMacOS: createTheme('light', 'macos'),
  darkMacOS: createTheme('dark', 'macos'),
} as const;

// Type exports for TypeScript
export type ThemeColors = typeof lightThemeColors | typeof darkThemeColors;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;
export type ThemeBorderRadius = typeof borderRadius;
export type ThemeShadows = typeof shadows;
export type ThemeZIndex = typeof zIndex;
export type ThemeAnimation = typeof animation;
export type ThemeTransitions = typeof transitions;
export type ThemeComponents = typeof components;

// Re-export primitives for direct access
export {
  colorPrimitives,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  animation,
  transitions,
  components,
  lightThemeColors,
  darkThemeColors,
};