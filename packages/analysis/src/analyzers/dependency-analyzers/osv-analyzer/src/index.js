const OSVClient = require('./osv-client');
const OSVMapper = require('./osv-mapper');

/**
 * OSV-Scanner Analyzer - Topolop Multi-Ecosystem Dependency Security Analysis
 *
 * Integrates OSV-Scanner for comprehensive vulnerability detection across multiple
 * package ecosystems (npm, PyPI, Go, Rust, Maven, etc.). Maps vulnerability data
 * to Topolop's unified data model for cross-tool correlation and city visualization.
 *
 * OSV-Scanner uses the Open Source Vulnerabilities database, providing broad
 * ecosystem coverage and up-to-date vulnerability information.
 */
class OSVAnalyzer {
  constructor(config = {}) {
    this.config = {
      osvPath: config.osvPath || this._getDefaultOSVPath(),
      timeout: config.timeout || 300000, // 5 minutes for comprehensive scanning
      maxBuffer: config.maxBuffer || 1024 * 1024 * 10, // 10MB buffer
      workingDirectory: config.workingDirectory || process.cwd(),
      recursive: config.recursive !== false, // Enable recursive scanning by default
      supportedEcosystems: config.supportedEcosystems || [
        'npm', 'pypi', 'cargo', 'go', 'maven', 'nuget', 'composer', 'rubygems'
      ],
      ...config
    };

    this.client = null;
    this.mapper = new OSVMapper();

    console.log('🔍 OSV-Scanner Analyzer initialized');
    console.log(`   🛡️  Multi-ecosystem vulnerability scanning`);
    console.log(`   📦 Supported ecosystems: ${this.config.supportedEcosystems.join(', ')}`);
    console.log(`   ⚡ Timeout: ${this.config.timeout}ms`);
  }

  /**
   * Get default OSV-Scanner path
   */
  _getDefaultOSVPath() {
    const path = require('path');
    const fs = require('fs-extra');

    const commonPaths = [
      'osv-scanner',
      path.join(process.env.HOME || '', 'scripts', 'osv-scanner'),
      path.join(process.env.HOME || '', 'bin', 'osv-scanner'),
      '/usr/local/bin/osv-scanner'
    ];

    for (const osvPath of commonPaths) {
      try {
        if (fs.existsSync(osvPath)) {
          return osvPath;
        }
      } catch (error) {
        // Continue checking
      }
    }

    return 'osv-scanner'; // Default
  }

