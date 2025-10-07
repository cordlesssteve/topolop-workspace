const CodacyClient = require('./codacy-client');
const CodacyMapper = require('./codacy-mapper');
const fs = require('fs-extra');
const path = require('path');

/**
 * Codacy Code Quality Analyzer
 * 
 * Code quality analysis integration for Topolop providing comprehensive quality assessment,
 * grade evaluation, and quality trend analysis.
 * 
 * Tier 1 Tool - Final Integration (3.0% market share)
 * Layer 1 Data Source providing unified quality analysis data
 */
class CodacyAnalyzer {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://app.codacy.com/api/v3',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 2500,
      maxIssuesPerRepository: config.maxIssuesPerRepository || 1000,
      maxFilesPerRepository: config.maxFilesPerRepository || 1000,
      includeFileMetrics: config.includeFileMetrics !== false,
      includeCityVisualization: config.includeCityVisualization !== false,
      ...config
    };

    this.client = null;
    this.mapper = null;
  }

  /**
   * Initialize Codacy analyzer with authentication
   */
  async initialize() {
    this.client = new CodacyClient(this.config);
    await this.client.initialize();
    
    this.mapper = new CodacyMapper(this.config);
    
    console.log('✅ Codacy analyzer initialized successfully');
    
    return {
      status: 'initialized',
      authenticated: this.client.authenticated,
      configuration: this.client.getConfigurationStatus()
    };
  }

  /**
   * Test connection and authentication
   */
  async testConnection() {
    if (!this.client) await this.initialize();
    
    try {
      const connectionResult = await this.client.testConnection();
      
      return {
        success: true,
        service: 'codacy',
        user: connectionResult.user,
        authenticated: connectionResult.authenticated,
        configuration: this.client.getConfigurationStatus()
      };
    } catch (error) {
      return {
        success: false,
        service: 'codacy',
        error: error.message,
        authenticated: false
      };
    }
  }

  /**
   * Analyze repository with comprehensive quality assessment
   */
  async analyzeRepository(provider, organization, repository, options = {}) {
    if (!this.client) await this.initialize();
    
    console.log(`🔍 Starting Codacy quality analysis for ${provider}/${organization}/${repository}...`);
    
    try {
      // Get comprehensive repository quality data
      const repositoryQualityData = await this.client.getRepositoryQuality(
        provider, 
        organization, 
        repository,
        {
          branch: options.branch,
          maxIssues: options.maxIssues || this.config.maxIssuesPerRepository,
          maxFiles: options.maxFiles || this.config.maxFilesPerRepository,
          severities: options.severities || ['Error', 'Warning', 'Info'],
          categories: options.categories,
          directory: options.directory,
          ...options
        }
      );

      // Map to Layer 2 unified data model
      const layer2Data = this.mapper.mapToLayer2(repositoryQualityData);
      
      console.log(`✅ Codacy analysis completed for ${provider}/${organization}/${repository}`);
      console.log(`📊 Quality Grade: ${repositoryQualityData.summary.grade}`);
      console.log(`📈 Total Issues: ${repositoryQualityData.summary.totalIssues}`);
      console.log(`📁 Files Analyzed: ${repositoryQualityData.summary.totalFiles}`);
      
      return {
        source: 'codacy',
        analysisType: 'code-quality',
        provider: provider,
        organization: organization,
        repository: repository,
        status: 'completed',
        
        // Raw quality data
        qualityData: repositoryQualityData,
        
        // Unified Layer 2 data
        cityData: layer2Data
      };
    } catch (error) {
      throw new Error(`Codacy repository analysis failed: ${error.message}`);
    }
  }

  /**
   * Get organizations accessible to the user
   */
  async getOrganizations(provider = 'gh') {
    if (!this.client) await this.initialize();
    
    try {
      const organizationsData = await this.client.getOrganizations(provider);
      
      return {
        source: 'codacy',
        provider: provider,
        organizations: organizationsData.organizations,
        totalOrganizations: organizationsData.totalOrganizations
      };
    } catch (error) {
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  /**
   * Get repositories for an organization
   */
  async getRepositories(provider, organization, options = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const repositoriesData = await this.client.getRepositories(provider, organization, options);
      
      return {
        source: 'codacy',
        provider: provider,
        organization: organization,
        repositories: repositoriesData.repositories,
        pagination: repositoriesData.pagination
      };
    } catch (error) {
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  /**
   * Search repositories across organizations
   */
  async searchRepositories(searchTerm, provider = 'gh', options = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const searchResults = await this.client.searchRepositories(searchTerm, provider, options);
      
      return {
        source: 'codacy',
        provider: provider,
        searchTerm: searchTerm,
        repositories: searchResults.repositories,
        totalCount: searchResults.totalCount
      };
    } catch (error) {
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }

  /**
   * Get detailed repository analysis (basic metrics without full quality analysis)
   */
  async getRepositoryAnalysis(provider, organization, repository, options = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const analysis = await this.client.getRepositoryAnalysis(provider, organization, repository, options);
      
      return {
        source: 'codacy',
        provider: provider,
        organization: organization,
        repository: repository,
        analysis: analysis
      };
    } catch (error) {
      throw new Error(`Failed to get repository analysis: ${error.message}`);
    }
  }

  /**
   * Search issues in repository with filtering
   */
  async searchIssues(provider, organization, repository, filters = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const issuesData = await this.client.searchRepositoryIssues(provider, organization, repository, filters);
      
      return {
        source: 'codacy',
        provider: provider,
        organization: organization,
        repository: repository,
        issues: issuesData.issues,
        pagination: issuesData.pagination
      };
    } catch (error) {
      throw new Error(`Failed to search issues: ${error.message}`);
    }
  }

  /**
   * Get file-level quality metrics
   */
  async getFileMetrics(provider, organization, repository, options = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const fileData = await this.client.getFileMetrics(provider, organization, repository, options);
      
      return {
        source: 'codacy',
        provider: provider,
        organization: organization,
        repository: repository,
        files: fileData.files,
        pagination: fileData.pagination
      };
    } catch (error) {
      throw new Error(`Failed to get file metrics: ${error.message}`);
    }
  }

  /**
   * Generate quality report for repository
   */
  async generateQualityReport(provider, organization, repository, options = {}) {
    if (!this.client) await this.initialize();
    
    console.log(`📊 Generating comprehensive quality report for ${provider}/${organization}/${repository}...`);
    
    try {
      // Get full quality analysis
      const analysisResult = await this.analyzeRepository(provider, organization, repository, options);
      const qualityData = analysisResult.qualityData;
      
      // Generate report
      const report = {
        repository: `${provider}/${organization}/${repository}`,
        branch: options.branch || 'default',
        analysisDate: new Date().toISOString(),
        
        // Executive Summary
        executiveSummary: {
          overallGrade: qualityData.summary.grade,
          qualityScore: this.mapper._gradeToScore(qualityData.summary.grade),
          totalIssues: qualityData.summary.totalIssues,
          totalFiles: qualityData.summary.totalFiles,
          
          keyMetrics: {
            complexity: qualityData.analysis?.quality?.complexity || 0,
            coverage: qualityData.analysis?.quality?.coverage || 0,
            duplication: qualityData.analysis?.quality?.duplication || 0
          }
        },
        
        // Quality Breakdown
        qualityBreakdown: {
          issuesBySeverity: {
            errors: qualityData.issues.filter(i => i.level === 'Error').length,
            warnings: qualityData.issues.filter(i => i.level === 'Warning').length,
            info: qualityData.issues.filter(i => i.level === 'Info').length
          },
          
          issuesByCategory: this._categorizeIssues(qualityData.issues),
          
          topIssuePatterns: this._getTopIssuePatterns(qualityData.issues),
          
          qualityHotspots: this._identifyQualityHotspots(qualityData.files)
        },
        
        // Recommendations
        recommendations: analysisResult.cityData.summary.recommendations || [],
        
        // Technical Details
        technicalDetails: {
          analysisConfiguration: options,
          metricsCollected: {
            totalIssuesAnalyzed: qualityData.issues.length,
            totalFilesAnalyzed: qualityData.files.length,
            analysisScope: options.directory || 'full-repository'
          }
        }
      };
      
      console.log(`✅ Quality report generated successfully`);
      console.log(`📈 Overall Grade: ${report.executiveSummary.overallGrade}`);
      console.log(`🔍 Issues Found: ${report.executiveSummary.totalIssues}`);
      
      return {
        source: 'codacy',
        reportType: 'comprehensive-quality',
        report: report
      };
    } catch (error) {
      throw new Error(`Failed to generate quality report: ${error.message}`);
    }
  }

  /**
   * Export analysis results to file
   */
  async exportResults(analysisResult, outputPath, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codacy-analysis-${timestamp}.${format}`;
    const fullPath = path.join(outputPath, filename);

    try {
      if (format === 'json') {
        await fs.writeJson(fullPath, analysisResult, { spaces: 2 });
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        file: fullPath,
        format: format,
        size: (await fs.stat(fullPath)).size
      };
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Get analyzer capabilities
   */
  getCapabilities() {
    return {
      analyzer: 'codacy',
      analysisTypes: ['code-quality', 'grade-assessment', 'issue-analysis'],
      supportedProviders: ['github', 'gitlab', 'bitbucket'],
      
      qualityMetrics: [
        'overall-grade',
        'code-complexity',
        'test-coverage',
        'code-duplication',
        'technical-debt',
        'maintainability-index'
      ],
      
      issueCategories: [
        'Security',
        'CodeStyle', 
        'Performance',
        'Compatibility',
        'Documentation'
      ],
      
      severityLevels: ['Error', 'Warning', 'Info'],
      
      visualizationSupport: {
        cityMetaphor: true,
        qualityOverlays: true,
        gradeVisualization: true,
        trendAnalysis: true
      },
      
      apiCapabilities: {
        rateLimitPerWindow: this.config.rateLimit,
        maxIssuesPerRepository: this.config.maxIssuesPerRepository,
        maxFilesPerRepository: this.config.maxFilesPerRepository,
        paginationSupport: true
      }
    };
  }

  /**
   * Check if analyzer is properly configured
   */
  isConfigured() {
    const apiToken = this.config.apiToken || process.env.CODACY_API_TOKEN;
    return !!apiToken;
  }

  /**
   * Get analyzer status and configuration
   */
  getStatus() {
    return {
      analyzer: 'codacy',
      version: '1.0.0',
      initialized: !!this.client,
      authenticated: this.client?.authenticated || false,
      configured: this.isConfigured(),
      configuration: this.client?.getConfigurationStatus() || {},
      capabilities: this.getCapabilities()
    };
  }

  // Helper methods for report generation
  _categorizeIssues(issues) {
    const categories = {};
    issues.forEach(issue => {
      const category = issue.patternInfo?.category || 'Other';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  _getTopIssuePatterns(issues) {
    const patterns = {};
    issues.forEach(issue => {
      const patternId = issue.patternId;
      if (!patterns[patternId]) {
        patterns[patternId] = {
          patternId: patternId,
          title: issue.patternInfo?.title || 'Unknown Pattern',
          count: 0,
          severity: issue.level
        };
      }
      patterns[patternId].count++;
    });
    
    return Object.values(patterns)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 patterns
  }

  _identifyQualityHotspots(files) {
    if (!files || files.length === 0) return [];
    
    return files
      .filter(file => (file.issues || 0) > 5 || ['D', 'F'].includes(file.grade))
      .sort((a, b) => (b.issues || 0) - (a.issues || 0))
      .slice(0, 10) // Top 10 hotspots
      .map(file => ({
        file: file.path,
        grade: file.grade,
        issues: file.issues || 0,
        complexity: file.complexity || 0,
        recommendation: this._getFileRecommendation(file)
      }));
  }

  _getFileRecommendation(file) {
    if (['D', 'F'].includes(file.grade)) {
      return 'High priority: Requires immediate attention to improve quality';
    }
    if ((file.issues || 0) > 10) {
      return 'Medium priority: Multiple issues need to be addressed';
    }
    if ((file.complexity || 0) > 80) {
      return 'Consider refactoring to reduce complexity';
    }
    return 'Monitor for quality trends';
  }
}

module.exports = CodacyAnalyzer;