/**
 * Pylint Adapter for Topolop
 * 
 * Transforms Pylint static analysis output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Pylint errors → Red alert beacons on buildings
 * - Pylint warnings → Yellow caution lights
 * - Code quality score → Building structural integrity
 * - Convention violations → Building style inconsistencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PylintAdapter {
  constructor() {
    this.name = 'pylint';
    this.supportedLanguages = ['python'];
    this.description = 'Python static analysis and code quality checker';
  }

  /**
   * Check if Pylint is available
   */
  async checkAvailability() {
    try {
      execSync('pylint --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Pylint analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Pylint not available. Run: pip install pylint');
    }

    const outputFile = path.join(codebasePath, '.topolop-pylint-output.json');
    
    try {
      // Run Pylint with JSON output
      const pylintCommand = `pylint "${codebasePath}" --output-format=json --output="${outputFile}" --recursive=y --ignore=.git,node_modules,__pycache__ || true`;
      execSync(pylintCommand, { cwd: codebasePath, stdio: 'pipe' });
      
      // Read and parse results
      const rawOutput = fs.readFileSync(outputFile, 'utf8');
      const pylintResults = JSON.parse(rawOutput || '[]');
      
      // Get overall score
      const scoreOutput = execSync(
        `pylint "${codebasePath}" --score-only --recursive=y --ignore=.git,node_modules,__pycache__ || true`,
        { cwd: codebasePath, encoding: 'utf8', stdio: 'pipe' }
      );
      
      // Clean up temp file
      fs.unlinkSync(outputFile);
      
      return {
        tool: 'pylint',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: pylintResults,
        overallScore: this.extractScore(scoreOutput),
        summary: this.generateSummary(pylintResults)
      };
      
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
      throw new Error(`Pylint analysis failed: ${error.message}`);
    }
  }

  extractScore(scoreOutput) {
    const match = scoreOutput.match(/Your code has been rated at ([\d.-]+)\/10/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(pylintResults) {
    const severityCounts = {
      error: 0,
      warning: 0,
      refactor: 0,
      convention: 0
    };
    
    const messageTypes = {};
    const fileStats = {};
    const moduleStats = {};

    for (const issue of pylintResults) {
      const severity = issue.type || 'unknown';
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Track message types
      const msgId = issue['message-id'] || issue.symbol;
      if (msgId) {
        messageTypes[msgId] = (messageTypes[msgId] || 0) + 1;
      }

      // Track per-file stats
      const filePath = issue.path;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          errors: 0,
          warnings: 0,
          refactor: 0,
          convention: 0,
          total: 0,
          issues: []
        };
      }
      
      fileStats[filePath][severity]++;
      fileStats[filePath].total++;
      fileStats[filePath].issues.push(issue);

      // Track module-level stats
      const module = issue.module || path.dirname(filePath);
      if (!moduleStats[module]) {
        moduleStats[module] = { files: new Set(), issues: 0 };
      }
      moduleStats[module].files.add(filePath);
      moduleStats[module].issues++;
    }

    return {
      totalIssues: pylintResults.length,
      severityCounts,
      fileStats,
      moduleStats: this.processModuleStats(moduleStats),
      topMessageTypes: this.getTopMessages(messageTypes, 10),
      qualityMetrics: this.calculateQualityMetrics(severityCounts, pylintResults.length)
    };
  }

  processModuleStats(moduleStats) {
    const processed = {};
    for (const [module, stats] of Object.entries(moduleStats)) {
      processed[module] = {
        fileCount: stats.files.size,
        issueCount: stats.issues,
        averageIssuesPerFile: (stats.issues / stats.files.size).toFixed(2)
      };
    }
    return processed;
  }

  getTopMessages(messageTypes, limit = 10) {
    return Object.entries(messageTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  calculateQualityMetrics(severityCounts, totalIssues) {
    const errorWeight = severityCounts.error * 4;
    const warningWeight = severityCounts.warning * 2;
    const refactorWeight = severityCounts.refactor * 1;
    const conventionWeight = severityCounts.convention * 0.5;
    
    const weightedScore = Math.max(0, 100 - (errorWeight + warningWeight + refactorWeight + conventionWeight));
    
    return {
      weightedQualityScore: weightedScore.toFixed(1),
      errorRatio: totalIssues > 0 ? (severityCounts.error / totalIssues).toFixed(3) : 0,
      criticalIssueRatio: totalIssues > 0 ? ((severityCounts.error + severityCounts.warning) / totalIssues).toFixed(3) : 0
    };
  }

  /**
   * Transform Pylint output into city visualization data
   */
  toCityData(pylintOutput) {
    const { results, summary, overallScore } = pylintOutput;
    
    const cityData = {
      qualityIssues: [],
      buildingEnhancements: {},
      districtHealth: {},
      codeQualityIndex: overallScore || 5.0
    };

    // Process each file's issues
    for (const [filePath, stats] of Object.entries(summary.fileStats)) {
      const normalizedPath = this.normalizeFilePath(filePath, pylintOutput.codebasePath);
      
      if (stats.total > 0) {
        // Add quality issues for visualization
        cityData.qualityIssues.push({
          file: normalizedPath,
          type: 'pylint',
          severity: this.calculateSeverity(stats),
          count: stats.total,
          details: {
            errors: stats.errors,
            warnings: stats.warnings,
            refactor: stats.refactor,
            convention: stats.convention,
            topIssues: this.getTopIssuesForFile(stats.issues)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[normalizedPath] = {
          qualityScore: this.calculateFileQualityScore(stats),
          structuralIntegrity: this.calculateStructuralIntegrity(stats),
          codeStyleConsistency: this.calculateStyleConsistency(stats),
          visualEffects: {
            errorBeacons: stats.errors > 0,
            warningLights: stats.warnings > 0,
            refactoringSigns: stats.refactor > 3,
            styleInconsistencies: stats.convention > 5
          }
        };
      }
    }

    // Calculate district-level health
    cityData.districtHealth = this.calculateDistrictHealth(summary.moduleStats);

    return cityData;
  }

  normalizeFilePath(fullPath, basePath) {
    return path.relative(basePath, fullPath);
  }

  calculateSeverity(stats) {
    if (stats.errors > 0) return 'error';
    if (stats.warnings > 0) return 'warning';
    if (stats.refactor > 0) return 'refactor';
    return 'convention';
  }

  getTopIssuesForFile(issues) {
    const typeCounts = {};
    for (const issue of issues) {
      const type = issue['message-id'] || issue.symbol || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  calculateFileQualityScore(stats) {
    const errorPenalty = stats.errors * 15;
    const warningPenalty = stats.warnings * 5;
    const refactorPenalty = stats.refactor * 2;
    const conventionPenalty = stats.convention * 1;
    
    return Math.max(0, 100 - errorPenalty - warningPenalty - refactorPenalty - conventionPenalty);
  }

  calculateStructuralIntegrity(stats) {
    // Structural integrity based on errors and warnings
    const criticalIssues = stats.errors + stats.warnings;
    if (criticalIssues === 0) return 'excellent';
    if (criticalIssues <= 2) return 'good';
    if (criticalIssues <= 5) return 'fair';
    return 'poor';
  }

  calculateStyleConsistency(stats) {
    // Style consistency based on convention violations
    if (stats.convention === 0) return 'consistent';
    if (stats.convention <= 3) return 'mostly-consistent';
    if (stats.convention <= 8) return 'inconsistent';
    return 'very-inconsistent';
  }

  calculateDistrictHealth(moduleStats) {
    const districtHealth = {};
    
    for (const [module, stats] of Object.entries(moduleStats)) {
      const district = this.inferDistrict(module);
      if (!districtHealth[district]) {
        districtHealth[district] = {
          modules: 0,
          totalFiles: 0,
          totalIssues: 0,
          scores: []
        };
      }
      
      districtHealth[district].modules++;
      districtHealth[district].totalFiles += stats.fileCount;
      districtHealth[district].totalIssues += stats.issueCount;
      districtHealth[district].scores.push(parseFloat(stats.averageIssuesPerFile));
    }

    // Calculate aggregate scores for each district
    for (const [district, data] of Object.entries(districtHealth)) {
      const avgIssuesPerFile = data.totalIssues / data.totalFiles;
      data.healthScore = Math.max(0, 100 - (avgIssuesPerFile * 10));
      data.healthLevel = this.getHealthLevel(avgIssuesPerFile);
      data.averageIssuesPerFile = avgIssuesPerFile.toFixed(2);
    }

    return districtHealth;
  }

  inferDistrict(modulePath) {
    const pathLower = modulePath.toLowerCase();
    
    if (pathLower.includes('test') || pathLower.includes('tests')) {
      return 'testing';
    }
    if (pathLower.includes('api') || pathLower.includes('server') || pathLower.includes('backend')) {
      return 'backend';
    }
    if (pathLower.includes('ui') || pathLower.includes('frontend') || pathLower.includes('client')) {
      return 'frontend';
    }
    if (pathLower.includes('config') || pathLower.includes('settings') || pathLower.includes('deploy')) {
      return 'infrastructure';
    }
    if (pathLower.includes('util') || pathLower.includes('helper') || pathLower.includes('common')) {
      return 'utilities';
    }
    
    return 'core';
  }

  getHealthLevel(avgIssues) {
    if (avgIssues <= 1) return 'excellent';
    if (avgIssues <= 3) return 'good';
    if (avgIssues <= 6) return 'fair';
    if (avgIssues <= 10) return 'poor';
    return 'critical';
  }
}

module.exports = new PylintAdapter();