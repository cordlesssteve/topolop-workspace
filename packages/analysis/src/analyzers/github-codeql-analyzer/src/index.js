const CodeQLClient = require('./codeql-client');
const CodeQLMapper = require('./codeql-mapper');

/**
 * GitHub CodeQL Analyzer - Topolop Layer 1 Data Source
 * 
 * Integrates with GitHub CodeQL CLI to perform semantic code analysis.
 * Maps SARIF results to unified Layer 2 data model with city visualization support.
 * 
 * Part of Tier 1 tool integration (4th priority after SonarQube, CodeClimate, and Semgrep) 
 * with advanced semantic analysis capabilities for security and correctness.
 */
class CodeQLAnalyzer {
  constructor(config = {}) {
    this.config = {
      codeqlPath: config.codeqlPath || 'codeql',
      timeout: config.timeout || 600000, // 10 minutes for database creation
      workingDirectory: config.workingDirectory || process.cwd(),
      databasesDirectory: config.databasesDirectory,
      defaultQueries: config.defaultQueries || 'security',
      ...config
    };

    this.client = null;
    this.mapper = new CodeQLMapper();
    
    console.log('🔍 GitHub CodeQL Analyzer initialized');
    console.log(`   🎯 Default queries: ${this.config.defaultQueries}`);
    console.log(`   ⏱️  Timeout: ${this.config.timeout / 1000}s`);
  }

