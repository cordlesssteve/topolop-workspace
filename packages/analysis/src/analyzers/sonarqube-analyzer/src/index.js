const SonarQubeClient = require('./sonarqube-client');
const SonarQubeMapper = require('./sonarqube-mapper');

/**
 * SonarQube Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with SonarQube/SonarCloud to fetch code quality, security, and 
 * maintainability analysis results. Maps data to unified Layer 2 data model.
 * 
 * Part of Tier 1 tool integration (highest priority) with 22.7% market mindshare.
 */
class SonarQubeAnalyzer {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.SONARQUBE_URL || 'https://sonarcloud.io',
      token: config.token || process.env.SONARQUBE_TOKEN,
      organization: config.organization || process.env.SONARQUBE_ORG,
      ...config
    };

    this.client = null;
    this.mapper = new SonarQubeMapper();
    
    console.log('🔍 SonarQube Analyzer initialized');
    console.log(`   📡 Server: ${this.config.baseUrl}`);
    console.log(`   🏢 Organization: ${this.config.organization || 'Not specified'}`);
  }

  /**
   * Initialize the analyzer and test connection
   */
  async initialize() {
    try {
      this.client = new SonarQubeClient(this.config);
      
      console.log('🔌 Testing SonarQube connection...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Connection failed: ${connectionTest.error}`);
      }
      
      console.log(`✅ Connected to SonarQube ${connectionTest.version} (Status: ${connectionTest.status})`);
      return true;
    } catch (error) {
      console.error('❌ SonarQube initialization failed:', error.message);
      throw new Error(`SonarQube initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a specific project
   */
  async analyzeProject(projectKey, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Analyzing SonarQube project: ${projectKey}`);

    try {
      // Get comprehensive project data from SonarQube
      const sonarQubeData = await this.client.analyzeProject(projectKey, options);
      
      // Map to unified data model
      console.log('🔄 Mapping SonarQube data to unified model...');
      const unifiedData = this.mapper.mapProjectAnalysis(sonarQubeData);
      
      console.log('✅ SonarQube analysis complete:');
      console.log(`   📊 Overall Rating: ${unifiedData.project.overallRating}`);
      console.log(`   🏗️  Files: ${unifiedData.files.length}`);
      console.log(`   🐛 Issues: ${unifiedData.issues.length}`);
      console.log(`   🔥 Security Hotspots: ${unifiedData.securityHotspots.length}`);
      console.log(`   🏙️  Districts: ${unifiedData.cityVisualization.districts.length}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ SonarQube analysis failed for ${projectKey}:`, error.message);
      throw new Error(`SonarQube analysis failed: ${error.message}`);
    }
  }

  /**
   * Search for projects in the organization
   */
  async searchProjects(searchTerm = null, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const projects = await this.client.searchProjects(searchTerm, options);
      
      console.log(`🔍 Found ${projects.components?.length || 0} SonarQube projects`);
      
      return {
        projects: projects.components || [],
        pagination: projects.paging || {},
        total: projects.paging?.total || 0
      };
    } catch (error) {
      console.error('❌ Project search failed:', error.message);
      throw new Error(`Project search failed: ${error.message}`);
    }
  }

  /**
   * Get available capabilities of this analyzer
   */
  getCapabilities() {
    return {
      name: 'SonarQube',
      version: '1.0.0',
      source: 'sonarqube',
      tier: 1,
      priority: 'highest',
      marketShare: '22.7%',
      
      features: {
        codeQuality: true,
        security: true,
        maintainability: true,
        reliability: true,
        testCoverage: true,
        technicalDebt: true,
        codeSmells: true,
        duplicateCode: true,
        complexityAnalysis: true,
        qualityGates: true,
        temporalAnalysis: true,
        cityVisualization: true
      },
      
      dataTypes: {
        projectMetrics: true,
        fileMetrics: true,
        issues: true,
        securityHotspots: true,
        qualityGates: true,
        analysisHistory: true,
        components: true
      },
      
      integrations: {
        sonarCloud: true,
        sonarQubeServer: true,
        organizations: true,
        multiProject: true
      },
      
      cityMapping: {
        buildings: 'files with height based on complexity + LOC',
        districts: 'directory structure grouping',
        buildingCondition: 'issue severity and count',
        securityZones: 'vulnerability and hotspot density',
        infrastructure: 'dependency and utility mapping'
      }
    };
  }

  /**
   * Check if the analyzer is properly configured
   */
  isConfigured() {
    return !!(this.config.token && (this.config.organization || this.config.baseUrl.includes('localhost')));
  }

  /**
   * Get configuration status and requirements
   */
  getConfigurationStatus() {
    const status = {
      configured: this.isConfigured(),
      requirements: []
    };

    if (!this.config.token) {
      status.requirements.push({
        type: 'environment_variable',
        name: 'SONARQUBE_TOKEN',
        description: 'SonarQube API token for authentication',
        required: true
      });
    }

    if (!this.config.organization && this.config.baseUrl.includes('sonarcloud.io')) {
      status.requirements.push({
        type: 'environment_variable', 
        name: 'SONARQUBE_ORG',
        description: 'SonarCloud organization key',
        required: true
      });
    }

    status.requirements.push({
      type: 'environment_variable',
      name: 'SONARQUBE_URL',
      description: 'SonarQube server URL (optional, defaults to SonarCloud)',
      required: false,
      default: 'https://sonarcloud.io'
    });

    return status;
  }

  /**
   * Validate project exists and is accessible
   */
  async validateProject(projectKey) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const searchResult = await this.client.searchProjects(projectKey);
      const project = searchResult.components?.find(p => p.key === projectKey);
      
      if (!project) {
        return {
          valid: false,
          error: `Project '${projectKey}' not found in organization '${this.config.organization}'`
        };
      }

      return {
        valid: true,
        project: {
          key: project.key,
          name: project.name,
          visibility: project.visibility,
          lastAnalysisDate: project.lastAnalysisDate
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
   * Generate analysis summary for reporting
   */
  generateAnalysisSummary(unifiedData) {
    if (!unifiedData) {
      return null;
    }

    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;
    
    // Categorize issues by severity
    const issueBySeverity = {};
    const issuesByType = {};
    
    issues.forEach(issue => {
      issueBySeverity[issue.severity] = (issueBySeverity[issue.severity] || 0) + 1;
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    });

    return {
      project: {
        key: unifiedData.project.key,
        overallRating: unifiedData.project.overallRating,
        qualityGateStatus: unifiedData.project.qualityGate.status
      },
      
      metrics: {
        linesOfCode: metrics.linesOfCode || 0,
        cyclomaticComplexity: metrics.cyclomaticComplexity || 0,
        testCoverage: metrics.testCoverage || 0,
        duplicationPercentage: metrics.duplicationPercentage || 0,
        technicalDebtHours: Math.round((metrics.technicalDebtMinutes || 0) / 60)
      },
      
      issues: {
        total: issues.length,
        bySeverity: issueBySeverity,
        byType: issuesByType,
        securityHotspots: unifiedData.securityHotspots.length
      },
      
      cityVisualization: {
        districts: unifiedData.cityVisualization.districts.length,
        buildings: unifiedData.files.length,
        overallCityCondition: this._calculateOverallCityCondition(unifiedData)
      },
      
      recommendations: this._generateRecommendations(unifiedData)
    };
  }

  /**
   * Calculate overall city condition based on all factors
   */
  _calculateOverallCityCondition(unifiedData) {
    const qualityGate = unifiedData.project.qualityGate.status;
    const overallRating = unifiedData.project.overallRating;
    const criticalIssues = unifiedData.issues.filter(i => 
      ['critical', 'high'].includes(i.severity)
    ).length;

    if (qualityGate === 'error' || overallRating === 'E' || criticalIssues > 50) {
      return 'poor';
    } else if (qualityGate === 'warn' || ['D', 'C'].includes(overallRating) || criticalIssues > 10) {
      return 'fair';
    } else if (overallRating === 'B' || criticalIssues > 2) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  _generateRecommendations(unifiedData) {
    const recommendations = [];
    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;

    // Quality gate recommendations
    if (unifiedData.project.qualityGate.status === 'error') {
      recommendations.push({
        priority: 'high',
        category: 'quality_gate',
        message: 'Quality gate is failing. Review and fix blocking conditions.',
        action: 'Fix quality gate conditions'
      });
    }

    // Security recommendations
    const securityIssues = issues.filter(i => i.type === 'vulnerability').length;
    if (securityIssues > 0) {
      recommendations.push({
        priority: securityIssues > 5 ? 'high' : 'medium',
        category: 'security',
        message: `Found ${securityIssues} security vulnerabilities that need attention.`,
        action: 'Review and fix security vulnerabilities'
      });
    }

    // Technical debt recommendations
    if (metrics.technicalDebtMinutes > 480) { // > 8 hours
      recommendations.push({
        priority: 'medium',
        category: 'technical_debt',
        message: `High technical debt: ${Math.round(metrics.technicalDebtMinutes/60)} hours.`,
        action: 'Prioritize technical debt reduction'
      });
    }

    // Test coverage recommendations
    if (metrics.testCoverage < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'testing',
        message: `Test coverage is ${metrics.testCoverage}%. Consider increasing coverage.`,
        action: 'Add more unit tests'
      });
    }

    // Code duplication recommendations
    if (metrics.duplicationPercentage > 5) {
      recommendations.push({
        priority: 'low',
        category: 'maintainability',
        message: `Code duplication is ${metrics.duplicationPercentage}%. Consider refactoring.`,
        action: 'Reduce code duplication'
      });
    }

    return recommendations;
  }
}

module.exports = SonarQubeAnalyzer;