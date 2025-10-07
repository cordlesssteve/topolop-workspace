/**
 * MyPy Adapter for Topolop
 * 
 * Transforms MyPy type checking output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Type errors → Structural instability indicators on buildings
 * - Type warnings → Construction warning signs
 * - Missing type annotations → Incomplete building blueprints
 * - Type coverage → Building construction completion percentage
 * - Complex type issues → Engineering complexity indicators
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class MyPyAdapter {
  constructor() {
    this.name = 'mypy';
    this.supportedLanguages = ['python'];
    this.description = 'Python static type checker';
  }

  /**
   * Check if MyPy is available
   */
  async checkAvailability() {
    try {
      execSync('mypy --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run MyPy analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('MyPy not available. Run: pip install mypy');
    }

    try {
      // Run MyPy with machine-readable output
      const mypyCommand = `mypy "${codebasePath}" --show-error-codes --show-column-numbers --no-error-summary --ignore-missing-imports || true`;
      const output = execSync(mypyCommand, { 
        cwd: codebasePath, 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      // Parse MyPy output
      const mypyResults = this.parseMyPyOutput(output);
      
      // Get type coverage if available
      let typeCoverage = null;
      try {
        const coverageOutput = execSync(
          `mypy "${codebasePath}" --html-report /tmp/mypy-report --txt-report /tmp/mypy-txt || true`,
          { cwd: codebasePath, encoding: 'utf8', stdio: 'pipe' }
        );
        typeCoverage = this.extractTypeCoverage(coverageOutput);
      } catch (error) {
        // Coverage reporting is optional
      }
      
      return {
        tool: 'mypy',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: mypyResults,
        typeCoverage,
        summary: this.generateSummary(mypyResults)
      };
      
    } catch (error) {
      throw new Error(`MyPy analysis failed: ${error.message}`);
    }
  }

  parseMyPyOutput(output) {
    const lines = output.split('\n').filter(line => line.trim());
    const results = [];
    
    for (const line of lines) {
      // Parse MyPy output format: file:line:col: severity: message [error-code]
      const match = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|note):\s*(.+?)(?:\s*\[([^\]]+)\])?$/);
      if (match) {
        results.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4],
          message: match[5].trim(),
          errorCode: match[6] || null
        });
      }
    }
    
    return results;
  }

  extractTypeCoverage(coverageOutput) {
    // Try to extract coverage percentage from MyPy output
    const match = coverageOutput.match(/Total coverage: ([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(mypyResults) {
    const severityCounts = {
      error: 0,
      warning: 0,
      note: 0
    };
    
    const errorCodes = {};
    const fileStats = {};
    const typeIssueCategories = {};

    for (const issue of mypyResults) {
      // Count by severity
      const severity = issue.severity;
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Track error codes
      const errorCode = issue.errorCode;
      if (errorCode) {
        errorCodes[errorCode] = (errorCodes[errorCode] || 0) + 1;
        
        // Categorize type issues
        const category = this.categorizeTypeIssue(errorCode);
        typeIssueCategories[category] = (typeIssueCategories[category] || 0) + 1;
      }

      // Track per-file stats
      const filePath = issue.file;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          errors: 0,
          warnings: 0,
          notes: 0,
          total: 0,
          issues: [],
          uniqueErrorCodes: new Set()
        };
      }
      
      fileStats[filePath][severity]++;
      fileStats[filePath].total++;
      fileStats[filePath].issues.push(issue);
      if (errorCode) {
        fileStats[filePath].uniqueErrorCodes.add(errorCode);
      }
    }

    // Convert Sets to arrays for serialization
    for (const stats of Object.values(fileStats)) {
      stats.uniqueErrorCodes = Array.from(stats.uniqueErrorCodes);
    }

    return {
      totalIssues: mypyResults.length,
      severityCounts,
      fileStats,
      topErrorCodes: this.getTopErrorCodes(errorCodes, 10),
      typeIssueCategories,
      typeQualityMetrics: this.calculateTypeQualityMetrics(severityCounts, mypyResults.length),
      complexityIndicators: this.calculateComplexityIndicators(fileStats)
    };
  }

  categorizeTypeIssue(errorCode) {
    const typeCategories = {
      'annotation': ['annotation-unchecked', 'type-abstract', 'misc'],
      'incompatible': ['assignment', 'return-value', 'argument'],
      'undefined': ['name-defined', 'attr-defined', 'has-type'],
      'import': ['import', 'no-redef'],
      'generic': ['type-arg', 'valid-type'],
      'union': ['union-attr', 'operator'],
      'callable': ['call-overload', 'call-arg'],
      'override': ['override', 'method-override']
    };
    
    for (const [category, codes] of Object.entries(typeCategories)) {
      if (codes.some(code => errorCode.includes(code))) {
        return category;
      }
    }
    
    return 'other';
  }

  getTopErrorCodes(errorCodes, limit = 10) {
    return Object.entries(errorCodes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([code, count]) => ({ code, count }));
  }

  calculateTypeQualityMetrics(severityCounts, totalIssues) {
    const errorWeight = severityCounts.error * 3;
    const warningWeight = severityCounts.warning * 1;
    const noteWeight = severityCounts.note * 0.5;
    
    const typeScore = Math.max(0, 100 - (errorWeight + warningWeight + noteWeight));
    
    return {
      typeQualityScore: typeScore.toFixed(1),
      errorRatio: totalIssues > 0 ? (severityCounts.error / totalIssues).toFixed(3) : 0,
      typeStability: this.calculateTypeStability(severityCounts)
    };
  }

  calculateTypeStability(severityCounts) {
    const totalIssues = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    if (totalIssues === 0) return 'excellent';
    
    const errorRatio = severityCounts.error / totalIssues;
    if (errorRatio > 0.7) return 'unstable';
    if (errorRatio > 0.3) return 'fragile';
    if (errorRatio > 0.1) return 'stable';
    return 'robust';
  }

  calculateComplexityIndicators(fileStats) {
    const complexityScores = [];
    
    for (const [file, stats] of Object.entries(fileStats)) {
      const complexity = stats.uniqueErrorCodes.length + (stats.errors * 2) + stats.warnings;
      complexityScores.push({ file, complexity, issues: stats.total });
    }
    
    // Sort by complexity and return top 5
    return complexityScores
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5);
  }

  /**
   * Transform MyPy output into city visualization data
   */
  toCityData(mypyOutput) {
    const { results, summary, typeCoverage } = mypyOutput;
    
    const cityData = {
      typeIssues: [],
      buildingEnhancements: {},
      districtTypeHealth: {},
      overallTypeCoverage: typeCoverage || 0
    };

    // Process each file's type issues
    for (const [filePath, stats] of Object.entries(summary.fileStats)) {
      const normalizedPath = this.normalizeFilePath(filePath, mypyOutput.codebasePath);
      
      if (stats.total > 0) {
        // Add type issues for visualization
        cityData.typeIssues.push({
          file: normalizedPath,
          type: 'mypy',
          severity: this.calculateTypeSeverity(stats),
          count: stats.total,
          details: {
            errors: stats.errors,
            warnings: stats.warnings,
            notes: stats.notes,
            errorCodeVariety: stats.uniqueErrorCodes.length,
            topErrorCodes: stats.uniqueErrorCodes.slice(0, 3)
          }
        });

        // Building type enhancement data
        cityData.buildingEnhancements[normalizedPath] = {
          typeStability: this.calculateFileTypeStability(stats),
          constructionQuality: this.calculateConstructionQuality(stats),
          blueprintCompleteness: this.calculateBlueprintCompleteness(stats),
          engineeringComplexity: this.calculateEngineeringComplexity(stats),
          visualEffects: {
            structuralWarnings: stats.errors > 0,
            constructionSigns: stats.warnings > 0,
            blueprintGaps: stats.notes > 2,
            engineeringComplexity: stats.uniqueErrorCodes.length > 3,
            stabilityIndicators: this.getStabilityIndicators(stats)
          }
        };
      }
    }

    // Calculate district-level type health
    cityData.districtTypeHealth = this.calculateDistrictTypeHealth(cityData.typeIssues);

    return cityData;
  }

  normalizeFilePath(fullPath, basePath) {
    return path.relative(basePath, fullPath);
  }

  calculateTypeSeverity(stats) {
    if (stats.errors > 0) return 'error';
    if (stats.warnings > 0) return 'warning';
    return 'note';
  }

  calculateFileTypeStability(stats) {
    const totalIssues = stats.total;
    if (totalIssues === 0) return 'excellent';
    
    const errorRatio = stats.errors / totalIssues;
    if (errorRatio > 0.6) return 'unstable';
    if (errorRatio > 0.3) return 'fragile';
    if (errorRatio > 0.1) return 'stable';
    return 'robust';
  }

  calculateConstructionQuality(stats) {
    const score = Math.max(0, 100 - (stats.errors * 10 + stats.warnings * 3 + stats.notes * 1));
    
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  calculateBlueprintCompleteness(stats) {
    // Higher notes often indicate missing type annotations
    if (stats.notes === 0 && stats.errors === 0) return 'complete';
    if (stats.notes <= 2) return 'mostly-complete';
    if (stats.notes <= 5) return 'incomplete';
    return 'very-incomplete';
  }

  calculateEngineeringComplexity(stats) {
    const complexity = stats.uniqueErrorCodes.length;
    if (complexity === 0) return 'simple';
    if (complexity <= 2) return 'moderate';
    if (complexity <= 5) return 'complex';
    return 'very-complex';
  }

  getStabilityIndicators(stats) {
    const indicators = [];
    
    if (stats.errors === 0) indicators.push('no-structural-issues');
    if (stats.warnings <= 1) indicators.push('minimal-warnings');
    if (stats.uniqueErrorCodes.length <= 2) indicators.push('simple-type-structure');
    if (stats.total <= 3) indicators.push('good-type-quality');
    
    return indicators;
  }

  calculateDistrictTypeHealth(typeIssues) {
    const districtStats = {};
    
    for (const issue of typeIssues) {
      const district = this.inferDistrict(issue.file);
      if (!districtStats[district]) {
        districtStats[district] = {
          files: 0,
          totalIssues: 0,
          typeErrors: 0,
          typeWarnings: 0,
          typeNotes: 0
        };
      }
      
      districtStats[district].files++;
      districtStats[district].totalIssues += issue.count;
      districtStats[district].typeErrors += issue.details.errors;
      districtStats[district].typeWarnings += issue.details.warnings;
      districtStats[district].typeNotes += issue.details.notes;
    }

    // Calculate type health scores for each district
    const districtTypeHealth = {};
    for (const [district, stats] of Object.entries(districtStats)) {
      const typeScore = Math.max(0, 100 - (
        stats.typeErrors * 10 + 
        stats.typeWarnings * 3 + 
        stats.typeNotes * 1
      ) / stats.files);
      
      districtTypeHealth[district] = {
        typeHealthScore: typeScore.toFixed(1),
        typeStability: this.getDistrictTypeStability(stats),
        files: stats.files,
        totalIssues: stats.totalIssues,
        errorRate: (stats.typeErrors / stats.files).toFixed(2),
        averageIssuesPerFile: (stats.totalIssues / stats.files).toFixed(1)
      };
    }

    return districtTypeHealth;
  }

  inferDistrict(filePath) {
    const pathLower = filePath.toLowerCase();
    
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
    if (pathLower.includes('model') || pathLower.includes('data') || pathLower.includes('db')) {
      return 'data';
    }
    
    return 'core';
  }

  getDistrictTypeStability(stats) {
    const errorRate = stats.typeErrors / stats.files;
    if (errorRate === 0) return 'excellent';
    if (errorRate <= 1) return 'stable';
    if (errorRate <= 3) return 'moderate';
    if (errorRate <= 5) return 'fragile';
    return 'unstable';
  }
}

module.exports = new MyPyAdapter();