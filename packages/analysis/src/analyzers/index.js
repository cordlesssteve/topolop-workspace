/**
 * Topolop Layer 1: Data Sources - Main Entry Point
 *
 * Unified access to all Layer 1 data collection components:
 * - AST Analysis
 * - Git History Analysis
 * - Formal Methods Analysis
 * - Runtime Profiling
 * - SonarQube Analysis (Tier 1 Priority)
 * - CodeClimate Analysis (Tier 1 Priority)
 * - Semgrep Analysis (Tier 1 Priority)
 * - GitHub CodeQL Analysis (Tier 1 Priority)
 * - DeepSource Analysis (Tier 1 Priority)
 * - Veracode Analysis (Tier 1 Priority)
 * - Checkmarx Analysis (Tier 1 Priority)
 * - Codacy Analysis (Tier 1 Priority)
 * - Dependency Security Analysis (NEW: 6 tools)
 *   - NPM Audit (Node.js dependencies)
 *   - OSV Scanner (Multi-ecosystem vulnerabilities)
 *   - Packj (Python package security)
 *   - Pip-Audit (Python dependencies)
 *   - Safety (Python vulnerability database)
 *   - RetireJS (JavaScript library vulnerabilities)
 */

const { ASTAnalyzer } = require('./ast-analyzer/src/index');
const { GitAnalyzer } = require('./git-analyzer/src/index');
const FormalMethodsHub = require('./formal-methods-adapters/index');
const { RuntimeProfilingHub } = require('./runtime-profiling/index');
const SonarQubeAnalyzer = require('./sonarqube-analyzer/src/index');
const CodeClimateAnalyzer = require('./codeclimate-analyzer/src/index');
const SemgrepAnalyzer = require('./semgrep-analyzer/src/index');
const CodeQLAnalyzer = require('./github-codeql-analyzer/src/index');
const DeepSourceAnalyzer = require('./deepsource-analyzer/src/index');
const VeracodeAnalyzer = require('./veracode-analyzer/src/index');
const CheckmarxAnalyzer = require('./checkmarx-analyzer/src/index');
const CodacyAnalyzer = require('./codacy-analyzer/src/index');

// Dependency Security Analyzers (NEW)
const NPMAuditAnalyzer = require('./dependency-analyzers/npm-audit-analyzer/src/index');
const OSVAnalyzer = require('./dependency-analyzers/osv-analyzer/src/index');
const PackjAnalyzer = require('./dependency-analyzers/packj-analyzer/src/index');
const PipAuditAnalyzer = require('./dependency-analyzers/pip-audit-analyzer/src/index');
const SafetyAnalyzer = require('./dependency-analyzers/safety-analyzer/src/index');
const RetireJSAnalyzer = require('./dependency-analyzers/retirejs-analyzer/src/index');

class Layer1DataSources {
  constructor(options = {}) {
    this.astAnalyzer = new ASTAnalyzer();
    this.gitAnalyzer = null; // Created per repository
    this.formalMethodsHub = new FormalMethodsHub();
    this.runtimeProfilingHub = new RuntimeProfilingHub();
    
    // SonarQube analyzer (Tier 1 priority) - initialized with config
    this.sonarQubeAnalyzer = options.sonarQube !== false ? new SonarQubeAnalyzer(options.sonarQube || {}) : null;
    
    // CodeClimate analyzer (Tier 1 priority) - initialized with config
    this.codeClimateAnalyzer = options.codeClimate !== false ? new CodeClimateAnalyzer(options.codeClimate || {}) : null;
    
    // Semgrep analyzer (Tier 1 priority) - initialized with config
    this.semgrepAnalyzer = options.semgrep !== false ? new SemgrepAnalyzer(options.semgrep || {}) : null;
    
    // GitHub CodeQL analyzer (Tier 1 priority) - initialized with config
    this.codeqlAnalyzer = options.codeql !== false ? new CodeQLAnalyzer(options.codeql || {}) : null;
    
    
    // DeepSource analyzer (Tier 1 priority) - initialized with config
    this.deepSourceAnalyzer = options.deepSource !== false ? new DeepSourceAnalyzer(options.deepSource || {}) : null;
    
    // Veracode analyzer (Tier 1 priority) - initialized with config
    this.veracodeAnalyzer = options.veracode !== false ? new VeracodeAnalyzer(options.veracode || {}) : null;
    
    // Checkmarx analyzer (Tier 1 priority) - initialized with config
    this.checkmarxAnalyzer = options.checkmarx !== false ? new CheckmarxAnalyzer(options.checkmarx || {}) : null;
    
    // Codacy analyzer (Tier 1 priority) - initialized with config
    this.codacyAnalyzer = options.codacy !== false ? new CodacyAnalyzer(options.codacy || {}) : null;

    // Dependency Security Analyzers (NEW) - initialized with config
    this.npmAuditAnalyzer = options.npmAudit !== false ? new NPMAuditAnalyzer(options.npmAudit || {}) : null;
    this.osvAnalyzer = options.osv !== false ? new OSVAnalyzer(options.osv || {}) : null;
    this.packjAnalyzer = options.packj !== false ? new PackjAnalyzer(options.packj || {}) : null;
    this.pipAuditAnalyzer = options.pipAudit !== false ? new PipAuditAnalyzer(options.pipAudit || {}) : null;
    this.safetyAnalyzer = options.safety !== false ? new SafetyAnalyzer(options.safety || {}) : null;
    this.retireJSAnalyzer = options.retireJS !== false ? new RetireJSAnalyzer(options.retireJS || {}) : null;
  }