  /**
   * Initialize the analyzer and test OSV-Scanner availability
   */
  async initialize() {
    try {
      this.client = new OSVClient(this.config);

      console.log('🔌 Testing OSV-Scanner availability...');
      const connectionTest = await this.client.testConnection();

      if (!connectionTest.success) {
        throw new Error(`OSV-Scanner not available: ${connectionTest.error}`);
      }

      console.log(`✅ OSV-Scanner ready: ${connectionTest.version}`);
      console.log(`   📍 Binary path: ${connectionTest.binary}`);

      return {
        success: true,
        version: connectionTest.version,
        tool: 'osv-scanner'
      };

    } catch (error) {
      console.error('🚨 OSV-Scanner Analyzer initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze project for vulnerabilities across all supported ecosystems
   *
   * @param {string} projectPath - Path to project directory
   * @param {Object} options - Analysis options
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  async analyzeProject(projectPath = this.config.workingDirectory, options = {}) {
    try {
      console.log(`🔍 Starting OSV-Scanner analysis for: ${projectPath}`);

      // Initialize if not already done
      if (!this.client) {
        await this.initialize();
      }

      // Run OSV-Scanner analysis
      const scanResult = await this.client.analyzeProject(projectPath, {
        recursive: options.recursive ?? this.config.recursive,
        ...options
      });

      if (!scanResult.success) {
        console.error(`❌ OSV-Scanner failed: ${scanResult.error}`);
        return this.mapper.toUnifiedModel(
          { error: scanResult.error },
          projectPath,
          { analysisType: 'project', failed: true }
        );
      }

      console.log('📊 OSV-Scanner completed successfully');

      // Log vulnerability summary
      if (scanResult.data && scanResult.data.results) {
        const results = scanResult.data.results;
        let totalVulns = 0;

        results.forEach(result => {
          if (result.packages) {
            result.packages.forEach(pkg => {
              if (pkg.vulnerabilities) {
                totalVulns += pkg.vulnerabilities.length;
              }
            });
          }
        });

        console.log(`   📈 Total vulnerabilities found: ${totalVulns}`);
        console.log(`   📁 Sources scanned: ${results.length}`);

        // Log ecosystem breakdown
        const ecosystems = new Set();
        results.forEach(result => {
          if (result.packages) {
            result.packages.forEach(pkg => {
              if (pkg.package && pkg.package.ecosystem) {
                ecosystems.add(pkg.package.ecosystem);
              }
            });
          }
        });

        if (ecosystems.size > 0) {
          console.log(`   🌐 Ecosystems detected: ${Array.from(ecosystems).join(', ')}`);
        }
      }

      // Map to unified model
      const unifiedResult = this.mapper.toUnifiedModel(
        scanResult.data,
        projectPath,
        {
          analysisType: 'project',
          scanMetadata: scanResult.metadata,
          lockfilesFound: scanResult.metadata?.lockfilesFound || []
        }
      );

      console.log(`✅ Analysis complete: ${unifiedResult.issues.length} vulnerabilities mapped`);
      return unifiedResult;

    } catch (error) {
      console.error('🚨 OSV-Scanner analysis failed:', error);
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
   * @param {string} packageManager - Package manager/ecosystem
   * @param {string} version - Package version (optional)
   * @param {Object} options - Analysis options
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  async analyzePackage(packageName, packageManager = 'npm', version = 'latest', options = {}) {
    try {
      console.log(`🔍 Starting OSV-Scanner analysis for: ${packageName}@${version} (${packageManager})`);

      // Validate ecosystem support
      if (!this.config.supportedEcosystems.includes(packageManager.toLowerCase())) {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      }

      // Initialize if not already done
      if (!this.client) {
        await this.initialize();
      }

      // Run package analysis
      const scanResult = await this.client.analyzePackage(packageName, packageManager, version, options);

      if (!scanResult.success) {
        console.error(`❌ Package analysis failed: ${scanResult.error}`);
        return this.mapper.toUnifiedModel(
          { error: scanResult.error },
          process.cwd(),
          {
            analysisType: 'package',
            packageName,
            packageManager,
            version,
            failed: true
          }
        );
      }

      console.log('📊 Package analysis completed successfully');

      // Map to unified model
      const unifiedResult = this.mapper.toUnifiedModel(
        scanResult.data,
        process.cwd(),
        {
          analysisType: 'package',
          packageName,
          packageManager,
          version,
          scanMetadata: scanResult.metadata
        }
      );

      console.log(`✅ Package analysis complete: ${unifiedResult.issues.length} vulnerabilities found`);
      return unifiedResult;

    } catch (error) {
      console.error('🚨 Package analysis failed:', error);
      return this.mapper.toUnifiedModel(
        { error: error.message },
        process.cwd(),
        {
          analysisType: 'package',
          packageName,
          packageManager,
          version,
          failed: true,
          errorDetails: error.stack
        }
      );
    }
  }

  /**
   * Get supported package ecosystems
   */
  getSupportedEcosystems() {
    return this.config.supportedEcosystems;
  }

  /**
   * Get analyzer metadata and capabilities
   */
  getInfo() {
    return {
      name: 'osv-scanner',
      displayName: 'OSV-Scanner',
      description: 'Multi-ecosystem vulnerability scanner using Open Source Vulnerabilities database',
      analysisType: 'dependency_security',
      capabilities: {
        projectAnalysis: true,
        packageAnalysis: true,
        multiEcosystem: true,
        realTimeScanning: false,
        incrementalAnalysis: false,
        recursiveScanning: true
      },
      supportedEcosystems: this.config.supportedEcosystems,
      supportedFileTypes: [
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        'Pipfile.lock', 'poetry.lock', 'requirements.txt',
        'Cargo.lock', 'Cargo.toml', 'go.mod', 'go.sum',
        'composer.lock', 'Gemfile.lock'
      ],
      requiredTools: ['osv-scanner'],
      configuration: this.config
    };
  }

  /**
   * Health check for the analyzer
   */
  async healthCheck() {
    try {
      if (!this.client) {
        this.client = new OSVClient(this.config);
      }

      const connectionTest = await this.client.testConnection();

      return {
        healthy: connectionTest.success,
        version: connectionTest.version,
        binary: connectionTest.binary,
        supportedEcosystems: this.config.supportedEcosystems.length,
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

module.exports = OSVAnalyzer;