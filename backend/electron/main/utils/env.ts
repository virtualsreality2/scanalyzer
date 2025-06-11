/**
 * Environment utility functions for Electron app
 */

/**
 * Check if the app is running in development mode
 * @returns {boolean} True if in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
}

/**
 * Check if the app is running in production mode
 * @returns {boolean} True if in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
}