  /**
   * Initialize analyzers for a specific codebase
   */
  async initialize(codebasePath) {
    this.codebasePath = codebasePath;
    this.gitAnalyzer = new GitAnalyzer(codebasePath);
    
    console.log('🔍 Layer 1: Initializing data sources...');
    console.log(`📁 Codebase: ${codebasePath}`);
  }

  /**
   * Collect all available data from Layer 1 sources
   */
  async collectAllData(options = {}) {
    if (!this.codebasePath) {
      throw new Error('Must initialize with codebase path first');
    }

    const data = {
      git: null,
      ast: null,
      formalMethods: null,
      runtime: null,
      sonarQube: null, // SonarQube analysis data
      codeClimate: null, // CodeClimate analysis data
      semgrep: null, // Semgrep security analysis data
      codeql: null, // GitHub CodeQL semantic analysis data
      deepSource: null, // DeepSource AI-powered analysis data
      veracode: null, // Veracode enterprise security analysis data
      checkmarx: null, // Checkmarx comprehensive SAST analysis data
      codacy: null, // Codacy code quality analysis data
      // Dependency Security Analysis (NEW)
      npmAudit: null, // NPM Audit dependency vulnerabilities
      osv: null, // OSV Scanner multi-ecosystem vulnerabilities
      packj: null, // Packj Python package security
      pipAudit: null, // Pip-Audit Python dependencies
      safety: null, // Safety Python vulnerability database
      retireJS: null, // RetireJS JavaScript library vulnerabilities
      metadata: {
        timestamp: new Date().toISOString(),
        codebasePath: this.codebasePath,
        options: options
      }
    };

    console.log('🚀 Layer 1: Starting comprehensive data collection...');

    // Collect Git data (always available)
    try {
      console.log('📜 Collecting Git history data...');
      data.git = await this.gitAnalyzer.analyze(options.git || {});
    } catch (error) {
      console.warn('⚠️  Git analysis failed:', error.message);
    }

    // Collect AST data
    try {
      console.log('🌳 Collecting AST structure data...');
      data.ast = await this.astAnalyzer.analyzeDirectory(this.codebasePath, options.ast || {});
    } catch (error) {
      console.warn('⚠️  AST analysis failed:', error.message);
    }

    // Collect Formal Methods data (security, quality)
    try {
      console.log('🛡️  Collecting formal methods data...');
      data.formalMethods = await this.formalMethodsHub.analyzeAll(this.codebasePath, options.formalMethods || {});
    } catch (error) {
      console.warn('⚠️  Formal methods analysis failed:', error.message);
    }

    // Collect Runtime data (if enabled and available)
    if (options.runtime !== false) {
      try {
        console.log('⚡ Collecting runtime profiling data...');
        const availableTools = await this.runtimeProfilingHub.getAvailableTools();
        
        if (availableTools.perf) {
          data.runtime = await this.runtimeProfilingHub.collectRuntimeData(this.codebasePath, options.runtime || {});
        } else {
          console.warn('⚠️  No runtime profiling tools available (perf not found)');
        }
      } catch (error) {
        console.warn('⚠️  Runtime profiling failed:', error.message);
      }
    }

    // Collect SonarQube data (Tier 1 priority - if configured and project specified)
    if (this.sonarQubeAnalyzer && options.sonarQube !== false && options.sonarQube?.projectKey) {
      try {
        console.log('🔍 Collecting SonarQube analysis data...');
        data.sonarQube = await this.sonarQubeAnalyzer.analyzeProject(
          options.sonarQube.projectKey, 
          options.sonarQube.options || {}
        );
      } catch (error) {
        console.warn('⚠️  SonarQube analysis failed:', error.message);
        console.warn('   💡 Ensure SONARQUBE_TOKEN and project key are correct');
      }
    } else if (this.sonarQubeAnalyzer && options.sonarQube !== false) {
      console.warn('⚠️  SonarQube analysis skipped: no projectKey specified');
    }

    // Collect CodeClimate data (Tier 1 priority - if configured and repository specified)
    if (this.codeClimateAnalyzer && options.codeClimate !== false && options.codeClimate?.repository) {
      try {
        console.log('🔍 Collecting CodeClimate analysis data...');
        data.codeClimate = await this.codeClimateAnalyzer.analyzeRepository(
          options.codeClimate.repository,
          options.codeClimate.options || {}
        );
      } catch (error) {
        console.warn('⚠️  CodeClimate analysis failed:', error.message);
        console.warn('   💡 Ensure CODECLIMATE_TOKEN and repository are correct');
      }
    } else if (this.codeClimateAnalyzer && options.codeClimate !== false) {
      console.warn('⚠️  CodeClimate analysis skipped: no repository specified');
    }

    // Collect Semgrep data (Tier 1 priority - if configured and target specified)
    if (this.semgrepAnalyzer && options.semgrep !== false && (options.semgrep?.target || this.codebasePath)) {
      try {
        console.log('🛡️  Collecting Semgrep security analysis data...');
        const target = options.semgrep?.target || this.codebasePath;
        data.semgrep = await this.semgrepAnalyzer.analyzeTarget(
          target,
          options.semgrep?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  Semgrep analysis failed:', error.message);
        console.warn('   💡 Ensure Semgrep CLI is installed and target path is valid');
      }
    } else if (this.semgrepAnalyzer && options.semgrep !== false) {
      console.warn('⚠️  Semgrep analysis will use codebase path as target');
    }

    // Collect GitHub CodeQL data (Tier 1 priority - if configured and codebase specified)
    if (this.codeqlAnalyzer && options.codeql !== false && (options.codeql?.language)) {
      try {
        console.log('🔍 Collecting GitHub CodeQL semantic analysis data...');
        const sourcePath = options.codeql?.sourcePath || this.codebasePath;
        const language = options.codeql.language;
        data.codeql = await this.codeqlAnalyzer.analyzeCodebase(
          sourcePath,
          language,
          options.codeql?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  GitHub CodeQL analysis failed:', error.message);
        console.warn('   💡 Ensure CodeQL CLI is installed and language is supported');
      }
    } else if (this.codeqlAnalyzer && options.codeql !== false) {
      console.warn('⚠️  GitHub CodeQL analysis skipped: no language specified');
    }


    // Collect DeepSource AI-powered analysis data (Tier 1 priority - if configured and repository specified)
    if (this.deepSourceAnalyzer && options.deepSource !== false && options.deepSource?.repositoryId) {
      try {
        console.log('🤖 Collecting DeepSource AI-powered analysis data...');
        const repositoryId = options.deepSource.repositoryId;
        data.deepSource = await this.deepSourceAnalyzer.analyzeRepository(
          repositoryId,
          options.deepSource?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  DeepSource analysis failed:', error.message);
        console.warn('   💡 Ensure DEEPSOURCE_TOKEN and repository ID are correct');
      }
    } else if (this.deepSourceAnalyzer && options.deepSource !== false) {
      console.warn('⚠️  DeepSource analysis skipped: no repositoryId specified');
    }

    // Collect Veracode enterprise security analysis data (Tier 1 priority - if configured and application specified)
    if (this.veracodeAnalyzer && options.veracode !== false && options.veracode?.applicationId) {
      try {
        console.log('🛡️  Collecting Veracode enterprise security analysis data...');
        const applicationId = options.veracode.applicationId;
        data.veracode = await this.veracodeAnalyzer.analyzeApplication(
          applicationId,
          options.veracode?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  Veracode analysis failed:', error.message);
        console.warn('   💡 Ensure VERACODE_API_ID, VERACODE_API_KEY and application ID are correct');
      }
    } else if (this.veracodeAnalyzer && options.veracode !== false) {
      console.warn('⚠️  Veracode analysis skipped: no applicationId specified');
    }

    // Collect Checkmarx comprehensive SAST analysis data (Tier 1 priority - if configured and project specified)
    if (this.checkmarxAnalyzer && options.checkmarx !== false && options.checkmarx?.projectId) {
      try {
        console.log('🛡️  Collecting Checkmarx comprehensive SAST analysis data...');
        const projectId = options.checkmarx.projectId;
        data.checkmarx = await this.checkmarxAnalyzer.analyzeProject(
          projectId,
          options.checkmarx?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  Checkmarx analysis failed:', error.message);
        console.warn('   💡 Ensure CHECKMARX_USERNAME, CHECKMARX_PASSWORD and project ID are correct');
      }
    } else if (this.checkmarxAnalyzer && options.checkmarx !== false) {
      console.warn('⚠️  Checkmarx analysis skipped: no projectId specified');
    }

    // Collect Codacy code quality analysis data (Tier 1 priority - if configured and repository specified)
    if (this.codacyAnalyzer && options.codacy !== false && options.codacy?.provider && options.codacy?.organization && options.codacy?.repository) {
      try {
        console.log('🎯 Collecting Codacy code quality analysis data...');
        const { provider, organization, repository } = options.codacy;
        data.codacy = await this.codacyAnalyzer.analyzeRepository(
          provider,
          organization,
          repository,
          options.codacy?.options || {}
        );
      } catch (error) {
        console.warn('⚠️  Codacy analysis failed:', error.message);
        console.warn('   💡 Ensure CODACY_API_TOKEN and repository coordinates are correct');
      }
    } else if (this.codacyAnalyzer && options.codacy !== false) {
      console.warn('⚠️  Codacy analysis skipped: no provider/organization/repository specified');
    }

    console.log('✅ Layer 1: Data collection completed');
    this._printCollectionSummary(data);

    return data;
  }

  /**
   * Collect specific data type only
   */
  async collectGitData(options = {}) {
    if (!this.gitAnalyzer) {
      throw new Error('Must initialize with codebase path first');
    }
    return await this.gitAnalyzer.analyze(options);
  }

  async collectASTData(options = {}) {
    return await this.astAnalyzer.analyzeDirectory(this.codebasePath, options);
  }

  async collectFormalMethodsData(options = {}) {
    return await this.formalMethodsHub.analyzeAll(this.codebasePath, options);
  }

  async collectRuntimeData(options = {}) {
    return await this.runtimeProfilingHub.collectRuntimeData(this.codebasePath, options);
  }

  async collectSonarQubeData(projectKey, options = {}) {
    if (!this.sonarQubeAnalyzer) {
      throw new Error('SonarQube analyzer not initialized');
    }
    return await this.sonarQubeAnalyzer.analyzeProject(projectKey, options);
  }

  async collectCodeClimateData(repository, options = {}) {
    if (!this.codeClimateAnalyzer) {
      throw new Error('CodeClimate analyzer not initialized');
    }
    return await this.codeClimateAnalyzer.analyzeRepository(repository, options);
  }

  async collectSemgrepData(target, options = {}) {
    if (!this.semgrepAnalyzer) {
      throw new Error('Semgrep analyzer not initialized');
    }
    return await this.semgrepAnalyzer.analyzeTarget(target, options);
  }

  async collectCodeQLData(sourcePath, language, options = {}) {
    if (!this.codeqlAnalyzer) {
      throw new Error('GitHub CodeQL analyzer not initialized');
    }
    return await this.codeqlAnalyzer.analyzeCodebase(sourcePath, language, options);
  }


  async collectDeepSourceData(repositoryId, options = {}) {
    if (!this.deepSourceAnalyzer) {
      throw new Error('DeepSource analyzer not initialized');
    }
    return await this.deepSourceAnalyzer.analyzeRepository(repositoryId, options);
  }

  async collectVeracodeData(applicationId, options = {}) {
    if (!this.veracodeAnalyzer) {
      throw new Error('Veracode analyzer not initialized');
    }
    return await this.veracodeAnalyzer.analyzeApplication(applicationId, options);
  }

  async collectCheckmarxData(projectId, options = {}) {
    if (!this.checkmarxAnalyzer) {
      throw new Error('Checkmarx analyzer not initialized');
    }
    return await this.checkmarxAnalyzer.analyzeProject(projectId, options);
  }

  async collectCodacyData(provider, organization, repository, options = {}) {
    if (!this.codacyAnalyzer) {
      throw new Error('Codacy analyzer not initialized');
    }
    return await this.codacyAnalyzer.analyzeRepository(provider, organization, repository, options);
  }

  /**
   * Get capabilities of all data sources
   */
  async getCapabilities() {
    const capabilities = {
      git: {
        available: true,
        features: ['commit history', 'file evolution', 'author analysis', 'hotspot detection']
      },
      ast: {
        available: true,
        languages: ['python', 'java', 'javascript', 'typescript'],
        features: ['structure extraction', 'complexity metrics', 'dependency analysis']
      },
      formalMethods: {
        available: true,
        languages: this.formalMethodsHub.supportedLanguages,
        tools: this.formalMethodsHub.supportedTools
      },
      runtime: {
        ...(await this.runtimeProfilingHub.getCapabilities()),
        available: await this.runtimeProfilingHub.getAvailableTools()
      }
    };

    // Add SonarQube capabilities if available
    if (this.sonarQubeAnalyzer) {
      capabilities.sonarQube = {
        ...this.sonarQubeAnalyzer.getCapabilities(),
        available: this.sonarQubeAnalyzer.isConfigured(),
        configured: this.sonarQubeAnalyzer.isConfigured()
      };
    }

    // Add CodeClimate capabilities if available
    if (this.codeClimateAnalyzer) {
      capabilities.codeClimate = {
        ...this.codeClimateAnalyzer.getCapabilities(),
        available: this.codeClimateAnalyzer.isConfigured(),
        configured: this.codeClimateAnalyzer.isConfigured()
      };
    }

    // Add Semgrep capabilities if available
    if (this.semgrepAnalyzer) {
      capabilities.semgrep = {
        ...this.semgrepAnalyzer.getCapabilities(),
        available: this.semgrepAnalyzer.isConfigured(),
        configured: this.semgrepAnalyzer.isConfigured()
      };
    }

    // Add GitHub CodeQL capabilities if available
    if (this.codeqlAnalyzer) {
      capabilities.codeql = {
        ...this.codeqlAnalyzer.getCapabilities(),
        available: this.codeqlAnalyzer.isConfigured(),
        configured: this.codeqlAnalyzer.isConfigured()
      };
    }


    // Add DeepSource capabilities if available
    if (this.deepSourceAnalyzer) {
      capabilities.deepSource = {
        ...this.deepSourceAnalyzer.getCapabilities(),
        available: this.deepSourceAnalyzer.client.authenticated,
        configured: this.deepSourceAnalyzer.client.authenticated
      };
    }

    // Add Veracode capabilities if available
    if (this.veracodeAnalyzer) {
      capabilities.veracode = {
        ...this.veracodeAnalyzer.getCapabilities(),
        available: this.veracodeAnalyzer.initialized,
        configured: this.veracodeAnalyzer.isConfigured()
      };
    }

    // Add Checkmarx capabilities if available
    if (this.checkmarxAnalyzer) {
      capabilities.checkmarx = {
        available: !!this.checkmarxAnalyzer,
        configured: !!this.checkmarxAnalyzer,
        features: [
          'comprehensive SAST analysis',
          'data flow analysis', 
          'taint tracking',
          'vulnerability correlation',
          'proprietary format parsing',
          'enterprise security assessment'
        ],
        scanTypes: ['full', 'incremental'],
        languages: ['Java', 'C#', 'JavaScript', 'TypeScript', 'Python', 'C++', 'Go', 'PHP', 'etc'],
        vulnerabilityTypes: ['XSS', 'SQL Injection', 'Path Traversal', 'Command Injection', 'etc'],
        analysisCapabilities: [
          'Static Application Security Testing (SAST)',
          'Data Flow Path Analysis',
          'Taint Analysis',
          'Code Quality Assessment',
          'Enterprise Policy Compliance',
          'Custom Rule Support'
        ]
      };
    }

    // Add Codacy capabilities if available
    if (this.codacyAnalyzer) {
      capabilities.codacy = {
        available: !!this.codacyAnalyzer,
        configured: this.codacyAnalyzer.isConfigured(),
        features: [
          'code quality analysis',
          'grade assessment (A-F)',
          'issue categorization',
          'quality trends analysis',
          'file-level metrics',
          'technical debt calculation'
        ],
        qualityMetrics: [
          'overall-grade',
          'code-complexity',
          'test-coverage',
          'code-duplication',
          'technical-debt',
          'maintainability-index'
        ],
        issueCategories: ['Security', 'CodeStyle', 'Performance', 'Compatibility', 'Documentation'],
        severityLevels: ['Error', 'Warning', 'Info'],
        supportedProviders: ['github', 'gitlab', 'bitbucket'],
        analysisCapabilities: [
          'Code Quality Assessment',
          'Grade-based Quality Rating',
          'Issue Pattern Analysis',
          'File-level Quality Metrics',
          'Quality Trend Tracking',
          'Technical Debt Assessment'
        ]
      };
    }

    return capabilities;
  }

  _printCollectionSummary(data) {
    console.log('\n📊 Layer 1 Collection Summary:');
    console.log(`├─ Git Data: ${data.git ? '✅ Collected' : '❌ Failed'}`);
    console.log(`├─ AST Data: ${data.ast ? '✅ Collected' : '❌ Failed'}`);
    console.log(`├─ Formal Methods: ${data.formalMethods ? '✅ Collected' : '❌ Failed'}`);
    console.log(`├─ Runtime Data: ${data.runtime ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ SonarQube Data: ${data.sonarQube ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ CodeClimate Data: ${data.codeClimate ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ Semgrep Data: ${data.semgrep ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ GitHub CodeQL Data: ${data.codeql ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ DeepSource Data: ${data.deepSource ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ Veracode Data: ${data.veracode ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`├─ Checkmarx Data: ${data.checkmarx ? '✅ Collected' : '❌ Failed/Skipped'}`);
    console.log(`└─ Codacy Data: ${data.codacy ? '✅ Collected' : '❌ Failed/Skipped'}`);
    
    if (data.runtime) {
      const summary = this.runtimeProfilingHub.generateVisualizationSummary(data.runtime);
      console.log(`   ├─ Runtime: ${summary.totalHotspots} hotspots, ${summary.totalCallRelationships} call relationships`);
    }
    
    if (data.sonarQube) {
      console.log(`   ├─ SonarQube: ${data.sonarQube.files?.length || 0} files, ${data.sonarQube.issues?.length || 0} issues, rating ${data.sonarQube.project?.overallRating || 'unknown'}`);
    }
    
    if (data.codeClimate) {
      console.log(`   ├─ CodeClimate: ${data.codeClimate.files?.length || 0} files, ${data.codeClimate.issues?.length || 0} issues, rating ${data.codeClimate.project?.overallRating || 'unknown'}`);
    }
    
    if (data.semgrep) {
      console.log(`   ├─ Semgrep: ${data.semgrep.files?.length || 0} files, ${data.semgrep.issues?.length || 0} security findings, score ${data.semgrep.project?.metrics?.securityScore || 'unknown'}/100`);
    }
    
    if (data.codeql) {
      console.log(`   ├─ CodeQL: ${data.codeql.files?.length || 0} files, ${data.codeql.issues?.length || 0} semantic findings, score ${data.codeql.project?.metrics?.semanticScore || 'unknown'}/100, data flows ${data.codeql.project?.metrics?.dataFlowFindings || 0}`);
    }
    
    
    if (data.deepSource) {
      console.log(`   ├─ DeepSource: ${data.deepSource.files?.length || 0} files, ${data.deepSource.issues?.length || 0} issues, autofix ${data.deepSource.project?.metrics?.autofixCount || 0} available, AI confidence ${data.deepSource.project?.metrics?.averageConfidence || 'unknown'}%`);
    }
    
    if (data.veracode) {
      console.log(`   ├─ Veracode: ${data.veracode.files?.length || 0} files, ${data.veracode.issues?.length || 0} findings, security score ${data.veracode.project?.metrics?.securityScore || 'unknown'}/100, critical ${data.veracode.project?.metrics?.criticalFindings || 0}, policy compliant ${data.veracode.project?.metrics?.policyCompliance?.compliant ? 'yes' : 'no'}`);
    }
    
    if (data.checkmarx) {
      console.log(`   ├─ Checkmarx: ${data.checkmarx.files?.length || 0} files, ${data.checkmarx.issues?.length || 0} vulnerabilities, data flows ${data.checkmarx.project?.metrics?.dataFlowFindings || 0}, taint analysis ${data.checkmarx.project?.metrics?.taintFindings || 0}, scan ${data.checkmarx.status}`);
    }
    
    if (data.codacy) {
      console.log(`   └─ Codacy: ${data.codacy.files?.length || 0} files, ${data.codacy.issues?.length || 0} issues, grade ${data.codacy.project?.overallRating || 'unknown'}, quality score ${data.codacy.project?.qualityScore || 'unknown'}/100, complexity ${data.codacy.project?.metrics?.complexity || 0}%`);
    }
    console.log('');
  }
}

module.exports = Layer1DataSources;