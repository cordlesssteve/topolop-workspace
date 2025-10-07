const SnykClient = require('./snyk-client');
const SnykMapper = require('./snyk-mapper');

/**
 * Snyk Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with Snyk CLI to fetch dependency vulnerability and license compliance data.
 * Maps data to unified Layer 2 data model with city visualization support focused on
 * infrastructure security and dependency health.
 * 
 * Part of Tier 1 tool integration (5th priority after SonarQube, CodeClimate, Semgrep, GitHub CodeQL)
 * targeting developer-first security and dependency vulnerability analysis.
 */
class SnykAnalyzer {
  constructor(config = {}) {
    this.config = {
      snykPath: config.snykPath || 'snyk',
      timeout: config.timeout || 300000, // 5 minutes for dependency analysis
      maxBuffer: config.maxBuffer || 1024 * 1024 * 10, // 10MB buffer
      defaultSeverityThreshold: config.defaultSeverityThreshold || 'low',
      includeDev: config.includeDev !== false, // Include dev dependencies by default
      ...config
    };

    this.client = null;
    this.mapper = new SnykMapper();
    
    console.log('🔍 Snyk Analyzer initialized');
    console.log(`   🛡️  Default severity threshold: ${this.config.defaultSeverityThreshold}`);
    console.log(`   📦 Include dev dependencies: ${this.config.includeDev}`);
  }

