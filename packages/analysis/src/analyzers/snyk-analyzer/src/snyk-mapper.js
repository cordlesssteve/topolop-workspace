/**
 * Snyk Data Mapper
 * 
 * Maps Snyk CLI analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor defined in STRATEGY.md with focus on
 * dependency vulnerabilities and infrastructure security.
 */

class SnykMapper {
  constructor() {
    // Snyk severity to unified severity mapping
    this.severityMapping = {
      'critical': 'critical',
      'high': 'high', 
      'medium': 'medium',
      'low': 'low'
    };

    // Snyk vulnerability types to unified issue types
    this.vulnerabilityTypeMapping = {
      'vuln': 'security',
      'license': 'compliance',
      'malicious': 'security',
      'configuration': 'configuration'
    };

    // Default mappings
    this.defaultSeverity = 'medium';
    this.defaultType = 'security';
  }

  /**
   * Map complete Snyk analysis results to unified data model
   */
  mapAnalysisResults(snykData) {
    const { vulnerabilities = [], dependencyCount, summary, metadata } = snykData;

    return {
      // Layer 2 unified data model structure
      source: 'snyk',
      sourceVersion: metadata?.snykVersion || '1.0.0',
      analyzedAt: metadata?.analyzedAt || new Date().toISOString(),
      
      // Project-level data
      project: {
        key: this._generateProjectKey(metadata?.targetPath),
        name: this._extractProjectName(metadata?.targetPath),
        path: metadata?.targetPath,
        metrics: this._calculateProjectMetrics(snykData),
        overallRating: this._calculateOverallRating(snykData)
      },

      // File-level data (dependencies as virtual files)
      files: this._mapDependenciesToFiles(vulnerabilities, metadata?.targetPath),
      
      // Issue-level data (vulnerabilities)
      issues: this._mapVulnerabilitiesToIssues(vulnerabilities),
      
      // Dependency relationship data
      dependencies: this._extractDependencyRelationships(vulnerabilities),
      
      // City visualization mapping
      cityVisualization: this._generateCityVisualization(snykData),
      
      // Snyk-specific data for detailed analysis
      snykData: {
        dependencyCount: dependencyCount || 0,
        summary: summary || {},
        vulnerabilityBreakdown: this._analyzeVulnerabilities(vulnerabilities),
        licenseIssues: this._extractLicenseIssues(vulnerabilities),
        dependencyPaths: this._extractDependencyPaths(vulnerabilities)
      }
    };
  }

  /**
   * Calculate project-level metrics from Snyk data
   */
  _calculateProjectMetrics(snykData) {
    const { vulnerabilities = [], dependencyCount = 0, summary = {} } = snykData;
    
    // Calculate security score based on vulnerability severity distribution
    const severityCounts = this._countBySeverity(vulnerabilities);
    const securityScore = this._calculateSecurityScore(severityCounts, dependencyCount);
    
    // Calculate risk level based on critical/high vulnerabilities
    const criticalHighCount = (severityCounts.critical || 0) + (severityCounts.high || 0);
    const riskLevel = this._calculateRiskLevel(criticalHighCount, dependencyCount);
    
    return {
      totalFindings: vulnerabilities.length,
      criticalFindings: severityCounts.critical || 0,
      highFindings: severityCounts.high || 0,
      securityFindings: vulnerabilities.filter(v => v.type !== 'license').length,
      licenseFindings: vulnerabilities.filter(v => v.type === 'license').length,
      dependencyCount: dependencyCount,
      vulnerableDependencies: this._countVulnerableDependencies(vulnerabilities),
      securityScore: securityScore,
      riskLevel: riskLevel,
      
      // Dependency-specific metrics
      directDependencies: this._countDirectDependencies(vulnerabilities),
      transitiveDependencies: this._countTransitiveDependencies(vulnerabilities),
      outdatedDependencies: this._countOutdatedDependencies(vulnerabilities),
      
      // Compliance metrics
      complianceScore: this._calculateComplianceScore(vulnerabilities),
      licenseIssues: this._countLicenseIssues(vulnerabilities)
    };
  }

