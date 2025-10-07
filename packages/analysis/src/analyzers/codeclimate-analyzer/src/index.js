const CodeClimateClient = require('./codeclimate-client');
const CodeClimateMapper = require('./codeclimate-mapper');

/**
 * CodeClimate Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with CodeClimate Quality to fetch code quality, maintainability,
 * and technical debt analysis results. Maps data to unified Layer 2 data model.
 * 
 * Part of Tier 1 tool integration (2nd priority after SonarQube) with significant
 * market presence in code quality analysis.
 */
class CodeClimateAnalyzer {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.CODECLIMATE_URL || 'https://api.codeclimate.com',
      token: config.token || process.env.CODECLIMATE_TOKEN,
      ...config
    };

    this.client = null;
    this.mapper = new CodeClimateMapper();
    
    console.log('🔍 CodeClimate Analyzer initialized');
    console.log(`   📡 Server: ${this.config.baseUrl}`);
  }

  /**
   * Initialize the analyzer and test connection
   */
  async initialize() {
    try {
      this.client = new CodeClimateClient(this.config);
      
      console.log('🔌 Testing CodeClimate connection...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Connection failed: ${connectionTest.error}`);
      }
      
      console.log(`✅ Connected to CodeClimate (User: ${connectionTest.user?.name || 'Unknown'})`);
      return true;
    } catch (error) {
      console.error('❌ CodeClimate initialization failed:', error.message);
      throw new Error(`CodeClimate initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a specific repository by ID or GitHub slug
   */
  async analyzeRepository(repoIdentifier, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    let repoId = repoIdentifier;
    
    // If identifier looks like a GitHub slug, search for the repository
    if (repoIdentifier.includes('/')) {
      console.log(`🔍 Searching for repository: ${repoIdentifier}`);
      const repos = await this.client.searchRepositoriesBySlug(repoIdentifier);
      
      if (!repos.data || repos.data.length === 0) {
        throw new Error(`Repository '${repoIdentifier}' not found in CodeClimate`);
      }
      
      repoId = repos.data[0].id;
      console.log(`📍 Found repository ID: ${repoId}`);
    }

    console.log(`🔍 Analyzing CodeClimate repository: ${repoId}`);

    try {
      // Get comprehensive repository data from CodeClimate
      const codeClimateData = await this.client.analyzeRepository(repoId, options);
      
      // Map to unified data model
      console.log('🔄 Mapping CodeClimate data to unified model...');
      const unifiedData = this.mapper.mapRepositoryAnalysis(codeClimateData);
      
      console.log('✅ CodeClimate analysis complete:');
      console.log(`   📊 Overall Rating: ${unifiedData.project.overallRating}`);
      console.log(`   🏗️  Files: ${unifiedData.files.length}`);
      console.log(`   🐛 Issues: ${unifiedData.issues.length}`);
      console.log(`   🏙️  Districts: ${unifiedData.cityVisualization.districts.length}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ CodeClimate analysis failed for ${repoIdentifier}:`, error.message);
      throw new Error(`CodeClimate analysis failed: ${error.message}`);
    }
  }

  /**
   * Get user's repositories
   */
  async getRepositories(options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const repositories = await this.client.getRepositories(options);
      
      console.log(`🔍 Found ${repositories.data?.length || 0} CodeClimate repositories`);
      
      return {
        repositories: repositories.data || [],
        pagination: repositories.meta || {},
        total: repositories.meta?.total_count || 0
      };
    } catch (error) {
      console.error('❌ Repository search failed:', error.message);
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }

  /**
   * Search for repositories by GitHub slug
   */
  async searchRepositories(githubSlug, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const repositories = await this.client.searchRepositoriesBySlug(githubSlug, options);
      
      console.log(`🔍 Found ${repositories.data?.length || 0} repositories matching '${githubSlug}'`);
      
      return {
        repositories: repositories.data || [],
        pagination: repositories.meta || {},
        total: repositories.meta?.total_count || 0
      };
    } catch (error) {
      console.error('❌ Repository search failed:', error.message);
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }

  /**
   * Get available capabilities of this analyzer
   */
  getCapabilities() {
    return {
      name: 'CodeClimate',
      version: '1.0.0',
      source: 'codeclimate',
      tier: 1,
      priority: 'high', // 2nd after SonarQube
      marketShare: '15.3%', // Estimated based on developer surveys
      
      features: {
        codeQuality: true,
        maintainability: true,
        technicalDebt: true,
        testCoverage: true,
        duplicateCode: true,
        complexityAnalysis: false, // Limited in CodeClimate
        securityAnalysis: true, // Basic security checks
        issueTracking: true,
        temporalAnalysis: true,
        cityVisualization: true
      },
      
      dataTypes: {
        repositoryMetrics: true,
        fileMetrics: false, // Limited file-level data
        issues: true,
        maintainabilityRatings: true,
        testCoverage: true,
        analysisHistory: true,
        technicalDebt: true
      },
      
      integrations: {
        github: true,
        gitlab: false, // CodeClimate primarily GitHub-focused
        bitbucket: false,
        multiRepository: true
      },
      
      cityMapping: {
        buildings: 'files with height based on issue count estimation',
        districts: 'directory structure grouping',
        buildingCondition: 'issue severity and count',
        securityZones: 'security issue density',
        infrastructure: 'maintainability ratings and technical debt'
      }
    };
  }

  /**
   * Check if the analyzer is properly configured
   */
  isConfigured() {
    return !!(this.config.token);
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
        name: 'CODECLIMATE_TOKEN',
        description: 'CodeClimate API token for authentication',
        required: true
      });
    }

    status.requirements.push({
      type: 'environment_variable',
      name: 'CODECLIMATE_URL',
      description: 'CodeClimate API URL (optional, defaults to api.codeclimate.com)',
      required: false,
      default: 'https://api.codeclimate.com'
    });

    return status;
  }

  /**
   * Validate repository exists and is accessible
   */
  async validateRepository(repoIdentifier) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      let repoId = repoIdentifier;
      
      // Handle GitHub slug format
      if (repoIdentifier.includes('/')) {
        const searchResult = await this.client.searchRepositoriesBySlug(repoIdentifier);
        if (!searchResult.data || searchResult.data.length === 0) {
          return {
            valid: false,
            error: `Repository '${repoIdentifier}' not found in CodeClimate`
          };
        }
        repoId = searchResult.data[0].id;
      }
      
      const repository = await this.client.getRepository(repoId);
      
      return {
        valid: true,
        repository: {
          id: repository.data.id,
          name: repository.data.attributes.human_name,
          githubSlug: repository.data.attributes.github_slug,
          rating: repository.data.attributes.rating?.letter || 'unknown',
          lastAnalyzed: repository.data.attributes.last_activity_at
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
    
    // Categorize issues by type and severity
    const issueByType = {};
    const issueBySeverity = {};
    
    issues.forEach(issue => {
      issueByType[issue.type] = (issueByType[issue.type] || 0) + 1;
      issueBySeverity[issue.severity] = (issueBySeverity[issue.severity] || 0) + 1;
    });

    return {
      project: {
        name: unifiedData.project.name,
        githubSlug: unifiedData.project.githubSlug,
        overallRating: unifiedData.project.overallRating
      },
      
      metrics: {
        linesOfCode: metrics.linesOfCode || 0,
        maintainabilityScore: metrics.maintainabilityScore || 0,
        testCoverage: metrics.testCoverage || 0,
        technicalDebtHours: Math.round((metrics.technicalDebtMinutes || 0) / 60),
        duplicationPercentage: metrics.duplicationPercentage || 0
      },
      
      issues: {
        total: issues.length,
        byType: issueByType,
        bySeverity: issueBySeverity
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
    const overallRating = unifiedData.project.overallRating;
    const criticalIssues = unifiedData.issues.filter(i => 
      ['critical', 'high'].includes(i.severity)
    ).length;
    const testCoverage = unifiedData.project.metrics.testCoverage || 0;

    if (overallRating === 'F' || criticalIssues > 50) {
      return 'poor';
    } else if (['D', 'C'].includes(overallRating) || criticalIssues > 10 || testCoverage < 60) {
      return 'fair';
    } else if (overallRating === 'B' || criticalIssues > 2 || testCoverage < 80) {
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
    const overallRating = unifiedData.project.overallRating;

    // Maintainability recommendations
    if (['D', 'F'].includes(overallRating)) {
      recommendations.push({
        priority: 'high',
        category: 'maintainability',
        message: `Maintainability rating is ${overallRating}. Focus on reducing technical debt.`,
        action: 'Address high-priority code quality issues'
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
        category: 'duplication',
        message: `Code duplication is ${metrics.duplicationPercentage}%. Consider refactoring.`,
        action: 'Reduce code duplication'
      });
    }

    // Security recommendations
    const securityIssues = issues.filter(i => i.type === 'security').length;
    if (securityIssues > 0) {
      recommendations.push({
        priority: securityIssues > 5 ? 'high' : 'medium',
        category: 'security',
        message: `Found ${securityIssues} security-related issues.`,
        action: 'Review and fix security issues'
      });
    }

    return recommendations;
  }
}

module.exports = CodeClimateAnalyzer;