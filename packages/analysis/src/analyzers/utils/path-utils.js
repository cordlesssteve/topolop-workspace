/**
 * Path Management Utilities for Topolop Analyzers
 * 
 * Provides configurable path management with proper temporary
 * directory handling and cleanup.
 */

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { resolveConfig } = require('../config/default-config');
const { ensureDirectory, cleanupTempFile } = require('./fs-utils');

class PathManager {
  constructor() {
    this.tempDirs = new Set(); // Track created temp directories for cleanup
    this.tempFiles = new Set(); // Track created temp files for cleanup
  }

  /**
   * Get temporary directory path
   */
  getTempDir() {
    return resolveConfig('paths.tempDir') || os.tmpdir();
  }

  /**
   * Get analysis output directory
   */
  getAnalysisOutputDir() {
    const configured = resolveConfig('paths.analysisOutputDir');
    if (configured) {
      return configured;
    }
    return path.join(this.getTempDir(), 'topolop-analysis');
  }

  /**
   * Get cache directory
   */
  getCacheDir() {
    const configured = resolveConfig('paths.cacheDir');
    if (configured) {
      return configured;
    }
    return path.join(this.getTempDir(), 'topolop-cache');
  }

  /**
   * Create unique temporary directory (async)
   */
  async createTempDir(prefix = 'topolop-analysis') {
    const randomId = crypto.randomBytes(8).toString('hex');
    const dirName = `${prefix}-${randomId}`;
    const fullPath = path.join(this.getTempDir(), dirName);
    
    await ensureDirectory(fullPath);
    this.tempDirs.add(fullPath);
    
    return fullPath;
  }

  /**
   * Create unique temporary directory (sync)
   */
  createTempDirSync(prefix = 'topolop-analysis') {
    const fs = require('fs');
    const randomId = crypto.randomBytes(8).toString('hex');
    const dirName = `${prefix}-${randomId}`;
    const fullPath = path.join(this.getTempDir(), dirName);
    
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      this.tempDirs.add(fullPath);
      return fullPath;
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
  }

  /**
   * Create temporary file path (doesn't create the file)
   */
  createTempFilePath(prefix = 'topolop', extension = '.tmp') {
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileName = `${prefix}-${randomId}${extension}`;
    const filePath = path.join(this.getTempDir(), fileName);
    
    this.tempFiles.add(filePath);
    return filePath;
  }

  /**
   * Get tool-specific paths
   */
  getToolPaths(tool, basePath = null) {
    const outputDir = basePath || this.getAnalysisOutputDir();
    
    const paths = {
      perf: {
        dataFile: path.join(outputDir, resolveConfig('paths.perfDataFile')),
        outputDir: path.join(outputDir, 'perf')
      },
      
      valgrind: {
        xmlFile: path.join(outputDir, resolveConfig('paths.valgrindOutputFile')),
        outputDir: path.join(outputDir, 'valgrind')
      },
      
      mypy: {
        reportDir: path.join(outputDir, resolveConfig('paths.mypyReportDir')),
        txtReport: path.join(outputDir, resolveConfig('paths.mypyReportDir'), 'report.txt')
      },
      
      clang: {
        outputDir: path.join(outputDir, resolveConfig('paths.clangOutputDir'))
      },
      
      cppcheck: {
        outputDir: path.join(outputDir, resolveConfig('paths.cppcheckOutputDir'))
      }
    };

    return paths[tool] || { outputDir: path.join(outputDir, tool) };
  }

  /**
   * Get container-specific paths (for Docker containers)
   */
  getContainerPaths() {
    return {
      tmpDir: resolveConfig('paths.containerTmpDir'),
      outputDir: resolveConfig('paths.containerOutputDir')
    };
  }

  /**
   * Create safe path for container mounting
   * Ensures the path is within allowed boundaries
   */
  createSafeContainerPath(hostPath) {
    const resolved = path.resolve(hostPath);
    const tempDir = this.getTempDir();
    
    // Ensure we're not allowing access outside of temp directory
    if (!resolved.startsWith(tempDir) && !resolved.startsWith('/home') && !resolved.startsWith('/tmp')) {
      throw new Error(`Unsafe container path: ${resolved}. Must be within temp directory or /home`);
    }
    
    return resolved;
  }

  /**
   * Cleanup temporary directories and files
   */
  async cleanup() {
    const fs = require('fs').promises;
    const errors = [];

    // Cleanup temporary files
    for (const filePath of this.tempFiles) {
      try {
        await cleanupTempFile(filePath);
      } catch (error) {
        errors.push(`Failed to cleanup file ${filePath}: ${error.message}`);
      }
    }

    // Cleanup temporary directories
    for (const dirPath of this.tempDirs) {
      try {
        await fs.rmdir(dirPath, { recursive: true, force: true });
      } catch (error) {
        // Only add error if directory still exists
        try {
          await fs.access(dirPath);
          errors.push(`Failed to cleanup directory ${dirPath}: ${error.message}`);
        } catch (accessError) {
          // Directory doesn't exist, that's fine
        }
      }
    }

    this.tempFiles.clear();
    this.tempDirs.clear();

    if (errors.length > 0) {
      console.warn('Cleanup warnings:', errors.join('; '));
    }
  }

  /**
   * Ensure all required directories exist (async)
   */
  async ensureDirectories() {
    await ensureDirectory(this.getAnalysisOutputDir());
    await ensureDirectory(this.getCacheDir());
  }

  /**
   * Ensure all required directories exist (sync)
   */
  ensureDirectoriesSync() {
    const fs = require('fs');
    
    const analysisDir = this.getAnalysisOutputDir();
    const cacheDir = this.getCacheDir();
    
    try {
      fs.mkdirSync(analysisDir, { recursive: true });
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directories: ${error.message}`);
    }
  }
}

// Global path manager instance
const globalPathManager = new PathManager();

// Cleanup on process exit
let cleanupInProgress = false;

async function safeCleanup(signal = 'exit') {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  
  try {
    await globalPathManager.cleanup();
  } catch (error) {
    console.warn(`Cleanup warning (${signal}):`, error.message);
  }
}

process.on('exit', () => {
  // For synchronous exit, we can't do async cleanup
  // Temp files will be cleaned by OS
});

process.on('SIGINT', async () => {
  await safeCleanup('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await safeCleanup('SIGTERM');
  process.exit(0);
});

module.exports = {
  PathManager,
  globalPathManager
};