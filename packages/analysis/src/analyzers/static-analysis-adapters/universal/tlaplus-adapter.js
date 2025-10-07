/**
 * TLA+ Adapter for Topolop
 * 
 * Transforms TLA+ specification verification output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Specifications → City blueprints and zoning laws
 * - Model checking results → Building permit approval status
 * - Invariant violations → Building code violations requiring immediate attention
 * - Temporal properties → Long-term city development compliance
 * - State space exploration → Comprehensive city planning surveys
 * - Deadlocks → Traffic gridlock situations requiring intervention
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TLAPlusAdapter {
  constructor() {
    this.name = 'tlaplus';
    this.supportedLanguages = ['tlaplus'];
    this.description = 'TLA+ specification language and model checker for concurrent systems';
  }

  /**
   * Check if TLA+ tools are available
   */
  async checkAvailability() {
    try {
      // Check for TLA+ tools (tlc, tla2sany)
      execSync('java -cp /opt/TLA+/tla2tools.jar tlc2.TLC -help', { stdio: 'pipe' });
      return true;
    } catch (error) {
      try {
        // Alternative: check if TLA+ is in PATH
        execSync('tlc -help', { stdio: 'pipe' });
        return true;
      } catch (altError) {
        return false;
      }
    }
  }

  /**
   * Run TLA+ analysis on specifications
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('TLA+ not available. Download from: https://lamport.azurewebsites.net/tla/tla.html');
    }

    const results = {
      specifications: [],
      modelChecking: [],
      proofChecking: []
    };
    
    try {
      // Find TLA+ specification files
      const tlaFiles = this.findTLAFiles(codebasePath);
      
      if (tlaFiles.length === 0) {
        return {
          tool: 'tlaplus',
          timestamp: new Date().toISOString(),
          codebasePath,
          results,
          summary: this.generateSummary(results)
        };
      }

      // Analyze each TLA+ specification
      for (const tlaFile of tlaFiles) {
        try {
          // Parse specification
          const specResults = await this.analyzeSpecification(tlaFile, codebasePath, options);
          results.specifications.push(...specResults);
          
          // Run model checking if config file exists
          const configFile = this.findConfigFile(tlaFile);
          if (configFile) {
            const modelResults = await this.runModelChecking(tlaFile, configFile, codebasePath, options);
            results.modelChecking.push(...modelResults);
          }
          
          // Check for proof obligations (if TLAPS is available)
          if (options.enableProofs) {
            const proofResults = await this.checkProofs(tlaFile, codebasePath, options);
            results.proofChecking.push(...proofResults);
          }
          
        } catch (error) {
          console.warn(`TLA+ analysis failed for ${tlaFile}: ${error.message}`);
          results.specifications.push({
            file: path.relative(codebasePath, tlaFile),
            type: 'analysis-error',
            message: error.message,
            severity: 'info'
          });
        }
      }
      
      return {
        tool: 'tlaplus',
        timestamp: new Date().toISOString(),
        codebasePath,
        results,
        summary: this.generateSummary(results)
      };
      
    } catch (error) {
      throw new Error(`TLA+ analysis failed: ${error.message}`);
    }
  }

  findTLAFiles(codebasePath) {
    const tlaFiles = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.')) {
            walkDirectory(fullPath);
          } else if (file.isFile() && file.name.endsWith('.tla')) {
            tlaFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return tlaFiles;
  }

  findConfigFile(tlaFile) {
    const baseName = path.basename(tlaFile, '.tla');
    const dir = path.dirname(tlaFile);
    const configFile = path.join(dir, `${baseName}.cfg`);
    
    return fs.existsSync(configFile) ? configFile : null;
  }

  async analyzeSpecification(tlaFile, basePath, options) {
    const results = [];
    const relativePath = path.relative(basePath, tlaFile);
    
    try {
      // Parse the TLA+ specification with SANY
      const sanyCommand = this.getTLACommand('tla2sany.SANY', tlaFile);
      
      const output = execSync(sanyCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: options.timeout || 30000,
        stdio: 'pipe'
      });
      
      const parseResults = this.parseSANYOutput(output, relativePath);
      results.push(...parseResults);
      
      // Analyze specification structure
      const structureResults = this.analyzeSpecStructure(tlaFile, relativePath);
      results.push(...structureResults);
      
    } catch (error) {
      results.push({
        file: relativePath,
        type: 'parse-error',
        message: error.message,
        severity: 'high'
      });
    }
    
    return results;
  }

  getTLACommand(className, ...args) {
    // Try common TLA+ installation paths
    const tlaJarPaths = [
      '/opt/TLA+/tla2tools.jar',
      '/usr/local/tla/tla2tools.jar',
      '~/tla/tla2tools.jar'
    ];
    
    for (const jarPath of tlaJarPaths) {
      if (fs.existsSync(jarPath)) {
        return `java -cp "${jarPath}" ${className} ${args.join(' ')}`;
      }
    }
    
    // Fallback: assume TLA+ is in PATH
    return `${className.split('.').pop().toLowerCase()} ${args.join(' ')}`;
  }

  parseSANYOutput(output, relativePath) {
    const results = [];
    const lines = output.split('\n');
    
    let parseSuccessful = false;
    const errors = [];
    const warnings = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes('Parsing completed successfully')) {
        parseSuccessful = true;
      } else if (trimmed.includes('Parse error')) {
        const lineMatch = trimmed.match(/line (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1]) : 0;
        
        errors.push({
          line: line,
          message: trimmed,
          type: 'syntax-error'
        });
      } else if (trimmed.includes('Warning')) {
        warnings.push({
          message: trimmed,
          type: 'warning'
        });
      }
    }
    
    results.push({
      file: relativePath,
      type: 'specification-parse',
      parseSuccessful: parseSuccessful,
      errors: errors,
      warnings: warnings,
      severity: errors.length > 0 ? 'high' : warnings.length > 0 ? 'medium' : 'info'
    });
    
    return results;
  }

  analyzeSpecStructure(tlaFile, relativePath) {
    const results = [];
    
    try {
      const content = fs.readFileSync(tlaFile, 'utf8');
      const structure = this.extractSpecificationStructure(content);
      
      results.push({
        file: relativePath,
        type: 'specification-structure',
        structure: structure,
        complexity: this.calculateSpecComplexity(structure),
        severity: 'info'
      });
      
    } catch (error) {
      results.push({
        file: relativePath,
        type: 'structure-analysis-error',
        message: error.message,
        severity: 'low'
      });
    }
    
    return results;
  }

  extractSpecificationStructure(content) {
    const structure = {
      modules: [],
      constants: [],
      variables: [],
      operators: [],
      invariants: [],
      temporalProperties: [],
      actions: []
    };
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract modules
      if (trimmed.startsWith('MODULE ')) {
        const module = trimmed.substring(7).trim();
        structure.modules.push(module);
      }
      
      // Extract constants
      if (trimmed.startsWith('CONSTANT ') || trimmed.startsWith('CONSTANTS ')) {
        const constants = trimmed.substring(trimmed.indexOf(' ') + 1).split(',').map(c => c.trim());
        structure.constants.push(...constants);
      }
      
      // Extract variables
      if (trimmed.startsWith('VARIABLE ') || trimmed.startsWith('VARIABLES ')) {
        const variables = trimmed.substring(trimmed.indexOf(' ') + 1).split(',').map(v => v.trim());
        structure.variables.push(...variables);
      }
      
      // Extract operators
      if (trimmed.includes(' == ') && !trimmed.startsWith('\\*')) {
        const operatorMatch = trimmed.match(/^(\w+)(?:\([^)]*\))?\s*==/);
        if (operatorMatch) {
          structure.operators.push(operatorMatch[1]);
        }
      }
      
      // Extract invariants
      if (trimmed.includes('Inv') && trimmed.includes('==')) {
        const invMatch = trimmed.match(/^(\w*[Ii]nv\w*)/);
        if (invMatch) {
          structure.invariants.push(invMatch[1]);
        }
      }
      
      // Extract temporal properties
      if (trimmed.includes('[]') || trimmed.includes('<>') || trimmed.includes('~>')) {
        const propMatch = trimmed.match(/^(\w+)/);
        if (propMatch) {
          structure.temporalProperties.push(propMatch[1]);
        }
      }
      
      // Extract actions
      if (trimmed.includes("'") && (trimmed.includes('/\\') || trimmed.includes('\\/'))) {
        const actionMatch = trimmed.match(/^(\w+)/);
        if (actionMatch) {
          structure.actions.push(actionMatch[1]);
        }
      }
    }
    
    return structure;
  }

  calculateSpecComplexity(structure) {
    let complexity = 0;
    
    complexity += structure.variables.length * 2;
    complexity += structure.operators.length * 3;
    complexity += structure.invariants.length * 5;
    complexity += structure.temporalProperties.length * 8;
    complexity += structure.actions.length * 4;
    
    if (complexity <= 20) return 'simple';
    if (complexity <= 50) return 'moderate';
    if (complexity <= 100) return 'complex';
    return 'very-complex';
  }

  async runModelChecking(tlaFile, configFile, basePath, options) {
    const results = [];
    const relativePath = path.relative(basePath, tlaFile);
    
    try {
      // Run TLC model checker
      const tlcCommand = this.getTLACommand('tlc2.TLC', '-config', configFile, tlaFile);
      
      const output = execSync(tlcCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: options.timeout || 120000, // 2 minutes default for model checking
        stdio: 'pipe'
      });
      
      const modelResults = this.parseTLCOutput(output, relativePath);
      results.push(...modelResults);
      
    } catch (error) {
      // TLC might return non-zero on violations, check output
      if (error.stdout) {
        const modelResults = this.parseTLCOutput(error.stdout, relativePath);
        results.push(...modelResults);
      } else {
        results.push({
          file: relativePath,
          type: 'model-checking-error',
          message: error.message,
          severity: 'high'
        });
      }
    }
    
    return results;
  }

  parseTLCOutput(output, relativePath) {
    const results = [];
    const lines = output.split('\n');
    
    let modelCheckingComplete = false;
    let statesGenerated = 0;
    let distinctStates = 0;
    const invariantViolations = [];
    const deadlocks = [];
    const propertyViolations = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check completion status
      if (trimmed.includes('Model checking completed')) {
        modelCheckingComplete = true;
      }
      
      // Extract state statistics
      const statesMatch = trimmed.match(/(\d+) states generated/);
      if (statesMatch) {
        statesGenerated = parseInt(statesMatch[1]);
      }
      
      const distinctMatch = trimmed.match(/(\d+) distinct states found/);
      if (distinctMatch) {
        distinctStates = parseInt(distinctMatch[1]);
      }
      
      // Check for invariant violations
      if (trimmed.includes('Invariant') && trimmed.includes('violated')) {
        const invMatch = trimmed.match(/Invariant (\w+) violated/);
        if (invMatch) {
          invariantViolations.push({
            invariant: invMatch[1],
            line: this.extractLineNumber(trimmed)
          });
        }
      }
      
      // Check for deadlocks
      if (trimmed.includes('Deadlock reached')) {
        deadlocks.push({
          type: 'deadlock',
          message: trimmed
        });
      }
      
      // Check for temporal property violations
      if (trimmed.includes('Temporal properties violated')) {
        propertyViolations.push({
          type: 'temporal-violation',
          message: trimmed
        });
      }
    }
    
    results.push({
      file: relativePath,
      type: 'model-checking-result',
      completed: modelCheckingComplete,
      statesGenerated: statesGenerated,
      distinctStates: distinctStates,
      invariantViolations: invariantViolations,
      deadlocks: deadlocks,
      propertyViolations: propertyViolations,
      passed: invariantViolations.length === 0 && deadlocks.length === 0 && propertyViolations.length === 0,
      severity: this.calculateModelCheckingSeverity(invariantViolations, deadlocks, propertyViolations)
    });
    
    return results;
  }

  extractLineNumber(text) {
    const lineMatch = text.match(/line (\d+)/);
    return lineMatch ? parseInt(lineMatch[1]) : 0;
  }

  calculateModelCheckingSeverity(invariants, deadlocks, properties) {
    if (deadlocks.length > 0) return 'critical';
    if (invariants.length > 0) return 'high';
    if (properties.length > 0) return 'medium';
    return 'info';
  }

  async checkProofs(tlaFile, basePath, options) {
    const results = [];
    const relativePath = path.relative(basePath, tlaFile);
    
    try {
      // Check if TLAPS (TLA+ Proof System) is available
      const tlapsCommand = this.getTLACommand('tla2sany.SANY', '-I', '/usr/local/lib/tlaps', tlaFile);
      
      const output = execSync(tlapsCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: options.timeout || 60000,
        stdio: 'pipe'
      });
      
      results.push({
        file: relativePath,
        type: 'proof-checking-result',
        message: 'Proof checking completed',
        severity: 'info'
      });
      
    } catch (error) {
      results.push({
        file: relativePath,
        type: 'proof-checking-error',
        message: error.message,
        severity: 'low'
      });
    }
    
    return results;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(results) {
    const allResults = [
      ...results.specifications,
      ...results.modelChecking,
      ...results.proofChecking
    ];
    
    const fileStats = {};
    const overallStats = {
      totalSpecs: 0,
      parsedSpecs: 0,
      modelCheckedSpecs: 0,
      passedModelChecking: 0,
      invariantViolations: 0,
      deadlocks: 0,
      propertyViolations: 0
    };

    for (const result of allResults) {
      const fileName = result.file;
      
      if (!fileStats[fileName]) {
        fileStats[fileName] = {
          parsed: false,
          modelChecked: false,
          passed: false,
          issues: [],
          complexity: 'unknown'
        };
      }
      
      if (result.type === 'specification-parse') {
        overallStats.totalSpecs++;
        if (result.parseSuccessful) {
          overallStats.parsedSpecs++;
          fileStats[fileName].parsed = true;
        }
        fileStats[fileName].issues.push(...result.errors, ...result.warnings);
      }
      
      if (result.type === 'specification-structure') {
        fileStats[fileName].complexity = result.complexity;
      }
      
      if (result.type === 'model-checking-result') {
        overallStats.modelCheckedSpecs++;
        fileStats[fileName].modelChecked = true;
        
        if (result.passed) {
          overallStats.passedModelChecking++;
          fileStats[fileName].passed = true;
        }
        
        overallStats.invariantViolations += result.invariantViolations.length;
        overallStats.deadlocks += result.deadlocks.length;
        overallStats.propertyViolations += result.propertyViolations.length;
      }
    }

    return {
      overallStats,
      fileStats,
      verificationRate: overallStats.modelCheckedSpecs > 0 ? 
        ((overallStats.passedModelChecking / overallStats.modelCheckedSpecs) * 100).toFixed(1) : 0,
      specificationQuality: this.calculateSpecificationQuality(overallStats, fileStats)
    };
  }

  calculateSpecificationQuality(stats, fileStats) {
    let score = 100;
    
    // Penalize parse failures
    const parseFailures = stats.totalSpecs - stats.parsedSpecs;
    score -= parseFailures * 20;
    
    // Penalize verification failures
    const verificationFailures = stats.modelCheckedSpecs - stats.passedModelChecking;
    score -= verificationFailures * 15;
    
    // Penalize specific violations
    score -= stats.invariantViolations * 10;
    score -= stats.deadlocks * 25;
    score -= stats.propertyViolations * 8;
    
    return Math.max(0, score).toFixed(1);
  }

  /**
   * Transform TLA+ output into city visualization data
   */
  toCityData(tlaplusOutput) {
    const { results, summary } = tlaplusOutput;
    
    const cityData = {
      verificationResults: [],
      buildingEnhancements: {},
      cityPlanning: {},
      complianceStatus: {}
    };

    // Process each specification file
    for (const [fileName, stats] of Object.entries(summary.fileStats)) {
      // Add verification results for visualization
      cityData.verificationResults.push({
        file: fileName,
        type: 'tlaplus',
        parsed: stats.parsed,
        modelChecked: stats.modelChecked,
        verified: stats.passed,
        complexity: stats.complexity,
        issueCount: stats.issues.length,
        details: {
          issues: stats.issues,
          complexity: stats.complexity
        }
      });

      // Building enhancement data
      cityData.buildingEnhancements[fileName] = {
        blueprintApproval: this.calculateBlueprintStatus(stats),
        buildingPermit: this.calculatePermitStatus(stats),
        complianceLevel: this.calculateComplianceLevel(stats),
        planningQuality: this.calculatePlanningQuality(stats),
        visualEffects: {
          blueprintApproved: stats.parsed,
          permitIssued: stats.modelChecked,
          complianceVerified: stats.passed,
          violationNotices: stats.issues.length > 0,
          gridlockWarnings: this.hasDeadlockIssues(stats.issues),
          developmentFlags: stats.complexity === 'very-complex'
        }
      };

      // City planning data
      cityData.cityPlanning[fileName] = {
        zoningCompliance: this.assessZoningCompliance(stats),
        developmentApproval: this.assessDevelopmentApproval(stats),
        infrastructurePlanning: this.assessInfrastructurePlanning(stats.complexity),
        longTermViability: this.assessLongTermViability(stats)
      };

      // Compliance status
      cityData.complianceStatus[fileName] = {
        regulatoryCompliance: stats.passed ? 'compliant' : 'non-compliant',
        safetyStandards: this.assessSafetyStandards(stats.issues),
        buildingCodes: this.assessBuildingCodes(stats),
        environmentalImpact: this.assessEnvironmentalImpact(stats.complexity)
      };
    }

    return cityData;
  }

  calculateBlueprintStatus(stats) {
    if (stats.parsed && stats.issues.length === 0) return 'approved';
    if (stats.parsed && stats.issues.length <= 2) return 'approved-with-conditions';
    if (stats.parsed) return 'requires-revision';
    return 'rejected';
  }

  calculatePermitStatus(stats) {
    if (stats.modelChecked && stats.passed) return 'issued';
    if (stats.modelChecked) return 'pending-corrections';
    if (stats.parsed) return 'under-review';
    return 'not-submitted';
  }

  calculateComplianceLevel(stats) {
    if (stats.passed && stats.issues.length === 0) return 'full-compliance';
    if (stats.passed) return 'compliant-with-notes';
    if (stats.modelChecked) return 'non-compliant';
    return 'not-assessed';
  }

  calculatePlanningQuality(stats) {
    if (stats.complexity === 'simple' && stats.passed) return 'excellent';
    if (stats.complexity === 'moderate' && stats.passed) return 'good';
    if (stats.passed) return 'adequate';
    return 'poor';
  }

  hasDeadlockIssues(issues) {
    return issues.some(issue => 
      issue.type === 'deadlock' || 
      issue.message.toLowerCase().includes('deadlock')
    );
  }

  assessZoningCompliance(stats) {
    if (stats.parsed && stats.passed) return 'compliant';
    if (stats.parsed) return 'violations-found';
    return 'not-reviewed';
  }

  assessDevelopmentApproval(stats) {
    if (stats.modelChecked && stats.passed) return 'approved';
    if (stats.modelChecked) return 'rejected';
    return 'pending';
  }

  assessInfrastructurePlanning(complexity) {
    const planningMap = {
      simple: 'basic-infrastructure',
      moderate: 'standard-infrastructure',
      complex: 'advanced-infrastructure',
      'very-complex': 'comprehensive-infrastructure'
    };
    
    return planningMap[complexity] || 'unknown';
  }

  assessLongTermViability(stats) {
    if (stats.passed && stats.complexity !== 'very-complex') return 'sustainable';
    if (stats.passed) return 'viable-with-maintenance';
    if (stats.parsed) return 'requires-redesign';
    return 'not-viable';
  }

  assessSafetyStandards(issues) {
    const safetyIssues = issues.filter(issue => 
      issue.type === 'deadlock' || 
      issue.type === 'invariant-violation' ||
      issue.message.toLowerCase().includes('safety')
    );
    
    if (safetyIssues.length === 0) return 'meets-standards';
    if (safetyIssues.length <= 2) return 'minor-concerns';
    return 'safety-violations';
  }

  assessBuildingCodes(stats) {
    if (stats.passed) return 'code-compliant';
    if (stats.modelChecked) return 'code-violations';
    return 'not-inspected';
  }

  assessEnvironmentalImpact(complexity) {
    const impactMap = {
      simple: 'minimal-impact',
      moderate: 'low-impact',
      complex: 'moderate-impact',
      'very-complex': 'high-impact'
    };
    
    return impactMap[complexity] || 'unknown-impact';
  }
}

module.exports = new TLAPlusAdapter();