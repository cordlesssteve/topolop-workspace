/**
 * Topolop Path Normalization System
 * 
 * Canonical entity identification for cross-tool correlation.
 * Converts tool-specific file identifiers to standardized relative-from-project-root paths.
 */

const path = require('path');

/**
 * PathNormalizer provides canonical entity identification across analysis tools
 * 
 * Each tool has different entity identification formats:
 * - SonarQube: component keys like "project:src/main/java/App.java"
 * - CodeClimate: direct paths like "/Users/dev/project/src/App.js"  
 * - Semgrep: relative paths like "./src/App.js"
 * - CodeQL: absolute paths from codebase root
 * - etc.
 * 
 * This normalizer converts all formats to: "src/main/java/App.java"
 */
class PathNormalizer {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Normalize any tool-specific path to canonical format
   * @param {string} toolPath - Tool's native file identifier
   * @param {string} toolName - Name of the analysis tool
   * @returns {Object} {canonicalPath, confidence, normalized: boolean}
   */
  normalize(toolPath, toolName) {
    if (!toolPath || typeof toolPath !== 'string') {
      return {
        canonicalPath: null,
        confidence: 0,
        normalized: false,
        error: 'Invalid path provided'
      };
    }

    try {
      let normalizedPath;
      let confidence = 1.0;

      switch (toolName.toLowerCase()) {
        case 'sonarqube':
          normalizedPath = this._normalizeSonarQubePath(toolPath);
          break;
          
        case 'codeclimate':
          normalizedPath = this._normalizeCodeClimatePath(toolPath);
          break;
          
        case 'semgrep':
          normalizedPath = this._normalizeSemgrepPath(toolPath);
          break;
          
        case 'codeql':
          normalizedPath = this._normalizeCodeQLPath(toolPath);
          break;
          
        case 'deepsource':
          normalizedPath = this._normalizeDeepSourcePath(toolPath);
          break;
          
        case 'veracode':
          normalizedPath = this._normalizeVeracodePath(toolPath);
          break;
          
        case 'checkmarx':
          normalizedPath = this._normalizeCheckmarxPath(toolPath);
          break;
          
        case 'codacy':
          normalizedPath = this._normalizeCodacyPath(toolPath);
          break;
          
        default:
          // Generic path normalization
          normalizedPath = this._normalizeGenericPath(toolPath);
          confidence = 0.8; // Lower confidence for unknown tools
      }

      // Ensure path is relative and clean
      const canonicalPath = this._ensureRelativePath(normalizedPath);
      
      return {
        canonicalPath,
        confidence,
        normalized: true,
        originalPath: toolPath
      };

    } catch (error) {
      return {
        canonicalPath: null,
        confidence: 0,
        normalized: false,
        error: error.message,
        originalPath: toolPath
      };
    }
  }

  /**
   * Normalize SonarQube component keys
   * Format: "project:src/main/java/App.java" -> "src/main/java/App.java"
   */
  _normalizeSonarQubePath(componentKey) {
    // SonarQube component keys have format: "projectKey:filePath"
    const colonIndex = componentKey.indexOf(':');
    if (colonIndex === -1) {
      // Assume it's already a path
      return componentKey;
    }
    
    return componentKey.substring(colonIndex + 1);
  }

  /**
   * Normalize CodeClimate paths
   * Format: Various - could be absolute or relative
   */
  _normalizeCodeClimatePath(codePath) {
    // CodeClimate can provide absolute paths or relative paths
    if (path.isAbsolute(codePath)) {
      const relativePath = path.relative(this.projectRoot, codePath);
      
      // If path is outside project, extract meaningful part
      if (relativePath.startsWith('../')) {
        // Try to find src/ or similar common patterns
        const parts = codePath.split(path.sep);
        const srcIndex = parts.findIndex(p => ['src', 'lib', 'app'].includes(p));
        if (srcIndex !== -1) {
          return parts.slice(srcIndex).join('/');
        }
        // Fall back to filename
        return parts[parts.length - 1];
      }
      
      return relativePath;
    }
    
    // Handle relative paths that go outside project
    if (codePath.startsWith('../')) {
      const parts = codePath.split('/');
      
      // Try to find src/ or similar common patterns
      const srcIndex = parts.findIndex(p => ['src', 'lib', 'app'].includes(p));
      if (srcIndex !== -1) {
        return parts.slice(srcIndex).join('/');
      }
      
      // For paths clearly outside project, just return filename
      return parts[parts.length - 1];
    }
    
    return codePath;
  }

