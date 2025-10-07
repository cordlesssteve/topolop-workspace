const SemgrepClient = require('./semgrep-client');
const SemgrepMapper = require('./semgrep-mapper');

/**
 * Semgrep Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with Semgrep CLI to fetch static application security testing (SAST) results.
 * Maps data to unified Layer 2 data model with city visualization support.
 * 
 * Part of Tier 1 tool integration (3rd priority after SonarQube and CodeClimate) 
 * with strong security analysis capabilities.
 */
class SemgrepAnalyzer {
  constructor(config = {}) {
    this.config = {
      semgrepPath: config.semgrepPath || 'semgrep',
      timeout: config.timeout || 120000,
      defaultRules: config.defaultRules || 'p/security-audit',
      ...config
    };

    this.client = null;
    this.mapper = new SemgrepMapper();
    
    console.log('🔍 Semgrep Analyzer initialized');
    console.log(`   🛡️  Default rules: ${this.config.defaultRules}`);
  }

  /**
   * Initialize the analyzer and test Semgrep availability
   */
  async initialize() {
    try {
      this.client = new SemgrepClient(this.config);
      
      console.log('🔌 Testing Semgrep availability...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Semgrep not available: ${connectionTest.error}`);
      }
      
      console.log(`✅ Semgrep ready: ${connectionTest.version}`);
      return true;
    } catch (error) {
      console.error('❌ Semgrep initialization failed:', error.message);
      throw new Error(`Semgrep initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a codebase directory or file
   */
  async analyzeTarget(targetPath, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Analyzing target with Semgrep: ${targetPath}`);

    try {
      // Validate target path
      const validation = await this.client.validateTarget(targetPath);
      if (!validation.valid) {
        throw new Error(`Invalid target path: ${validation.error}`);
      }

      console.log(`📁 Target validated: ${validation.isDirectory ? 'directory' : 'file'}`);

      // Run Semgrep analysis
      const semgrepData = await this.client.analyze(targetPath, {
        config: options.rules || this.config.defaultRules,
        severity: options.severity || ['ERROR', 'WARNING', 'INFO'],
        exclude: options.exclude,
        lang: options.languages,
        jobs: options.jobs,
        workingDirectory: options.workingDirectory
      });
      
      // Map to unified data model
      console.log('🔄 Mapping Semgrep data to unified model...');
      const unifiedData = this.mapper.mapAnalysisResults(semgrepData);
      
      console.log('✅ Semgrep analysis complete:');
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   🏗️  Files: ${unifiedData.files.length}`);
      console.log(`   🚨 Findings: ${unifiedData.issues.length}`);
      console.log(`   🏙️  Districts: ${unifiedData.cityVisualization.districts.length}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ Semgrep analysis failed for ${targetPath}:`, error.message);
      throw new Error(`Semgrep analysis failed: ${error.message}`);
    }
  }

  /**
   * Run security-focused analysis with OWASP and security rulesets
   */
  async securityAnalysis(targetPath, options = {}) {
    return await this.analyzeTarget(targetPath, {
      ...options,
      rules: options.rules || 'p/security-audit',
      severity: ['ERROR', 'WARNING']
    });
  }

  /**
   * Run analysis with custom rules file
   */
  async analyzeWithCustomRules(targetPath, rulesPath, options = {}) {
    return await this.analyzeTarget(targetPath, {
      ...options,
      rules: rulesPath
    });
  }

  /**
   * Run analysis with specific registry ruleset
   */
  async analyzeWithRegistry(targetPath, registryRules, options = {}) {
    return await this.analyzeTarget(targetPath, {
      ...options,
      rules: registryRules
    });
  }

  /**
   * Get available capabilities of this analyzer
   */
  getCapabilities() {
    return {
      name: 'Semgrep',
      version: '1.0.0',
      source: 'semgrep',
      tier: 1,
      priority: 'high', // 3rd after SonarQube and CodeClimate
      marketShare: '12.1%', // Estimated based on security tool adoption

      features: {
        securityAnalysis: true,
        sastScanning: true,
        customRules: true,
        registryRules: true,
        multiLanguage: true,
        cweMapping: true,
        owaspMapping: true,
        vulnerabilityDetection: true,
        codeQuality: false, // Limited compared to SonarQube/CodeClimate
        performanceAnalysis: true, // Limited performance rules
        cityVisualization: true
      },
      
      dataTypes: {
        securityFindings: true,
        vulnerabilities: true,
        codeSmells: false, // Limited support
        bugs: true,
        compliance: true, // CWE, OWASP compliance
        customChecks: true,
        multiLanguageSupport: true
      },
      
      languages: [
        'javascript', 'typescript', 'python', 'java', 'go', 'ruby',
        'php', 'c', 'cpp', 'csharp', 'kotlin', 'scala', 'swift',
        'rust', 'shell', 'yaml', 'json', 'dockerfile'
      ],

      integrations: {
        cli: true,
        cicd: true,
        github: true,
        gitlab: true,
        multiRepository: true,
        standalone: true
      },
      
      cityMapping: {
        buildings: 'files with height based on security findings and severity',
        districts: 'directory structure with security-focused grouping',
        buildingCondition: 'security risk level and vulnerability count',
        securityZones: 'critical security findings create high-risk zones',
        infrastructure: 'security posture and compliance status',
        overlays: 'vulnerability, compliance, and risk heat maps'
      },

      compliance: {
        owasp: true,
        cwe: true,
        pci: false,
        sox: false,
        custom: true
      }
    };
  }

  /**
   * Check if the analyzer is properly configured
   */
  isConfigured() {
    // Semgrep doesn't require API tokens, just CLI availability
    return true;
  }

  /**
   * Get configuration status and requirements
   */
  getConfigurationStatus() {
    const status = {
      configured: true, // Always configured if binary is available
      requirements: []
    };

    status.requirements.push({
      type: 'binary',
      name: 'semgrep',
      description: 'Semgrep CLI tool must be installed and available in PATH',
      required: true,
      installInstructions: 'pip install semgrep or brew install semgrep'
    });

    status.requirements.push({
      type: 'environment_variable',
      name: 'SEMGREP_APP_TOKEN',
      description: 'Optional: Semgrep App token for enhanced registry access',
      required: false
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
          analyzable: true
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
   * Get available registry rulesets
   */
  async getAvailableRulesets() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.getRegistryRulesets();
    } catch (error) {
      console.error('❌ Failed to get available rulesets:', error.message);
      return {
        security: ['p/security-audit'],
        quality: [],
        performance: [],
        custom: []
      };
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

    // Security-specific analysis
    const securityIssues = issues.filter(i => i.type === 'security');
    const criticalSecurityIssues = securityIssues.filter(i => i.severity === 'critical');

    return {
      project: {
        name: unifiedData.project.name,
        path: unifiedData.project.path,
        overallRating: unifiedData.project.overallRating
      },
      
      metrics: {
        totalFindings: metrics.totalFindings || 0,
        criticalFindings: metrics.criticalFindings || 0,
        securityFindings: metrics.securityFindings || 0,
        filesScanned: metrics.filesScanned || 0,
        securityScore: metrics.securityScore || 0,
        riskLevel: metrics.riskLevel || 'unknown'
      },
      
      issues: {
        total: issues.length,
        byType: issueByType,
        bySeverity: issueBySeverity,
        security: {
          total: securityIssues.length,
          critical: criticalSecurityIssues.length
        }
      },
      
      cityVisualization: {
        districts: unifiedData.cityVisualization.districts.length,
        buildings: unifiedData.files.length,
        securityZones: this._countSecurityZones(unifiedData),
        overallSecurityPosture: this._calculateSecurityPosture(unifiedData)
      },
      
      recommendations: this._generateSecurityRecommendations(unifiedData)
    };
  }

  /**
   * Count security zones in city visualization
   */
  _countSecurityZones(unifiedData) {
    const zoning = unifiedData.cityVisualization.infrastructure.zoning;
    return {
      critical: zoning.security?.length || 0,
      moderate: zoning.monitoring?.length || 0,
      secure: zoning.stable?.length || 0
    };
  }

  /**
   * Calculate overall security posture
   */
  _calculateSecurityPosture(unifiedData) {
    const securityScore = unifiedData.project.metrics.securityScore || 0;
    const riskLevel = unifiedData.project.metrics.riskLevel;

    if (securityScore >= 90 && riskLevel === 'low') return 'excellent';
    if (securityScore >= 80 && ['low', 'medium'].includes(riskLevel)) return 'good';
    if (securityScore >= 70 && riskLevel !== 'critical') return 'fair';
    return 'poor';
  }

  /**
   * Generate security-focused recommendations
   */
  _generateSecurityRecommendations(unifiedData) {
    const recommendations = [];
    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;

    // Critical security issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: `${criticalIssues.length} critical security issues found. Immediate attention required.`,
        action: 'Review and fix all critical security vulnerabilities',
        affectedFiles: [...new Set(criticalIssues.map(i => i.component))]
      });
    }

    // Security score recommendations
    if (metrics.securityScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        message: `Security score is ${metrics.securityScore}/100. Consider implementing additional security measures.`,
        action: 'Address high and medium severity security findings'
      });
    }

    // Risk level recommendations
    if (metrics.riskLevel === 'high' || metrics.riskLevel === 'critical') {
      recommendations.push({
        priority: 'high',
        category: 'risk',
        message: `Project risk level is ${metrics.riskLevel}. Risk mitigation required.`,
        action: 'Implement risk reduction strategies and monitoring'
      });
    }

    // Compliance recommendations
    const complianceIssues = issues.filter(i => 
      i.semgrepData?.cwe?.length > 0 || i.semgrepData?.owasp?.length > 0
    );
    if (complianceIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'compliance',
        message: `${complianceIssues.length} compliance-related issues found.`,
        action: 'Address CWE and OWASP compliance violations'
      });
    }

    return recommendations;
  }
}

module.exports = SemgrepAnalyzer;