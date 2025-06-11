/**
 * Security utility functions for path validation
 */
import * as path from 'path';
import { app } from 'electron';

/**
 * Validate a file path to prevent directory traversal attacks
 */
export function validatePath(inputPath: string): boolean {
  if (!inputPath) {
    return false;
  }

  // Check for null bytes
  if (inputPath.indexOf('\0') !== -1) {
    return false;
  }

  // Check for directory traversal
  if (inputPath.includes('..')) {
    return false;
  }

  // Check for dangerous protocols
  const dangerousProtocols = ['file://', 'javascript:', 'data:', 'vbscript:'];
  const lowerPath = inputPath.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerPath.startsWith(protocol)) {
      return false;
    }
  }

  // Normalize the path
  const normalizedPath = path.normalize(inputPath);

  // Check if path is within allowed directories
  const allowedPaths = [
    app.getPath('userData'),
    app.getPath('temp'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('home')
  ];

  // For absolute paths, check if they're within allowed directories
  if (path.isAbsolute(normalizedPath)) {
    const isAllowed = allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize a file path by removing dangerous characters
 */
export function sanitizePath(inputPath: string): string {
  if (!inputPath) {
    return '';
  }

  // Remove null bytes
  let sanitized = inputPath.replace(/\0/g, '');

  // Normalize path separators
  sanitized = path.normalize(sanitized);

  // Remove any remaining directory traversal attempts
  sanitized = sanitized.split(path.sep)
    .filter(segment => segment !== '..' && segment !== '.')
    .join(path.sep);

  // Remove dangerous characters but keep valid path characters
  sanitized = sanitized.replace(/[^\w\s\-\.\/\\:]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}