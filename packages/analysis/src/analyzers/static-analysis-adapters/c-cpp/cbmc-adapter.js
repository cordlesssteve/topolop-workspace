/**
 * CBMC Adapter for Topolop
 * 
 * Transforms CBMC (Bounded Model Checker for C/C++) output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Verification failures → Critical structural failure alarms
 * - Property violations → Building code violation notices
 * - Assertion failures → Emergency safety system activations
 * - Bounds checking failures → Perimeter security breaches
 * - Memory safety violations → Hazardous material containment failures
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CBMCAdapter {
  constructor() {
    this.name = 'cbmc';
    this.supportedLanguages = ['c-cpp'];
    this.description = 'Bounded model checker for C/C++ programs';
  }

  /**
   * Check if CBMC is available
   */
  async checkAvailability() {
    try {
      execSync('cbmc --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run CBMC analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('CBMC not available. Install from: https://www.cprover.org/cbmc/');
    }

    const outputFile = path.join(codebasePath, '.topolop-cbmc-output.xml');
    const results = [];
    
    try {
      // Find C/C++ source files
      const sourceFiles = this.findSourceFiles(codebasePath);
      
      if (sourceFiles.length === 0) {
        return {
          tool: 'cbmc',
          timestamp: new Date().toISOString(),
          codebasePath,
          results: [],
          summary: this.generateSummary([])
        };
      }

      // Run CBMC on each source file
      for (const sourceFile of sourceFiles.slice(0, 10)) { // Limit to first 10 files
        try {
          const filePath = path.join(codebasePath, sourceFile);
          const fileResults = await this.analyzeSingleFile(filePath, codebasePath, options);
          results.push(...fileResults);
        } catch (error) {
          console.warn(`CBMC analysis failed for ${sourceFile}: ${error.message}`);
          results.push({
            file: sourceFile,
            type: 'analysis-error',
            message: error.message,
            verified: false
          });
        }
      }
      
      return {
        tool: 'cbmc',
        timestamp: new Date().toISOString(),
        codebasePath,
        results,
        summary: this.generateSummary(results)
      };
      
    } catch (error) {
      throw new Error(`CBMC analysis failed: ${error.message}`);
    }
  }

  async analyzeSingleFile(filePath, basePath, options) {
    const results = [];
    const timeout = options.timeout || 60000; // 1 minute default timeout
    
    try {
      // Basic CBMC verification
      const cbmcCommand = `cbmc "${filePath}" --bounds-check --pointer-check --memory-leak-check --div-by-zero-check --signed-overflow-check --unsigned-overflow-check --conversion-check --xml-ui`;
      
      const output = execSync(cbmcCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: timeout,
        stdio: 'pipe'
      });
      
      const parsedResults = this.parseCBMCOutput(output, filePath, basePath);
      results.push(...parsedResults);
      
    } catch (error) {
      // CBMC returns non-zero on verification failures, which is expected
      if (error.stdout) {
        const parsedResults = this.parseCBMCOutput(error.stdout, filePath, basePath);
        results.push(...parsedResults);
      } else {
        results.push({
          file: path.relative(basePath, filePath),
          type: 'verification-error',
          message: error.message || 'CBMC execution failed',
          verified: false,
          severity: 'high'
        });
      }
    }
    
    return results;
  }

  findSourceFiles(codebasePath) {
    const sourceFiles = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.') && 
              !['build', 'obj', 'bin', 'target'].includes(file.name)) {
            walkDirectory(fullPath);
          } else if (file.isFile() && /\.(c|cpp|cc|cxx)$/.test(file.name)) {
            sourceFiles.push(path.relative(codebasePath, fullPath));
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return sourceFiles;
  }

  parseCBMCOutput(output, filePath, basePath) {
    const results = [];
    const relativePath = path.relative(basePath, filePath);
    
    // Parse XML output
    if (output.includes('<cprover>')) {
      return this.parseXMLOutput(output, relativePath);
    }
    
    // Fallback: parse text output
    const lines = output.split('\n');
    let currentProperty = null;
    let verificationSuccessful = true;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for verification results
      if (trimmed.includes('VERIFICATION FAILED')) {
        verificationSuccessful = false;
      } else if (trimmed.includes('VERIFICATION SUCCESSFUL')) {
        verificationSuccessful = true;
      }
      
      // Parse property violations
      if (trimmed.startsWith('Violated property:')) {
        currentProperty = this.extractProperty(trimmed);
      }
      
      // Parse assertion failures
      if (trimmed.includes('assertion') && trimmed.includes('line')) {
        const lineMatch = trimmed.match(/line (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 0;
        
        results.push({
          file: relativePath,
          type: 'assertion-failure',
          property: currentProperty || 'assertion',
          line: line,
          message: trimmed,
          verified: false,
          severity: 'high'
        });
      }
      
      // Parse bounds check failures
      if (trimmed.includes('array bounds') || trimmed.includes('buffer overflow')) {
        const lineMatch = trimmed.match(/line (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 0;
        
        results.push({
          file: relativePath,
          type: 'bounds-violation',
          property: 'array-bounds-check',
          line: line,
          message: trimmed,
          verified: false,
          severity: 'high'
        });
      }
      
      // Parse pointer check failures
      if (trimmed.includes('pointer dereference') || trimmed.includes('null pointer')) {
        const lineMatch = trimmed.match(/line (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 0;
        
        results.push({
          file: relativePath,
          type: 'pointer-violation',
          property: 'pointer-check',
          line: line,
          message: trimmed,
          verified: false,
          severity: 'high'
        });
      }
      
      // Parse memory leak detection
      if (trimmed.includes('memory leak') || trimmed.includes('dynamic object')) {
        results.push({
          file: relativePath,
          type: 'memory-leak',
          property: 'memory-leak-check',
          message: trimmed,
          verified: false,
          severity: 'medium'
        });
      }
      
      // Parse arithmetic overflow
      if (trimmed.includes('overflow') || trimmed.includes('wraparound')) {
        const lineMatch = trimmed.match(/line (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 0;
        
        results.push({
          file: relativePath,
          type: 'arithmetic-overflow',
          property: 'overflow-check',
          line: line,
          message: trimmed,
          verified: false,
          severity: 'medium'
        });
      }
    }
    
    // If no specific violations found but verification failed, add general failure
    if (!verificationSuccessful && results.length === 0) {
      results.push({
        file: relativePath,
        type: 'verification-failure',
        property: 'general-verification',
        message: 'Verification failed but no specific violations detected',
        verified: false,
        severity: 'medium'
      });
    }
    
    // If verification successful, add success result
    if (verificationSuccessful && results.length === 0) {
      results.push({
        file: relativePath,
        type: 'verification-success',
        property: 'all-properties',
        message: 'All properties verified successfully',
        verified: true,
        severity: 'info'
      });
    }
    
    return results;
  }

  parseXMLOutput(xmlOutput, relativePath) {
    const results = [];
    
    // Simple XML parsing for CBMC output
    // In production, consider using a proper XML parser
    const propertyPattern = /<property[^>]*>(.*?)<\/property>/gs;
    const statusPattern = /<status>([^<]+)<\/status>/g;
    const descriptionPattern = /<description>([^<]+)<\/description>/g;
    
    let propertyMatch;
    while ((propertyMatch = propertyPattern.exec(xmlOutput)) !== null) {
      const propertyContent = propertyMatch[1];
      
      const statusMatch = statusPattern.exec(propertyContent);
      const descMatch = descriptionPattern.exec(propertyContent);
      
      const status = statusMatch ? statusMatch[1] : 'unknown';
      const description = descMatch ? descMatch[1] : 'No description';
      
      results.push({
        file: relativePath,
        type: status === 'FAILURE' ? 'property-violation' : 'property-check',
        property: description,
        message: description,
        verified: status === 'SUCCESS',
        severity: status === 'FAILURE' ? 'high' : 'info'
      });
    }
    
    return results;
  }

  extractProperty(line) {
    const propertyMatch = line.match(/Violated property: (.+)/);
    return propertyMatch ? propertyMatch[1].trim() : 'unknown-property';
  }

  /**
   * Generate analysis summary
   */
  generateSummary(results) {
    const typeCounts = {};
    const severityCounts = {
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };
    
    const fileStats = {};
    const propertyViolations = {};
    let totalVerified = 0;
    let totalFailed = 0;

    for (const result of results) {
      // Count by type
      typeCounts[result.type] = (typeCounts[result.type] || 0) + 1;
      
      // Count by severity
      if (severityCounts[result.severity] !== undefined) {
        severityCounts[result.severity]++;
      }
      
      // Track verification status
      if (result.verified) {
        totalVerified++;
      } else {
        totalFailed++;
      }
      
      // Track property violations
      if (result.property) {
        propertyViolations[result.property] = (propertyViolations[result.property] || 0) + 1;
      }

      // Track per-file stats
      if (!fileStats[result.file]) {
        fileStats[result.file] = {
          verified: 0,
          failed: 0,
          total: 0,
          violations: []
        };
      }
      
      fileStats[result.file].total++;
      if (result.verified) {
        fileStats[result.file].verified++;
      } else {
        fileStats[result.file].failed++;
        fileStats[result.file].violations.push(result);
      }
    }

    return {
      totalResults: results.length,
      totalVerified,
      totalFailed,
      verificationRate: results.length > 0 ? ((totalVerified / results.length) * 100).toFixed(1) : 0,
      typeCounts,
      severityCounts,
      fileStats,
      topPropertyViolations: this.getTopViolations(propertyViolations, 10),
      safetyScore: this.calculateSafetyScore(severityCounts, totalVerified, totalFailed)
    };
  }

  getTopViolations(propertyViolations, limit = 10) {
    return Object.entries(propertyViolations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([property, count]) => ({ property, count }));
  }

  calculateSafetyScore(severityCounts, verified, failed) {
    if (verified + failed === 0) return 100;
    
    const highPenalty = severityCounts.high * 25;
    const mediumPenalty = severityCounts.medium * 10;
    const lowPenalty = severityCounts.low * 3;
    const verificationBonus = (verified / (verified + failed)) * 20;
    
    return Math.max(0, Math.min(100, 100 - highPenalty - mediumPenalty - lowPenalty + verificationBonus));
  }

  /**
   * Transform CBMC output into city visualization data
   */
  toCityData(cbmcOutput) {
    const { results, summary } = cbmcOutput;
    
    const cityData = {
      verificationResults: [],
      buildingEnhancements: {},
      safetyCompliance: {},
      structuralIntegrity: {}
    };

    // Process each file's verification results
    for (const [fileName, stats] of Object.entries(summary.fileStats)) {
      if (stats.total > 0) {
        // Add verification results for visualization
        cityData.verificationResults.push({
          file: fileName,
          type: 'cbmc',
          verified: stats.verified > 0,
          violationCount: stats.failed,
          verificationRate: ((stats.verified / stats.total) * 100).toFixed(1),
          details: {
            verified: stats.verified,
            failed: stats.failed,
            total: stats.total,
            topViolations: this.getTopViolationsForFile(stats.violations)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[fileName] = {
          structuralCertification: this.calculateStructuralCertification(stats),
          safetyCompliance: this.calculateSafetyCompliance(stats),
          verificationStatus: this.getVerificationStatus(stats),
          visualEffects: {
            structuralAlarms: this.hasStructuralViolations(stats.violations),
            safetyBeacons: this.hasSafetyViolations(stats.violations),
            complianceIndicators: stats.verified > 0,
            emergencyProtocols: this.hasCriticalViolations(stats.violations),
            verificationBadges: stats.failed === 0
          }
        };

        // Safety compliance data
        cityData.safetyCompliance[fileName] = {
          memorysafety: this.assessMemorySafety(stats.violations),
          boundsChecking: this.assessBoundsCompliance(stats.violations),
          pointerSafety: this.assessPointerSafety(stats.violations),
          arithmeticSafety: this.assessArithmeticSafety(stats.violations)
        };

        // Structural integrity data
        cityData.structuralIntegrity[fileName] = {
          integrityLevel: this.calculateIntegrityLevel(stats),
          criticalFailures: this.countCriticalFailures(stats.violations),
          structuralRisk: this.assessStructuralRisk(stats)
        };
      }
    }

    return cityData;
  }

  getTopViolationsForFile(violations) {
    const typeCounts = {};
    for (const violation of violations) {
      typeCounts[violation.type] = (typeCounts[violation.type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  calculateStructuralCertification(stats) {
    const passRate = stats.total > 0 ? (stats.verified / stats.total) : 0;
    
    if (passRate >= 0.95) return 'certified';
    if (passRate >= 0.80) return 'compliant';
    if (passRate >= 0.60) return 'conditional';
    return 'non-compliant';
  }

  calculateSafetyCompliance(stats) {
    const criticalViolations = stats.violations.filter(v => v.severity === 'high').length;
    
    if (criticalViolations === 0 && stats.failed === 0) return 'full-compliance';
    if (criticalViolations === 0) return 'partial-compliance';
    if (criticalViolations <= 2) return 'minor-violations';
    return 'major-violations';
  }

  getVerificationStatus(stats) {
    if (stats.failed === 0) return 'fully-verified';
    if (stats.verified > stats.failed) return 'mostly-verified';
    if (stats.verified > 0) return 'partially-verified';
    return 'unverified';
  }

  hasStructuralViolations(violations) {
    return violations.some(v => 
      v.type.includes('assertion') || 
      v.type.includes('bounds') ||
      v.type.includes('pointer')
    );
  }

  hasSafetyViolations(violations) {
    return violations.some(v => 
      v.type.includes('memory') || 
      v.type.includes('overflow') ||
      v.severity === 'high'
    );
  }

  hasCriticalViolations(violations) {
    return violations.some(v => v.severity === 'high');
  }

  assessMemorySafety(violations) {
    const memoryViolations = violations.filter(v => 
      v.type.includes('memory') || v.type.includes('leak')
    );
    
    if (memoryViolations.length === 0) return 'safe';
    if (memoryViolations.length <= 2) return 'caution';
    return 'unsafe';
  }

  assessBoundsCompliance(violations) {
    const boundsViolations = violations.filter(v => v.type.includes('bounds'));
    
    if (boundsViolations.length === 0) return 'compliant';
    if (boundsViolations.length <= 1) return 'minor-issues';
    return 'major-issues';
  }

  assessPointerSafety(violations) {
    const pointerViolations = violations.filter(v => v.type.includes('pointer'));
    
    if (pointerViolations.length === 0) return 'safe';
    if (pointerViolations.length <= 1) return 'caution';
    return 'unsafe';
  }

  assessArithmeticSafety(violations) {
    const arithmeticViolations = violations.filter(v => v.type.includes('overflow'));
    
    if (arithmeticViolations.length === 0) return 'safe';
    if (arithmeticViolations.length <= 2) return 'caution';
    return 'unsafe';
  }

  calculateIntegrityLevel(stats) {
    const integrityScore = stats.total > 0 ? (stats.verified / stats.total) * 100 : 0;
    
    if (integrityScore >= 95) return 'excellent';
    if (integrityScore >= 80) return 'good';
    if (integrityScore >= 60) return 'fair';
    return 'poor';
  }

  countCriticalFailures(violations) {
    return violations.filter(v => v.severity === 'high').length;
  }

  assessStructuralRisk(stats) {
    const criticalFailures = stats.violations.filter(v => v.severity === 'high').length;
    const totalFailures = stats.failed;
    
    if (criticalFailures === 0 && totalFailures === 0) return 'minimal';
    if (criticalFailures === 0) return 'low';
    if (criticalFailures <= 2) return 'moderate';
    return 'high';
  }
}

module.exports = new CBMCAdapter();