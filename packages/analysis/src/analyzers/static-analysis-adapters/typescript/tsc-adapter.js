/**
 * TypeScript Compiler (tsc) Adapter for Topolop
 * 
 * Transforms TypeScript compiler output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Type errors → Red warning signs on buildings
 * - Strict mode violations → Building code violations
 * - Unused variables → Abandoned lots and empty buildings
 * - Import/export issues → Broken road connections
 * - Type inference success → Well-connected infrastructure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveConfig } = require('../../config/default-config');
const { safeReadFile, canAccess, findFileUpwards, FileSystemError } = require('../../utils/fs-utils');
const { globalCacheManager } = require('../../utils/cache-manager');
const { timed, withTimeout } = require('../../utils/performance-utils');

class TypeScriptCompilerAdapter {
  constructor() {
    this.name = 'tsc';
    this.supportedLanguages = ['typescript'];
    this.description = 'TypeScript compiler type checking and analysis tool';
  }

  /**
   * Check if TypeScript compiler is available
   */
  async checkAvailability() {
    try {
      // Try local installation first
      execSync('npx tsc --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      try {
        // Try global installation
        execSync('tsc --version', { stdio: 'pipe' });
        return true;
      } catch (globalError) {
        return false;
      }
    }
  }

  /**
   * Run TypeScript compiler analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('TypeScript compiler not available. Run: npm install -g typescript');
    }

    // Generate cache key based on codebase and options
    const cacheKey = globalCacheManager.generateKey('typescript-compile', codebasePath, options);
    
    return await globalCacheManager.cached(
      cacheKey,
      'typescript-compile',
      () => this._performAnalysis(codebasePath, options),
      { 
        codebasePath,
        persistToDisk: true,
        ttl: 30 * 60 * 1000 // 30 minutes for TypeScript analysis
      }
    );
  }

  /**
   * Perform the actual TypeScript analysis (called by cached wrapper)
   */
  async _performAnalysis(codebasePath, options = {}) {

    const results = {
      typeErrors: [],
      compilationSuccess: false,
      strictModeViolations: [],
      unusedDeclarations: [],
      importExportIssues: [],
      cityVisualizationData: {},
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        filesProcessed: 0,
        typeCheckSuccess: false
      }
    };

    try {
      // Look for tsconfig.json
      const tsconfigPath = await this._findTsConfig(codebasePath);
      
      // Run TypeScript compiler with different flags
      const compilerResults = await this._runTypeScriptAnalysis(codebasePath, tsconfigPath, options);
      
      // Parse and categorize results
      results.typeErrors = this._parseTypeErrors(compilerResults.errors);
      results.strictModeViolations = this._parseStrictModeViolations(compilerResults.errors);
      results.unusedDeclarations = this._parseUnusedDeclarations(compilerResults.errors);
      results.importExportIssues = this._parseImportExportIssues(compilerResults.errors);
      
      results.compilationSuccess = compilerResults.exitCode === 0;
      results.summary = this._generateSummary(results);
      
      // Convert to city visualization data
      results.cityVisualizationData = this._generateCityVisualizationData(results);

      return results;

    } catch (error) {
      throw new Error(`TypeScript analysis failed: ${error.message}`);
    }
  }

  /**
   * Check if TypeScript is available locally
   */
  async _hasLocalTypeScript(basePath) {
    try {
      const packageJsonPath = path.join(basePath, 'package.json');
      
      const packageJsonContent = await safeReadFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent);
      
      return !!(packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript);
      
    } catch (error) {
      if (error instanceof FileSystemError) {
        if (error.code === 'FILE_NOT_FOUND') {
          // Package.json doesn't exist - try node_modules
          return this._checkNodeModulesTypeScript(basePath);
        } else if (error.code === 'PERMISSION_DENIED') {
          throw new Error(`Permission denied reading package.json: ${error.message}`);
        }
        // Other file system errors - try node_modules as fallback
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in package.json: ${error.message}`);
      }
      
      // Fallback to checking node_modules
      return this._checkNodeModulesTypeScript(basePath);
    }
  }

  _checkNodeModulesTypeScript(basePath) {
    const typeScriptPath = path.join(basePath, 'node_modules', 'typescript');
    return canAccess(typeScriptPath);
  }

  /**
   * Find tsconfig.json file
   */
  async _findTsConfig(basePath) {
    try {
      return await findFileUpwards(basePath, 'tsconfig.json');
    } catch (error) {
      // If we can't search for tsconfig, return null to use default behavior
      console.warn(`Error searching for tsconfig.json: ${error.message}`);
      return null;
    }
  }

  /**
   * Run TypeScript compiler analysis
   */
  async _runTypeScriptAnalysis(basePath, tsconfigPath, options) {
    const results = {
      errors: [],
      exitCode: 0
    };

    try {
      // Build command with local TypeScript first
      let command;
      const hasLocalTypeScript = await this._hasLocalTypeScript(basePath);
      
      if (hasLocalTypeScript) {
        command = 'npx tsc --noEmit --pretty false';
      } else {
        command = 'tsc --noEmit --pretty false';
      }
      
      if (tsconfigPath) {
        command += ` --project "${tsconfigPath}"`;
      } else {
        // Find TypeScript files
        command += ` "${basePath}/**/*.ts" "${basePath}/**/*.tsx"`;
      }

      // Add strict checking if requested
      const useStrict = options.strict !== undefined ? options.strict : resolveConfig('formalMethods.typescript.strictByDefault');
      if (useStrict) {
        command += ' --strict';
      }

      // Add unused detection
      const checkUnused = options.checkUnused !== undefined ? options.checkUnused : resolveConfig('formalMethods.typescript.checkUnusedByDefault');
      if (checkUnused) {
        command += ' --noUnusedLocals --noUnusedParameters';
      }

      console.log('🔍 Running TypeScript compiler analysis...');
      const timeout = resolveConfig('formalMethods.typescript.compileTimeout');
      const output = execSync(command, { 
        cwd: basePath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: timeout
      });
      
      results.exitCode = 0; // Success
      
    } catch (error) {
      // TypeScript compiler returns non-zero exit code for errors
      results.exitCode = error.status || 1;
      results.errors = this._parseCompilerOutput(error.stdout || error.stderr || '');
    }

    return results;
  }

  /**
   * Parse TypeScript compiler output
   */
  _parseCompilerOutput(output) {
    const errors = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      // Parse TypeScript error format: file(line,col): error TS####: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
      
      if (match) {
        const [, file, line, col, severity, code, message] = match;
        
        errors.push({
          file: file,
          line: parseInt(line),
          column: parseInt(col),
          severity: severity,
          code: code,
          message: message,
          raw: line
        });
      }
    }
    
    return errors;
  }

  /**
   * Parse type errors
   */
  _parseTypeErrors(errors) {
    return errors.filter(error => 
      error.severity === 'error' && 
      (error.code.startsWith('TS2') || error.code.startsWith('TS1'))
    ).map(error => ({
      file: error.file,
      line: error.line,
      column: error.column,
      message: error.message,
      errorCode: error.code,
      severity: 'error',
      category: 'type-error'
    }));
  }

  /**
   * Parse strict mode violations
   */
  _parseStrictModeViolations(errors) {
    return errors.filter(error => 
      error.message.includes('strict') ||
      error.code === 'TS2367' || // any type
      error.code === 'TS7006'    // implicit any
    ).map(error => ({
      file: error.file,
      line: error.line,
      column: error.column,
      message: error.message,
      errorCode: error.code,
      severity: 'warning',
      category: 'strict-mode-violation'
    }));
  }

  /**
   * Parse unused declarations
   */
  _parseUnusedDeclarations(errors) {
    return errors.filter(error => 
      error.code === 'TS6133' || // unused variable
      error.code === 'TS6196'    // unused parameter
    ).map(error => ({
      file: error.file,
      line: error.line,
      column: error.column,
      message: error.message,
      errorCode: error.code,
      severity: 'info',
      category: 'unused-declaration'
    }));
  }

  /**
   * Parse import/export issues
   */
  _parseImportExportIssues(errors) {
    return errors.filter(error => 
      error.code === 'TS2307' || // cannot find module
      error.code === 'TS1149' || // import assertion
      error.code === 'TS2305'    // module has no exported member
    ).map(error => ({
      file: error.file,
      line: error.line,
      column: error.column,
      message: error.message,
      errorCode: error.code,
      severity: 'error',
      category: 'import-export-issue'
    }));
  }

  /**
   * Generate analysis summary
   */
  _generateSummary(results) {
    const summary = {
      totalErrors: results.typeErrors.length,
      totalWarnings: results.strictModeViolations.length,
      totalInfo: results.unusedDeclarations.length,
      filesWithErrors: new Set(),
      typeCheckSuccess: results.typeErrors.length === 0
    };

    // Count unique files with errors
    [...results.typeErrors, ...results.strictModeViolations, ...results.unusedDeclarations, ...results.importExportIssues]
      .forEach(issue => summary.filesWithErrors.add(issue.file));

    summary.filesProcessed = summary.filesWithErrors.size;

    return summary;
  }

  /**
   * Generate city visualization data
   */
  _generateCityVisualizationData(results) {
    const cityData = {
      districts: [],
      buildings: [],
      roads: [],
      alerts: [],
      healthMetrics: {}
    };

    // Group issues by file (buildings)
    const fileIssues = {};
    
    [...results.typeErrors, ...results.strictModeViolations, ...results.unusedDeclarations, ...results.importExportIssues]
      .forEach(issue => {
        if (!fileIssues[issue.file]) {
          fileIssues[issue.file] = {
            file: issue.file,
            typeErrors: 0,
            warnings: 0,
            unused: 0,
            importIssues: 0,
            totalIssues: 0
          };
        }
        
        const fileData = fileIssues[issue.file];
        fileData.totalIssues++;
        
        switch (issue.category) {
          case 'type-error':
            fileData.typeErrors++;
            break;
          case 'strict-mode-violation':
            fileData.warnings++;
            break;
          case 'unused-declaration':
            fileData.unused++;
            break;
          case 'import-export-issue':
            fileData.importIssues++;
            break;
        }
      });

    // Convert to city buildings
    Object.values(fileIssues).forEach(fileData => {
      cityData.buildings.push({
        name: path.basename(fileData.file),
        fullPath: fileData.file,
        height: Math.max(1, 10 - fileData.totalIssues), // Fewer issues = taller building
        color: this._getBuildingColor(fileData),
        alerts: fileData.typeErrors > 0 ? ['type-errors'] : [],
        violations: fileData.warnings,
        abandoned: fileData.unused > 3,
        brokenConnections: fileData.importIssues
      });
    });

    // Health metrics
    cityData.healthMetrics = {
      overallHealth: results.compilationSuccess ? 'good' : 'poor',
      typeCheckScore: Math.max(0, 100 - (results.typeErrors.length * 5)),
      codeQualityScore: Math.max(0, 100 - (results.strictModeViolations.length * 2)),
      maintenanceScore: Math.max(0, 100 - (results.unusedDeclarations.length * 1))
    };

    return cityData;
  }

  /**
   * Get building color based on issues
   */
  _getBuildingColor(fileData) {
    if (fileData.typeErrors > 0) return 'red';
    if (fileData.warnings > 2) return 'orange';
    if (fileData.unused > 0) return 'yellow';
    return 'green';
  }

  static getSupportedExtensions() {
    return ['.ts', '.tsx'];
  }

  static getLanguageName() {
    return 'typescript';
  }
}

module.exports = TypeScriptCompilerAdapter;