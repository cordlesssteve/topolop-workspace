const NPMAuditClient = require('./npm-audit-client');
const NPMAuditMapper = require('./npm-audit-mapper');

/**
 * NPM Audit Analyzer - Topolop Dependency Security Analysis
 *
 * Integrates npm audit dependency vulnerability scanning into Topolop's unified
 * analysis platform. Maps vulnerability data to unified data model for cross-tool
 * correlation and city visualization.
 *
 * Part of the dependency-analyzers suite extending Topolop's 89.6% static analysis
 * coverage to include comprehensive dependency security analysis.
 */
class NPMAuditAnalyzer {
  constructor(config = {}) {
    this.config = {
      npmPath: config.npmPath || 'npm',
      timeout: config.timeout || 120000, // 2 minutes for npm operations
      maxBuffer: config.maxBuffer || 1024 * 1024 * 5, // 5MB buffer
      workingDirectory: config.workingDirectory || process.cwd(),
      includeDevDependencies: config.includeDevDependencies !== false,
      severityThreshold: config.severityThreshold || 'low',
      ...config
    };

    this.client = null;
    this.mapper = new NPMAuditMapper();

    console.log('🔍 NPM Audit Analyzer initialized');
    console.log(`   📦 Working directory: ${this.config.workingDirectory}`);
    console.log(`   ⚡ Timeout: ${this.config.timeout}ms`);
    console.log(`   🔒 Severity threshold: ${this.config.severityThreshold}`);
  }

  /**
   * Initialize the analyzer and test npm availability
   */
  async initialize() {
    try {
      this.client = new NPMAuditClient(this.config);

      console.log('🔌 Testing npm CLI availability...');
      const connectionTest = await this.client.testConnection();

      if (!connectionTest.success) {
        throw new Error(`npm CLI not available: ${connectionTest.error}`);
      }

      console.log(`✅ npm CLI ready: ${connectionTest.version}`);
      console.log(`   📍 Binary path: ${connectionTest.binary}`);

      return {
        success: true,
        version: connectionTest.version,
        tool: 'npm-audit'
      };

    } catch (error) {
      console.error('🚨 NPM Audit Analyzer initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze project dependencies for security vulnerabilities
   *
   * @param {string} projectPath - Path to project directory
   * @param {Object} options - Analysis options
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  async analyzeProject(projectPath = this.config.workingDirectory, options = {}) {
    try {
      console.log(`🔍 Starting npm audit analysis for: ${projectPath}`);

      // Initialize if not already done
      if (!this.client) {
        await this.initialize();
      }

      // Run npm audit analysis
      const auditResult = await this.client.analyzeProject(projectPath, {
        includeDevDependencies: options.includeDevDependencies ?? this.config.includeDevDependencies,
        ...options
      });

      if (!auditResult.success) {
        console.error(`❌ npm audit failed: ${auditResult.error}`);
        return this.mapper.toUnifiedModel(
          { error: auditResult.error },
          projectPath,
          { analysisType: 'project', failed: true }
        );
      }

      console.log('📊 npm audit completed successfully');

      // Log vulnerability summary
      if (auditResult.data && auditResult.data.metadata && auditResult.data.metadata.vulnerabilities) {
        const vulns = auditResult.data.metadata.vulnerabilities;
        console.log(`   📈 Total vulnerabilities: ${vulns.total || 0}`);
        console.log(`   🔴 Critical: ${vulns.critical || 0}`);
        console.log(`   🟠 High: ${vulns.high || 0}`);
        console.log(`   🟡 Medium: ${vulns.moderate || 0}`);
        console.log(`   🟢 Low: ${vulns.low || 0}`);
      }

      // Map to unified model
      const unifiedResult = this.mapper.toUnifiedModel(
        auditResult.data,
        projectPath,
        {
          analysisType: 'project',
          auditMetadata: auditResult.metadata,
          hasLockFile: auditResult.metadata?.hasLockFile
        }
      );

      console.log(`✅ Analysis complete: ${unifiedResult.issues.length} vulnerabilities mapped`);
      return unifiedResult;

    } catch (error) {
      console.error('🚨 NPM audit analysis failed:', error);
      return this.mapper.toUnifiedModel(
        { error: error.message },
        projectPath,
        { analysisType: 'project', failed: true, errorDetails: error.stack }
      );
    }
  }

  /**
   * Analyze a specific package for vulnerabilities
   *
   * @param {string} packageName - Package name to analyze
   * @param {string} version - Package version (optional)
   * @param {Object} options - Analysis options
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  async analyzePackage(packageName, version = 'latest', options = {}) {
    try {
      console.log(`🔍 Starting npm audit analysis for package: ${packageName}@${version}`);

      // Initialize if not already done
      if (!this.client) {
        await this.initialize();
      }

      // Run package analysis
      const auditResult = await this.client.analyzePackage(packageName, version, options);

      if (!auditResult.success) {
        console.error(`❌ Package analysis failed: ${auditResult.error}`);
        return this.mapper.toUnifiedModel(
          { error: auditResult.error },
          process.cwd(),
          {
            analysisType: 'package',
            packageName,
            version,
            failed: true
          }
        );
      }

      console.log('📊 Package audit completed successfully');

      // Map to unified model
      const unifiedResult = this.mapper.toUnifiedModel(
        auditResult.data,
        process.cwd(),
        {
          analysisType: 'package',
          packageName,
          version,
          auditMetadata: auditResult.metadata
        }
      );

      console.log(`✅ Package analysis complete: ${unifiedResult.issues.length} vulnerabilities found`);
      return unifiedResult;

    } catch (error) {
      console.error('🚨 Package audit analysis failed:', error);
      return this.mapper.toUnifiedModel(
        { error: error.message },
        process.cwd(),
        {
          analysisType: 'package',
          packageName,
          version,
          failed: true,
          errorDetails: error.stack
        }
      );
    }
  }

  /**
   * Get analyzer metadata and capabilities
   */
  getInfo() {
    return {
      name: 'npm-audit',
      displayName: 'NPM Audit',
      description: 'NPM dependency vulnerability scanner',
      analysisType: 'dependency_security',
      capabilities: {
        projectAnalysis: true,
        packageAnalysis: true,
        realTimeScanning: false,
        incrementalAnalysis: false
      },
      supportedFileTypes: ['package.json', 'package-lock.json'],
      requiredTools: ['npm'],
      configuration: this.config
    };
  }

  /**
   * Health check for the analyzer
   */
  async healthCheck() {
    try {
      if (!this.client) {
        this.client = new NPMAuditClient(this.config);
      }

      const connectionTest = await this.client.testConnection();

      return {
        healthy: connectionTest.success,
        version: connectionTest.version,
        issues: connectionTest.success ? [] : [connectionTest.error]
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [error.message]
      };
    }
  }
}

module.exports = NPMAuditAnalyzer;