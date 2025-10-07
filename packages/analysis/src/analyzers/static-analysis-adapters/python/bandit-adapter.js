/**
 * Bandit Adapter for Topolop
 * 
 * Transforms Bandit security analysis output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Security vulnerabilities → Red security alarm systems on buildings
 * - High severity issues → Flashing emergency beacons
 * - Medium severity → Orange security warnings
 * - Low severity → Yellow caution indicators
 * - Security hotspots → Buildings with enhanced security presence
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BanditAdapter {
  constructor() {
    this.name = 'bandit';
    this.supportedLanguages = ['python'];
    this.description = 'Python security vulnerability scanner';
  }

  /**
   * Check if Bandit is available
   */
  async checkAvailability() {
    try {
      execSync('bandit --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Bandit analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Bandit not available. Run: pip install bandit');
    }

    const outputFile = path.join(codebasePath, '.topolop-bandit-output.json');
    
    try {
      // Run Bandit with JSON output
      const banditCommand = `bandit -r "${codebasePath}" -f json -o "${outputFile}" --skip .git,node_modules,__pycache__ || true`;
      execSync(banditCommand, { cwd: codebasePath, stdio: 'pipe' });
      
      // Read and parse results
      const rawOutput = fs.readFileSync(outputFile, 'utf8');
      const banditResults = JSON.parse(rawOutput || '{"results": [], "metrics": {}}');
      
      // Clean up temp file
      fs.unlinkSync(outputFile);
      
      return {
        tool: 'bandit',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: banditResults.results || [],
        metrics: banditResults.metrics || {},
        summary: this.generateSummary(banditResults)
      };
      
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
      throw new Error(`Bandit analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate analysis summary
   */
  generateSummary(banditResults) {
    const results = banditResults.results || [];
    const metrics = banditResults.metrics || {};
    
    const severityCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    
    const confidenceCounts = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    
    const testTypes = {};
    const fileStats = {};
    const vulnerabilityHotspots = {};

    for (const issue of results) {
      // Count by severity
      const severity = issue.issue_severity;
      if (severityCounts[severity] !== undefined) {
        severityCounts[severity]++;
      }

      // Count by confidence
      const confidence = issue.issue_confidence;
      if (confidenceCounts[confidence] !== undefined) {
        confidenceCounts[confidence]++;
      }

      // Track test types
      const testId = issue.test_id;
      if (testId) {
        testTypes[testId] = (testTypes[testId] || 0) + 1;
      }

      // Track per-file stats
      const filePath = issue.filename;
      if (!fileStats[filePath]) {
        fileStats[filePath] = {
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          total: 0,
          issues: []
        };
      }
      
      fileStats[filePath][severity]++;
      fileStats[filePath].total++;
      fileStats[filePath].issues.push(issue);

      // Track vulnerability hotspots
      const testName = issue.test_name;
      if (!vulnerabilityHotspots[testName]) {
        vulnerabilityHotspots[testName] = {
          count: 0,
          files: new Set(),
          severities: { HIGH: 0, MEDIUM: 0, LOW: 0 }
        };
      }
      vulnerabilityHotspots[testName].count++;
      vulnerabilityHotspots[testName].files.add(filePath);
      vulnerabilityHotspots[testName].severities[severity]++;
    }

    return {
      totalIssues: results.length,
      severityCounts,
      confidenceCounts,
      fileStats,
      metrics,
      topVulnerabilityTypes: this.getTopVulnerabilities(testTypes, 10),
      vulnerabilityHotspots: this.processVulnerabilityHotspots(vulnerabilityHotspots),
      securityScore: this.calculateSecurityScore(severityCounts, results.length)
    };
  }

  getTopVulnerabilities(testTypes, limit = 10) {
    return Object.entries(testTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  processVulnerabilityHotspots(hotspots) {
    const processed = {};
    for (const [testName, data] of Object.entries(hotspots)) {
      processed[testName] = {
        count: data.count,
        affectedFiles: data.files.size,
        severityDistribution: data.severities,
        riskLevel: this.calculateRiskLevel(data.severities)
      };
    }
    return processed;
  }

  calculateRiskLevel(severities) {
    if (severities.HIGH > 0) return 'critical';
    if (severities.MEDIUM > 2) return 'high';
    if (severities.MEDIUM > 0 || severities.LOW > 5) return 'medium';
    return 'low';
  }

  calculateSecurityScore(severityCounts, totalIssues) {
    if (totalIssues === 0) return 100;
    
    const highPenalty = severityCounts.HIGH * 25;
    const mediumPenalty = severityCounts.MEDIUM * 10;
    const lowPenalty = severityCounts.LOW * 3;
    
    return Math.max(0, 100 - highPenalty - mediumPenalty - lowPenalty);
  }

  /**
   * Transform Bandit output into city visualization data
   */
  toCityData(banditOutput) {
    const { results, summary } = banditOutput;
    
    const cityData = {
      securityIssues: [],
      buildingEnhancements: {},
      districtSecurity: {},
      securityIndex: summary.securityScore
    };

    // Process each file's security issues
    for (const [filePath, stats] of Object.entries(summary.fileStats)) {
      const normalizedPath = this.normalizeFilePath(filePath, banditOutput.codebasePath);
      
      if (stats.total > 0) {
        // Add security issues for visualization
        cityData.securityIssues.push({
          file: normalizedPath,
          type: 'bandit',
          severity: this.calculateOverallSeverity(stats),
          count: stats.total,
          details: {
            high: stats.HIGH,
            medium: stats.MEDIUM,
            low: stats.LOW,
            topVulnerabilities: this.getTopVulnerabilitiesForFile(stats.issues)
          }
        });

        // Building security enhancement data
        cityData.buildingEnhancements[normalizedPath] = {
          securityLevel: this.calculateSecurityLevel(stats),
          threatLevel: this.calculateThreatLevel(stats),
          securityMeasures: this.determineSecurityMeasures(stats),
          visualEffects: {
            emergencyBeacons: stats.HIGH > 0,
            securityAlarms: stats.MEDIUM > 0,
            cautionLights: stats.LOW > 0,
            securityPatrols: stats.total > 5,
            reinforcedStructure: stats.HIGH > 2
          }
        };
      }
    }

    // Calculate district-level security
    cityData.districtSecurity = this.calculateDistrictSecurity(cityData.securityIssues);

    return cityData;
  }

  normalizeFilePath(fullPath, basePath) {
    // Handle cases where fullPath is already relative
    if (!path.isAbsolute(fullPath)) {
      return fullPath;
    }

    // Get relative path
    const relativePath = path.relative(basePath, fullPath);

    // If the relative path contains "..", it means the file is outside the base path
    // In that case, we should return the path as-is relative to current working directory
    if (relativePath.startsWith('..')) {
      return fullPath;
    }

    return relativePath;
  }

  calculateOverallSeverity(stats) {
    if (stats.HIGH > 0) return 'critical';
    if (stats.MEDIUM > 0) return 'high';
    if (stats.LOW > 0) return 'medium';
    return 'low';
  }

  getTopVulnerabilitiesForFile(issues) {
    const vulnCounts = {};
    for (const issue of issues) {
      const vuln = issue.test_name || issue.test_id;
      vulnCounts[vuln] = (vulnCounts[vuln] || 0) + 1;
    }
    
    return Object.entries(vulnCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([vuln, count]) => ({ vulnerability: vuln, count }));
  }

  calculateSecurityLevel(stats) {
    const score = 100 - (stats.HIGH * 25 + stats.MEDIUM * 10 + stats.LOW * 3);
    
    if (score >= 90) return 'maximum';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'low';
    return 'minimal';
  }

  calculateThreatLevel(stats) {
    if (stats.HIGH > 2) return 'severe';
    if (stats.HIGH > 0) return 'high';
    if (stats.MEDIUM > 3) return 'elevated';
    if (stats.MEDIUM > 0 || stats.LOW > 5) return 'moderate';
    return 'low';
  }

  determineSecurityMeasures(stats) {
    const measures = [];
    
    if (stats.HIGH > 0) {
      measures.push('immediate-review-required');
      measures.push('security-audit');
    }
    if (stats.MEDIUM > 0) {
      measures.push('enhanced-monitoring');
    }
    if (stats.LOW > 3) {
      measures.push('security-guidelines-review');
    }
    if (stats.total > 10) {
      measures.push('comprehensive-security-overhaul');
    }
    
    return measures;
  }

  calculateDistrictSecurity(securityIssues) {
    const districtStats = {};
    
    for (const issue of securityIssues) {
      const district = this.inferDistrict(issue.file);
      if (!districtStats[district]) {
        districtStats[district] = {
          files: 0,
          totalIssues: 0,
          criticalIssues: 0,
          highIssues: 0,
          mediumIssues: 0
        };
      }
      
      districtStats[district].files++;
      districtStats[district].totalIssues += issue.count;
      
      if (issue.severity === 'critical') districtStats[district].criticalIssues += issue.details.high;
      if (issue.severity === 'high') districtStats[district].highIssues += issue.details.medium;
      if (issue.severity === 'medium') districtStats[district].mediumIssues += issue.details.low;
    }

    // Calculate security scores for each district
    const districtSecurity = {};
    for (const [district, stats] of Object.entries(districtStats)) {
      const securityScore = Math.max(0, 100 - (
        stats.criticalIssues * 25 + 
        stats.highIssues * 10 + 
        stats.mediumIssues * 3
      ) / stats.files);
      
      districtSecurity[district] = {
        securityScore: securityScore.toFixed(1),
        threatLevel: this.getDistrictThreatLevel(stats),
        files: stats.files,
        totalIssues: stats.totalIssues,
        criticalIssues: stats.criticalIssues,
        averageIssuesPerFile: (stats.totalIssues / stats.files).toFixed(1)
      };
    }

    return districtSecurity;
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
    if (pathLower.includes('auth') || pathLower.includes('security') || pathLower.includes('crypto')) {
      return 'security';
    }
    
    return 'core';
  }

  getDistrictThreatLevel(stats) {
    if (stats.criticalIssues > 0) return 'critical';
    if (stats.highIssues > 3) return 'high';
    if (stats.mediumIssues > 5) return 'elevated';
    if (stats.totalIssues > 0) return 'moderate';
    return 'low';
  }
}

module.exports = new BanditAdapter();