import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

addons.setConfig({
  theme: {
    ...themes.normal,
    brandTitle: 'Scanalyzer Component Library',
    brandUrl: 'https://scanalyzer.io',
    brandTarget: '_self',
    
    // UI
    appBg: '#fafafa',
    appContentBg: '#ffffff',
    appBorderColor: '#e8e8e8',
    appBorderRadius: 4,
    
    // Typography
    fontBase: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontCode: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    
    // Text colors
    textColor: '#1f1f1f',
    textInverseColor: '#ffffff',
    
    // Toolbar default and active colors
    barTextColor: '#595959',
    barSelectedColor: '#1677ff',
    barBg: '#ffffff',
    
    // Form colors
    inputBg: '#ffffff',
    inputBorder: '#d9d9d9',
    inputTextColor: '#1f1f1f',
    inputBorderRadius: 4,
  },
  sidebar: {
    showRoots: true,
    collapsedRoots: ['other'],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});