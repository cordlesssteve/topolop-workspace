/**
 * Secure Formal Methods Adapter Registry
 * 
 * Central registry for all formal method tool adapters with security-first approach.
 * Transforms outputs from static analysis, security, and verification tools
 * into standardized data structures for city visualization.
 * 
 * SECURITY: All adapters run in secure mode with input validation and sandboxing
 */

const path = require('path');
const fs = require('fs');
const SecurityValidator = require('./security/input-validator');

class SecureFormalMethodsRegistry {
  constructor() {
    this.adapters = new Map();
    this.supportedLanguages = new Set();
    this.securityValidator = SecurityValidator;
    this.secureMode = true;
    this.initializeAdapters();
  }

  initializeAdapters() {
    try {
      // JavaScript ecosystem adapters (SECURE VERSIONS)
      this.registerAdapter('eslint', require('./javascript/eslint-adapter'));
      this.registerAdapter('madge', require('./javascript/madge-adapter'));
      
      // Python ecosystem adapters (SECURE VERSIONS)
      this.registerAdapter('secure-pylint', require('./python/secure-pylint-adapter'));
      this.registerAdapter('secure-bandit', require('./python/secure-bandit-adapter'));
      this.registerAdapter('secure-mypy', require('./python/secure-mypy-adapter'));
      this.registerAdapter('pyreverse', require('./python/pyreverse-adapter'));
      
      // C/C++ ecosystem adapters
      this.registerAdapter('clang-static-analyzer', require('./c-cpp/clang-adapter'));
      this.registerAdapter('cbmc', require('./c-cpp/cbmc-adapter'));
      this.registerAdapter('valgrind', require('./c-cpp/valgrind-adapter'));
      
      // Universal adapters
      this.registerAdapter('perf', require('./universal/perf-adapter'));
      this.registerAdapter('tlaplus', require('./universal/tlaplus-adapter'));
      this.registerAdapter('klee', require('./universal/klee-adapter'));
      
      console.log(`✅ Initialized ${this.adapters.size} secure formal method adapters`);
      console.log(`🔒 Security mode: ${this.secureMode ? 'ENABLED' : 'DISABLED'}`);
    } catch (error) {
      console.error('❌ Failed to initialize some adapters:', error.message);
    }
  }

  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    if (adapter.supportedLanguages) {
      adapter.supportedLanguages.forEach(lang => this.supportedLanguages.add(lang));
    }
  }

  getAdapter(toolName) {
    return this.adapters.get(toolName);
  }

  getSupportedTools() {
    return Array.from(this.adapters.keys());
  }

  getSupportedLanguages() {
    return Array.from(this.supportedLanguages);
  }

  /**
   * Auto-detect and run appropriate tools for a codebase with security validation
   */
  async analyzeCodebase(codebasePath, options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      codebasePath,
      toolOutputs: {},
      cityEnhancements: {},
      securityReport: null
    };

    try {
      // SECURITY: Validate codebase before analysis
      console.log('🔒 Performing security validation of codebase...');
      const validation = await this.securityValidator.validateCodebase(codebasePath, 'all');
      results.securityReport = this.securityValidator.createSecurityReport(validation);
      
      if (!validation.valid) {
        throw new Error(`Security validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.warn(`⚠️  Security warnings: ${validation.warnings.length} issues detected`);
      }
      
      console.log(`✅ Security validation passed (${validation.validFiles.length} files validated)`);

      // Detect languages in codebase
      const detectedLanguages = await this.detectLanguages(codebasePath);
      
      // Run appropriate tools based on detected languages
      for (const language of detectedLanguages) {
        const tools = this.getToolsForLanguage(language);
        
        for (const toolName of tools) {
          if (options.skipTools && options.skipTools.includes(toolName)) continue;
          
          try {
            console.log(`🔍 Running secure ${toolName} analysis...`);
            const adapter = this.getAdapter(toolName);
            
            // SECURITY: Pass validated file list to adapter if available
            const secureOptions = {
              ...options,
              validatedFiles: validation.validFiles.map(f => f.path),
              securityMode: this.secureMode
            };
            
            const toolOutput = await adapter.analyze(codebasePath, secureOptions);
            
            results.toolOutputs[toolName] = toolOutput;
            results.cityEnhancements[toolName] = adapter.toCityData(toolOutput);
            
            console.log(`✅ ${toolName} secure analysis complete`);
          } catch (error) {
            console.log(`⚠️  ${toolName} analysis failed: ${error.message}`);
            results.toolOutputs[toolName] = { 
              error: error.message,
              securityMode: this.secureMode
            };
          }
        }
      }

    } catch (error) {
      console.error(`🚨 Codebase analysis failed: ${error.message}`);
      results.error = error.message;
    }

    return results;
  }

  async detectLanguages(codebasePath) {
    const languages = new Set();
    
    // SECURITY: Use secure file discovery
    const files = await this.securityValidator.findFiles(codebasePath, 'all');
    
    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      
      if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
        languages.add('javascript');
      } else if (['.py', '.pyw'].includes(ext)) {
        languages.add('python');
      } else if (['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'].includes(ext)) {
        languages.add('c-cpp');
      } else if (['.tla', '.cfg'].includes(ext)) {
        languages.add('tlaplus');
      }
    }

    return Array.from(languages);
  }

  getToolsForLanguage(language) {
    const toolMap = {
      'javascript': ['eslint', 'madge'],
      'python': ['pylint', 'bandit', 'mypy', 'pyreverse'],
      'c-cpp': ['clang-static-analyzer', 'cbmc', 'valgrind', 'klee'],
      'tlaplus': ['tlaplus'],
      'universal': ['perf']
    };
    
    return toolMap[language] || [];
  }

  /**
   * Merge all tool outputs into unified city enhancement data
   */
  mergeCityEnhancements(toolResults) {
    const merged = {
      // Code quality and static analysis
      securityIssues: [],
      qualityIssues: [],
      typeIssues: [],
      staticAnalysisIssues: [],
      
      // Performance and profiling
      performanceHotspots: [],
      memoryIssues: [],
      
      // Dependencies and architecture
      dependencies: [],
      cyclicDependencies: [],
      
      // Verification and testing
      verificationResults: [],
      pathAnalysis: [],
      
      // Metrics and assessments
      complexityMetrics: {},
      buildingEnhancements: {},
      
      // Infrastructure
      roadNetwork: {},
      trafficPatterns: {},
      districtHealth: {},
      
      // Safety and compliance
      environmentalHazards: {},
      complianceStatus: {},
      emergencyPreparedness: {}
    };

    for (const [toolName, enhancements] of Object.entries(toolResults.cityEnhancements)) {
      // Security and vulnerability data
      if (enhancements.securityIssues) {
        merged.securityIssues.push(...enhancements.securityIssues.map(issue => ({...issue, source: toolName})));
      }
      
      // Code quality issues
      if (enhancements.qualityIssues) {
        merged.qualityIssues.push(...enhancements.qualityIssues.map(issue => ({...issue, source: toolName})));
      }
      
      // Type checking issues
      if (enhancements.typeIssues) {
        merged.typeIssues.push(...enhancements.typeIssues.map(issue => ({...issue, source: toolName})));
      }
      
      // Static analysis results
      if (enhancements.staticAnalysisIssues) {
        merged.staticAnalysisIssues.push(...enhancements.staticAnalysisIssues.map(issue => ({...issue, source: toolName})));
      }
      
      // Performance data
      if (enhancements.performanceHotspots) {
        merged.performanceHotspots.push(...enhancements.performanceHotspots.map(hotspot => ({...hotspot, source: toolName})));
      }
      
      // Memory analysis
      if (enhancements.memoryIssues) {
        merged.memoryIssues.push(...enhancements.memoryIssues.map(issue => ({...issue, source: toolName})));
      }
      
      // Dependency analysis
      if (enhancements.dependencies) {
        merged.dependencies.push(...enhancements.dependencies.map(dep => ({...dep, source: toolName})));
      }
      
      if (enhancements.cyclicDependencies) {
        merged.cyclicDependencies.push(...enhancements.cyclicDependencies.map(cycle => ({...cycle, source: toolName})));
      }
      
      // Verification results
      if (enhancements.verificationResults) {
        merged.verificationResults.push(...enhancements.verificationResults.map(result => ({...result, source: toolName})));
      }
      
      // Path analysis
      if (enhancements.pathAnalysis) {
        merged.pathAnalysis.push(...enhancements.pathAnalysis.map(analysis => ({...analysis, source: toolName})));
      }
      
      // Building enhancements (merge by file)
      if (enhancements.buildingEnhancements) {
        for (const [file, enhancement] of Object.entries(enhancements.buildingEnhancements)) {
          if (!merged.buildingEnhancements[file]) {
            merged.buildingEnhancements[file] = {};
          }
          merged.buildingEnhancements[file][toolName] = enhancement;
        }
      }
      
      // Infrastructure data
      if (enhancements.roadNetwork) {
        merged.roadNetwork[toolName] = enhancements.roadNetwork;
      }
      
      if (enhancements.trafficPatterns) {
        merged.trafficPatterns[toolName] = enhancements.trafficPatterns;
      }
      
      if (enhancements.districtHealth) {
        merged.districtHealth[toolName] = enhancements.districtHealth;
      }
      
      // Safety and environmental data
      if (enhancements.environmentalHazards) {
        merged.environmentalHazards[toolName] = enhancements.environmentalHazards;
      }
      
      if (enhancements.complianceStatus) {
        merged.complianceStatus[toolName] = enhancements.complianceStatus;
      }
      
      if (enhancements.emergencyPreparedness) {
        merged.emergencyPreparedness[toolName] = enhancements.emergencyPreparedness;
      }
      
      // Legacy support
      if (enhancements.complexityMetrics) {
        Object.assign(merged.complexityMetrics, enhancements.complexityMetrics);
      }
    }

    // Calculate overall city health score
    merged.overallCityHealth = this.calculateOverallCityHealth(merged);

    return merged;
  }

  /**
   * Calculate overall city health based on all formal method results
   */
  calculateOverallCityHealth(mergedData) {
    let score = 100;
    
    // Security penalties
    score -= mergedData.securityIssues.filter(issue => issue.severity === 'critical').length * 10;
    score -= mergedData.securityIssues.filter(issue => issue.severity === 'high').length * 5;
    
    // Quality penalties
    score -= mergedData.qualityIssues.filter(issue => issue.severity === 'error').length * 8;
    score -= mergedData.staticAnalysisIssues.filter(issue => issue.severity === 'critical').length * 12;
    
    // Memory and performance penalties
    score -= mergedData.memoryIssues.filter(issue => issue.severity === 'critical').length * 15;
    score -= mergedData.performanceHotspots.filter(hotspot => hotspot.severity === 'critical').length * 6;
    
    // Cyclic dependency penalties
    score -= mergedData.cyclicDependencies.length * 5;
    
    // Verification failures
    const failedVerifications = mergedData.verificationResults.filter(result => !result.verified).length;
    score -= failedVerifications * 8;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      level: this.categorizeHealthLevel(score),
      issues: {
        security: mergedData.securityIssues.length,
        quality: mergedData.qualityIssues.length,
        memory: mergedData.memoryIssues.length,
        performance: mergedData.performanceHotspots.length,
        verification: failedVerifications
      }
    };
  }

  categorizeHealthLevel(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }
}

module.exports = SecureFormalMethodsRegistry;