  /**
   * Map dependencies to file-like entities for unified model
   */
  _mapDependenciesToFiles(vulnerabilities, basePath) {
    const dependencyMap = new Map();
    
    vulnerabilities.forEach(vuln => {
      const packageName = vuln.packageName || vuln.moduleName;
      const version = vuln.version;
      const dependencyKey = `${packageName}@${version}`;
      
      if (!dependencyMap.has(dependencyKey)) {
        dependencyMap.set(dependencyKey, {
          path: `dependencies/${packageName}`,
          name: packageName,
          type: 'dependency',
          size: 1, // Virtual size - could be based on actual package size
          language: this._detectLanguageFromPackage(packageName, vuln),
          metrics: {
            vulnerabilityCount: 0,
            securityScore: 100,
            riskLevel: 'low'
          },
          vulnerabilities: []
        });
      }
      
      const dep = dependencyMap.get(dependencyKey);
      dep.vulnerabilities.push(vuln);
      dep.metrics.vulnerabilityCount++;
      
      // Update security metrics based on vulnerabilities
      const maxSeverity = this._getMaxSeverity(dep.vulnerabilities);
      dep.metrics.securityScore = this._calculateDependencySecurityScore(dep.vulnerabilities);
      dep.metrics.riskLevel = this._mapSeverityToRiskLevel(maxSeverity);
    });
    
    return Array.from(dependencyMap.values());
  }

  /**
   * Map vulnerabilities to unified issue format
   */
  _mapVulnerabilitiesToIssues(vulnerabilities) {
    return vulnerabilities.map(vuln => ({
      id: vuln.id || this._generateVulnerabilityId(vuln),
      title: vuln.title,
      description: vuln.description || vuln.overview,
      severity: this.severityMapping[vuln.severity?.toLowerCase()] || this.defaultSeverity,
      type: this.vulnerabilityTypeMapping[vuln.type] || this.defaultType,
      component: vuln.packageName || vuln.moduleName,
      file: `dependencies/${vuln.packageName || vuln.moduleName}`,
      line: 0, // Dependencies don't have line numbers
      
      // Snyk-specific issue data
      snykData: {
        id: vuln.id,
        title: vuln.title,
        cve: vuln.identifiers?.CVE || [],
        cwe: vuln.identifiers?.CWE || [],
        cvssScore: vuln.cvssScore,
        cvss3: vuln.CVSSv3,
        packageName: vuln.packageName || vuln.moduleName,
        version: vuln.version,
        fixedIn: vuln.fixedIn,
        upgradePath: vuln.upgradePath,
        isUpgradable: vuln.isUpgradable,
        isPatchable: vuln.isPatchable,
        from: vuln.from || [],
        semver: vuln.semver,
        publicationTime: vuln.publicationTime,
        disclosureTime: vuln.disclosureTime,
        language: vuln.language,
        packageManager: vuln.packageManager,
        references: vuln.references || [],
        
        // License-specific data if applicable
        licenseType: vuln.licenseType,
        licenseIssue: vuln.type === 'license'
      }
    }));
  }

  /**
   * Extract dependency relationship data
   */
  _extractDependencyRelationships(vulnerabilities) {
    const relationships = [];
    
    vulnerabilities.forEach(vuln => {
      if (vuln.from && Array.isArray(vuln.from) && vuln.from.length > 1) {
        // Build dependency chain relationships
        for (let i = 0; i < vuln.from.length - 1; i++) {
          const from = vuln.from[i];
          const to = vuln.from[i + 1];
          
          relationships.push({
            from: from,
            to: to,
            type: i === 0 ? 'direct' : 'transitive',
            relationship: 'depends_on',
            vulnerable: true,
            vulnerabilityId: vuln.id
          });
        }
      }
    });
    
    return relationships;
  }