  /**
   * Normalize Semgrep paths
   * Format: "./src/App.js" -> "src/App.js"
   */
  _normalizeSemgrepPath(semgrepPath) {
    // Remove leading ./ if present
    if (semgrepPath.startsWith('./')) {
      return semgrepPath.substring(2);
    }
    
    // Handle absolute paths
    if (path.isAbsolute(semgrepPath)) {
      const relativePath = path.relative(this.projectRoot, semgrepPath);
      
      // If path is outside project, extract meaningful part
      if (relativePath.startsWith('../')) {
        const parts = semgrepPath.split(path.sep);
        
        // Look for src/ lib/ or other common patterns
        const commonPatterns = ['src', 'lib', 'app', 'components'];
        const patternIndex = parts.findIndex(p => commonPatterns.includes(p));
        if (patternIndex !== -1) {
          return parts.slice(patternIndex).join('/');
        }
        
        // Fall back to filename
        return parts[parts.length - 1];
      }
      
      return relativePath;
    }
    
    return semgrepPath;
  }

  /**
   * Normalize CodeQL paths
   * Format: Typically absolute paths from database creation
   */
  _normalizeCodeQLPath(codeqlPath) {
    if (path.isAbsolute(codeqlPath)) {
      return path.relative(this.projectRoot, codeqlPath);
    }
    return codeqlPath;
  }

  /**
   * Normalize DeepSource paths
   * Format: Repository-relative paths
   */
  _normalizeDeepSourcePath(dsPath) {
    // DeepSource typically provides repository-relative paths
    if (dsPath.startsWith('/')) {
      return dsPath.substring(1); // Remove leading slash
    }
    return dsPath;
  }

  /**
   * Normalize Veracode paths
   * Format: Can be complex with package structure
   */
  _normalizeVeracodePath(veracodePath) {
    // Veracode may include package information, extract file path
    // Handle format like "com.example.package.ClassName" -> try to find corresponding file
    if (!veracodePath.includes('/') && !veracodePath.includes('\\')) {
      // Looks like a class name, try to convert to path
      const javaPath = veracodePath.replace(/\./g, '/') + '.java';
      return 'src/main/java/' + javaPath; // Assume Maven structure
    }
    
    return this._normalizeGenericPath(veracodePath);
  }

  /**
   * Normalize Checkmarx paths
   * Format: Complex data flow paths, extract source file
   */
  _normalizeCheckmarxPath(checkmarxPath) {
    // Checkmarx may provide complex path objects or strings
    if (typeof checkmarxPath === 'object' && checkmarxPath.fileName) {
      return checkmarxPath.fileName;
    }
    
    // If it's a data flow path, extract the source file
    if (checkmarxPath.includes('->')) {
      const sourcePath = checkmarxPath.split('->')[0].trim();
      return this._normalizeGenericPath(sourcePath);
    }
    
    return this._normalizeGenericPath(checkmarxPath);
  }

  /**
   * Normalize Codacy paths
   * Format: GitHub API style paths
   */
  _normalizeCodacyPath(codacyPath) {
    // Codacy typically uses GitHub-style paths
    if (codacyPath.startsWith('/')) {
      return codacyPath.substring(1);
    }
    return codacyPath;
  }

