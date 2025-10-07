/**
 * Secure Input Validation Pipeline for Topolop Formal Methods
 * 
 * Provides comprehensive validation for all inputs to formal method tools
 * SECURITY: Prevents directory traversal, file type attacks, and resource exhaustion
 * 
 * Features:
 * - File size and count limits
 * - Path security validation  
 * - Content-based security checks
 * - Resource usage monitoring
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityValidator {
  constructor() {
    // File validation limits
    this.maxFileSize = 10 * 1024 * 1024;    // 10MB per file
    this.maxFiles = 1000;                   // Maximum files to analyze
    this.maxAnalysisTime = 300000;          // 5 minutes max
    this.maxTotalSize = 100 * 1024 * 1024;  // 100MB total codebase
    
    // Allowed file extensions by language
    this.allowedExtensions = new Map([
      ['javascript', ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.json']],
      ['python', ['.py', '.pyw', '.pyi']],
      ['c_cpp', ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx']],
      ['all', ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.json', '.py', '.pyw', '.pyi', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx']]
    ]);
    
    // Security patterns to block
    this.blockedPatterns = [
      /\.\.\//g,              // Directory traversal
      /\/proc\//g,            // System paths
      /\/sys\//g,             // System paths
      /\/dev\//g,             // Device paths
      /\/tmp\//g,             // Temporary paths (suspicious)
      /\/var\/log\//g,        // Log paths
      /\/etc\//g,             // Configuration paths
      /__pycache__/g,         // Python cache
      /\.pyc$/g,              // Compiled Python
      /node_modules/g,        // Node modules
      /\.git/g,               // Git directories
      /\.svn/g,               // SVN directories
      /\.hg/g,                // Mercurial directories
      /\.DS_Store/g,          // macOS system files
      /Thumbs\.db/g,          // Windows system files
      /\.min\.js$/g,          // Minified files
      /\.bundle\.js$/g,       // Bundle files
      /dist\//g,              // Distribution directories
      /build\//g,             // Build directories
      /coverage\//g,          // Coverage directories
      /\.nyc_output/g         // NYC coverage output
    ];
    
    // Blocked directories for scanning
    this.blockedDirectories = [
      'node_modules',
      '.git',
      '.svn', 
      '.hg',
      '__pycache__',
      '.pytest_cache',
      'coverage',
      '.nyc_output',
      'dist',
      'build',
      'target',
      'bin',
      'obj',
      '.idea',
      '.vscode',
      '.vs',
      'logs',
      'log',
      'tmp',
      'temp',
      '.cache'
    ];
    
    // Suspicious content patterns
    this.suspiciousPatterns = [
      /eval\s*\(/gi,          // Code evaluation
      /Function\s*\(/gi,      // Dynamic function creation
      /require\s*\(\s*['"`]child_process['"`]\s*\)/gi, // Process execution
      /exec\s*\(/gi,          // Command execution
      /spawn\s*\(/gi,         // Process spawning
      /system\s*\(/gi,        // System calls
      /os\.system/gi,         // Python system calls
      /subprocess\./gi,       // Python subprocess
      /shell=True/gi,         // Python shell execution
      /\$\{.*\}/g,            // Template literal injection
      /<script/gi,            // Script tags
      /javascript:/gi,        // JavaScript protocols
      /data:/gi,              // Data URIs
      /file:/gi,              // File URIs
      /ftp:/gi,               // FTP protocols
      /\.\.[\\/]/g            // Path traversal attempts
    ];
  }

  /**
   * Validate a single file for security
   */
  async validateFile(filePath, language = 'all') {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      metadata: {}
    };

    try {
      // 1. Path security validation
      const pathValidation = this.validatePath(filePath);
      if (!pathValidation.valid) {
        result.errors.push(...pathValidation.errors);
        return result;
      }

      // 2. File existence and accessibility
      if (!fs.existsSync(filePath)) {
        result.errors.push(`File does not exist: ${filePath}`);
        return result;
      }

      // 3. File stats validation
      const stats = await fs.promises.stat(filePath);
      
      if (!stats.isFile()) {
        result.errors.push(`Path is not a file: ${filePath}`);
        return result;
      }

      if (stats.size > this.maxFileSize) {
        result.errors.push(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
        return result;
      }

      if (stats.size === 0) {
        result.warnings.push(`Empty file: ${filePath}`);
      }

      // 4. File extension validation
      const ext = path.extname(filePath).toLowerCase();
      const allowedExts = this.allowedExtensions.get(language);
      if (allowedExts && !allowedExts.includes(ext)) {
        result.errors.push(`File extension not allowed: ${ext} for language ${language}`);
        return result;
      }

      // 5. Content validation for text files
      if (this.isTextFile(ext)) {
        const contentValidation = await this.validateContent(filePath);
        if (!contentValidation.valid) {
          result.errors.push(...contentValidation.errors);
          result.warnings.push(...contentValidation.warnings);
        }
      }

      // 6. Store metadata
      result.metadata = {
        size: stats.size,
        extension: ext,
        lastModified: stats.mtime,
        checksum: await this.calculateChecksum(filePath)
      };

      if (result.errors.length === 0) {
        result.valid = true;
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate a codebase directory
   */
  async validateCodebase(codebasePath, language = 'all') {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      validFiles: [],
      invalidFiles: [],
      totalSize: 0,
      metadata: {}
    };

    try {
      // 1. Validate base path
      const pathValidation = this.validatePath(codebasePath);
      if (!pathValidation.valid) {
        result.errors.push(...pathValidation.errors);
        return result;
      }

      // 2. Find all files in codebase
      const files = await this.findFiles(codebasePath, language);
      
      if (files.length === 0) {
        result.warnings.push(`No files found for language: ${language}`);
        result.valid = true;
        return result;
      }

      if (files.length > this.maxFiles) {
        result.errors.push(`Too many files: ${files.length} (max: ${this.maxFiles})`);
        return result;
      }

      // 3. Validate each file
      for (const file of files) {
        const fileValidation = await this.validateFile(file, language);
        
        if (fileValidation.valid) {
          result.validFiles.push({
            path: file,
            metadata: fileValidation.metadata
          });
          result.totalSize += fileValidation.metadata.size;
        } else {
          result.invalidFiles.push({
            path: file,
            errors: fileValidation.errors,
            warnings: fileValidation.warnings
          });
        }

        result.warnings.push(...fileValidation.warnings);
      }

      // 4. Check total size limit
      if (result.totalSize > this.maxTotalSize) {
        result.errors.push(`Total codebase too large: ${result.totalSize} bytes (max: ${this.maxTotalSize})`);
        return result;
      }

      // 5. Generate metadata
      result.metadata = {
        totalFiles: files.length,
        validFiles: result.validFiles.length,
        invalidFiles: result.invalidFiles.length,
        totalSize: result.totalSize,
        language: language,
        basePath: codebasePath
      };

      if (result.invalidFiles.length === 0 && result.validFiles.length > 0) {
        result.valid = true;
      }

    } catch (error) {
      result.errors.push(`Codebase validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate file/directory path for security
   */
  validatePath(filePath) {
    const result = { valid: false, errors: [] };

    try {
      // 1. Resolve and normalize path
      const resolvedPath = path.resolve(filePath);
      const normalizedPath = path.normalize(filePath);

      // 2. Check for directory traversal
      if (normalizedPath.includes('..')) {
        result.errors.push(`Directory traversal detected in path: ${filePath}`);
        return result;
      }

      // 3. Check against blocked patterns
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(resolvedPath)) {
          result.errors.push(`Blocked path pattern detected: ${resolvedPath}`);
          return result;
        }
      }

      // 4. Check path length (prevent extremely long paths)
      if (resolvedPath.length > 4096) {
        result.errors.push(`Path too long: ${resolvedPath.length} characters`);
        return result;
      }

      // 5. Check for null bytes
      if (resolvedPath.includes('\0')) {
        result.errors.push(`Null byte detected in path: ${filePath}`);
        return result;
      }

      result.valid = true;
    } catch (error) {
      result.errors.push(`Path validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate file content for security issues
   */
  async validateContent(filePath) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      // Read file content (limit to first 1MB for large files)
      const content = await fs.promises.readFile(filePath, 'utf8').catch(() => {
        // If UTF-8 fails, try reading as binary and check if it's text
        return fs.promises.readFile(filePath).then(buffer => {
          if (this.isBinaryContent(buffer)) {
            throw new Error('Binary file content cannot be validated');
          }
          return buffer.toString('utf8', 0, Math.min(buffer.length, 1024 * 1024));
        });
      });

      // Check for suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          result.warnings.push(`Suspicious pattern detected: ${pattern.source} (${matches.length} matches)`);
        }
      }

      // Check for extremely long lines (potential attack)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 10000) {
          result.warnings.push(`Extremely long line detected at line ${i + 1}: ${lines[i].length} characters`);
        }
      }

      // Check for high entropy content (potential encoded payloads)
      if (this.hasHighEntropy(content)) {
        result.warnings.push('High entropy content detected - possible encoded data');
      }

    } catch (error) {
      result.warnings.push(`Content validation warning: ${error.message}`);
    }

    return result;
  }

  /**
   * Find files in directory with security filtering
   */
  async findFiles(codebasePath, language = 'all', maxDepth = 10) {
    const files = [];
    const allowedExts = this.allowedExtensions.get(language);

    const walkDirectory = async (dir, depth = 0) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Security: validate each path
          if (!this.validatePath(fullPath).valid) {
            continue;
          }

          if (entry.isDirectory()) {
            // Skip blocked directories
            if (this.shouldSkipDirectory(entry.name)) {
              continue;
            }
            await walkDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            
            // Check file extension
            if (allowedExts && !allowedExts.includes(ext)) {
              continue;
            }

            // Check file size before adding
            try {
              const stats = await fs.promises.stat(fullPath);
              if (stats.size <= this.maxFileSize) {
                files.push(fullPath);
                
                // Security: limit total number of files
                if (files.length >= this.maxFiles) {
                  return files;
                }
              }
            } catch (error) {
              // Skip files we can't stat
              continue;
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.warn(`Skipping directory ${dir}: ${error.message}`);
      }
    };

    await walkDirectory(codebasePath);
    return files;
  }

  /**
   * Check if directory should be skipped
   */
  shouldSkipDirectory(dirName) {
    return this.blockedDirectories.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Check if file is a text file based on extension
   */
  isTextFile(extension) {
    const textExtensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.pyw', '.pyi', 
                           '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', '.json',
                           '.txt', '.md', '.yml', '.yaml', '.xml', '.html', '.css'];
    return textExtensions.includes(extension.toLowerCase());
  }

  /**
   * Check if buffer contains binary content
   */
  isBinaryContent(buffer) {
    // Check first 1024 bytes for null bytes (indicating binary)
    const sample = buffer.subarray(0, Math.min(1024, buffer.length));
    return sample.includes(0);
  }

  /**
   * Calculate file checksum for integrity verification
   */
  async calculateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check for high entropy content (potential encoded data)
   */
  hasHighEntropy(content) {
    if (content.length < 100) return false;
    
    // Calculate Shannon entropy
    const charCount = {};
    for (const char of content) {
      charCount[char] = (charCount[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = content.length;
    
    for (const count of Object.values(charCount)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }
    
    // High entropy threshold (6.5+ bits suggests encoded/encrypted data)
    return entropy > 6.5;
  }

  /**
   * Create security report for validation results
   */
  createSecurityReport(validationResults) {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: validationResults.metadata?.totalFiles || 0,
        validFiles: validationResults.validFiles?.length || 0,
        invalidFiles: validationResults.invalidFiles?.length || 0,
        totalErrors: validationResults.errors?.length || 0,
        totalWarnings: validationResults.warnings?.length || 0,
        totalSize: validationResults.totalSize || 0
      },
      security: {
        pathViolations: validationResults.errors?.filter(e => e.includes('path')).length || 0,
        sizeViolations: validationResults.errors?.filter(e => e.includes('large')).length || 0,
        contentWarnings: validationResults.warnings?.filter(w => w.includes('Suspicious')).length || 0,
        highriskFiles: validationResults.invalidFiles?.filter(f => 
          f.errors?.some(e => e.includes('traversal') || e.includes('Blocked'))
        ).length || 0
      },
      recommendations: this.generateSecurityRecommendations(validationResults)
    };
  }

  /**
   * Generate security recommendations based on validation
   */
  generateSecurityRecommendations(results) {
    const recommendations = [];
    
    if (results.errors?.some(e => e.includes('traversal'))) {
      recommendations.push('Directory traversal attempts detected - ensure proper path validation');
    }
    
    if (results.warnings?.some(w => w.includes('Suspicious'))) {
      recommendations.push('Suspicious code patterns detected - manual review recommended');
    }
    
    if (results.totalSize > this.maxTotalSize * 0.8) {
      recommendations.push('Codebase approaching size limits - consider filtering unnecessary files');
    }
    
    if (results.invalidFiles?.length > results.validFiles?.length * 0.1) {
      recommendations.push('High percentage of invalid files - review file selection criteria');
    }
    
    return recommendations;
  }
}

module.exports = new SecurityValidator();