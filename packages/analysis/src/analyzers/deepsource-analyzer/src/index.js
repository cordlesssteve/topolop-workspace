const DeepSourceClient = require('./deepsource-client');
const DeepSourceMapper = require('./deepsource-mapper');

/**
 * DeepSource Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with DeepSource GraphQL API to fetch AI-powered code analysis results.
 * Maps data to unified Layer 2 data model with city visualization support focused on
 * automated fixes, AI insights, and comprehensive code quality analysis.
 * 
 * Part of Tier 1 tool integration (6th priority - completing Medium Complexity tier)
 * targeting AI-powered analysis and automated code remediation.
 */
class DeepSourceAnalyzer {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.deepsource.io/graphql/',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      defaultBranch: config.defaultBranch || null,
      includeHistoricalData: config.includeHistoricalData !== false,
      ...config
    };

    this.client = null;
    this.mapper = new DeepSourceMapper();
    
    console.log('🤖 DeepSource Analyzer initialized');
    console.log(`   🔗 API URL: ${this.config.apiUrl}`);
    console.log(`   📊 Include historical data: ${this.config.includeHistoricalData}`);
  }

  /**
   * Initialize the analyzer and test DeepSource connection
   */
  async initialize() {
    try {
      this.client = new DeepSourceClient(this.config);
      
      console.log('🔌 Testing DeepSource API connection...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`DeepSource API not available: ${connectionTest.error}`);
      }
      
      console.log(`✅ DeepSource API ready - authenticated as: ${connectionTest.user}`);
      return true;
    } catch (error) {
      console.error('❌ DeepSource initialization failed:', error.message);
      throw new Error(`DeepSource initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a repository by full name (owner/repo)
   */
  async analyzeRepository(repositoryFullName, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Analyzing repository with DeepSource: ${repositoryFullName}`);

    try {
      // Find repository by name
      const searchResult = await this.client.searchRepositories(repositoryFullName.split('/')[1], {
        language: options.language
      });

      const repository = searchResult.repositories.find(repo => 
        repo.fullName.toLowerCase() === repositoryFullName.toLowerCase()
      );

      if (!repository) {
        throw new Error(`Repository not found: ${repositoryFullName}. Make sure it's connected to DeepSource.`);
      }

      console.log(`📁 Repository found: ${repository.fullName} (${repository.language?.name || 'multiple languages'})`);

      // Get comprehensive analysis data
      const analysisOptions = {
        branch: options.branch || this.config.defaultBranch,
        limit: options.limit || 10,
        ...options
      };

      const repositoryData = await this.client.getRepositoryAnalysis(repository.id, analysisOptions);
      
      // Map to unified data model
      console.log('🔄 Mapping DeepSource data to unified model...');
      const unifiedData = this.mapper.mapRepositoryAnalysis(repositoryData, {
        localPath: options.localPath || repositoryFullName,
        apiVersion: '1.0.0'
      });
      
      console.log('✅ DeepSource analysis complete:');
      console.log(`   🎯 Overall Rating: ${unifiedData.project.overallRating}`);
      console.log(`   📊 Quality Score: ${unifiedData.project.metrics.qualityScore}/100`);
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   🚨 Total Issues: ${unifiedData.issues.length}`);
      console.log(`   🤖 AI Autofixable: ${unifiedData.project.metrics.autofixableIssues} (${unifiedData.project.metrics.autofixPercentage}%)`);
      console.log(`   📈 Coverage: ${unifiedData.project.metrics.coverageScore}%`);
      console.log(`   🏙️  Districts: ${unifiedData.cityVisualization.districts.length}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ DeepSource analysis failed for ${repositoryFullName}:`, error.message);
      throw new Error(`DeepSource analysis failed: ${error.message}`);
    }
  }

  /**
   * Get repository list with filtering options
   */
  async getRepositories(filters = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log('📂 Fetching accessible repositories...');

    try {
      const result = await this.client.getRepositories({
        limit: filters.limit || 50,
        cursor: filters.cursor
      });

      console.log(`✅ Found ${result.repositories.length} repositories`);
      
      // Apply client-side filtering if needed
      let filteredRepos = result.repositories;
      
      if (filters.language) {
        filteredRepos = filteredRepos.filter(repo => 
          repo.language?.name?.toLowerCase() === filters.language.toLowerCase()
        );
      }
      
      if (filters.private !== undefined) {
        filteredRepos = filteredRepos.filter(repo => 
          repo.isPrivate === filters.private
        );
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredRepos = filteredRepos.filter(repo =>
          repo.name.toLowerCase().includes(searchTerm) ||
          repo.fullName.toLowerCase().includes(searchTerm) ||
          (repo.description && repo.description.toLowerCase().includes(searchTerm))
        );
      }

      return {
        repositories: filteredRepos,
        totalCount: filteredRepos.length,
        pageInfo: result.pageInfo
      };
    } catch (error) {
      console.error('❌ Failed to fetch repositories:', error.message);
      throw error;
    }
  }

  /**
   * Get specific analysis run details
   */
  async getAnalysisRun(analysisRunId, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Fetching analysis run: ${analysisRunId}`);

    try {
      const analysisRun = await this.client.getAnalysisRun(analysisRunId);
      
      if (options.mapToUnified !== false) {
        // Wrap in repository-like structure for mapper
        const repositoryData = {
          id: analysisRun.repository.id,
          name: analysisRun.repository.name,
          fullName: analysisRun.repository.fullName,
          analysisRuns: {
            edges: [{ node: analysisRun }]
          }
        };
        
        return this.mapper.mapRepositoryAnalysis(repositoryData, {
          localPath: options.localPath || analysisRun.repository.fullName,
          apiVersion: '1.0.0'
        });
      }
      
      return analysisRun;
    } catch (error) {
      console.error(`❌ Failed to fetch analysis run: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get repository metrics and trends
   */
  async getRepositoryMetrics(repositoryFullName, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      // Find repository
      const searchResult = await this.client.searchRepositories(repositoryFullName.split('/')[1]);
      const repository = searchResult.repositories.find(repo => 
        repo.fullName.toLowerCase() === repositoryFullName.toLowerCase()
      );

      if (!repository) {
        throw new Error(`Repository not found: ${repositoryFullName}`);
      }

      // Get metrics with optional historical data
      const metricsData = await this.client.getRepositoryMetrics(repository.id, {
        branch: options.branch || this.config.defaultBranch,
        from: options.from,
        to: options.to
      });

      console.log(`📊 Metrics retrieved for ${repository.fullName}`);
      
      return {
        repository: metricsData.repository,
        currentMetrics: metricsData.currentMetrics,
        historicalData: metricsData.metricsHistory,
        trends: this._calculateTrends(metricsData.metricsHistory)
      };
    } catch (error) {
      console.error(`❌ Failed to fetch repository metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get autofix suggestions for repository
   */
  async getAutofixSuggestions(repositoryFullName, options = {}) {
    console.log(`🤖 Getting AI autofix suggestions for: ${repositoryFullName}`);

    try {
      const analysisData = await this.analyzeRepository(repositoryFullName, options);
      
      const autofixableIssues = analysisData.issues.filter(issue => 
        issue.deepsourceData?.autofix?.available
      );

      const suggestions = autofixableIssues.map(issue => ({
        issueId: issue.id,
        title: issue.title,
        file: issue.file,
        line: issue.line,
        severity: issue.severity,
        autofix: issue.deepsourceData.autofix,
        category: issue.type
      }));

      console.log(`✅ Found ${suggestions.length} AI autofix suggestions`);
      
      return {
        repositoryFullName: repositoryFullName,
        totalIssues: analysisData.issues.length,
        autofixableIssues: suggestions.length,
        autofixPercentage: analysisData.project.metrics.autofixPercentage,
        suggestions: suggestions,
        aiCapabilityRating: analysisData.cityVisualization.cityMetrics.aiCapabilityRating
      };
    } catch (error) {
      console.error(`❌ Failed to get autofix suggestions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run comprehensive analysis with AI insights
   */
  async comprehensiveAnalysis(repositoryFullName, options = {}) {
    console.log(`🔄 Running comprehensive DeepSource analysis for: ${repositoryFullName}`);

    try {
      // Get main analysis
      const mainAnalysis = await this.analyzeRepository(repositoryFullName, options);
      
      // Get metrics trends if requested
      let metricsHistory = null;
      if (this.config.includeHistoricalData && options.includeHistory !== false) {
        try {
          const metricsData = await this.getRepositoryMetrics(repositoryFullName, {
            branch: options.branch,
            from: options.historyFrom,
            to: options.historyTo
          });
          metricsHistory = metricsData;
        } catch (metricsError) {
          console.warn(`⚠️  Historical metrics unavailable: ${metricsError.message}`);
        }
      }

      // Get autofix suggestions
      const autofixSuggestions = await this.getAutofixSuggestions(repositoryFullName, options);

      const comprehensiveResults = {
        timestamp: new Date().toISOString(),
        repository: repositoryFullName,
        analysis: mainAnalysis,
        metrics: metricsHistory,
        autofixSuggestions: autofixSuggestions,
        
        summary: {
          overallRating: mainAnalysis.project.overallRating,
          qualityScore: mainAnalysis.project.metrics.qualityScore,
          securityScore: mainAnalysis.project.metrics.securityScore,
          aiCapabilityRating: mainAnalysis.cityVisualization.cityMetrics.aiCapabilityRating,
          automationLevel: mainAnalysis.cityVisualization.cityMetrics.automationLevel,
          totalIssues: mainAnalysis.issues.length,
          autofixableIssues: autofixSuggestions.autofixableIssues,
          autofixPercentage: autofixSuggestions.autofixPercentage
        }
      };

      console.log(`✅ Comprehensive analysis complete:`);
      console.log(`   🎯 Overall Rating: ${comprehensiveResults.summary.overallRating}`);
      console.log(`   🤖 AI Capability: ${comprehensiveResults.summary.aiCapabilityRating}`);
      console.log(`   ⚡ Automation Level: ${comprehensiveResults.summary.automationLevel}%`);

      return comprehensiveResults;
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
      name: 'DeepSource',
      version: '1.0.0',
      source: 'deepsource',
      tier: 1,
      priority: 'high', // 6th - completing Medium Complexity tier
      marketShare: '7.0%', // Estimated based on AI-powered analysis adoption

      features: {
        aiPoweredAnalysis: true,
        automatedFixes: true,
        codeQualityAnalysis: true,
        securityAnalysis: true,
        staticAnalysis: true,
        coverageAnalysis: true,
        continuousMonitoring: true,
        cicdIntegration: true,
        pullRequestAnalysis: true,
        historicalTrends: true,
        multiLanguageSupport: true,
        cityVisualization: true
      },
      
      dataTypes: {
        codeQuality: true,
        securityIssues: true,
        bugRisk: true,
        performance: true,
        maintainability: true,
        style: true,
        coverage: true,
        autofixSuggestions: true,
        aiRecommendations: true,
        qualityTrends: true,
        metrics: true
      },
      
      languages: [
        'python', 'javascript', 'typescript', 'java', 'go', 'ruby',
        'php', 'scala', 'kotlin', 'swift', 'csharp', 'rust',
        'dart', 'shell', 'dockerfile', 'terraform', 'ansible'
      ],

      integrations: {
        api: true,
        graphql: true,
        github: true,
        gitlab: true,
        bitbucket: true,
        jenkins: true,
        circleci: true,
        githubActions: true,
        ide: true, // VS Code extension
        cli: false, // GraphQL API only
        webhook: true,
        slack: true
      },
      
      cityMapping: {
        buildings: 'files with height based on issue count and AI autofix capability',
        districts: 'analyzers/categories with AI-powered grouping',
        buildingCondition: 'code quality grade and autofix availability',
        aiZones: 'areas with high automation capability and AI recommendations',
        infrastructure: 'overall AI health, automation level, and quality trends',
        overlays: 'autofix heat maps, AI confidence zones, and quality trends'
      },

      aiFeatures: {
        autofixAI: true, // Autofix™ AI with LLM-powered remediation
        patternDetection: true,
        intelligentRecommendations: true,
        confidenceScoring: true,
        iterativeRefinement: true,
        customModels: true, // Bring Your Own Model capability
        lowFalsePositives: true // <5% false positive rate
      },

      compliance: {
        owasp: true,
        cwe: true,
        sans: true,
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
    const token = this.config.token || process.env.DEEPSOURCE_TOKEN;
    return !!token;
  }

  /**
   * Get configuration status and requirements
   */
  getConfigurationStatus() {
    const token = this.config.token || process.env.DEEPSOURCE_TOKEN;
    
    const status = {
      configured: !!token,
      requirements: []
    };

    status.requirements.push({
      type: 'authentication',
      name: 'DEEPSOURCE_TOKEN',
      description: 'DeepSource Personal Access Token for API authentication',
      required: true,
      configured: !!token,
      setupInstructions: 'Generate a PAT at https://deepsource.com/settings/tokens and set DEEPSOURCE_TOKEN environment variable'
    });

    status.requirements.push({
      type: 'repository_access',
      name: 'Repository Connection',
      description: 'Repository must be connected to DeepSource for analysis',
      required: true,
      setupInstructions: 'Connect your repository to DeepSource at https://deepsource.com/setup'
    });

    status.requirements.push({
      type: 'network',
      name: 'API Access',
      description: 'Network access to DeepSource API (api.deepsource.io)',
      required: true
    });

    return status;
  }

  /**
   * Validate repository exists and is accessible
   */
  async validateRepository(repositoryFullName) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const searchResult = await this.client.searchRepositories(repositoryFullName.split('/')[1]);
      const repository = searchResult.repositories.find(repo => 
        repo.fullName.toLowerCase() === repositoryFullName.toLowerCase()
      );

      if (!repository) {
        return {
          valid: false,
          error: `Repository ${repositoryFullName} not found. Make sure it's connected to DeepSource.`
        };
      }

      return {
        valid: true,
        repository: {
          id: repository.id,
          name: repository.name,
          fullName: repository.fullName,
          language: repository.language?.name,
          isPrivate: repository.isPrivate,
          defaultBranch: repository.defaultBranch
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
    const aiData = unifiedData.deepsourceData.aiInsights;
    
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
        repository: unifiedData.project.repository.fullName,
        overallRating: unifiedData.project.overallRating
      },
      
      metrics: {
        qualityScore: metrics.qualityScore || 0,
        securityScore: metrics.securityScore || 0,
        coverageScore: metrics.coverageScore || 0,
        overallScore: metrics.overallScore || 0,
        totalFindings: metrics.totalFindings || 0,
        criticalFindings: metrics.criticalFindings || 0
      },
      
      aiCapabilities: {
        autofixableIssues: metrics.autofixableIssues || 0,
        autofixPercentage: metrics.autofixPercentage || 0,
        aiRecommendations: metrics.aiRecommendations || 0,
        automationLevel: unifiedData.cityVisualization.cityMetrics.automationLevel || 0,
        aiCapabilityRating: unifiedData.cityVisualization.cityMetrics.aiCapabilityRating
      },
      
      issues: {
        total: issues.length,
        byType: issueByType,
        bySeverity: issueBySeverity,
        aiEnhanced: {
          total: issues.filter(i => i.deepsourceData?.autofix?.available).length,
          highConfidence: issues.filter(i => i.deepsourceData?.autofix?.confidence === 'high').length,
          mediumConfidence: issues.filter(i => i.deepsourceData?.autofix?.confidence === 'medium').length
        }
      },
      
      cityVisualization: {
        districts: unifiedData.cityVisualization.districts.length,
        aiEnhancedBuildings: unifiedData.cityVisualization.cityMetrics.aiEnhancedBuildings,
        traditionalBuildings: unifiedData.cityVisualization.cityMetrics.traditionalBuildings,
        overallAIHealth: unifiedData.cityVisualization.infrastructure.ai.overallAIHealth
      },
      
      recommendations: this._generateAIRecommendations(unifiedData)
    };
  }

  /**
   * Calculate trends from historical data
   */
  _calculateTrends(historicalData) {
    if (!historicalData || historicalData.length < 2) {
      return { trend: 'insufficient-data' };
    }

    const recent = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];

    return {
      quality: {
        current: recent.quality?.grade,
        previous: previous.quality?.grade,
        trend: this._compareTrend(recent.quality?.value, previous.quality?.value)
      },
      security: {
        current: recent.security?.grade,
        previous: previous.security?.grade,
        trend: this._compareTrend(recent.security?.value, previous.security?.value)
      },
      coverage: {
        current: recent.coverage?.percentage,
        previous: previous.coverage?.percentage,
        trend: this._compareTrend(recent.coverage?.percentage, previous.coverage?.percentage)
      }
    };
  }

  _compareTrend(current, previous) {
    if (!current || !previous) return 'unknown';
    if (current > previous) return 'improving';
    if (current < previous) return 'declining';
    return 'stable';
  }

  /**
   * Generate AI-focused recommendations
   */
  _generateAIRecommendations(unifiedData) {
    const recommendations = [];
    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;
    const aiData = unifiedData.deepsourceData.aiInsights;

    // High-confidence autofix recommendations
    const highConfidenceAutofixes = issues.filter(i => 
      i.deepsourceData?.autofix?.available && i.deepsourceData?.autofix?.confidence === 'high'
    );
    
    if (highConfidenceAutofixes.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'ai-automation',
        message: `${highConfidenceAutofixes.length} issues can be auto-fixed with high confidence.`,
        action: 'Apply AI-powered automated fixes to improve code quality instantly',
        affectedFiles: [...new Set(highConfidenceAutofixes.map(i => i.file))].slice(0, 5),
        aiCapable: true
      });
    }

    // Quality score recommendations
    if (metrics.qualityScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        message: `Quality score is ${metrics.qualityScore}/100. AI recommendations available.`,
        action: 'Review AI-powered code quality suggestions and apply automated fixes',
        aiCapable: true
      });
    }

    // Security recommendations with AI support
    const securityIssues = issues.filter(i => i.type === 'security');
    if (securityIssues.length > 0) {
      const autofixableSecurityIssues = securityIssues.filter(i => 
        i.deepsourceData?.autofix?.available
      );
      
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: `${securityIssues.length} security issues found (${autofixableSecurityIssues.length} AI-fixable).`,
        action: 'Address security vulnerabilities using AI-powered remediation',
        aiCapable: autofixableSecurityIssues.length > 0
      });
    }

    // Coverage recommendations
    if (metrics.coverageScore < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'coverage',
        message: `Test coverage is ${metrics.coverageScore}%. Consider improving test coverage.`,
        action: 'Use AI insights to identify critical paths needing test coverage'
      });
    }

    // AI capability recommendations
    if (metrics.autofixPercentage < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'ai-adoption',
        message: `Only ${metrics.autofixPercentage}% of issues are AI-fixable. Consider code patterns that enable better automation.`,
        action: 'Refactor code to patterns that AI can more effectively analyze and fix'
      });
    }

    return recommendations;
  }
}

module.exports = DeepSourceAnalyzer;