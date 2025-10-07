const VeracodeClient = require('./veracode-client');
const VeracodeMapper = require('./veracode-mapper');

/**
 * Veracode Enterprise Security Analysis Integration
 * 
 * Provides comprehensive static application security testing (SAST) analysis
 * through Veracode's enterprise platform for Topolop's Layer 1 data sources.
 * 
 * Key Features:
 * - Enterprise HMAC authentication and API integration
 * - Application security analysis with policy compliance
 * - Vulnerability management and remediation tracking  
 * - Executive security reporting and risk assessment
 * - City visualization with security zones and compliance overlays
 */
class VeracodeAnalyzer {
  constructor(config = {}) {
    this.config = {
      includeHistoricalData: config.includeHistoricalData !== false,
      includePolicyData: config.includePolicyData !== false,
      maxApplications: config.maxApplications || 100,
      maxFindings: config.maxFindings || 1000,
      ...config
    };

    this.client = new VeracodeClient(config);
    this.mapper = new VeracodeMapper(config);
    this.initialized = false;

    console.log('🛡️  Veracode Enterprise Security Analyzer initialized');
    console.log('   🔗 API URL:', this.client.config.apiUrl);
    console.log('   📊 Include policy compliance:', this.config.includePolicyData);
    console.log('   📈 Include historical trends:', this.config.includeHistoricalData);
  }

  /**
   * Initialize the analyzer with authentication
   */
  async initialize() {
    if (!this.initialized) {
      await this.client.initialize();
      this.initialized = true;
    }
  }