  /**
   * Generate city visualization data with dependency focus
   */
  _generateCityVisualization(snykData) {
    const { vulnerabilities = [], dependencyCount = 0 } = snykData;
    
    // Group vulnerabilities by package manager / ecosystem
    const ecosystems = this._groupByEcosystem(vulnerabilities);
    
    const districts = Object.keys(ecosystems).map(ecosystem => ({
      id: ecosystem,
      name: this._getEcosystemDisplayName(ecosystem),
      type: 'ecosystem',
      
      // District metrics based on ecosystem vulnerabilities
      metrics: {
        dependencyCount: ecosystems[ecosystem].dependencies.size,
        vulnerabilityCount: ecosystems[ecosystem].vulnerabilities.length,
        securityScore: this._calculateEcosystemSecurityScore(ecosystems[ecosystem])
      },
      
      // Visual properties
      size: Math.max(ecosystems[ecosystem].dependencies.size, 5),
      condition: this._calculateEcosystemCondition(ecosystems[ecosystem]),
      zoning: this._calculateEcosystemZoning(ecosystems[ecosystem])
    }));
    
    // Infrastructure represents overall dependency health
    const infrastructure = {
      security: {
        zones: this._createSecurityZones(vulnerabilities),
        overall: this._calculateOverallSecurityPosture(snykData)
      },
      
      dependencies: {
        total: dependencyCount,
        vulnerable: this._countVulnerableDependencies(vulnerabilities),
        outdated: this._countOutdatedDependencies(vulnerabilities),
        upgradeable: this._countUpgradeableDependencies(vulnerabilities)
      },
      
      compliance: {
        licenseIssues: this._countLicenseIssues(vulnerabilities),
        policyViolations: this._countPolicyViolations(vulnerabilities)
      },
      
      // City infrastructure zoning based on dependency types
      zoning: {
        secure: [], // Low/no vulnerability dependencies
        monitoring: [], // Medium vulnerability dependencies  
        critical: [] // High/critical vulnerability dependencies
      }
    };
    
    return {
      districts,
      infrastructure,
      
      // Overall city metrics
      cityMetrics: {
        totalBuildings: dependencyCount,
        healthyBuildings: dependencyCount - this._countVulnerableDependencies(vulnerabilities),
        atRiskBuildings: this._countVulnerableDependencies(vulnerabilities),
        
        securityZones: infrastructure.security.zones.length,
        overallRating: this._calculateOverallRating(snykData)
      }
    };
  }

  /**
   * Helper methods for calculations
   */

