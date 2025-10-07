/**
 * File System Utilities with Enhanced Error Handling
 * 
 * Provides robust file system operations with proper error categorization
 * and recovery strategies for Topolop analyzers.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { resolveConfig } = require('../config/default-config');

class FileSystemError extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Enhanced file reading with proper error handling
 */
async function safeReadFile(filePath, options = {}) {
  const { 
    encoding = 'utf8',
    maxSize = resolveConfig('formalMethods.javascript.maxFileSize'),
    fallbackEncoding = 'binary'
  } = options;

  try {
    // Check if file exists and is readable
    await fs.access(filePath, fsSync.constants.R_OK);
    
    // Get file stats to check size
    const stats = await fs.stat(filePath);
    
    if (stats.size > maxSize) {
      throw new FileSystemError(
        `File too large: ${stats.size} bytes (max: ${maxSize})`,
        'FILE_TOO_LARGE'
      );
    }

    if (!stats.isFile()) {
      throw new FileSystemError(
        `Path is not a file: ${filePath}`,
        'NOT_A_FILE'
      );
    }

    // Try to read with specified encoding
    try {
      return await fs.readFile(filePath, encoding);
    } catch (encodingError) {
      if (fallbackEncoding && encoding !== fallbackEncoding) {
        // Try fallback encoding
        const content = await fs.readFile(filePath, fallbackEncoding);
        return content;
      }
      throw encodingError;
    }

  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }

    // Categorize system errors
    switch (error.code) {
      case 'ENOENT':
        throw new FileSystemError(`File not found: ${filePath}`, 'FILE_NOT_FOUND', error);
      case 'EACCES':
        throw new FileSystemError(`Permission denied: ${filePath}`, 'PERMISSION_DENIED', error);
      case 'EISDIR':
        throw new FileSystemError(`Path is a directory: ${filePath}`, 'IS_DIRECTORY', error);
      case 'EMFILE':
      case 'ENFILE':
        throw new FileSystemError('Too many open files', 'TOO_MANY_FILES', error);
      case 'ENOSPC':
        throw new FileSystemError('No space left on device', 'NO_SPACE', error);
      default:
        throw new FileSystemError(`File system error: ${error.message}`, 'UNKNOWN', error);
    }
  }
}

/**
 * Safe file writing with directory creation
 */
async function safeWriteFile(filePath, content, options = {}) {
  const { createDirs = true, mode = 0o644 } = options;

  try {
    if (createDirs) {
      await ensureDirectory(path.dirname(filePath));
    }

    await fs.writeFile(filePath, content, { mode, ...options });
    return true;

  } catch (error) {
    switch (error.code) {
      case 'ENOENT':
        if (!createDirs) {
          throw new FileSystemError(`Directory does not exist: ${path.dirname(filePath)}`, 'DIR_NOT_FOUND', error);
        }
        throw new FileSystemError(`Cannot create file: ${filePath}`, 'CANNOT_CREATE', error);
      case 'EACCES':
        throw new FileSystemError(`Permission denied writing: ${filePath}`, 'PERMISSION_DENIED', error);
      case 'ENOSPC':
        throw new FileSystemError('No space left on device', 'NO_SPACE', error);
      case 'EROFS':
        throw new FileSystemError('Read-only file system', 'READ_ONLY', error);
      default:
        throw new FileSystemError(`Write error: ${error.message}`, 'WRITE_ERROR', error);
    }
  }
}

/**
 * Ensure directory exists, create if needed
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
    const stats = await fs.stat(dirPath);
    
    if (!stats.isDirectory()) {
      throw new FileSystemError(`Path exists but is not a directory: ${dirPath}`, 'NOT_A_DIRECTORY');
    }
    
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
        return true;
      } catch (createError) {
        throw new FileSystemError(
          `Cannot create directory: ${dirPath} - ${createError.message}`,
          'CANNOT_CREATE_DIR',
          createError
        );
      }
    } else if (error instanceof FileSystemError) {
      throw error;
    } else {
      throw new FileSystemError(`Directory access error: ${error.message}`, 'DIR_ACCESS_ERROR', error);
    }
  }
}

/**
 * Check if file/directory can be accessed
 */
function canAccess(filePath, mode = fsSync.constants.R_OK) {
  try {
    fsSync.accessSync(filePath, mode);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Safe file stat with error handling
 */
async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    switch (error.code) {
      case 'ENOENT':
        return null; // File doesn't exist
      case 'EACCES':
        throw new FileSystemError(`Permission denied: ${filePath}`, 'PERMISSION_DENIED', error);
      default:
        throw new FileSystemError(`Stat error: ${error.message}`, 'STAT_ERROR', error);
    }
  }
}

/**
 * Find file by walking up directory tree
 */
async function findFileUpwards(startPath, fileName, maxDepth = 10) {
  let currentPath = path.resolve(startPath);
  let depth = 0;

  while (depth < maxDepth) {
    const candidatePath = path.join(currentPath, fileName);
    
    try {
      const stats = await safeStat(candidatePath);
      if (stats && stats.isFile()) {
        return candidatePath;
      }
    } catch (error) {
      // Continue searching even if we hit permission errors
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached root
      break;
    }

    currentPath = parentPath;
    depth++;
  }

  return null;
}

/**
 * List directory contents with error handling
 */
async function safeReadDir(dirPath, options = {}) {
  const { withFileTypes = false, filter = null } = options;

  try {
    const items = await fs.readdir(dirPath, { withFileTypes });
    
    if (filter && typeof filter === 'function') {
      return items.filter(filter);
    }
    
    return items;
  } catch (error) {
    switch (error.code) {
      case 'ENOENT':
        throw new FileSystemError(`Directory not found: ${dirPath}`, 'DIR_NOT_FOUND', error);
      case 'EACCES':
        throw new FileSystemError(`Permission denied: ${dirPath}`, 'PERMISSION_DENIED', error);
      case 'ENOTDIR':
        throw new FileSystemError(`Not a directory: ${dirPath}`, 'NOT_A_DIRECTORY', error);
      default:
        throw new FileSystemError(`Directory read error: ${error.message}`, 'READ_DIR_ERROR', error);
    }
  }
}

/**
 * Safe temporary file creation
 */
async function createTempFile(prefix = 'topolop', suffix = '.tmp') {
  const os = require('os');
  const crypto = require('crypto');
  
  const tmpDir = os.tmpdir();
  const randomId = crypto.randomBytes(8).toString('hex');
  const fileName = `${prefix}-${randomId}${suffix}`;
  const filePath = path.join(tmpDir, fileName);
  
  try {
    // Create empty file
    await fs.writeFile(filePath, '', { flag: 'wx' }); // Fail if exists
    return filePath;
  } catch (error) {
    throw new FileSystemError(`Cannot create temp file: ${error.message}`, 'TEMP_FILE_ERROR', error);
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // Already deleted
    }
    // Log but don't throw - temp cleanup failures shouldn't break analysis
    console.warn(`Warning: Could not cleanup temp file ${filePath}: ${error.message}`);
    return false;
  }
}

module.exports = {
  FileSystemError,
  safeReadFile,
  safeWriteFile,
  ensureDirectory,
  canAccess,
  safeStat,
  findFileUpwards,
  safeReadDir,
  createTempFile,
  cleanupTempFile
};