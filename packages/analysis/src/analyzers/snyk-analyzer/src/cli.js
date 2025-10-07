#!/usr/bin/env node

const SnykAnalyzer = require('./index');
const path = require('path');
const fs = require('fs-extra');

/**
 * Snyk Analyzer CLI
 * 
 * Command-line interface for Snyk vulnerability analysis integration.
 * Part of Topolop's Layer 1 data source collection.
 */

class SnykAnalyzerCLI {
  constructor() {
    this.analyzer = null;
  }

  /**
   * Parse command line arguments and execute requested action
   */
  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      return;
    }

    if (args.includes('--version') || args.includes('-v')) {
      this.showVersion();
      return;
    }

    try {
      const command = args[0];
      const targetPath = args[1] || process.cwd();
      const options = this.parseOptions(args);

      await this.executeCommand(command, targetPath, options);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Execute the requested command
   */
  async executeCommand(command, targetPath, options) {
    console.log(`🔍 Snyk Analyzer CLI - ${command.toUpperCase()}`);
    console.log(`📁 Target: ${path.resolve(targetPath)}`);
    console.log('');

    // Initialize analyzer
    this.analyzer = new SnykAnalyzer({
      snykPath: options.snykPath,
      timeout: options.timeout,
      defaultSeverityThreshold: options.severity
    });

    switch (command) {
      case 'test':
      case 'analyze':
        await this.runAnalysis(targetPath, options);
        break;
        
      case 'vulnerability':
      case 'vuln':
        await this.runVulnerabilityAnalysis(targetPath, options);
        break;
        
      case 'container':
        await this.runContainerAnalysis(targetPath, options);
        break;
        
      case 'code':
        await this.runCodeAnalysis(targetPath, options);
        break;
        
      case 'comprehensive':
      case 'full':
        await this.runComprehensiveAnalysis(targetPath, options);
        break;
        
      case 'summary':
        await this.runSummaryAnalysis(targetPath, options);
        break;
        
      case 'validate':
        await this.runValidation(targetPath);
        break;
        
      case 'capabilities':
        await this.showCapabilities();
        break;
        
      case 'config':
        await this.showConfiguration();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }

  /**
   * Run standard dependency analysis
   */
  async runAnalysis(targetPath, options) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log('🔍 Running dependency vulnerability analysis...');
      const results = await this.analyzer.analyzeTarget(targetPath, {
        severityThreshold: options.severity,
        includeDev: options.includeDev,
        allProjects: options.allProjects,
        file: options.file,
        packageManager: options.packageManager
      });

      await this.outputResults(results, options);
      await this.showAnalysisSummary(results);
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run vulnerability-focused analysis (no license issues)
   */
  async runVulnerabilityAnalysis(targetPath, options) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log('🔍 Running vulnerability-only analysis...');
      const results = await this.analyzer.vulnerabilityAnalysis(targetPath, options);

      await this.outputResults(results, options);
      await this.showAnalysisSummary(results);
      
    } catch (error) {
      console.error(`❌ Vulnerability analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run container analysis
   */
  async runContainerAnalysis(targetPath, options) {
    const imageName = options.image || targetPath;
    
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log(`🐳 Running container analysis for: ${imageName}`);
      const results = await this.analyzer.analyzeContainer(imageName, options);

      await this.outputResults(results, options);
      await this.showAnalysisSummary(results);
      
    } catch (error) {
      console.error(`❌ Container analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run code analysis (SAST)
   */
  async runCodeAnalysis(targetPath, options) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log('💻 Running static code analysis...');
      const results = await this.analyzer.analyzeCode(targetPath, options);

      await this.outputResults(results, options);
      await this.showAnalysisSummary(results);
      
    } catch (error) {
      console.error(`❌ Code analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run comprehensive analysis
   */
  async runComprehensiveAnalysis(targetPath, options) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log('🔄 Running comprehensive analysis...');
      const results = await this.analyzer.comprehensiveAnalysis(targetPath, options);

      if (options.output) {
        await this.saveResultsToFile(results, options.output);
      } else {
        console.log('\n📊 COMPREHENSIVE ANALYSIS RESULTS');
        console.log('='.repeat(50));
        console.log(`Target: ${results.target}`);
        console.log(`Timestamp: ${results.timestamp}`);
        console.log(`Analysis types: ${results.analyses.length}`);
        console.log('');

        results.analyses.forEach((analysis, index) => {
          console.log(`${index + 1}. ${analysis.type.toUpperCase()} ANALYSIS`);
          const data = analysis.data;
          console.log(`   Security Score: ${data.project.metrics.securityScore}/100`);
          console.log(`   Issues Found: ${data.issues.length}`);
          console.log(`   Risk Level: ${data.project.metrics.riskLevel}`);
          console.log('');
        });

        console.log('📋 SUMMARY');
        console.log(`Overall Security Score: ${results.summary.overallSecurityScore}/100`);
        console.log(`Total Issues: ${results.summary.totalIssues}`);
        
        if (results.summary.recommendedActions.length > 0) {
          console.log('\n💡 RECOMMENDED ACTIONS:');
          results.summary.recommendedActions.forEach((action, i) => {
            console.log(`   ${i + 1}. ${action}`);
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ Comprehensive analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run summary analysis
   */
  async runSummaryAnalysis(targetPath, options) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      await this.analyzer.initialize();
      
      console.log('📊 Getting project vulnerability summary...');
      const summary = await this.analyzer.getProjectSummary(targetPath, options);

      if (!summary) {
        console.log('⚠️  No summary data available');
        return;
      }

      console.log('\n📋 PROJECT VULNERABILITY SUMMARY');
      console.log('='.repeat(40));
      console.log(`✅ Analysis Status: ${summary.ok ? 'PASSED' : 'ISSUES FOUND'}`);
      console.log(`🚨 Total Vulnerabilities: ${summary.totalVulnerabilities}`);
      console.log(`📦 Total Dependencies: ${summary.totalDependencies}`);
      console.log(`⚠️  Vulnerable Dependencies: ${summary.vulnerableDependencies}`);
      console.log('');
      
      console.log('📊 SEVERITY BREAKDOWN:');
      console.log(`   🔴 Critical: ${summary.severityCounts.critical}`);
      console.log(`   🟠 High: ${summary.severityCounts.high}`);
      console.log(`   🟡 Medium: ${summary.severityCounts.medium}`);
      console.log(`   🟢 Low: ${summary.severityCounts.low}`);

      if (summary.uniqueCount > 0) {
        console.log(`\n🔢 Unique Vulnerabilities: ${summary.uniqueCount}`);
      }

    } catch (error) {
      console.error(`❌ Summary analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run target validation
   */
  async runValidation(targetPath) {
    try {
      console.log('🔄 Initializing Snyk analyzer...');
      this.analyzer = new SnykAnalyzer();
      await this.analyzer.initialize();
      
      console.log('🔍 Validating target...');
      const validation = await this.analyzer.validateTarget(targetPath);

      if (validation.valid) {
        console.log('✅ Target validation successful');
        console.log(`   📁 Path: ${validation.target.path}`);
        console.log(`   📋 Type: ${validation.target.type}`);
        console.log(`   🔍 Analyzable: ${validation.target.analyzable}`);
        console.log(`   📦 Has manifests: ${validation.target.hasManifests}`);
      } else {
        console.error(`❌ Target validation failed: ${validation.error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show analyzer capabilities
   */
  async showCapabilities() {
    this.analyzer = new SnykAnalyzer();
    const capabilities = this.analyzer.getCapabilities();

    console.log('🔍 SNYK ANALYZER CAPABILITIES');
    console.log('='.repeat(50));
    console.log(`Name: ${capabilities.name}`);
    console.log(`Version: ${capabilities.version}`);
    console.log(`Tier: ${capabilities.tier}`);
    console.log(`Priority: ${capabilities.priority}`);
    console.log(`Market Share: ${capabilities.marketShare}`);
    console.log('');

    console.log('✨ FEATURES:');
    Object.entries(capabilities.features).forEach(([feature, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${feature}`);
    });

    console.log('\n📦 SUPPORTED ECOSYSTEMS:');
    capabilities.ecosystems.forEach(ecosystem => {
      console.log(`   • ${ecosystem}`);
    });

    console.log('\n🔗 INTEGRATIONS:');
    Object.entries(capabilities.integrations).forEach(([integration, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${integration}`);
    });

    console.log('\n🏙️  CITY VISUALIZATION MAPPING:');
    Object.entries(capabilities.cityMapping).forEach(([element, description]) => {
      console.log(`   🏗️  ${element}: ${description}`);
    });
  }

  /**
   * Show configuration status
   */
  async showConfiguration() {
    this.analyzer = new SnykAnalyzer();
    const configStatus = this.analyzer.getConfigurationStatus();

    console.log('⚙️  SNYK ANALYZER CONFIGURATION');
    console.log('='.repeat(50));
    console.log(`Configured: ${configStatus.configured ? '✅' : '❌'}`);
    console.log('');

    console.log('📋 REQUIREMENTS:');
    configStatus.requirements.forEach((req, index) => {
      console.log(`${index + 1}. ${req.name} (${req.type})`);
      console.log(`   📝 ${req.description}`);
      console.log(`   ⚠️  Required: ${req.required ? 'Yes' : 'No'}`);
      
      if (req.installInstructions) {
        console.log(`   💻 Install: ${req.installInstructions}`);
      }
      
      if (req.setupInstructions) {
        console.log(`   🔧 Setup: ${req.setupInstructions}`);
      }
      
      if (req.examples) {
        console.log(`   📄 Examples: ${req.examples.join(', ')}`);
      }
      
      console.log('');
    });
  }

  /**
   * Output results based on format option
   */
  async outputResults(results, options) {
    if (options.output) {
      await this.saveResultsToFile(results, options.output);
    } else if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
    // Otherwise results are shown in summary
  }

  /**
   * Save results to file
   */
  async saveResultsToFile(results, outputPath) {
    try {
      const resolvedPath = path.resolve(outputPath);
      await fs.ensureDir(path.dirname(resolvedPath));
      await fs.writeJson(resolvedPath, results, { spaces: 2 });
      console.log(`💾 Results saved to: ${resolvedPath}`);
    } catch (error) {
      console.error(`❌ Failed to save results: ${error.message}`);
    }
  }

  /**
   * Show analysis summary
   */
  async showAnalysisSummary(results) {
    console.log('');
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(30));
    
    const summary = this.analyzer.generateAnalysisSummary(results);
    if (!summary) {
      console.log('⚠️  No summary available');
      return;
    }

    console.log(`📋 Project: ${summary.project.name}`);
    console.log(`🛡️  Security Score: ${summary.metrics.securityScore}/100`);
    console.log(`⚠️  Risk Level: ${summary.metrics.riskLevel.toUpperCase()}`);
    console.log(`📦 Dependencies: ${summary.dependencies.total} (${summary.dependencies.vulnerable} vulnerable)`);
    console.log(`🚨 Vulnerabilities: ${summary.metrics.totalVulnerabilities} (${summary.metrics.criticalVulnerabilities} critical)`);
    
    if (summary.metrics.licenseIssues > 0) {
      console.log(`⚖️  License Issues: ${summary.metrics.licenseIssues}`);
    }
    
    if (summary.metrics.upgradeableVulnerabilities > 0) {
      console.log(`⬆️  Upgradeable: ${summary.metrics.upgradeableVulnerabilities}`);
    }

    // Show recommendations
    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      summary.recommendations.forEach((rec, index) => {
        const priorityIcon = {
          'critical': '🔴',
          'high': '🟠', 
          'medium': '🟡',
          'low': '🟢'
        }[rec.priority] || '⚪';
        
        console.log(`${priorityIcon} ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
        if (rec.affectedPackages && rec.affectedPackages.length > 0) {
          console.log(`   Packages: ${rec.affectedPackages.slice(0, 3).join(', ')}${rec.affectedPackages.length > 3 ? '...' : ''}`);
        }
      });
    }

    console.log('\n🏙️  CITY VISUALIZATION:');
    console.log(`   🏗️  Ecosystems: ${summary.cityVisualization.ecosystems}`);
    console.log(`   🛡️  Security zones: ${summary.cityVisualization.securityZones}`);
    console.log(`   📊 Overall posture: ${summary.cityVisualization.overallPosture.toUpperCase()}`);
    console.log(`   ✅ Healthy dependencies: ${summary.cityVisualization.healthyDependencies}`);
    console.log(`   ⚠️  At-risk dependencies: ${summary.cityVisualization.atRiskDependencies}`);
  }

  /**
   * Parse command line options
   */
  parseOptions(args) {
    const options = {
      severity: 'low',
      includeDev: true,
      allProjects: false,
      json: false,
      output: null,
      timeout: 300000,
      snykPath: 'snyk',
      file: null,
      packageManager: null,
      image: null
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--severity':
        case '-s':
          if (nextArg && ['low', 'medium', 'high', 'critical'].includes(nextArg)) {
            options.severity = nextArg;
            i++;
          }
          break;
          
        case '--no-dev':
          options.includeDev = false;
          break;
          
        case '--dev':
          options.includeDev = true;
          break;
          
        case '--all-projects':
          options.allProjects = true;
          break;
          
        case '--json':
          options.json = true;
          break;
          
        case '--output':
        case '-o':
          if (nextArg) {
            options.output = nextArg;
            i++;
          }
          break;
          
        case '--timeout':
          if (nextArg && !isNaN(parseInt(nextArg))) {
            options.timeout = parseInt(nextArg) * 1000; // Convert to milliseconds
            i++;
          }
          break;
          
        case '--snyk-path':
          if (nextArg) {
            options.snykPath = nextArg;
            i++;
          }
          break;
          
        case '--file':
        case '-f':
          if (nextArg) {
            options.file = nextArg;
            i++;
          }
          break;
          
        case '--package-manager':
        case '--pm':
          if (nextArg) {
            options.packageManager = nextArg;
            i++;
          }
          break;
          
        case '--image':
        case '-i':
          if (nextArg) {
            options.image = nextArg;
            i++;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log('🔍 Snyk Analyzer CLI - Topolop Layer 1 Integration');
    console.log('='.repeat(60));
    console.log('');
    console.log('USAGE:');
    console.log('  topolop-snyk <command> [target] [options]');
    console.log('');
    console.log('COMMANDS:');
    console.log('  test, analyze           Run dependency vulnerability analysis');
    console.log('  vulnerability, vuln     Run vulnerability-only analysis (no licenses)');
    console.log('  container              Run container image analysis');
    console.log('  code                   Run static code analysis (Snyk Code)');
    console.log('  comprehensive, full    Run comprehensive analysis (all types)');
    console.log('  summary                Get project vulnerability summary');
    console.log('  validate               Validate target path and requirements');
    console.log('  capabilities           Show analyzer capabilities');
    console.log('  config                 Show configuration status');
    console.log('');
    console.log('OPTIONS:');
    console.log('  --severity, -s         Severity threshold: low, medium, high, critical (default: low)');
    console.log('  --dev                  Include dev dependencies (default: true)');
    console.log('  --no-dev               Exclude dev dependencies');
    console.log('  --all-projects         Test all projects in workspace');
    console.log('  --file, -f             Specify manifest file to analyze');
    console.log('  --package-manager      Specify package manager: npm, pip, maven, etc.');
    console.log('  --image, -i            Container image name for container analysis');
    console.log('  --json                 Output results in JSON format');
    console.log('  --output, -o           Save results to file');
    console.log('  --timeout              Timeout in seconds (default: 300)');
    console.log('  --snyk-path            Path to Snyk CLI binary');
    console.log('  --help, -h             Show this help');
    console.log('  --version, -v          Show version');
    console.log('');
    console.log('EXAMPLES:');
    console.log('  topolop-snyk analyze                    # Analyze current directory');
    console.log('  topolop-snyk test /path/to/project      # Analyze specific project');
    console.log('  topolop-snyk vuln --severity high       # Only high/critical vulnerabilities');
    console.log('  topolop-snyk container my-image:latest  # Analyze container image');
    console.log('  topolop-snyk full --output results.json # Comprehensive analysis to file');
    console.log('  topolop-snyk summary --json             # JSON summary output');
    console.log('');
    console.log('AUTHENTICATION:');
    console.log('  Run "snyk auth" to authenticate before using this tool');
    console.log('  Or set SNYK_TOKEN environment variable');
    console.log('');
  }

  /**
   * Show version information
   */
  showVersion() {
    const packageInfo = require('../package.json');
    console.log(`Snyk Analyzer CLI v${packageInfo.version}`);
    console.log('Part of Topolop Layer 1 Data Sources');
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new SnykAnalyzerCLI();
  cli.run().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = SnykAnalyzerCLI;