  _generateProjectKey(targetPath) {
    if (!targetPath) return 'unknown-project';
    return path.basename(targetPath).toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  _extractProjectName(targetPath) {
    if (!targetPath) return 'Unknown Project';
    return path.basename(targetPath);
  }

  _calculateOverallRating(snykData) {
    const { vulnerabilities = [], dependencyCount = 0 } = snykData;
    
    if (vulnerabilities.length === 0) return 'A';
    
    const severityCounts = this._countBySeverity(vulnerabilities);
    const criticalCount = severityCounts.critical || 0;
    const highCount = severityCounts.high || 0;
    
    if (criticalCount > 0) return 'F';
    if (highCount > 5) return 'E';
    if (highCount > 0) return 'D';
    if (vulnerabilities.length > dependencyCount * 0.1) return 'C';
    if (vulnerabilities.length > 0) return 'B';
    return 'A';
  }

  _countBySeverity(vulnerabilities) {
    return vulnerabilities.reduce((counts, vuln) => {
      const severity = vuln.severity?.toLowerCase() || 'low';
      counts[severity] = (counts[severity] || 0) + 1;
      return counts;
    }, {});
  }

  _calculateSecurityScore(severityCounts, dependencyCount) {
    if (dependencyCount === 0) return 100;
    
    const totalVulns = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    if (totalVulns === 0) return 100;
    
    // Weight vulnerabilities by severity
    const weightedScore = (
      (severityCounts.critical || 0) * 40 +
      (severityCounts.high || 0) * 20 +
      (severityCounts.medium || 0) * 10 +
      (severityCounts.low || 0) * 5
    );
    
    // Calculate score as percentage of dependency health
    const maxPossibleScore = dependencyCount * 40; // Worst case: all critical
    const score = Math.max(0, 100 - (weightedScore / Math.max(maxPossibleScore, 1)) * 100);
    
    return Math.round(score);
  }

  _calculateRiskLevel(criticalHighCount, dependencyCount) {
    if (criticalHighCount === 0) return 'low';
    if (criticalHighCount > dependencyCount * 0.2) return 'critical';
    if (criticalHighCount > dependencyCount * 0.1) return 'high';
    return 'medium';
  }

  _countVulnerableDependencies(vulnerabilities) {
    const vulnerablePackages = new Set();
    vulnerabilities.forEach(vuln => {
      const packageName = vuln.packageName || vuln.moduleName;
      if (packageName) {
        vulnerablePackages.add(packageName);
      }
    });
    return vulnerablePackages.size;
  }

  _countDirectDependencies(vulnerabilities) {
    return vulnerabilities.filter(vuln => 
      vuln.from && vuln.from.length === 2 // Root + direct dependency
    ).length;
  }

  _countTransitiveDependencies(vulnerabilities) {
    return vulnerabilities.filter(vuln => 
      vuln.from && vuln.from.length > 2 // Root + direct + transitive
    ).length;
  }

  _countOutdatedDependencies(vulnerabilities) {
    return vulnerabilities.filter(vuln => 
      vuln.isUpgradable || vuln.fixedIn
    ).length;
  }

  _countUpgradeableDependencies(vulnerabilities) {
    return vulnerabilities.filter(vuln => vuln.isUpgradable).length;
  }

  _countLicenseIssues(vulnerabilities) {
    return vulnerabilities.filter(vuln => vuln.type === 'license').length;
  }

  _countPolicyViolations(vulnerabilities) {
    return vulnerabilities.filter(vuln => 
      vuln.policyViolations && vuln.policyViolations.length > 0
    ).length;
  }

  _calculateComplianceScore(vulnerabilities) {
    const licenseIssues = this._countLicenseIssues(vulnerabilities);
    const policyViolations = this._countPolicyViolations(vulnerabilities);
    const totalIssues = licenseIssues + policyViolations;
    
    if (totalIssues === 0) return 100;
    
    // Simple compliance scoring - could be enhanced with policy weighting
    return Math.max(0, 100 - (totalIssues * 10));
  }

  _detectLanguageFromPackage(packageName, vuln) {
    if (vuln.packageManager) return vuln.packageManager;
    if (vuln.language) return vuln.language;
    
    // Simple heuristics based on package patterns
    if (packageName.includes('@')) return 'npm';
    if (packageName.includes('::')) return 'ruby';
    return 'unknown';
  }

  _getMaxSeverity(vulnerabilities) {
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    
    for (const severity of severityOrder) {
      if (vulnerabilities.some(v => v.severity?.toLowerCase() === severity)) {
        return severity;
      }
    }
    
    return 'low';
  }

  _calculateDependencySecurityScore(vulnerabilities) {
    if (vulnerabilities.length === 0) return 100;
    
    const severityCounts = this._countBySeverity(vulnerabilities);
    const totalVulns = vulnerabilities.length;
    
    // Weight by severity and normalize
    const weightedScore = (
      (severityCounts.critical || 0) * 40 +
      (severityCounts.high || 0) * 20 +
      (severityCounts.medium || 0) * 10 +
      (severityCounts.low || 0) * 5
    );
    
    const maxScore = totalVulns * 40;
    return Math.max(0, 100 - (weightedScore / maxScore) * 100);
  }

  _mapSeverityToRiskLevel(severity) {
    const riskMapping = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    
    return riskMapping[severity] || 'low';
  }

  _generateVulnerabilityId(vuln) {
    return vuln.id || `snyk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _analyzeVulnerabilities(vulnerabilities) {
    return {
      total: vulnerabilities.length,
      bySeverity: this._countBySeverity(vulnerabilities),
      byType: this._countByType(vulnerabilities),
      byPackageManager: this._countByPackageManager(vulnerabilities),
      upgradeable: vulnerabilities.filter(v => v.isUpgradable).length,
      patchable: vulnerabilities.filter(v => v.isPatchable).length
    };
  }

  _countByType(vulnerabilities) {
    return vulnerabilities.reduce((counts, vuln) => {
      const type = vuln.type || 'vuln';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
  }

  _countByPackageManager(vulnerabilities) {
    return vulnerabilities.reduce((counts, vuln) => {
      const pm = vuln.packageManager || vuln.language || 'unknown';
      counts[pm] = (counts[pm] || 0) + 1;
      return counts;
    }, {});
  }

  _extractLicenseIssues(vulnerabilities) {
    return vulnerabilities
      .filter(vuln => vuln.type === 'license')
      .map(vuln => ({
        packageName: vuln.packageName || vuln.moduleName,
        licenseType: vuln.licenseType,
        severity: vuln.severity,
        issue: vuln.description || vuln.title
      }));
  }

  _extractDependencyPaths(vulnerabilities) {
    const paths = new Map();
    
    vulnerabilities.forEach(vuln => {
      if (vuln.from && Array.isArray(vuln.from)) {
        const pathKey = vuln.from.join(' -> ');
        if (!paths.has(pathKey)) {
          paths.set(pathKey, {
            path: vuln.from,
            vulnerabilities: []
          });
        }
        paths.get(pathKey).vulnerabilities.push(vuln.id);
      }
    });
    
    return Array.from(paths.values());
  }

  _groupByEcosystem(vulnerabilities) {
    const ecosystems = {};
    
    vulnerabilities.forEach(vuln => {
      const ecosystem = vuln.packageManager || vuln.language || 'unknown';
      
      if (!ecosystems[ecosystem]) {
        ecosystems[ecosystem] = {
          vulnerabilities: [],
          dependencies: new Set()
        };
      }
      
      ecosystems[ecosystem].vulnerabilities.push(vuln);
      ecosystems[ecosystem].dependencies.add(vuln.packageName || vuln.moduleName);
    });
    
    return ecosystems;
  }

  _getEcosystemDisplayName(ecosystem) {
    const nameMap = {
      'npm': 'JavaScript (npm)',
      'pip': 'Python (pip)',
      'maven': 'Java (Maven)',
      'gradle': 'Java (Gradle)',
      'rubygems': 'Ruby (RubyGems)',
      'nuget': '.NET (NuGet)',
      'composer': 'PHP (Composer)',
      'go': 'Go Modules',
      'cargo': 'Rust (Cargo)'
    };
    
    return nameMap[ecosystem] || ecosystem.charAt(0).toUpperCase() + ecosystem.slice(1);
  }

  _calculateEcosystemSecurityScore(ecosystem) {
    if (ecosystem.vulnerabilities.length === 0) return 100;
    
    const severityCounts = this._countBySeverity(ecosystem.vulnerabilities);
    const dependencyCount = ecosystem.dependencies.size;
    
    return this._calculateSecurityScore(severityCounts, dependencyCount);
  }

  _calculateEcosystemCondition(ecosystem) {
    const score = this._calculateEcosystemSecurityScore(ecosystem);
    
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  _calculateEcosystemZoning(ecosystem) {
    const criticalCount = ecosystem.vulnerabilities.filter(v => 
      v.severity?.toLowerCase() === 'critical'
    ).length;
    
    if (criticalCount > 0) return 'security';
    if (ecosystem.vulnerabilities.length > 0) return 'monitoring';
    return 'stable';
  }

  _createSecurityZones(vulnerabilities) {
    const zones = [];
    const criticalVulns = vulnerabilities.filter(v => 
      v.severity?.toLowerCase() === 'critical'
    );
    
    if (criticalVulns.length > 0) {
      zones.push({
        type: 'critical',
        name: 'Critical Vulnerability Zone',
        vulnerabilities: criticalVulns.length,
        packages: [...new Set(criticalVulns.map(v => v.packageName || v.moduleName))]
      });
    }
    
    return zones;
  }

  _calculateOverallSecurityPosture(snykData) {
    const score = this._calculateProjectMetrics(snykData).securityScore;
    
    if (score >= 90) return 'strong';
    if (score >= 80) return 'good';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'weak';
    return 'critical';
  }
}

module.exports = SnykMapper;