  /**
   * Initialize the analyzer and test CodeQL availability
   */
  async initialize() {
    try {
      this.client = new CodeQLClient(this.config);
      
      console.log('🔌 Testing CodeQL CLI availability...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`CodeQL CLI not available: ${connectionTest.error}`);
      }
      
      console.log(`✅ CodeQL ready: ${connectionTest.version}`);
      return true;
    } catch (error) {
      console.error('❌ CodeQL initialization failed:', error.message);
      throw new Error(`CodeQL initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze a codebase with semantic analysis
   */
  async analyzeCodebase(sourcePath, language, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Analyzing codebase with CodeQL: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}`);

    try {
      // Run full CodeQL analysis workflow
      const codeqlData = await this.client.analyze(sourcePath, language, {
        queries: options.queries || this._getDefaultQueries(language, options.queryType),
        overwriteDatabase: options.overwriteDatabase || false,
        threads: options.threads,
        buildMode: options.buildMode,
        outputFile: options.outputFile
      });
      
      // Map to unified data model
      console.log('🔄 Mapping CodeQL data to unified model...');
      const unifiedData = this.mapper.mapAnalysisResults(codeqlData);
      
      console.log('✅ CodeQL analysis complete:');
      console.log(`   🛡️  Security Score: ${unifiedData.project.metrics.securityScore}/100`);
      console.log(`   📊 Semantic Score: ${unifiedData.project.metrics.semanticScore}/100`);
      console.log(`   🏗️  Files: ${unifiedData.files.length}`);
      console.log(`   🚨 Findings: ${unifiedData.issues.length}`);
      console.log(`   🏙️  Districts: ${unifiedData.cityVisualization.districts.length}`);
      console.log(`   🔄 Data Flow Findings: ${unifiedData.project.metrics.dataFlowFindings}`);

      return unifiedData;
    } catch (error) {
      console.error(`❌ CodeQL analysis failed for ${sourcePath}:`, error.message);
      throw new Error(`CodeQL analysis failed: ${error.message}`);
    }
  }

  /**
   * Run security-focused analysis with security queries
   */
  async securityAnalysis(sourcePath, language, options = {}) {
    return await this.analyzeCodebase(sourcePath, language, {
      ...options,
      queryType: 'security',
      queries: options.queries || this._getSecurityQueries(language)
    });
  }

  /**
   * Run analysis with custom queries
   */
  async analyzeWithCustomQueries(sourcePath, language, queriesPath, options = {}) {
    return await this.analyzeCodebase(sourcePath, language, {
      ...options,
      queries: queriesPath
    });
  }

  /**
   * Get or create CodeQL database only (without running queries)
   */
  async createDatabase(sourcePath, language, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🏗️  Creating CodeQL database: ${sourcePath}`);
    
    try {
      const dbResult = await this.client.createDatabase(sourcePath, language, options);
      
      console.log(`✅ Database ${dbResult.created ? 'created' : 'reused'}: ${dbResult.databasePath}`);
      
      return {
        databasePath: dbResult.databasePath,
        created: dbResult.created,
        reused: dbResult.reused,
        language: language,
        sourcePath: sourcePath
      };
    } catch (error) {
      console.error(`❌ Database creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run queries against existing database
   */
  async queryDatabase(databasePath, queries, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    console.log(`🔍 Querying CodeQL database: ${databasePath}`);
    
    try {
      const analysisResult = await this.client.analyzeDatabase(databasePath, {
        queries: queries,
        outputFile: options.outputFile,
        format: options.format
      });

      // Map results to unified format
      const mockCodeqlData = {
        sourcePath: databasePath,
        language: 'unknown', // Would need to be passed in or detected
        database: { created: false, reused: true },
        analysis: analysisResult,
        metadata: analysisResult.metadata
      };

      const unifiedData = this.mapper.mapAnalysisResults(mockCodeqlData);
      
      console.log(`✅ Query analysis complete: ${unifiedData.issues.length} findings`);
      return unifiedData;
    } catch (error) {
      console.error(`❌ Database query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available capabilities of this analyzer
   */
  getCapabilities() {
    return {
      name: 'GitHub CodeQL',
      version: '1.0.0',
      source: 'github-codeql',
      tier: 1,
      priority: 'high', // 4th after SonarQube, CodeClimate, and Semgrep
      marketShare: '9.5%', // Estimated based on GitHub security adoption

      features: {
        semanticAnalysis: true,      // Core CodeQL capability
        securityAnalysis: true,
        sastScanning: true,
        dataFlowAnalysis: true,      // Advanced data flow tracking
        controlFlowAnalysis: true,   // Control flow analysis
        customQueries: true,
        queryLanguage: true,         // QL query language support
        sarifOutput: true,          // SARIF format support
        multiLanguage: true,
        vulnerabilityDetection: true,
        codeQuality: true,          // Correctness and maintainability
        performanceAnalysis: false, // Limited performance queries
        cityVisualization: true
      },
      
      dataTypes: {
        semanticFindings: true,
        securityVulnerabilities: true,
        dataFlowIssues: true,
        controlFlowIssues: true,
        correctnessIssues: true,
        sarifResults: true,
        databaseCache: true,        // Database caching
        customQueries: true,
        multiLanguageSupport: true
      },
      
      languages: [
        'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp',
        'go', 'ruby', 'swift', 'kotlin', 'scala'
      ],

      integrations: {
        cli: true,
        github: true,              // Native GitHub integration
        githubActions: true,       // GitHub Actions support
        sarif: true,              // SARIF standard compliance
        cicd: true,
        multiRepository: true,
        databaseCaching: true,     // Database reuse capability
        standalone: true
      },
      
      cityMapping: {
        buildings: 'files with height based on semantic findings and complexity',
        districts: 'directory structure with semantic analysis grouping',
        buildingCondition: 'semantic complexity and finding severity',
        securityZones: 'data flow vulnerabilities and security findings',
        infrastructure: 'semantic analysis capabilities and data flows',
        overlays: 'semantic complexity, data flow paths, and vulnerability heat maps',
        dataFlows: 'visualization of data flow paths through codebase'
      },

      queryTypes: {
        security: 'Security vulnerabilities and CWE mappings',
        correctness: 'Logic errors and correctness issues',
        performance: 'Performance anti-patterns (limited)',
        maintainability: 'Code maintainability and style',
        custom: 'User-defined QL queries'
      }
    };
  }

  /**
   * Check if the analyzer is properly configured
   */
  isConfigured() {
    // CodeQL requires CLI installation but no tokens
    return true;
  }

  /**
   * Get configuration status and requirements
   */
  getConfigurationStatus() {
    const status = {
      configured: true,
      requirements: []
    };

    status.requirements.push({
      type: 'binary',
      name: 'codeql',
      description: 'CodeQL CLI tool must be installed and available in PATH',
      required: true,
      installInstructions: 'Download from: https://github.com/github/codeql-cli-binaries/releases'
    });

    status.requirements.push({
      type: 'disk_space',
      name: 'storage',
      description: 'Adequate disk space for CodeQL databases (can be several GB per project)',
      required: true
    });

    status.requirements.push({
      type: 'memory',
      name: 'ram',
      description: 'Sufficient RAM for database creation and analysis (recommended: 8GB+)',
      required: false
    });

    return status;
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.getSupportedLanguages();
    } catch (error) {
      console.error('❌ Failed to get supported languages:', error.message);
      return this.getCapabilities().languages;
    }
  }

  /**
   * Get available queries for a language
   */
  async getAvailableQueries(language) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.getAvailableQueries(language);
    } catch (error) {
      console.error(`❌ Failed to get queries for ${language}:`, error.message);
      return { language, queries: [], total: 0 };
    }
  }

  /**
   * List existing CodeQL databases
   */
  async listDatabases() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.listDatabases();
    } catch (error) {
      console.error('❌ Failed to list databases:', error.message);
      return [];
    }
  }

  /**
   * Clean up old databases
   */
  async cleanupDatabases(maxAge = 7 * 24 * 60 * 60 * 1000) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      return await this.client.cleanupDatabases(maxAge);
    } catch (error) {
      console.error('❌ Database cleanup failed:', error.message);
      return { cleanedCount: 0, totalDatabases: 0 };
    }
  }

  /**
   * Validate target path exists and is analyzable
   */
  async validateTarget(sourcePath) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const validation = await this.client.validateTarget(sourcePath);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error
        };
      }

      return {
        valid: true,
        target: {
          path: sourcePath,
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
   * Validate codebase for CodeQL analysis
   */
  async validateCodebase(sourcePath, language) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      // Check if path exists and language is supported
      const fs = require('fs').promises;
      const stat = await fs.stat(sourcePath);
      const supportedLanguages = await this.getSupportedLanguages();
      
      if (!stat.isDirectory()) {
        return {
          valid: false,
          error: 'CodeQL requires a directory for analysis'
        };
      }
      
      if (!supportedLanguages.includes(language)) {
        return {
          valid: false,
          error: `Language '${language}' not supported. Supported: ${supportedLanguages.join(', ')}`
        };
      }
      
      return {
        valid: true,
        codebase: {
          path: sourcePath,
          language: language,
          type: 'directory',
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

    // CodeQL-specific analysis
    const securityIssues = issues.filter(i => i.type === 'security');
    const dataFlowIssues = issues.filter(i => i.codeqlData?.dataFlow);
    const semanticIssues = issues.filter(i => i.codeqlData?.semanticModel);

    return {
      project: {
        name: unifiedData.project.name,
        path: unifiedData.project.path,
        language: unifiedData.project.language,
        overallRating: unifiedData.project.overallRating
      },
      
      metrics: {
        totalFindings: metrics.totalFindings || 0,
        securityFindings: metrics.securityFindings || 0,
        criticalFindings: metrics.criticalFindings || 0,
        semanticScore: metrics.semanticScore || 0,
        securityScore: metrics.securityScore || 0,
        dataFlowFindings: metrics.dataFlowFindings || 0,
        controlFlowFindings: metrics.controlFlowFindings || 0,
        rulesExecuted: metrics.rulesExecuted || 0
      },
      
      issues: {
        total: issues.length,
        byType: issueByType,
        bySeverity: issueBySeverity,
        semantic: {
          total: semanticIssues.length,
          dataFlow: dataFlowIssues.length,
          security: securityIssues.length
        }
      },
      
      cityVisualization: {
        districts: unifiedData.cityVisualization.districts.length,
        buildings: unifiedData.files.length,
        semanticZones: this._countSemanticZones(unifiedData),
        dataFlows: unifiedData.cityVisualization.infrastructure?.dataFlows?.length || 0,
        overallSemanticComplexity: this._calculateOverallComplexity(unifiedData)
      },
      
      database: {
        path: unifiedData.metadata.databasePath,
        created: unifiedData.temporal.databaseInfo?.created || false,
        reused: unifiedData.temporal.databaseInfo?.reused || false,
        language: unifiedData.temporal.databaseInfo?.language
      },
      
      recommendations: this._generateCodeQLRecommendations(unifiedData)
    };
  }

  /**
   * Count semantic zones in city visualization  
   */
  _countSemanticZones(unifiedData) {
    const zoning = unifiedData.cityVisualization.infrastructure.zoning;
    return {
      complex: zoning.complex?.length || 0,
      security: zoning.security?.length || 0,
      stable: zoning.stable?.length || 0,
      critical: zoning.critical?.length || 0
    };
  }

  /**
   * Calculate overall semantic complexity
   */
  _calculateOverallComplexity(unifiedData) {
    const files = unifiedData.files || [];
    const complexityLevels = files.map(f => f.cityAttributes?.semanticComplexity || 'low');
    
    const complexityScores = { 'very-high': 4, 'high': 3, 'medium': 2, 'low': 1 };
    const averageScore = complexityLevels.reduce((sum, level) => 
      sum + (complexityScores[level] || 1), 0) / complexityLevels.length;
    
    if (averageScore >= 3.5) return 'very-high';
    if (averageScore >= 2.5) return 'high';
    if (averageScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Generate CodeQL-specific recommendations
   */
  _generateCodeQLRecommendations(unifiedData) {
    const recommendations = [];
    const metrics = unifiedData.project.metrics;
    const issues = unifiedData.issues;

    // Critical security issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: `${criticalIssues.length} critical semantic security issues found. These require immediate code review.`,
        action: 'Review data flow paths and fix critical vulnerabilities',
        affectedFiles: [...new Set(criticalIssues.map(i => i.component))]
      });
    }

    // Semantic analysis score
    if (metrics.semanticScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'semantic',
        message: `Semantic analysis score is ${metrics.semanticScore}/100. Code logic may have issues.`,
        action: 'Review correctness findings and improve semantic quality'
      });
    }

    // Data flow issues
    if (metrics.dataFlowFindings > 0) {
      recommendations.push({
        priority: 'high',
        category: 'dataflow',
        message: `${metrics.dataFlowFindings} data flow issues detected. May indicate security vulnerabilities.`,
        action: 'Review data flow paths and implement input validation'
      });
    }

    // Database optimization
    const dbReused = unifiedData.temporal.databaseInfo?.reused;
    if (!dbReused) {
      recommendations.push({
        priority: 'low',
        category: 'performance',
        message: 'CodeQL database was created from scratch. Consider reusing databases for faster analysis.',
        action: 'Implement database caching strategy for repeated analyses'
      });
    }

    return recommendations;
  }

  /**
   * Get default queries based on language and query type
   */
  _getDefaultQueries(language, queryType = 'security') {
    const queryMap = {
      security: {
        'javascript': 'javascript-queries:Security',
        'python': 'python-queries:Security',
        'java': 'java-queries:Security',
        'cpp': 'cpp-queries:Security',
        'csharp': 'csharp-queries:Security',
        'go': 'go-queries:Security',
        'ruby': 'ruby-queries:Security'
      },
      correctness: {
        'javascript': 'javascript-queries:Correctness',
        'python': 'python-queries:Correctness',
        'java': 'java-queries:Correctness',
        'cpp': 'cpp-queries:Correctness'
      }
    };
    
    return queryMap[queryType]?.[language] || `${language}-queries`;
  }

  /**
   * Get security-specific queries for a language
   */
  _getSecurityQueries(language) {
    return this._getDefaultQueries(language, 'security');
  }
}

module.exports = CodeQLAnalyzer;