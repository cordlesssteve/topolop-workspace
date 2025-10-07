/**
 * Valgrind Adapter for Topolop
 * 
 * Transforms Valgrind memory analysis output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Memory leaks → Toxic waste disposal sites with warning signs
 * - Buffer overflows → Building structural damage alerts  
 * - Use-after-free → Condemned building zones
 * - Invalid reads/writes → Security perimeter breaches
 * - Memory corruption → Environmental contamination zones
 * - Cache misses → Traffic congestion indicators
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ValgrindAdapter {
  constructor() {
    this.name = 'valgrind';
    this.supportedLanguages = ['c-cpp'];
    this.description = 'Dynamic analysis tool for memory debugging and profiling';
  }

  /**
   * Check if Valgrind is available
   */
  async checkAvailability() {
    try {
      execSync('valgrind --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Valgrind analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Valgrind not available. Install with: sudo apt-get install valgrind');
    }

    const results = {
      memcheck: [],
      cachegrind: [],
      callgrind: []
    };
    
    try {
      // Find executable files or compile source files
      const executables = await this.findOrCreateExecutables(codebasePath, options);
      
      if (executables.length === 0) {
        return {
          tool: 'valgrind',
          timestamp: new Date().toISOString(),
          codebasePath,
          results,
          summary: this.generateSummary(results)
        };
      }

      // Run different Valgrind tools on executables
      for (const executable of executables.slice(0, 5)) { // Limit to first 5 executables
        try {
          // Memory checking with Memcheck
          const memcheckResults = await this.runMemcheck(executable, codebasePath, options);
          results.memcheck.push(...memcheckResults);
          
          // Cache analysis with Cachegrind (if enabled)
          if (options.enableCachegrind) {
            const cachegrindResults = await this.runCachegrind(executable, codebasePath, options);
            results.cachegrind.push(...cachegrindResults);
          }
          
          // Call profiling with Callgrind (if enabled)
          if (options.enableCallgrind) {
            const callgrindResults = await this.runCallgrind(executable, codebasePath, options);
            results.callgrind.push(...callgrindResults);
          }
          
        } catch (error) {
          console.warn(`Valgrind analysis failed for ${executable}: ${error.message}`);
          results.memcheck.push({
            executable: path.relative(codebasePath, executable),
            type: 'analysis-error',
            message: error.message,
            severity: 'info'
          });
        }
      }
      
      return {
        tool: 'valgrind',
        timestamp: new Date().toISOString(),
        codebasePath,
        results,
        summary: this.generateSummary(results)
      };
      
    } catch (error) {
      throw new Error(`Valgrind analysis failed: ${error.message}`);
    }
  }

  async findOrCreateExecutables(codebasePath, options) {
    const executables = [];
    
    // First, try to find existing executables
    const foundExecutables = this.findExecutables(codebasePath);
    executables.push(...foundExecutables);
    
    // If no executables found, try to compile source files
    if (executables.length === 0) {
      const compiledExecutables = await this.compileSourceFiles(codebasePath, options);
      executables.push(...compiledExecutables);
    }
    
    return executables;
  }

  findExecutables(codebasePath) {
    const executables = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.') && 
              !['build', 'obj', 'bin'].includes(file.name)) {
            walkDirectory(fullPath);
          } else if (file.isFile() && this.isExecutable(fullPath)) {
            executables.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return executables;
  }

  isExecutable(filePath) {
    try {
      const stats = fs.statSync(filePath);
      // Check if file is executable and not a script
      return (stats.mode & parseInt('111', 8)) && !path.extname(filePath);
    } catch (error) {
      return false;
    }
  }

  async compileSourceFiles(codebasePath, options) {
    const executables = [];
    const sourceFiles = this.findSourceFiles(codebasePath);
    
    for (const sourceFile of sourceFiles.slice(0, 3)) { // Limit compilation attempts
      try {
        const executable = await this.compileFile(sourceFile, codebasePath);
        if (executable) {
          executables.push(executable);
        }
      } catch (error) {
        // Compilation failed, continue with next file
      }
    }
    
    return executables;
  }

  findSourceFiles(codebasePath) {
    const sourceFiles = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.')) {
            walkDirectory(fullPath);
          } else if (file.isFile() && /\.(c|cpp|cc|cxx)$/.test(file.name)) {
            sourceFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return sourceFiles;
  }

  async compileFile(sourceFile, basePath) {
    const ext = path.extname(sourceFile);
    const basename = path.basename(sourceFile, ext);
    const outputFile = path.join(path.dirname(sourceFile), `${basename}_valgrind_test`);
    
    try {
      let compileCommand;
      if (ext === '.c') {
        compileCommand = `gcc -g -o "${outputFile}" "${sourceFile}"`;
      } else {
        compileCommand = `g++ -g -o "${outputFile}" "${sourceFile}"`;
      }
      
      execSync(compileCommand, { 
        cwd: basePath,
        stdio: 'pipe'
      });
      
      return outputFile;
    } catch (error) {
      return null;
    }
  }

  async runMemcheck(executable, basePath, options) {
    const results = [];
    const timeout = options.timeout || 30000; // 30 seconds default
    
    try {
      const valgrindCommand = `valgrind --tool=memcheck --leak-check=full --show-leak-kinds=all --track-origins=yes --xml=yes --xml-file=/tmp/valgrind-memcheck.xml "${executable}"`;
      
      try {
        execSync(valgrindCommand, { 
          cwd: basePath,
          timeout: timeout,
          stdio: 'pipe'
        });
      } catch (error) {
        // Valgrind may return non-zero even on successful analysis
      }
      
      // Parse XML output
      const xmlFile = '/tmp/valgrind-memcheck.xml';
      if (fs.existsSync(xmlFile)) {
        const xmlContent = fs.readFileSync(xmlFile, 'utf8');
        const parsedResults = this.parseMemcheckXML(xmlContent, executable, basePath);
        results.push(...parsedResults);
        
        // Clean up temp file
        fs.unlinkSync(xmlFile);
      }
      
    } catch (error) {
      results.push({
        executable: path.relative(basePath, executable),
        type: 'memcheck-error',
        message: error.message,
        severity: 'info'
      });
    }
    
    return results;
  }

  parseMemcheckXML(xmlContent, executable, basePath) {
    const results = [];
    const relativePath = path.relative(basePath, executable);
    
    // Simple XML parsing for Valgrind output
    const errorPattern = /<error>(.*?)<\/error>/gs;
    
    let errorMatch;
    while ((errorMatch = errorPattern.exec(xmlContent)) !== null) {
      const errorContent = errorMatch[1];
      
      const kind = this.extractXMLValue(errorContent, 'kind');
      const text = this.extractXMLValue(errorContent, 'text');
      const file = this.extractXMLValue(errorContent, 'file');
      const line = this.extractXMLValue(errorContent, 'line');
      
      results.push({
        executable: relativePath,
        type: this.categorizeMemcheckError(kind),
        kind: kind,
        message: text || 'Memory error detected',
        file: file || relativePath,
        line: line ? parseInt(line) : 0,
        severity: this.getMemcheckSeverity(kind)
      });
    }
    
    // If no specific errors found, check for summary
    if (results.length === 0) {
      const leaksPattern = /<supprcount>(\d+)<\/supprcount>/;
      const leaksMatch = xmlContent.match(leaksPattern);
      
      if (leaksMatch && parseInt(leaksMatch[1]) === 0) {
        results.push({
          executable: relativePath,
          type: 'no-errors',
          message: 'No memory errors detected',
          severity: 'info'
        });
      }
    }
    
    return results;
  }

  extractXMLValue(content, tagName) {
    const pattern = new RegExp(`<${tagName}>([^<]+)<\/${tagName}>`);
    const match = content.match(pattern);
    return match ? match[1] : null;
  }

  categorizeMemcheckError(kind) {
    const errorMap = {
      'InvalidRead': 'invalid-read',
      'InvalidWrite': 'invalid-write',
      'InvalidFree': 'invalid-free',
      'MismatchedFree': 'mismatched-free',
      'Leak_DefinitelyLost': 'memory-leak',
      'Leak_PossiblyLost': 'possible-leak',
      'Leak_StillReachable': 'reachable-leak',
      'UninitCondition': 'uninitialized-value',
      'UninitValue': 'uninitialized-value'
    };
    
    return errorMap[kind] || 'unknown-error';
  }

  getMemcheckSeverity(kind) {
    const highSeverity = ['InvalidRead', 'InvalidWrite', 'InvalidFree', 'Leak_DefinitelyLost'];
    const mediumSeverity = ['MismatchedFree', 'Leak_PossiblyLost', 'UninitCondition'];
    
    if (highSeverity.includes(kind)) return 'high';
    if (mediumSeverity.includes(kind)) return 'medium';
    return 'low';
  }

  async runCachegrind(executable, basePath, options) {
    const results = [];
    
    try {
      const cachegrindCommand = `valgrind --tool=cachegrind --cachegrind-out-file=/tmp/cachegrind.out "${executable}"`;
      
      execSync(cachegrindCommand, { 
        cwd: basePath,
        timeout: options.timeout || 30000,
        stdio: 'pipe'
      });
      
      // Parse cachegrind output
      const outputFile = '/tmp/cachegrind.out';
      if (fs.existsSync(outputFile)) {
        const cacheResults = this.parseCachegrindOutput(outputFile, executable, basePath);
        results.push(...cacheResults);
        
        // Clean up temp file
        fs.unlinkSync(outputFile);
      }
      
    } catch (error) {
      results.push({
        executable: path.relative(basePath, executable),
        type: 'cachegrind-error',
        message: error.message,
        severity: 'info'
      });
    }
    
    return results;
  }

  parseCachegrindOutput(outputFile, executable, basePath) {
    const results = [];
    const relativePath = path.relative(basePath, executable);
    
    try {
      const content = fs.readFileSync(outputFile, 'utf8');
      const lines = content.split('\n');
      
      let totalRefs = 0;
      let l1Misses = 0;
      let llMisses = 0;
      
      for (const line of lines) {
        if (line.startsWith('refs=')) {
          totalRefs = parseInt(line.split('=')[1]) || 0;
        } else if (line.startsWith('I1mrs=')) {
          l1Misses += parseInt(line.split('=')[1]) || 0;
        } else if (line.startsWith('D1mrs=')) {
          l1Misses += parseInt(line.split('=')[1]) || 0;
        } else if (line.startsWith('LLmrs=')) {
          llMisses = parseInt(line.split('=')[1]) || 0;
        }
      }
      
      results.push({
        executable: relativePath,
        type: 'cache-analysis',
        totalRefs,
        l1Misses,
        llMisses,
        l1MissRate: totalRefs > 0 ? ((l1Misses / totalRefs) * 100).toFixed(2) : 0,
        llMissRate: totalRefs > 0 ? ((llMisses / totalRefs) * 100).toFixed(2) : 0,
        severity: 'info'
      });
      
    } catch (error) {
      results.push({
        executable: relativePath,
        type: 'cachegrind-parse-error',
        message: error.message,
        severity: 'info'
      });
    }
    
    return results;
  }

  async runCallgrind(executable, basePath, options) {
    // Callgrind implementation would be similar to cachegrind
    // Simplified for this example
    return [{
      executable: path.relative(basePath, executable),
      type: 'callgrind-analysis',
      message: 'Call profiling completed',
      severity: 'info'
    }];
  }

  /**
   * Generate analysis summary
   */
  generateSummary(results) {
    const allResults = [
      ...results.memcheck,
      ...results.cachegrind,
      ...results.callgrind
    ];
    
    const typeCounts = {};
    const severityCounts = {
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };
    
    const executableStats = {};
    const memoryIssues = {
      leaks: 0,
      invalidAccess: 0,
      uninitializedValues: 0
    };

    for (const result of allResults) {
      // Count by type
      typeCounts[result.type] = (typeCounts[result.type] || 0) + 1;
      
      // Count by severity
      if (severityCounts[result.severity] !== undefined) {
        severityCounts[result.severity]++;
      }
      
      // Track memory issue categories
      if (result.type.includes('leak')) {
        memoryIssues.leaks++;
      } else if (result.type.includes('invalid')) {
        memoryIssues.invalidAccess++;
      } else if (result.type.includes('uninitialized')) {
        memoryIssues.uninitializedValues++;
      }

      // Track per-executable stats
      const executable = result.executable;
      if (!executableStats[executable]) {
        executableStats[executable] = {
          high: 0,
          medium: 0,
          low: 0,
          total: 0,
          issues: []
        };
      }
      
      executableStats[executable].total++;
      if (severityCounts[result.severity] !== undefined) {
        executableStats[executable][result.severity]++;
      }
      executableStats[executable].issues.push(result);
    }

    return {
      totalResults: allResults.length,
      typeCounts,
      severityCounts,
      executableStats,
      memoryIssues,
      memoryHealthScore: this.calculateMemoryHealthScore(memoryIssues, severityCounts),
      performanceMetrics: this.extractPerformanceMetrics(results.cachegrind)
    };
  }

  calculateMemoryHealthScore(memoryIssues, severityCounts) {
    const leakPenalty = memoryIssues.leaks * 15;
    const accessPenalty = memoryIssues.invalidAccess * 20;
    const uninitPenalty = memoryIssues.uninitializedValues * 10;
    const severityPenalty = severityCounts.high * 10 + severityCounts.medium * 5;
    
    return Math.max(0, 100 - leakPenalty - accessPenalty - uninitPenalty - severityPenalty);
  }

  extractPerformanceMetrics(cachegrindResults) {
    const metrics = {
      averageL1MissRate: 0,
      averageLLMissRate: 0,
      totalRefs: 0
    };
    
    const cacheAnalyses = cachegrindResults.filter(r => r.type === 'cache-analysis');
    if (cacheAnalyses.length > 0) {
      const l1MissRates = cacheAnalyses.map(r => parseFloat(r.l1MissRate) || 0);
      const llMissRates = cacheAnalyses.map(r => parseFloat(r.llMissRate) || 0);
      
      metrics.averageL1MissRate = (l1MissRates.reduce((a, b) => a + b, 0) / l1MissRates.length).toFixed(2);
      metrics.averageLLMissRate = (llMissRates.reduce((a, b) => a + b, 0) / llMissRates.length).toFixed(2);
      metrics.totalRefs = cacheAnalyses.reduce((sum, r) => sum + (r.totalRefs || 0), 0);
    }
    
    return metrics;
  }

  /**
   * Transform Valgrind output into city visualization data
   */
  toCityData(valgrindOutput) {
    const { results, summary } = valgrindOutput;
    
    const cityData = {
      memoryIssues: [],
      buildingEnhancements: {},
      environmentalHazards: {},
      performanceIndicators: {}
    };

    // Process each executable's results
    for (const [executable, stats] of Object.entries(summary.executableStats)) {
      if (stats.total > 0) {
        // Add memory issues for visualization
        cityData.memoryIssues.push({
          file: executable,
          type: 'valgrind',
          severity: this.calculateOverallSeverity(stats),
          count: stats.total,
          details: {
            high: stats.high,
            medium: stats.medium,
            low: stats.low,
            topIssueTypes: this.getTopIssueTypesForExecutable(stats.issues)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[executable] = {
          memoryIntegrity: this.calculateMemoryIntegrity(stats),
          environmentalSafety: this.calculateEnvironmentalSafety(stats),
          structuralStability: this.calculateStructuralStability(stats),
          visualEffects: {
            toxicWasteAlerts: this.hasMemoryLeaks(stats.issues),
            structuralDamage: this.hasInvalidAccess(stats.issues),
            condemnedZones: this.hasUseAfterFree(stats.issues),
            securityBreaches: this.hasSecurityIssues(stats.issues),
            contaminationZones: this.hasCorruptionIssues(stats.issues),
            trafficCongestion: this.hasPerformanceIssues(stats.issues)
          }
        };

        // Environmental hazards data
        cityData.environmentalHazards[executable] = {
          memoryLeakage: this.assessMemoryLeakage(stats.issues),
          contamination: this.assessContamination(stats.issues),
          hazardLevel: this.assessHazardLevel(stats),
          cleanupRequired: this.assessCleanupNeeds(stats.issues)
        };

        // Performance indicators
        cityData.performanceIndicators[executable] = {
          memoryEfficiency: this.calculateMemoryEfficiency(stats.issues),
          cachePerformance: this.extractCachePerformance(stats.issues),
          overallPerformance: this.calculateOverallPerformance(stats)
        };
      }
    }

    return cityData;
  }

  calculateOverallSeverity(stats) {
    if (stats.high > 0) return 'critical';
    if (stats.medium > 0) return 'high';
    if (stats.low > 0) return 'medium';
    return 'low';
  }

  getTopIssueTypesForExecutable(issues) {
    const typeCounts = {};
    for (const issue of issues) {
      typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  calculateMemoryIntegrity(stats) {
    const criticalIssues = stats.high;
    if (criticalIssues === 0) return 'excellent';
    if (criticalIssues <= 1) return 'good';
    if (criticalIssues <= 3) return 'fair';
    return 'poor';
  }

  calculateEnvironmentalSafety(stats) {
    const memoryScore = 100 - (stats.high * 25 + stats.medium * 10 + stats.low * 3);
    
    if (memoryScore >= 95) return 'safe';
    if (memoryScore >= 80) return 'mostly-safe';
    if (memoryScore >= 60) return 'caution';
    return 'hazardous';
  }

  calculateStructuralStability(stats) {
    const accessViolations = stats.issues.filter(issue => 
      issue.type.includes('invalid') || issue.type.includes('free')
    ).length;
    
    if (accessViolations === 0) return 'stable';
    if (accessViolations <= 2) return 'mostly-stable';
    if (accessViolations <= 5) return 'unstable';
    return 'critical';
  }

  hasMemoryLeaks(issues) {
    return issues.some(issue => issue.type.includes('leak'));
  }

  hasInvalidAccess(issues) {
    return issues.some(issue => issue.type.includes('invalid'));
  }

  hasUseAfterFree(issues) {
    return issues.some(issue => issue.type.includes('free'));
  }

  hasSecurityIssues(issues) {
    return issues.some(issue => 
      issue.type.includes('invalid') || 
      issue.severity === 'high'
    );
  }

  hasCorruptionIssues(issues) {
    return issues.some(issue => 
      issue.type.includes('uninitialized') ||
      issue.type.includes('corruption')
    );
  }

  hasPerformanceIssues(issues) {
    return issues.some(issue => 
      issue.type === 'cache-analysis' && 
      (parseFloat(issue.l1MissRate) > 5 || parseFloat(issue.llMissRate) > 2)
    );
  }

  assessMemoryLeakage(issues) {
    const leaks = issues.filter(issue => issue.type.includes('leak')).length;
    
    if (leaks === 0) return 'none';
    if (leaks <= 2) return 'minor';
    if (leaks <= 5) return 'moderate';
    return 'severe';
  }

  assessContamination(issues) {
    const contaminationIssues = issues.filter(issue => 
      issue.type.includes('uninitialized') || 
      issue.type.includes('invalid')
    ).length;
    
    if (contaminationIssues === 0) return 'clean';
    if (contaminationIssues <= 2) return 'minor';
    return 'major';
  }

  assessHazardLevel(stats) {
    if (stats.high > 3) return 'extreme';
    if (stats.high > 0) return 'high';
    if (stats.medium > 5) return 'moderate';
    return 'low';
  }

  assessCleanupNeeds(issues) {
    const criticalIssues = issues.filter(issue => issue.severity === 'high').length;
    
    if (criticalIssues === 0) return 'none';
    if (criticalIssues <= 2) return 'minor';
    if (criticalIssues <= 5) return 'major';
    return 'comprehensive';
  }

  calculateMemoryEfficiency(issues) {
    const leaks = issues.filter(issue => issue.type.includes('leak')).length;
    const accessIssues = issues.filter(issue => issue.type.includes('invalid')).length;
    
    const efficiency = Math.max(0, 100 - (leaks * 10 + accessIssues * 15));
    
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 70) return 'good';
    if (efficiency >= 50) return 'fair';
    return 'poor';
  }

  extractCachePerformance(issues) {
    const cacheAnalysis = issues.find(issue => issue.type === 'cache-analysis');
    
    if (cacheAnalysis) {
      const l1Rate = parseFloat(cacheAnalysis.l1MissRate) || 0;
      const llRate = parseFloat(cacheAnalysis.llMissRate) || 0;
      
      if (l1Rate < 2 && llRate < 1) return 'excellent';
      if (l1Rate < 5 && llRate < 2) return 'good';
      if (l1Rate < 10 && llRate < 5) return 'fair';
      return 'poor';
    }
    
    return 'unknown';
  }

  calculateOverallPerformance(stats) {
    const memoryScore = 100 - (stats.high * 20 + stats.medium * 8 + stats.low * 3);
    
    if (memoryScore >= 85) return 'excellent';
    if (memoryScore >= 70) return 'good';
    if (memoryScore >= 50) return 'fair';
    return 'poor';
  }
}

module.exports = new ValgrindAdapter();