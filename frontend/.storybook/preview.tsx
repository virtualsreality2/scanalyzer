import React from 'react';
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/components/common/theme';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#141414',
        },
        {
          name: 'surface',
          value: '#fafafa',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    docs: {
      toc: true,
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.parameters.theme || context.globals.theme || 'light';
      
      return (
        <ThemeProvider defaultColorScheme={theme}>
          <div className="min-h-screen bg-background-primary p-8">
            <Story />
          </div>
        </ThemeProvider>
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'system', title: 'System', icon: 'computer' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    platform: {
      name: 'Platform',
      description: 'Target platform',
      defaultValue: 'windows',
      toolbar: {
        icon: 'computer',
        items: [
          { value: 'windows', title: 'Windows' },
          { value: 'macos', title: 'macOS' },
          { value: 'linux', title: 'Linux' },
        ],
        showName: true,
      },
    },
  },
};

export default preview;