  /**
   * Analyze a specific Veracode application
   */
  async analyzeApplication(applicationId, options = {}) {
    await this.initialize();

    console.log(`🔍 Analyzing Veracode application: ${applicationId}`);
    
    try {
      // Fetch comprehensive application analysis data
      const analysisData = await this.client.getApplicationAnalysis(applicationId, {
        findingsLimit: options.maxFindings || this.config.maxFindings,
        scanLimit: options.maxScans || 10,
        ...options
      });

      // Get policy compliance data if enabled
      if (this.config.includePolicyData) {
        try {
          analysisData.policyData = await this.client.getApplicationPolicy(applicationId);
        } catch (policyError) {
          console.warn(`⚠️  Could not fetch policy data: ${policyError.message}`);
          analysisData.policyData = null;
        }
      }

      // Map to unified data model
      console.log('🗺️  Mapping Veracode data to unified model...');
      const unifiedData = this.mapper.mapApplicationAnalysis(analysisData, options);

      console.log(`✅ Veracode analysis completed:`);
      console.log(`   📱 Application: ${unifiedData.project.name}`);
      console.log(`   🔒 Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   🚨 Total Findings: ${unifiedData.project.metrics.totalFindings}`);
      console.log(`   ⚠️  Critical: ${unifiedData.project.metrics.criticalFindings}, High: ${unifiedData.project.metrics.highFindings}`);
      console.log(`   📋 Policy Compliant: ${unifiedData.project.metrics.policyCompliance?.compliant || 'Unknown'}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ Veracode application analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze multiple applications (portfolio analysis)
   */
  async analyzePortfolio(filters = {}) {
    await this.initialize();

    console.log('🏢 Starting Veracode portfolio analysis...');
    
    try {
      // Get applications list
      const applicationsData = await this.client.getApplications({
        limit: filters.limit || this.config.maxApplications,
        ...filters
      });

      const applications = applicationsData.applications;
      console.log(`📊 Found ${applications.length} applications to analyze`);

      const portfolioResults = {
        source: 'veracode',
        analysisType: 'portfolio-security',
        timestamp: new Date().toISOString(),
        portfolio: {
          totalApplications: applications.length,
          analyzedApplications: 0,
          applications: []
        },
        aggregateMetrics: {
          overallSecurityScore: 0,
          totalFindings: 0,
          criticalFindings: 0,
          highFindings: 0,
          policyCompliantApps: 0,
          riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
        }
      };

      // Analyze each application
      for (const app of applications.slice(0, Math.min(10, applications.length))) {
        try {
          console.log(`🔍 Analyzing ${app.profile?.name || app.id}...`);
          
          const appAnalysis = await this.analyzeApplication(app.id, {
            maxFindings: 500 // Reduced for portfolio analysis
          });

          portfolioResults.portfolio.applications.push({
            id: app.id,
            name: appAnalysis.project.name,
            securityScore: appAnalysis.project.metrics.securityScore,
            totalFindings: appAnalysis.project.metrics.totalFindings,
            criticalFindings: appAnalysis.project.metrics.criticalFindings,
            highFindings: appAnalysis.project.metrics.highFindings,
            riskRating: appAnalysis.project.metrics.riskRating,
            policyCompliant: appAnalysis.project.metrics.policyCompliance?.compliant,
            businessCriticality: appAnalysis.project.metrics.businessCriticality
          });

          portfolioResults.portfolio.analyzedApplications++;
          
          // Update aggregate metrics
          this._updatePortfolioMetrics(portfolioResults.aggregateMetrics, appAnalysis);
          
        } catch (appError) {
          console.warn(`⚠️  Failed to analyze application ${app.profile?.name || app.id}: ${appError.message}`);
        }
      }

      // Finalize aggregate metrics
      this._finalizePortfolioMetrics(portfolioResults);

      console.log(`✅ Portfolio analysis completed:`);
      console.log(`   📊 Analyzed: ${portfolioResults.portfolio.analyzedApplications}/${applications.length} applications`);
      console.log(`   🔒 Portfolio Security Score: ${portfolioResults.aggregateMetrics.overallSecurityScore}/100`);
      console.log(`   🚨 Total Findings: ${portfolioResults.aggregateMetrics.totalFindings}`);
      console.log(`   📋 Policy Compliant Apps: ${portfolioResults.aggregateMetrics.policyCompliantApps}`);

      return portfolioResults;
    } catch (error) {
      console.error(`❌ Veracode portfolio analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get application security metrics and trends
   */
  async getApplicationMetrics(applicationId, options = {}) {
    await this.initialize();
    
    console.log(`📊 Fetching Veracode metrics for application: ${applicationId}`);
    
    try {
      const metrics = await this.client.getApplicationMetrics(applicationId, options);
      
      console.log(`✅ Metrics retrieved:`);
      console.log(`   🔒 Security Score: ${metrics.metrics.securityScore}/100`);
      console.log(`   🚨 Total Findings: ${metrics.metrics.totalFindings}`);
      console.log(`   📋 Policy Compliant: ${metrics.metrics.policyCompliance?.compliant || 'Unknown'}`);
      
      return metrics;
    } catch (error) {
      console.error(`❌ Failed to fetch metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search applications by name or criteria
   */
  async searchApplications(searchTerm, filters = {}) {
    await this.initialize();
    
    console.log(`🔍 Searching Veracode applications: "${searchTerm}"`);
    
    try {
      const results = await this.client.searchApplications(searchTerm, filters);
      
      console.log(`✅ Found ${results.totalCount} applications matching search criteria`);
      
      return results;
    } catch (error) {
      console.error(`❌ Application search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run comprehensive security analysis with all available data
   */
  async comprehensiveAnalysis(applicationId, options = {}) {
    await this.initialize();

    console.log(`🛡️  Running comprehensive Veracode security analysis for: ${applicationId}`);
    
    try {
      // Get application analysis
      const analysis = await this.analyzeApplication(applicationId, options);
      
      // Get detailed metrics
      const metrics = await this.getApplicationMetrics(applicationId, options);
      
      // Enhance with comprehensive data
      const comprehensiveResult = {
        ...analysis,
        detailedMetrics: metrics,
        recommendations: this._generateSecurityRecommendations(analysis),
        executiveSummary: this._generateExecutiveSummary(analysis, metrics),
        complianceReport: this._generateComplianceReport(analysis),
        remediationPlan: this._generateRemediationPlan(analysis)
      };

      console.log(`✅ Comprehensive analysis completed`);
      console.log(`   📊 Security Score: ${analysis.project.metrics.securityScore}/100`);
      console.log(`   🎯 Risk Rating: ${analysis.project.metrics.riskRating}`);
      console.log(`   📋 Compliance Status: ${comprehensiveResult.complianceReport.overallStatus}`);
      console.log(`   🔧 Remediation Items: ${comprehensiveResult.remediationPlan.totalItems}`);

      return comprehensiveResult;
    } catch (error) {
      console.error(`❌ Comprehensive analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if analyzer is properly configured
   */
  isConfigured() {
    const apiId = this.config.apiId || process.env.VERACODE_API_ID;
    const apiKey = this.config.apiKey || process.env.VERACODE_API_KEY;
    return !!(apiId && apiKey);
  }

  /**
   * Get analyzer capabilities
   */
  getCapabilities() {
    return {
      name: 'Veracode',
      version: '1.0.0',
      source: 'veracode',
      tier: 1,
      priority: 'high',
      marketShare: '9.0%',
      
      features: {
        enterpriseSecurity: true,
        staticAnalysis: true,
        vulnerabilityManagement: true,
        policyCompliance: true,
        executiveReporting: true,
        riskAssessment: true,
        remediationTracking: true,
        portfolioAnalysis: true,
        binaryAnalysis: true,
        complianceFrameworks: true,
        historicalTrends: this.config.includeHistoricalData,
        cityVisualization: true
      },

      dataTypes: {
        securityVulnerabilities: true,
        policyViolations: true,
        riskAssessment: true,
        complianceStatus: true,
        remediationGuidance: true,
        executiveMetrics: true,
        portfolioInsights: true,
        trendAnalysis: true,
        businessImpact: true
      },

      languages: [
        'java', 'csharp', 'cpp', 'javascript', 'typescript', 'python',
        'php', 'ruby', 'scala', 'kotlin', 'swift', 'objectivec',
        'vb', 'cobol', 'cfml', 'apex', 'go', 'perl', 'android', 'ios'
      ],

      integrations: {
        api: true,
        restApi: true,
        hmacAuth: true,
        enterprise: true,
        cicd: true,
        ide: true,
        jira: true,
        servicenow: true,
        slack: true,
        webhook: false
      },

      cityMapping: {
        buildings: 'applications/files with height based on finding count and business criticality',
        districts: 'business units/teams with security zone classification',
        buildingCondition: 'security score and policy compliance status',
        securityPerimeter: 'enterprise security infrastructure with monitoring zones',
        infrastructure: 'overall enterprise security posture and compliance framework',
        overlays: 'security heat maps, policy compliance zones, risk assessment areas, remediation priorities'
      },

      enterpriseFeatures: {
        hmacAuthentication: true,
        policyEnforcement: true,
        complianceReporting: true,
        executiveDashboard: true,
        portfolioManagement: true,
        riskManagement: true,
        auditTrail: true,
        roleBasedAccess: false, // Not implemented in this integration
        ssoIntegration: false   // Not implemented in this integration
      },

      compliance: {
        owasp: true,
        cwe: true,
        sans25: true,
        pciDss: true,
        sox: true,
        hipaa: true,
        fisma: true,
        nist: true,
        iso27001: true,
        custom: true
      }
    };
  }

  // Helper methods for comprehensive analysis
  _updatePortfolioMetrics(aggregateMetrics, appAnalysis) {
    const metrics = appAnalysis.project.metrics;
    
    aggregateMetrics.totalFindings += metrics.totalFindings;
    aggregateMetrics.criticalFindings += metrics.criticalFindings;
    aggregateMetrics.highFindings += metrics.highFindings;
    
    if (metrics.policyCompliance?.compliant) {
      aggregateMetrics.policyCompliantApps++;
    }

    // Update risk distribution
    const riskLevel = metrics.riskRating || 'low';
    if (aggregateMetrics.riskDistribution[riskLevel] !== undefined) {
      aggregateMetrics.riskDistribution[riskLevel]++;
    }
  }

  _finalizePortfolioMetrics(portfolioResults) {
    const totalApps = portfolioResults.portfolio.analyzedApplications;
    if (totalApps > 0) {
      const totalScore = portfolioResults.portfolio.applications.reduce(
        (sum, app) => sum + app.securityScore, 0
      );
      portfolioResults.aggregateMetrics.overallSecurityScore = Math.round(totalScore / totalApps);
    }
  }

  _generateSecurityRecommendations(analysis) {
    const findings = analysis.issues || [];
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    return {
      immediate: criticalFindings.length > 0 ? [
        'Address all critical security vulnerabilities immediately',
        'Implement emergency security patches',
        'Review and update security policies'
      ] : [],
      
      shortTerm: highFindings.length > 0 ? [
        'Prioritize high-severity vulnerability remediation',
        'Implement security testing in CI/CD pipeline',
        'Conduct security training for development team'
      ] : [],
      
      longTerm: [
        'Establish regular security scanning schedule',
        'Implement security-by-design practices',
        'Build security metrics dashboard for executives'
      ]
    };
  }

  _generateExecutiveSummary(analysis, metrics) {
    return {
      applicationName: analysis.project.name,
      securityPosture: this._getSecurityPostureDescription(analysis.project.metrics.securityScore),
      keyRisks: this._identifyKeyRisks(analysis),
      businessImpact: this._assessBusinessImpact(analysis),
      recommendedActions: this._getExecutiveRecommendations(analysis),
      complianceStatus: analysis.project.metrics.policyCompliance?.compliant ? 'Compliant' : 'Non-Compliant'
    };
  }

  _generateComplianceReport(analysis) {
    const policyCompliance = analysis.project.metrics.policyCompliance;
    const findings = analysis.issues || [];
    
    return {
      overallStatus: policyCompliance?.compliant ? 'Compliant' : 'Non-Compliant',
      policyViolations: findings.filter(f => f.policy?.violatesPolicy).length,
      complianceScore: analysis.project.metrics.securityScore,
      frameworks: ['OWASP', 'CWE', 'SANS'],
      lastAssessment: new Date().toISOString(),
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
    };
  }

  _generateRemediationPlan(analysis) {
    const findings = analysis.issues || [];
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    return {
      totalItems: findings.length,
      highPriority: criticalFindings.length + highFindings.length,
      estimatedEffort: `${findings.length * 2} hours`, // Rough estimate
      timeline: {
        immediate: criticalFindings.length,
        short: highFindings.length,
        medium: findings.filter(f => f.severity === 'medium').length,
        long: findings.filter(f => f.severity === 'low').length
      }
    };
  }

  _getSecurityPostureDescription(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Improvement';
  }

  _identifyKeyRisks(analysis) {
    const findings = analysis.issues || [];
    const riskCategories = {};
    
    findings.forEach(finding => {
      const category = finding.type || 'Unknown';
      riskCategories[category] = (riskCategories[category] || 0) + 1;
    });

    return Object.entries(riskCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  }

  _assessBusinessImpact(analysis) {
    const criticalCount = analysis.project.metrics.criticalFindings || 0;
    const businessCriticality = analysis.project.metrics.businessCriticality;

    if (criticalCount > 0 && businessCriticality === 'VERY_HIGH') return 'Very High';
    if (criticalCount > 0 || businessCriticality === 'HIGH') return 'High';
    if (businessCriticality === 'MEDIUM') return 'Medium';
    return 'Low';
  }

  _getExecutiveRecommendations(analysis) {
    const score = analysis.project.metrics.securityScore;
    const criticalFindings = analysis.project.metrics.criticalFindings;

    if (criticalFindings > 0) {
      return ['Immediate remediation of critical vulnerabilities required'];
    }
    if (score < 70) {
      return ['Increase security testing frequency', 'Implement security training program'];
    }
    return ['Maintain current security practices', 'Continue regular assessments'];
  }
}

module.exports = VeracodeAnalyzer;