  /**
   * Generic path normalization for unknown tools
   */
  _normalizeGenericPath(genericPath) {
    // Try to make absolute path relative
    if (path.isAbsolute(genericPath)) {
      try {
        const relativePath = path.relative(this.projectRoot, genericPath);
        
        // If relative path goes outside project (starts with ../), 
        // extract meaningful path components or just the filename
        if (relativePath.startsWith('../')) {
          const parts = genericPath.split(path.sep);
          
          // Look for recognizable patterns in the path 
          const srcIndex = parts.findIndex(part => part === 'src');
          if (srcIndex !== -1) {
            // Extract from 'src' onwards
            return parts.slice(srcIndex).join('/');
          }
          
          // Otherwise just return filename for paths clearly outside project
          return parts[parts.length - 1]; 
        }
        
        return relativePath;
      } catch (error) {
        // If relative conversion fails, strip known prefixes
        return this._stripCommonPrefixes(genericPath);
      }
    }
    
    // Handle relative paths that start with ../
    if (genericPath.startsWith('../')) {
      const parts = genericPath.split('/');
      
      // Look for recognizable patterns
      const srcIndex = parts.findIndex(part => part === 'src');
      if (srcIndex !== -1) {
        return parts.slice(srcIndex).join('/');
      }
      
      // For paths clearly outside project, just return filename  
      return parts[parts.length - 1];
    }
    
    // Clean up other relative paths
    return this._stripCommonPrefixes(genericPath);
  }

  /**
   * Remove common path prefixes that don't belong in canonical paths
   */
  _stripCommonPrefixes(filePath) {
    const prefixesToRemove = [
      './',
      '../',
      '\\',
      '//'
    ];
    
    let cleaned = filePath;
    for (const prefix of prefixesToRemove) {
      while (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length);
      }
    }
    
    return cleaned;
  }

  /**
   * Ensure path is relative and clean
   */
  _ensureRelativePath(filePath) {
    if (!filePath) return null;
    
    // Normalize path separators to forward slashes
    let cleaned = filePath.replace(/\\/g, '/');
    
    // Remove leading slashes
    while (cleaned.startsWith('/')) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove current directory references
    while (cleaned.startsWith('./')) {
      cleaned = cleaned.substring(2);
    }
    
    // Clean up double slashes
    cleaned = cleaned.replace(/\/+/g, '/');
    
    // Remove trailing slashes
    while (cleaned.endsWith('/') && cleaned.length > 1) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    
    return cleaned || null;
  }

  /**
   * Validate that a canonical path looks reasonable
   * @param {string} canonicalPath - The normalized path to validate
   * @returns {boolean} True if path looks valid
   */
  validateCanonicalPath(canonicalPath) {
    if (!canonicalPath || typeof canonicalPath !== 'string') {
      return false;
    }
    
    // Check for common issues
    const issues = [
      canonicalPath.includes('..'), // No parent directory references
      canonicalPath.startsWith('/'), // No absolute paths
      canonicalPath.includes('//'), // No double slashes
      canonicalPath.trim() !== canonicalPath, // No leading/trailing whitespace
      canonicalPath.length === 0 // Not empty
    ];
    
    return !issues.some(issue => issue);
  }

  /**
   * Batch normalize multiple paths from the same tool
   * @param {Array} paths - Array of {path, toolName} objects
   * @returns {Array} Array of normalization results
   */
  batchNormalize(paths) {
    return paths.map(({path: toolPath, toolName}) => ({
      ...this.normalize(toolPath, toolName),
      toolName
    }));
  }

  /**
   * Get normalization statistics for debugging
   */
  getStats(results) {
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      averageConfidence: 0,
      toolBreakdown: {}
    };
    
    let confidenceSum = 0;
    
    for (const result of results) {
      if (result.normalized) {
        stats.successful++;
        confidenceSum += result.confidence;
      } else {
        stats.failed++;
      }
      
      const tool = result.toolName || 'unknown';
      stats.toolBreakdown[tool] = (stats.toolBreakdown[tool] || 0) + 1;
    }
    
    stats.averageConfidence = stats.successful > 0 ? confidenceSum / stats.successful : 0;
    stats.successRate = stats.total > 0 ? stats.successful / stats.total : 0;
    
    return stats;
  }
}

module.exports = PathNormalizer;