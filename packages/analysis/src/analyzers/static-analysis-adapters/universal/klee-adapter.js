/**
 * KLEE Adapter for Topolop
 * 
 * Transforms KLEE symbolic execution output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Symbolic execution paths → Detailed road network surveys
 * - Path coverage → Comprehensive city accessibility mapping
 * - Assertion failures → Critical infrastructure failure points
 * - Memory errors → Environmental contamination sites
 * - Test case generation → Emergency evacuation route planning
 * - Branch coverage → Traffic flow optimization studies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class KLEEAdapter {
  constructor() {
    this.name = 'klee';
    this.supportedLanguages = ['c-cpp'];
    this.description = 'Symbolic execution engine for C programs';
  }

  /**
   * Check if KLEE is available
   */
  async checkAvailability() {
    try {
      execSync('klee --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run KLEE analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('KLEE not available. Install from: https://klee.github.io/');
    }

    const results = {
      symbolicExecution: [],
      pathCoverage: [],
      testGeneration: []
    };
    
    try {
      // Find C source files suitable for KLEE
      const sourceFiles = this.findKLEECompatibleFiles(codebasePath);
      
      if (sourceFiles.length === 0) {
        return {
          tool: 'klee',
          timestamp: new Date().toISOString(),
          codebasePath,
          results,
          summary: this.generateSummary(results)
        };
      }

      // Process each source file
      for (const sourceFile of sourceFiles.slice(0, 3)) { // Limit to first 3 files
        try {
          // Compile to LLVM bitcode
          const bitcodeFile = await this.compileToBitcode(sourceFile, codebasePath, options);
          
          if (bitcodeFile) {
            // Run KLEE symbolic execution
            const kleeResults = await this.runKLEE(bitcodeFile, sourceFile, codebasePath, options);
            results.symbolicExecution.push(...kleeResults.execution);
            results.pathCoverage.push(...kleeResults.coverage);
            results.testGeneration.push(...kleeResults.tests);
          }
          
        } catch (error) {
          console.warn(`KLEE analysis failed for ${sourceFile}: ${error.message}`);
          results.symbolicExecution.push({
            file: path.relative(codebasePath, sourceFile),
            type: 'analysis-error',
            message: error.message,
            severity: 'info'
          });
        }
      }
      
      return {
        tool: 'klee',
        timestamp: new Date().toISOString(),
        codebasePath,
        results,
        summary: this.generateSummary(results)
      };
      
    } catch (error) {
      throw new Error(`KLEE analysis failed: ${error.message}`);
    }
  }

  findKLEECompatibleFiles(codebasePath) {
    const sourceFiles = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.') && 
              !['build', 'obj', 'bin'].includes(file.name)) {
            walkDirectory(fullPath);
          } else if (file.isFile() && file.name.endsWith('.c')) {
            // Check if file has main function or is suitable for KLEE
            if (this.isKLEECompatible(fullPath)) {
              sourceFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return sourceFiles;
  }

  isKLEECompatible(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for main function or KLEE-specific constructs
      const hasMain = content.includes('int main(') || content.includes('void main(');
      const hasKleeSymbolic = content.includes('klee_make_symbolic');
      const hasAsserts = content.includes('assert(') || content.includes('klee_assert');
      
      // File is compatible if it has main or KLEE constructs
      return hasMain || hasKleeSymbolic || hasAsserts;
    } catch (error) {
      return false;
    }
  }

  async compileToBitcode(sourceFile, basePath, options) {
    const basename = path.basename(sourceFile, '.c');
    const outputFile = path.join(path.dirname(sourceFile), `${basename}.bc`);
    
    try {
      // Compile to LLVM bitcode with clang
      const compileCommand = `clang -I ${this.getKLEEIncludePath()} -emit-llvm -c -g -O0 -Xclang -disable-O0-optnone "${sourceFile}" -o "${outputFile}"`;
      
      execSync(compileCommand, { 
        cwd: basePath,
        stdio: 'pipe'
      });
      
      return outputFile;
    } catch (error) {
      console.warn(`Failed to compile ${sourceFile} to bitcode: ${error.message}`);
      return null;
    }
  }

  getKLEEIncludePath() {
    // Common KLEE include paths
    const paths = [
      '/usr/local/include/klee',
      '/usr/include/klee',
      '/opt/klee/include'
    ];
    
    for (const kleeInclude of paths) {
      if (fs.existsSync(kleeInclude)) {
        return kleeInclude;
      }
    }
    
    return '/usr/local/include'; // Fallback
  }

  async runKLEE(bitcodeFile, sourceFile, basePath, options) {
    const results = {
      execution: [],
      coverage: [],
      tests: []
    };
    
    const outputDir = path.join(path.dirname(bitcodeFile), 'klee-out');
    const relativePath = path.relative(basePath, sourceFile);
    const timeout = options.timeout || 60000; // 1 minute default
    
    try {
      // Run KLEE with various options
      const kleeCommand = [
        'klee',
        '--output-dir=' + outputDir,
        '--write-cov',
        '--write-test-info',
        '--write-paths',
        '--max-time=' + Math.floor(timeout / 1000) + 's',
        '--max-memory=1000',
        bitcodeFile
      ].join(' ');
      
      const output = execSync(kleeCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: timeout,
        stdio: 'pipe'
      });
      
      // Parse KLEE output
      const executionResults = this.parseKLEEOutput(output, relativePath);
      results.execution.push(...executionResults);
      
      // Parse generated files
      if (fs.existsSync(outputDir)) {
        const coverageResults = this.parseCoverageFiles(outputDir, relativePath);
        results.coverage.push(...coverageResults);
        
        const testResults = this.parseTestFiles(outputDir, relativePath);
        results.tests.push(...testResults);
        
        // Clean up output directory
        this.cleanupKLEEOutput(outputDir);
      }
      
    } catch (error) {
      results.execution.push({
        file: relativePath,
        type: 'klee-execution-error',
        message: error.message,
        severity: 'medium'
      });
    }
    
    return results;
  }

  parseKLEEOutput(output, relativePath) {
    const results = [];
    const lines = output.split('\n');
    
    let completedPaths = 0;
    let generatedTests = 0;
    let foundErrors = 0;
    const errors = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse KLEE statistics
      if (trimmed.includes('completed paths =')) {
        const pathMatch = trimmed.match(/completed paths = (\d+)/);
        if (pathMatch) {
          completedPaths = parseInt(pathMatch[1]);
        }
      }
      
      if (trimmed.includes('generated tests =')) {
        const testMatch = trimmed.match(/generated tests = (\d+)/);
        if (testMatch) {
          generatedTests = parseInt(testMatch[1]);
        }
      }
      
      // Parse errors
      if (trimmed.includes('ERROR:')) {
        foundErrors++;
        errors.push({
          type: this.classifyKLEEError(trimmed),
          message: trimmed,
          line: this.extractLineNumber(trimmed)
        });
      }
      
      // Parse assertions
      if (trimmed.includes('ASSERTION FAIL')) {
        errors.push({
          type: 'assertion-failure',
          message: trimmed,
          line: this.extractLineNumber(trimmed)
        });
      }
    }
    
    results.push({
      file: relativePath,
      type: 'symbolic-execution-summary',
      completedPaths: completedPaths,
      generatedTests: generatedTests,
      foundErrors: foundErrors,
      errors: errors,
      severity: foundErrors > 0 ? 'high' : 'info'
    });
    
    return results;
  }

  classifyKLEEError(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('memory')) return 'memory-error';
    if (message.includes('overflow')) return 'overflow-error';
    if (message.includes('division')) return 'division-error';
    if (message.includes('null')) return 'null-pointer-error';
    if (message.includes('bounds')) return 'bounds-error';
    
    return 'unknown-error';
  }

  extractLineNumber(text) {
    const lineMatch = text.match(/line (\d+)/);
    return lineMatch ? parseInt(lineMatch[1]) : 0;
  }

  parseCoverageFiles(outputDir, relativePath) {
    const results = [];
    
    try {
      const files = fs.readdirSync(outputDir);
      
      for (const file of files) {
        if (file.endsWith('.cov')) {
          const covPath = path.join(outputDir, file);
          const coverage = this.parseCoverageFile(covPath);
          
          results.push({
            file: relativePath,
            type: 'path-coverage',
            coverageFile: file,
            coverage: coverage,
            severity: 'info'
          });
        }
      }
    } catch (error) {
      results.push({
        file: relativePath,
        type: 'coverage-parse-error',
        message: error.message,
        severity: 'low'
      });
    }
    
    return results;
  }

  parseCoverageFile(covPath) {
    try {
      const content = fs.readFileSync(covPath, 'utf8');
      const lines = content.split('\n');
      
      const coverage = {
        totalLines: 0,
        coveredLines: 0,
        branches: [],
        paths: []
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('ob=')) {
          // Object file info
        } else if (trimmed.startsWith('fl=')) {
          // Function info
        } else if (trimmed.match(/^\d+\s+\d+/)) {
          // Line coverage: line_num execution_count
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            coverage.totalLines++;
            if (parseInt(parts[1]) > 0) {
              coverage.coveredLines++;
            }
          }
        }
      }
      
      coverage.coveragePercentage = coverage.totalLines > 0 ? 
        ((coverage.coveredLines / coverage.totalLines) * 100).toFixed(2) : 0;
      
      return coverage;
    } catch (error) {
      return { error: error.message };
    }
  }

  parseTestFiles(outputDir, relativePath) {
    const results = [];
    
    try {
      const files = fs.readdirSync(outputDir);
      const testFiles = files.filter(f => f.endsWith('.ktest'));
      
      results.push({
        file: relativePath,
        type: 'test-generation-summary',
        totalTests: testFiles.length,
        testFiles: testFiles.slice(0, 10), // List up to 10 test files
        severity: 'info'
      });
      
    } catch (error) {
      results.push({
        file: relativePath,
        type: 'test-parse-error',
        message: error.message,
        severity: 'low'
      });
    }
    
    return results;
  }

  cleanupKLEEOutput(outputDir) {
    try {
      const rmCommand = process.platform === 'win32' ? 
        `rmdir /s /q "${outputDir}"` : 
        `rm -rf "${outputDir}"`;
      execSync(rmCommand, { stdio: 'pipe' });
    } catch (error) {
      // Cleanup is best effort
    }
  }

  /**
   * Generate analysis summary
   */
  generateSummary(results) {
    const allResults = [
      ...results.symbolicExecution,
      ...results.pathCoverage,
      ...results.testGeneration
    ];
    
    const fileStats = {};
    const overallStats = {
      totalFiles: 0,
      totalPaths: 0,
      totalTests: 0,
      totalErrors: 0,
      errorTypes: {}
    };

    for (const result of allResults) {
      const fileName = result.file;
      
      if (!fileStats[fileName]) {
        fileStats[fileName] = {
          paths: 0,
          tests: 0,
          errors: 0,
          coverage: 0,
          issues: []
        };
        overallStats.totalFiles++;
      }
      
      if (result.type === 'symbolic-execution-summary') {
        fileStats[fileName].paths = result.completedPaths;
        fileStats[fileName].tests = result.generatedTests;
        fileStats[fileName].errors = result.foundErrors;
        fileStats[fileName].issues = result.errors;
        
        overallStats.totalPaths += result.completedPaths;
        overallStats.totalTests += result.generatedTests;
        overallStats.totalErrors += result.foundErrors;
        
        // Count error types
        for (const error of result.errors) {
          overallStats.errorTypes[error.type] = (overallStats.errorTypes[error.type] || 0) + 1;
        }
      }
      
      if (result.type === 'path-coverage' && result.coverage) {
        fileStats[fileName].coverage = parseFloat(result.coverage.coveragePercentage) || 0;
      }
    }

    return {
      overallStats,
      fileStats,
      averageCoverage: this.calculateAverageCoverage(fileStats),
      testingEffectiveness: this.calculateTestingEffectiveness(overallStats),
      errorAnalysis: this.analyzeErrors(overallStats.errorTypes)
    };
  }

  calculateAverageCoverage(fileStats) {
    const coverages = Object.values(fileStats)
      .map(stats => stats.coverage)
      .filter(cov => cov > 0);
    
    return coverages.length > 0 ? 
      (coverages.reduce((a, b) => a + b, 0) / coverages.length).toFixed(2) : 0;
  }

  calculateTestingEffectiveness(stats) {
    if (stats.totalFiles === 0) return 'unknown';
    
    const testsPerFile = stats.totalTests / stats.totalFiles;
    const pathsPerFile = stats.totalPaths / stats.totalFiles;
    const errorRate = stats.totalErrors / Math.max(stats.totalPaths, 1);
    
    if (testsPerFile >= 10 && pathsPerFile >= 5 && errorRate < 0.1) return 'excellent';
    if (testsPerFile >= 5 && pathsPerFile >= 3 && errorRate < 0.2) return 'good';
    if (testsPerFile >= 1 && pathsPerFile >= 1) return 'fair';
    return 'poor';
  }

  analyzeErrors(errorTypes) {
    const sortedErrors = Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return {
      topErrorTypes: sortedErrors,
      criticalErrors: sortedErrors.filter(([type]) => 
        ['memory-error', 'overflow-error', 'null-pointer-error'].includes(type)
      ).length,
      totalUniqueErrors: Object.keys(errorTypes).length
    };
  }

  /**
   * Transform KLEE output into city visualization data
   */
  toCityData(kleeOutput) {
    const { results, summary } = kleeOutput;
    
    const cityData = {
      pathAnalysis: [],
      buildingEnhancements: {},
      routePlanning: {},
      emergencyPreparedness: {}
    };

    // Process each file's symbolic execution results
    for (const [fileName, stats] of Object.entries(summary.fileStats)) {
      // Add path analysis for visualization
      cityData.pathAnalysis.push({
        file: fileName,
        type: 'klee',
        pathsExplored: stats.paths,
        testsGenerated: stats.tests,
        errorsFound: stats.errors,
        coverage: stats.coverage,
        details: {
          issues: stats.issues,
          pathDensity: this.calculatePathDensity(stats),
          testQuality: this.calculateTestQuality(stats)
        }
      });

      // Building enhancement data
      cityData.buildingEnhancements[fileName] = {
        accessibilityMapping: this.calculateAccessibilityMapping(stats),
        routeOptimization: this.calculateRouteOptimization(stats),
        safetyAnalysis: this.calculateSafetyAnalysis(stats),
        infrastructureQuality: this.calculateInfrastructureQuality(stats),
        visualEffects: {
          detailedSurveys: stats.paths > 0,
          accessibilityMaps: stats.coverage > 0,
          failurePoints: stats.errors > 0,
          contaminationSites: this.hasMemoryErrors(stats.issues),
          evacuationRoutes: stats.tests > 0,
          optimizationStudies: stats.coverage > 50
        }
      };

      // Route planning data
      cityData.routePlanning[fileName] = {
        routeCompleteness: this.assessRouteCompleteness(stats),
        pathEfficiency: this.assessPathEfficiency(stats),
        alternativeRoutes: this.assessAlternativeRoutes(stats),
        emergencyAccess: this.assessEmergencyAccess(stats)
      };

      // Emergency preparedness data
      cityData.emergencyPreparedness[fileName] = {
        evacuationPlanning: this.assessEvacuationPlanning(stats),
        hazardIdentification: this.assessHazardIdentification(stats),
        responseCapability: this.assessResponseCapability(stats),
        testingReadiness: this.assessTestingReadiness(stats)
      };
    }

    return cityData;
  }

  calculatePathDensity(stats) {
    if (stats.paths <= 5) return 'sparse';
    if (stats.paths <= 20) return 'moderate';
    if (stats.paths <= 50) return 'dense';
    return 'very-dense';
  }

  calculateTestQuality(stats) {
    const testToCoverageRatio = stats.coverage > 0 ? stats.tests / stats.coverage : 0;
    
    if (testToCoverageRatio >= 0.5 && stats.errors === 0) return 'excellent';
    if (testToCoverageRatio >= 0.3) return 'good';
    if (testToCoverageRatio >= 0.1) return 'fair';
    return 'poor';
  }

  calculateAccessibilityMapping(stats) {
    if (stats.coverage >= 80) return 'comprehensive';
    if (stats.coverage >= 60) return 'good';
    if (stats.coverage >= 40) return 'partial';
    return 'limited';
  }

  calculateRouteOptimization(stats) {
    const pathsPerCoverage = stats.coverage > 0 ? stats.paths / stats.coverage : 0;
    
    if (pathsPerCoverage >= 1.0) return 'highly-optimized';
    if (pathsPerCoverage >= 0.5) return 'optimized';
    if (pathsPerCoverage >= 0.2) return 'suboptimal';
    return 'poor';
  }

  calculateSafetyAnalysis(stats) {
    if (stats.errors === 0 && stats.paths > 10) return 'comprehensive-safe';
    if (stats.errors === 0) return 'safe';
    if (stats.errors <= 2) return 'minor-concerns';
    return 'safety-issues';
  }

  calculateInfrastructureQuality(stats) {
    const score = (stats.coverage * 0.4) + ((stats.tests / Math.max(stats.paths, 1)) * 30) + 
                  (Math.max(0, 30 - stats.errors * 10));
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  hasMemoryErrors(issues) {
    return issues.some(issue => 
      issue.type.includes('memory') || 
      issue.type.includes('null-pointer') ||
      issue.type.includes('bounds')
    );
  }

  assessRouteCompleteness(stats) {
    if (stats.coverage >= 90) return 'complete';
    if (stats.coverage >= 70) return 'mostly-complete';
    if (stats.coverage >= 50) return 'partial';
    return 'incomplete';
  }

  assessPathEfficiency(stats) {
    const efficiency = stats.coverage > 0 ? (stats.tests / stats.coverage) * 100 : 0;
    
    if (efficiency >= 80) return 'highly-efficient';
    if (efficiency >= 60) return 'efficient';
    if (efficiency >= 40) return 'moderate';
    return 'inefficient';
  }

  assessAlternativeRoutes(stats) {
    if (stats.paths >= 20) return 'many-alternatives';
    if (stats.paths >= 10) return 'good-alternatives';
    if (stats.paths >= 5) return 'limited-alternatives';
    return 'few-alternatives';
  }

  assessEmergencyAccess(stats) {
    if (stats.tests >= 10 && stats.errors === 0) return 'fully-accessible';
    if (stats.tests >= 5) return 'mostly-accessible';
    if (stats.tests > 0) return 'partially-accessible';
    return 'limited-access';
  }

  assessEvacuationPlanning(stats) {
    if (stats.tests >= 15 && stats.coverage >= 70) return 'comprehensive';
    if (stats.tests >= 8) return 'adequate';
    if (stats.tests > 0) return 'basic';
    return 'insufficient';
  }

  assessHazardIdentification(stats) {
    if (stats.errors > 0 && stats.paths >= 10) return 'thorough';
    if (stats.errors > 0) return 'identified';
    if (stats.paths >= 20) return 'searched';
    return 'limited';
  }

  assessResponseCapability(stats) {
    const responseScore = stats.tests + (stats.coverage / 10) - (stats.errors * 2);
    
    if (responseScore >= 15) return 'excellent';
    if (responseScore >= 10) return 'good';
    if (responseScore >= 5) return 'adequate';
    return 'limited';
  }

  assessTestingReadiness(stats) {
    if (stats.tests >= 20) return 'fully-prepared';
    if (stats.tests >= 10) return 'well-prepared';
    if (stats.tests >= 5) return 'prepared';
    return 'unprepared';
  }
}

module.exports = new KLEEAdapter();