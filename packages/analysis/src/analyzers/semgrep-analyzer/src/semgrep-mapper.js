/**
 * Semgrep Data Mapper
 * 
 * Maps Semgrep CLI analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor defined in STRATEGY.md
 */

class SemgrepMapper {
  constructor() {
    // Semgrep severity to unified severity mapping
    this.severityMapping = {
      'ERROR': 'critical',
      'WARNING': 'high', 
      'INFO': 'medium'
    };

    // Semgrep metadata categories to unified issue types
    this.categoryMapping = {
      'security': 'security',
      'correctness': 'bug',
      'performance': 'performance',
      'maintainability': 'maintainability',
      'style': 'style',
      'compatibility': 'compatibility'
    };

    // Default mappings for unknown categories
    this.defaultCategory = 'security'; // Semgrep is primarily security-focused
    this.defaultSeverity = 'medium';
  }

  /**
   * Map complete Semgrep analysis results to unified data model
   */
  mapAnalysisResults(semgrepData) {
    const { results, errors, paths, version, metadata } = semgrepData;

    return {
      // Layer 2 unified data model structure
      source: 'semgrep',
      sourceVersion: version || '1.0.0',
      analyzedAt: metadata.analyzedAt,
      
      // Project-level data
      project: {
        key: this._generateProjectKey(metadata.targetPath),
        name: this._extractProjectName(metadata.targetPath),
        path: metadata.targetPath,
        metrics: this._calculateProjectMetrics(results, paths),
        overallRating: this._calculateOverallRating(results)
      },

      // File-level data (buildings in city metaphor)
      files: this._mapFiles(results, paths),
      
      // Issues mapped to city attributes
      issues: this._mapIssues(results),
      
      // City visualization mapping
      cityVisualization: this._generateCityMapping(results, paths),
      
      // Temporal data for 4D visualization
      temporal: {
        analysisHistory: [], // Semgrep doesn't provide history in single run
        lastAnalysis: metadata.analyzedAt
      },

      // Raw metadata and errors
      metadata: {
        ...metadata,
        totalFindings: results.length,
        totalErrors: errors.length,
        pathsScanned: paths.scanned?.length || 0,
        processingTime: new Date().toISOString(),
        errors: errors
      }
    };
  }

  /**
   * Map Semgrep issues to unified format
   */
  _mapIssues(results) {
    if (!results || results.length === 0) {
      return [];
    }

    return results.map((finding, index) => ({
      id: `semgrep-${finding.check_id}-${index}`,
      type: this._mapCategory(finding),
      severity: this.severityMapping[finding.extra.severity] || this.defaultSeverity,
      component: finding.path,
      rule: {
        key: finding.check_id,
        name: finding.extra.message
      },
      message: finding.extra.message,
      location: {
        file: finding.path,
        line: finding.start.line,
        column: finding.start.col,
        endLine: finding.end.line,
        endColumn: finding.end.col
      },
      effort: this._calculateEffort(finding),
      categories: this._extractCategories(finding),
      fingerprint: this._generateFingerprint(finding),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Semgrep-specific data
      semgrepData: {
        checkId: finding.check_id,
        ruleUrl: finding.extra.metadata?.source || null,
        confidence: finding.extra.metadata?.confidence || 'medium',
        impact: finding.extra.metadata?.impact || 'medium',
        likelihood: finding.extra.metadata?.likelihood || 'medium',
        cwe: finding.extra.metadata?.cwe || [],
        owasp: finding.extra.metadata?.owasp || []
      }
    }));
  }