  /**
   * Initialize the analyzer and test Snyk availability
   */
  async initialize() {
    try {
      this.client = new SnykClient(this.config);
      
      console.log('🔌 Testing Snyk CLI availability...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Snyk CLI not available: ${connectionTest.error}`);
      }
      
      console.log(`✅ Snyk CLI ready: ${connectionTest.version}`);
      
      // Test authentication
      console.log('🔐 Testing Snyk authentication...');
      const authTest = await this.client.testAuthentication();
      
      if (!authTest.success) {
        console.warn(`⚠️  Snyk authentication warning: ${authTest.error}`);
        console.warn('   📝 Run `snyk auth` to authenticate for full functionality');
        
        if (authTest.requiresAuth) {
          throw new Error(`Snyk authentication required: ${authTest.error}`);
        }
      } else {
        console.log('✅ Snyk authenticated successfully');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Snyk initialization failed:', error.message);
      throw new Error(`Snyk initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a codebase directory for dependency vulnerabilities
   */
  async analyzeTarget(targetPath, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Analyzing dependencies with Snyk: ${targetPath}`);

    try {
      // Validate target path
      const validation = await this.client.validateTarget(targetPath);
      if (!validation.valid) {
        throw new Error(`Invalid target path: ${validation.error}`);
      }

      console.log(`📁 Target validated: ${validation.isDirectory ? 'directory' : 'file'}`);

      // Run Snyk dependency analysis
      const snykData = await this.client.analyze(targetPath, {
        severityThreshold: options.severityThreshold || this.config.defaultSeverityThreshold,
        dev: options.includeDev !== undefined ? options.includeDev : this.config.includeDev,
        allProjects: options.allProjects || false,
        file: options.file,
        packageManager: options.packageManager,
        failOn: options.failOn || 'upgradable',
        workingDirectory: options.workingDirectory
      });
      
      // Map to unified data model
      console.log('🔄 Mapping Snyk data to unified model...');
      const unifiedData = this.mapper.mapAnalysisResults(snykData);
      
      console.log('✅ Snyk analysis complete:');
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   📦 Dependencies: ${unifiedData.project.metrics.dependencyCount}`);
      console.log(`   🚨 Vulnerabilities: ${unifiedData.issues.length}`);
      console.log(`   ⚠️  Vulnerable packages: ${unifiedData.project.metrics.vulnerableDependencies}`);
      console.log(`   🏙️  Ecosystems: ${unifiedData.cityVisualization.districts.length}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ Snyk analysis failed for ${targetPath}:`, error.message);
      throw new Error(`Snyk analysis failed: ${error.message}`);
    }
  }

  /**
   * Run focused vulnerability analysis (excludes license issues)
   */
  async vulnerabilityAnalysis(targetPath, options = {}) {
    const results = await this.analyzeTarget(targetPath, options);
    
    // Filter to security vulnerabilities only
    results.issues = results.issues.filter(issue => 
      issue.type === 'security' && !issue.snykData.licenseIssue
    );
    
    // Recalculate metrics without license issues
    const securityVulns = results.snykData.vulnerabilityBreakdown.total - 
      results.snykData.vulnerabilityBreakdown.byType.license || 0;
    
    results.project.metrics.securityFindings = securityVulns;
    
    return results;
  }

  /**
   * Run container image vulnerability analysis
   */
  async analyzeContainer(imageName, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🐳 Analyzing container image with Snyk: ${imageName}`);

    try {
      const snykData = await this.client.analyzeContainer(imageName, {
        severityThreshold: options.severityThreshold || this.config.defaultSeverityThreshold,
        file: options.file
      });
      
      // Map to unified data model with container-specific adjustments
      const unifiedData = this.mapper.mapAnalysisResults(snykData);
      
      // Mark as container analysis
      unifiedData.source = 'snyk-container';
      unifiedData.project.type = 'container';
      
      console.log('✅ Snyk container analysis complete:');
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   📦 Base image vulnerabilities: ${unifiedData.issues.length}`);
      
      return unifiedData;
    } catch (error) {
      console.error(`❌ Snyk container analysis failed for ${imageName}:`, error.message);
      throw new Error(`Snyk container analysis failed: ${error.message}`);
    }
  }

  /**
   * Run code analysis (SAST) with Snyk Code
   */
  async analyzeCode(targetPath, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`💻 Analyzing code with Snyk Code: ${targetPath}`);

    try {
      const snykData = await this.client.analyzeCode(targetPath, {
        severityThreshold: options.severityThreshold || this.config.defaultSeverityThreshold
      });
      
      // Map to unified data model with code-specific adjustments
      const unifiedData = this.mapper.mapAnalysisResults(snykData);
      
      // Mark as code analysis
      unifiedData.source = 'snyk-code';
      unifiedData.project.type = 'code';
      
      console.log('✅ Snyk Code analysis complete:');
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   🚨 Code vulnerabilities: ${unifiedData.issues.length}`);
      
      return unifiedData;
    } catch (error) {
      console.error(`❌ Snyk Code analysis failed for ${targetPath}:`, error.message);
      throw new Error(`Snyk Code analysis failed: ${error.message}`);
    }
  }

  /**
   * Run comprehensive analysis (dependencies + code + container if available)
   */
  async comprehensiveAnalysis(targetPath, options = {}) {
    const results = [];
    
    try {
      console.log('🔄 Running comprehensive Snyk analysis...');
      
      // 1. Dependency analysis (always run)
      console.log('📦 Step 1: Dependency vulnerability analysis');
      const depResults = await this.analyzeTarget(targetPath, options);
      results.push({
        type: 'dependencies',
        data: depResults
      });
      
      // 2. Code analysis (if enabled and available)
      if (options.includeCode !== false) {
        try {
          console.log('💻 Step 2: Static code analysis');
          const codeResults = await this.analyzeCode(targetPath, options);
          results.push({
            type: 'code',
            data: codeResults
          });
        } catch (codeError) {
          console.warn(`⚠️  Snyk Code analysis skipped: ${codeError.message}`);
        }
      }
      
      // 3. Container analysis (if Dockerfile found and enabled)
      if (options.includeContainer !== false) {
        const fs = require('fs-extra');
        const path = require('path');
        const dockerfilePath = path.join(targetPath, 'Dockerfile');
        
        if (await fs.pathExists(dockerfilePath)) {
          try {
            console.log('🐳 Step 3: Container image analysis');
            // Would need image name - this is a placeholder
            console.log('   📝 Container analysis requires image name - skipping');
          } catch (containerError) {
            console.warn(`⚠️  Container analysis skipped: ${containerError.message}`);
          }
        }
      }
      
      console.log(`✅ Comprehensive analysis complete: ${results.length} analysis types`);
      
      return {
        timestamp: new Date().toISOString(),
        target: targetPath,
        analyses: results,
        summary: this._generateComprehensiveSummary(results)
      };
      
    } catch (error) {
      console.error(`❌ Comprehensive analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available capabilities of this analyzer
   */
  getCapabilities() {
    return {
      name: 'Snyk',
      version: '1.0.0',
      source: 'snyk',
      tier: 1,
      priority: 'high', // 5th after SonarQube, CodeClimate, Semgrep, GitHub CodeQL
      marketShare: '8.2%', // Strong in developer-first security

      features: {
        dependencyVulnerabilities: true,
        licenseCompliance: true,
        containerScanning: true,
        codeAnalysis: true, // Snyk Code
        infrastructureAsCode: true, // Snyk IaC
        realTimeMonitoring: true,
        cicdIntegration: true,
        developerFirst: true,
        fixRecommendations: true,
        upgradePath: true,
        cityVisualization: true
      },
      
      dataTypes: {
        vulnerabilities: true,
        licenseIssues: true,
        dependencyHealth: true,
        containerIssues: true,
        codeVulnerabilities: true,
        complianceIssues: true,
        upgradePaths: true,
        riskScoring: true,
        policyViolations: true
      },
      
      ecosystems: [
        'npm', 'yarn', 'pip', 'poetry', 'pipenv', 
        'maven', 'gradle', 'sbt', 'rubygems', 'bundler',
        'nuget', 'composer', 'go-modules', 'cargo', 
        'cocoapods', 'hex', 'pub'
      ],

      integrations: {
        cli: true,
        api: true,
        github: true,
        gitlab: true,
        bitbucket: true,
        jenkins: true,
        circleCI: true,
        githubActions: true,
        docker: true,
        kubernetes: true,
        ide: true, // Various IDE plugins
        webhook: true
      },
      
      cityMapping: {
        buildings: 'dependencies with height based on vulnerability count and severity',
        districts: 'ecosystems/package managers with dependency groupings',
        buildingCondition: 'security risk level and upgrade path availability',
        securityZones: 'critical vulnerability areas and compliance issues',
        infrastructure: 'overall dependency health and license compliance',
        overlays: 'vulnerability heat maps, upgrade paths, and license zones'
      },

      compliance: {
        licenses: true, // License compliance scanning
        policies: true, // Custom security policies
        cve: true,      // CVE database integration
        cwe: true,      // CWE classification
        cvss: true,     // CVSS scoring
        owasp: true,    // OWASP Top 10 mapping
        pci: false,     // Limited PCI compliance
        sox: false,     // Limited SOX compliance
        custom: true    // Custom policy definitions
      }
    };
  }

  /**
   * Check if the analyzer is properly configured
   */
  isConfigured() {
    // Basic configuration check - CLI must be available
    // Authentication is checked during initialization
    return true; // Will be verified in initialize()
  }

  /**
   * Get configuration status and requirements
   */
  getConfigurationStatus() {
    const status = {
      configured: false, // Will be set after auth check
      requirements: []
    };

    status.requirements.push({
      type: 'binary',
      name: 'snyk',
      description: 'Snyk CLI tool must be installed and available in PATH',
      required: true,
      installInstructions: 'npm install -g snyk'
    });

    status.requirements.push({
      type: 'authentication',
      name: 'SNYK_TOKEN or snyk auth',
      description: 'Snyk authentication token required for API access',
      required: true,
      setupInstructions: 'Run `snyk auth` to authenticate or set SNYK_TOKEN environment variable'
    });

    status.requirements.push({
      type: 'project_manifests',
      name: 'Dependency manifests',
      description: 'Project must contain supported dependency manifest files',
      required: true,
      examples: ['package.json', 'requirements.txt', 'pom.xml', 'Cargo.toml']
    });

    return status;
  }

  /**
   * Validate target path exists and is analyzable
   */
  async validateTarget(targetPath) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const validation = await this.client.validateTarget(targetPath);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error
        };
      }
      
      return {
        valid: true,
        target: {
          path: validation.path,
          type: validation.isDirectory ? 'directory' : 'file',
          analyzable: true,
          hasManifests: true // Validated by client
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get project vulnerability summary
   */
  async getProjectSummary(targetPath, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.getProjectSummary(targetPath, options);
    } catch (error) {
      console.error('❌ Failed to get project summary:', error.message);
      return null;
    }
  }

  /**
   * Generate analysis summary for reporting
   */
  generateAnalysisSummary(unifiedData) {
    if (!unifiedData) {
      return null;
    }

    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;
    
    // Categorize issues by type and severity
    const issueByType = {};
    const issueBySeverity = {};
    
    issues.forEach(issue => {
      issueByType[issue.type] = (issueByType[issue.type] || 0) + 1;
      issueBySeverity[issue.severity] = (issueBySeverity[issue.severity] || 0) + 1;
    });

    // Dependency-specific analysis
    const dependencyMetrics = unifiedData.snykData;

    return {
      project: {
        name: unifiedData.project.name,
        path: unifiedData.project.path,
        overallRating: unifiedData.project.overallRating
      },
      
      metrics: {
        totalVulnerabilities: metrics.totalFindings || 0,
        criticalVulnerabilities: metrics.criticalFindings || 0,
        dependencyCount: metrics.dependencyCount || 0,
        vulnerableDependencies: metrics.vulnerableDependencies || 0,
        securityScore: metrics.securityScore || 0,
        riskLevel: metrics.riskLevel || 'unknown',
        upgradeableVulnerabilities: dependencyMetrics.vulnerabilityBreakdown?.upgradeable || 0,
        licenseIssues: metrics.licenseFindings || 0
      },
      
      issues: {
        total: issues.length,
        byType: issueByType,
        bySeverity: issueBySeverity,
        vulnerabilities: {
          total: issues.filter(i => i.type === 'security').length,
          upgradeable: issues.filter(i => i.snykData?.isUpgradable).length,
          patchable: issues.filter(i => i.snykData?.isPatchable).length
        },
        licenses: {
          total: issues.filter(i => i.type === 'compliance').length,
          violations: issues.filter(i => i.snykData?.licenseIssue).length
        }
      },
      
      dependencies: {
        total: metrics.dependencyCount || 0,
        vulnerable: metrics.vulnerableDependencies || 0,
        direct: metrics.directDependencies || 0,
        transitive: metrics.transitiveDependencies || 0,
        outdated: metrics.outdatedDependencies || 0
      },
      
      cityVisualization: {
        ecosystems: unifiedData.cityVisualization.districts.length,
        securityZones: unifiedData.cityVisualization.infrastructure.security.zones.length,
        overallPosture: unifiedData.cityVisualization.infrastructure.security.overall,
        healthyDependencies: unifiedData.cityVisualization.cityMetrics.healthyBuildings,
        atRiskDependencies: unifiedData.cityVisualization.cityMetrics.atRiskBuildings
      },
      
      recommendations: this._generateVulnerabilityRecommendations(unifiedData)
    };
  }

  /**
   * Generate comprehensive analysis summary
   */
  _generateComprehensiveSummary(results) {
    const summary = {
      totalAnalyses: results.length,
      overallSecurityScore: 0,
      totalIssues: 0,
      recommendedActions: []
    };

    let scoreSum = 0;
    let scoreCount = 0;

    results.forEach(result => {
      const data = result.data;
      if (data.project?.metrics?.securityScore) {
        scoreSum += data.project.metrics.securityScore;
        scoreCount++;
      }
      
      summary.totalIssues += data.issues?.length || 0;
      
      // Add type-specific recommendations
      if (result.type === 'dependencies' && data.issues?.length > 0) {
        summary.recommendedActions.push('Update vulnerable dependencies');
      }
      
      if (result.type === 'code' && data.issues?.length > 0) {
        summary.recommendedActions.push('Fix static code security issues');
      }
    });

    summary.overallSecurityScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;

    return summary;
  }

  /**
   * Generate vulnerability-focused recommendations
   */
  _generateVulnerabilityRecommendations(unifiedData) {
    const recommendations = [];
    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;
    const snykData = unifiedData.snykData;

    // Critical vulnerabilities
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: `${criticalIssues.length} critical vulnerabilities found. Immediate action required.`,
        action: 'Upgrade or patch critical vulnerabilities immediately',
        affectedPackages: [...new Set(criticalIssues.map(i => i.component))]
      });
    }

    // Upgradeable vulnerabilities
    const upgradeableCount = snykData.vulnerabilityBreakdown?.upgradeable || 0;
    if (upgradeableCount > 0) {
      recommendations.push({
        priority: 'high',
        category: 'maintenance',
        message: `${upgradeableCount} vulnerabilities can be fixed by upgrading dependencies.`,
        action: 'Run dependency updates to fix known vulnerabilities',
        impact: 'Low effort, high security impact'
      });
    }

    // License issues
    if (metrics.licenseFindings > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'compliance',
        message: `${metrics.licenseFindings} license compliance issues found.`,
        action: 'Review license policy and update dependencies with problematic licenses'
      });
    }

    // Dependency health
    const vulnRatio = metrics.vulnerableDependencies / Math.max(metrics.dependencyCount, 1);
    if (vulnRatio > 0.2) {
      recommendations.push({
        priority: 'medium',
        category: 'maintenance',
        message: `${Math.round(vulnRatio * 100)}% of dependencies have vulnerabilities.`,
        action: 'Consider dependency audit and cleanup of unused packages'
      });
    }

    // Security score
    if (metrics.securityScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        message: `Security score is ${metrics.securityScore}/100. Security posture needs improvement.`,
        action: 'Implement comprehensive dependency security management strategy'
      });
    }

    return recommendations;
  }
}

module.exports = SnykAnalyzer;