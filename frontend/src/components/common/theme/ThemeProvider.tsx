import React, { createContext, useCallback, useEffect, useState } from 'react';
import { Theme, ColorScheme, createTheme, utils } from '../../../styles/design-system';

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme | 'system') => void;
  systemColorScheme: ColorScheme;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultColorScheme?: ColorScheme | 'system';
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultColorScheme = 'system',
  storageKey = 'scanalyzer-theme',
}: ThemeProviderProps) {
  // Detect system color scheme
  const getSystemColorScheme = useCallback((): ColorScheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Detect platform
  const getPlatform = useCallback(() => {
    if (typeof window === 'undefined') return 'windows';
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    return 'windows';
  }, []);

  const [systemColorScheme, setSystemColorScheme] = useState<ColorScheme>(getSystemColorScheme());
  const [userPreference, setUserPreference] = useState<ColorScheme | 'system'>(() => {
    if (typeof window === 'undefined') return defaultColorScheme;
    
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return defaultColorScheme;
  });

  const colorScheme = userPreference === 'system' ? systemColorScheme : userPreference;
  const platform = getPlatform();
  const theme = createTheme(colorScheme, platform);

  // Listen for system color scheme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemColorScheme(e.matches ? 'dark' : 'light');
    };

    // Check if addEventListener is supported (older Safari doesn't support it)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply color scheme class
    root.classList.remove('light', 'dark');
    root.classList.add(colorScheme);
    
    // Apply platform class
    root.classList.remove('windows', 'macos', 'linux');
    root.classList.add(platform);

    // Generate and apply CSS variables
    const cssVariables = utils.generateCSSVariables(theme);
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Additional manual CSS variables for common use cases
    root.style.setProperty('--color-scheme', colorScheme);
    root.style.setProperty('--platform', platform);
    
    // Set color-scheme for native form controls
    root.style.colorScheme = colorScheme;
  }, [theme, colorScheme, platform]);

  const setColorScheme = useCallback((scheme: ColorScheme | 'system') => {
    setUserPreference(scheme);
    localStorage.setItem(storageKey, scheme);
  }, [storageKey]);

  const value: ThemeContextValue = {
    theme,
    colorScheme,
    systemColorScheme,
    setColorScheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}