  /**
   * Map files with security analysis data
   */
  _mapFiles(results, paths) {
    const fileMap = new Map();
    
    // Initialize with scanned paths
    if (paths.scanned) {
      paths.scanned.forEach(filePath => {
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, {
            id: filePath,
            name: filePath.split('/').pop(),
            path: filePath,
            type: this._getFileType(filePath),
            metrics: {
              linesOfCode: 0, // Not provided by Semgrep
              securityFindings: 0
            },
            issues: [],
            cityAttributes: {
              buildingHeight: 10, // Default small building
              buildingCondition: 'excellent',
              securityLevel: 'secure',
              constructionAge: 'recent',
              trafficLevel: 'low'
            }
          });
        }
      });
    }

    // Add findings to files
    results.forEach(finding => {
      const filePath = finding.path;
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          id: filePath,
          name: filePath.split('/').pop(),
          path: filePath,
          type: this._getFileType(filePath),
          metrics: {
            linesOfCode: 0,
            securityFindings: 0
          },
          issues: [],
          cityAttributes: {
            buildingHeight: 10,
            buildingCondition: 'good',
            securityLevel: 'secure',
            constructionAge: 'recent',
            trafficLevel: 'low'
          }
        });
      }
      
      const file = fileMap.get(filePath);
      file.metrics.securityFindings++;
      file.issues.push({
        id: finding.check_id,
        type: this._mapCategory(finding),
        severity: this.severityMapping[finding.extra.severity] || this.defaultSeverity,
        message: finding.extra.message,
        line: finding.start.line
      });
    });

    // Calculate city attributes for each file
    const files = Array.from(fileMap.values());
    files.forEach(file => {
      file.cityAttributes = this._calculateFileAttributes(file);
    });

    return files;
  }

  /**
   * Generate city visualization mapping
   */
  _generateCityMapping(results, paths) {
    const files = this._mapFiles(results, paths);
    const districts = this._groupFilesIntoDistricts(files);
    
    return {
      metaphor: 'city',
      districts: districts.map(district => ({
        id: district.name,
        name: district.name,
        files: district.files,
        overallCondition: this._calculateDistrictCondition(district.files),
        securityLevel: this._calculateDistrictSecurity(district.files)
      })),
      
      infrastructure: {
        roads: this._generateRoadNetwork(files),
        utilities: this._generateUtilities(results),
        zoning: this._generateZoning(files)
      },
      
      overlays: {
        security: this._generateSecurityOverlay(files),
        vulnerability: this._generateVulnerabilityOverlay(results),
        compliance: this._generateComplianceOverlay(results),
        risk: this._generateRiskOverlay(results)
      }
    };
  }

  /**
   * Calculate project-level metrics
   */
  _calculateProjectMetrics(results, paths) {
    const totalFindings = results.length;
    const criticalFindings = results.filter(r => r.extra.severity === 'ERROR').length;
    const securityFindings = results.filter(r => this._mapCategory(r) === 'security').length;
    
    return {
      totalFindings: totalFindings,
      criticalFindings: criticalFindings,
      securityFindings: securityFindings,
      filesScanned: paths.scanned?.length || 0,
      findingsDensity: paths.scanned?.length > 0 ? totalFindings / paths.scanned.length : 0,
      securityScore: this._calculateSecurityScore(results),
      riskLevel: this._calculateRiskLevel(results)
    };
  }

  /**
   * Calculate overall project rating based on security findings
   */
  _calculateOverallRating(results) {
    const totalFindings = results.length;
    const criticalFindings = results.filter(r => r.extra.severity === 'ERROR').length;
    const highFindings = results.filter(r => r.extra.severity === 'WARNING').length;

    if (criticalFindings > 10) return 'F';
    if (criticalFindings > 5 || highFindings > 20) return 'D';
    if (criticalFindings > 2 || highFindings > 10) return 'C';
    if (criticalFindings > 0 || highFindings > 5) return 'B';
    return 'A';
  }

  // Helper methods for mapping and calculation

  _mapCategory(finding) {
    // Try to extract category from rule metadata
    if (finding.extra.metadata?.category) {
      return this.categoryMapping[finding.extra.metadata.category] || this.defaultCategory;
    }
    
    // Fallback: analyze check_id for category hints
    const checkId = finding.check_id.toLowerCase();
    if (checkId.includes('security') || checkId.includes('crypto') || checkId.includes('injection')) {
      return 'security';
    }
    if (checkId.includes('performance')) {
      return 'performance';
    }
    if (checkId.includes('correctness') || checkId.includes('bug')) {
      return 'bug';
    }
    
    return this.defaultCategory;
  }

  _extractCategories(finding) {
    const categories = [this._mapCategory(finding)];
    
    // Add CWE and OWASP categories if available
    if (finding.extra.metadata?.cwe) {
      categories.push(`CWE-${finding.extra.metadata.cwe.join(',CWE-')}`);
    }
    if (finding.extra.metadata?.owasp) {
      categories.push(`OWASP-${finding.extra.metadata.owasp.join(',OWASP-')}`);
    }
    
    return categories;
  }

  _calculateEffort(finding) {
    // Estimate remediation effort based on severity and type
    const severityEffort = {
      'ERROR': 8,      // Critical: 8 hours
      'WARNING': 4,    // High: 4 hours  
      'INFO': 2        // Medium: 2 hours
    };
    
    return severityEffort[finding.extra.severity] || 2;
  }

  _generateFingerprint(finding) {
    // Create unique fingerprint for issue tracking
    return `${finding.check_id}:${finding.path}:${finding.start.line}:${finding.start.col}`;
  }

  _getFileType(filePath) {
    if (!filePath) return 'unknown';
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'kt': 'kotlin',
      'swift': 'swift',
      'scala': 'scala'
    };
    
    return typeMap[ext] || 'file';
  }

  _calculateFileAttributes(file) {
    const issues = file.issues || [];
    const criticalIssues = issues.filter(i => ['critical', 'high'].includes(i.severity));
    const securityIssues = issues.filter(i => i.type === 'security');
    
    return {
      buildingHeight: this._calculateBuildingHeight(file, issues),
      buildingCondition: this._calculateBuildingCondition(issues),
      securityLevel: this._calculateSecurityLevel(securityIssues, criticalIssues),
      constructionAge: 'recent', // Not available from Semgrep
      trafficLevel: this._calculateTrafficLevel(issues)
    };
  }

  _calculateBuildingHeight(file, issues) {
    // Height based on file size estimation and issue severity
    const baseHeight = 20; // Base building height
    const issueHeight = issues.reduce((height, issue) => {
      const severityMultiplier = {
        'critical': 10,
        'high': 6,
        'medium': 3,
        'low': 1
      };
      return height + (severityMultiplier[issue.severity] || 1);
    }, 0);
    
    return Math.min(baseHeight + issueHeight, 200); // Cap at 200
  }

  _calculateBuildingCondition(issues) {
    if (!issues || issues.length === 0) return 'excellent';
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    
    if (criticalIssues > 3) return 'poor';
    if (criticalIssues > 1 || highIssues > 5) return 'fair'; 
    if (criticalIssues > 0 || highIssues > 2) return 'good';
    return 'excellent';
  }

  _calculateSecurityLevel(securityIssues, criticalIssues) {
    const criticalSecurityCount = criticalIssues.filter(i => i.type === 'security').length;
    
    if (criticalSecurityCount > 2) return 'at-risk';
    if (criticalSecurityCount > 0 || securityIssues.length > 5) return 'moderate';
    return 'secure';
  }

  _calculateTrafficLevel(issues) {
    // Traffic based on issue density and severity
    const totalWeight = issues.reduce((weight, issue) => {
      const severityWeight = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return weight + (severityWeight[issue.severity] || 1);
    }, 0);
    
    if (totalWeight > 30) return 'high';
    if (totalWeight > 15) return 'medium';
    return 'low';
  }

  _groupFilesIntoDistricts(files) {
    const districts = {};
    
    files.forEach(file => {
      const pathParts = file.path.split('/');
      const districtName = pathParts.length > 1 ? pathParts[0] : 'root';
      
      if (!districts[districtName]) {
        districts[districtName] = {
          name: districtName,
          files: []
        };
      }
      
      districts[districtName].files.push(file);
    });
    
    return Object.values(districts);
  }

  _calculateDistrictCondition(files) {
    if (files.length === 0) return 'excellent';
    
    const conditions = files.map(f => f.cityAttributes.buildingCondition);
    const conditionScores = { 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1 };
    const averageScore = conditions.reduce((sum, condition) => 
      sum + conditionScores[condition], 0) / conditions.length;
    
    if (averageScore >= 3.5) return 'excellent';
    if (averageScore >= 2.5) return 'good';
    if (averageScore >= 1.5) return 'fair';
    return 'poor';
  }

  _calculateDistrictSecurity(files) {
    const securityLevels = files.map(f => f.cityAttributes.securityLevel);
    
    if (securityLevels.includes('at-risk')) return 'at-risk';
    if (securityLevels.includes('moderate')) return 'moderate';
    return 'secure';
  }

  _calculateSecurityScore(results) {
    if (results.length === 0) return 100;
    
    const maxScore = 100;
    const penalties = {
      'ERROR': 10,
      'WARNING': 5,
      'INFO': 2
    };
    
    const totalPenalty = results.reduce((penalty, result) => 
      penalty + (penalties[result.extra.severity] || 2), 0);
    
    return Math.max(0, maxScore - totalPenalty);
  }

  _calculateRiskLevel(results) {
    const criticalCount = results.filter(r => r.extra.severity === 'ERROR').length;
    const highCount = results.filter(r => r.extra.severity === 'WARNING').length;
    
    if (criticalCount > 5) return 'critical';
    if (criticalCount > 2 || highCount > 10) return 'high';
    if (criticalCount > 0 || highCount > 5) return 'medium';
    return 'low';
  }

  // Placeholder methods for future city visualization features
  _generateProjectKey(targetPath) {
    return targetPath.split('/').pop() || 'unknown';
  }

  _extractProjectName(targetPath) {
    return targetPath.split('/').pop() || 'Unknown Project';
  }

  _generateRoadNetwork(files) {
    return [];
  }

  _generateUtilities(results) {
    return {
      power: 'stable',
      water: 'clean', 
      internet: 'high-speed',
      security: this._calculateSecurityScore(results) > 80 ? 'strong' : 'moderate'
    };
  }

  _generateZoning(files) {
    return {
      security: files.filter(f => f.cityAttributes.securityLevel === 'at-risk').map(f => f.id),
      critical: files.filter(f => f.cityAttributes.buildingCondition === 'poor').map(f => f.id),
      stable: files.filter(f => f.cityAttributes.buildingCondition === 'excellent').map(f => f.id),
      monitoring: files.filter(f => f.cityAttributes.securityLevel === 'moderate').map(f => f.id)
    };
  }

  _generateSecurityOverlay(files) {
    return {
      type: 'security',
      data: files.map(file => ({
        fileId: file.id,
        securityLevel: file.cityAttributes.securityLevel,
        findings: file.metrics.securityFindings
      }))
    };
  }

  _generateVulnerabilityOverlay(results) {
    return {
      type: 'vulnerability',
      data: results.map(result => ({
        checkId: result.check_id,
        severity: result.extra.severity,
        path: result.path,
        line: result.start.line
      }))
    };
  }

  _generateComplianceOverlay(results) {
    return {
      type: 'compliance',
      data: results.filter(r => r.extra.metadata?.owasp || r.extra.metadata?.cwe)
    };
  }

  _generateRiskOverlay(results) {
    return {
      type: 'risk',
      data: results.filter(r => r.extra.severity === 'ERROR')
    };
  }
}

module.exports = SemgrepMapper;