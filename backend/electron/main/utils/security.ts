import * as path from 'path';

/**
 * Security utility functions for path validation and sanitization
 */

/**
 * Validate that a path is safe and doesn't contain dangerous patterns
 * @param {string} inputPath - The path to validate
 * @returns {boolean} True if the path is valid and safe
 */
export function validatePath(inputPath: string): boolean {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }

  // Check for null bytes
  if (inputPath.includes('\0')) {
    return false;
  }

  // Check for directory traversal attempts
  const normalizedPath = path.normalize(inputPath);
  if (normalizedPath.includes('..')) {
    return false;
  }

  // Check for absolute paths on Windows that might be dangerous
  if (process.platform === 'win32' && /^[A-Za-z]:/.test(inputPath)) {
    // Allow absolute paths but ensure they don't contain traversal
    const segments = inputPath.split(/[\\/]/);
    return !segments.includes('..');
  }

  // Check for dangerous protocols
  const dangerousProtocols = ['file://', 'javascript:', 'data:', 'vbscript:'];
  const lowerPath = inputPath.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerPath.startsWith(protocol)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize a path by removing dangerous characters and patterns
 * @param {string} inputPath - The path to sanitize
 * @returns {string} The sanitized path
 */
export function sanitizePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = inputPath.replace(/\0/g, '');

  // Normalize the path
  sanitized = path.normalize(sanitized);

  // Remove any remaining directory traversal attempts
  sanitized = sanitized.split(path.sep)
    .filter(segment => segment !== '..' && segment !== '.')
    .join(path.sep);

  // Remove dangerous characters for file systems
  // Keep alphanumeric, spaces, hyphens, underscores, dots, and path separators
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.\\/]/g, '');

  // Remove leading/trailing spaces and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

  return sanitized;
}