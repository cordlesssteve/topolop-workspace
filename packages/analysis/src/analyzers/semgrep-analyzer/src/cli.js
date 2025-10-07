#!/usr/bin/env node

/**
 * Semgrep Analyzer CLI
 * 
 * Command-line interface for Semgrep security analysis integration
 * Provides testing, configuration, and analysis capabilities
 */

const SemgrepAnalyzer = require('./index');
const SemgrepClient = require('./semgrep-client');
const path = require('path');

class SemgrepCLI {
  constructor() {
    this.analyzer = null;
  }

  async run(args = process.argv.slice(2)) {
    const command = args[0];
    
    try {
      switch (command) {
        case 'test':
          await this.testCommand();
          break;
        case 'config':
          await this.configCommand();
          break;
        case 'analyze':
          await this.analyzeCommand(args.slice(1));
          break;
        case 'security':
          await this.securityCommand(args.slice(1));
          break;
        case 'rules':
          await this.rulesCommand();
          break;
        case 'validate':
          await this.validateCommand(args.slice(1));
          break;
        case 'capabilities':
          await this.capabilitiesCommand();
          break;
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  async testCommand() {
    console.log('🧪 Testing Semgrep Analyzer Connection\n');

    const client = new SemgrepClient();
    const result = await client.testConnection();

    if (result.success) {
      console.log('✅ Semgrep CLI Test Results:');
      console.log(`   📍 Semgrep Path: ${result.semgrepPath}`);
      console.log(`   🔧 Version: ${result.version}`);
      console.log('\n✅ Semgrep is ready for analysis!');
    } else {
      console.log('❌ Semgrep CLI Test Failed:');
      console.log(`   Error: ${result.error}`);
      console.log('\n💡 Installation instructions:');
      console.log('   pip install semgrep');
      console.log('   # or');
      console.log('   brew install semgrep');
      console.log('   # or');
      console.log('   curl -L https://github.com/returntocorp/semgrep/releases/latest/download/semgrep-$(uname)-$(uname -m).tgz | tar -xz');
    }
  }

  async configCommand() {
    console.log('⚙️  Semgrep Analyzer Configuration\n');

    this.analyzer = new SemgrepAnalyzer();
    const status = this.analyzer.getConfigurationStatus();

    console.log(`📊 Configuration Status: ${status.configured ? '✅ Ready' : '❌ Needs Setup'}\n`);

    console.log('📋 Requirements:');
    status.requirements.forEach(req => {
      const icon = req.required ? '🔴' : '🟡';
      console.log(`   ${icon} ${req.name}: ${req.description}`);
      if (req.installInstructions) {
        console.log(`      💡 Install: ${req.installInstructions}`);
      }
    });

    console.log('\n🔧 Available Rules:');
    console.log('   🛡️  Security: p/security-audit, p/owasp-top-10, p/cwe-top-25');
    console.log('   🎯 Quality: p/code-quality, p/maintainability');
    console.log('   ⚡ Performance: p/performance');
    console.log('   📁 Custom: Local rules files (.yml, .yaml)');

    console.log('\n💡 Usage Examples:');
    console.log('   semgrep-analyzer analyze /path/to/project');
    console.log('   semgrep-analyzer security /path/to/project --rules p/owasp-top-10');
    console.log('   semgrep-analyzer analyze /path/to/project --rules custom-rules.yml');
  }

  async analyzeCommand(args) {
    const targetPath = args[0];
    if (!targetPath) {
      console.error('❌ Target path required');
      console.log('Usage: semgrep-analyzer analyze <path> [options]');
      process.exit(1);
    }

    console.log(`🔍 Analyzing target: ${targetPath}\n`);

    const options = this.parseAnalyzeOptions(args.slice(1));
    
    this.analyzer = new SemgrepAnalyzer();
    
    try {
      const result = await this.analyzer.analyzeTarget(targetPath, options);
      
      console.log('📊 Analysis Results:');
      console.log('==================');
      console.log(`Project: ${result.project.name}`);
      console.log(`Security Score: ${result.project.metrics.securityScore}/100`);
      console.log(`Risk Level: ${result.project.metrics.riskLevel}`);
      console.log(`Total Findings: ${result.issues.length}`);
      console.log(`Files Analyzed: ${result.files.length}`);
      console.log(`Districts: ${result.cityVisualization.districts.length}`);

      if (result.issues.length > 0) {
        console.log('\n🚨 Top Issues by Severity:');
        const bySeverity = this.groupIssuesBySeverity(result.issues);
        Object.entries(bySeverity).forEach(([severity, issues]) => {
          if (issues.length > 0) {
            const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🔵';
            console.log(`   ${icon} ${severity.toUpperCase()}: ${issues.length} issues`);
          }
        });

        console.log('\n🔍 Sample Issues:');
        result.issues.slice(0, 5).forEach(issue => {
          console.log(`   • ${issue.rule.key}: ${issue.message.substring(0, 80)}...`);
          console.log(`     📁 ${issue.location.file}:${issue.location.line}`);
        });
      }

      console.log(`\n✅ Analysis complete! Results saved to unified data model.`);
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  async securityCommand(args) {
    const targetPath = args[0];
    if (!targetPath) {
      console.error('❌ Target path required');
      console.log('Usage: semgrep-analyzer security <path> [options]');
      process.exit(1);
    }

    console.log(`🛡️  Security Analysis: ${targetPath}\n`);

    const options = {
      ...this.parseAnalyzeOptions(args.slice(1)),
      rules: args.includes('--rules') ? this.getOptionValue(args, '--rules') : 'p/security-audit'
    };
    
    this.analyzer = new SemgrepAnalyzer();
    
    try {
      const result = await this.analyzer.securityAnalysis(targetPath, options);
      
      console.log('🛡️  Security Analysis Results:');
      console.log('==============================');
      console.log(`Security Score: ${result.project.metrics.securityScore}/100`);
      console.log(`Risk Level: ${result.project.metrics.riskLevel}`);
      console.log(`Security Findings: ${result.project.metrics.securityFindings}`);
      console.log(`Critical Findings: ${result.project.metrics.criticalFindings}`);

      const securityIssues = result.issues.filter(i => i.type === 'security');
      if (securityIssues.length > 0) {
        console.log('\n🚨 Security Issues:');
        securityIssues.slice(0, 10).forEach(issue => {
          const severityIcon = {
            'critical': '🔴',
            'high': '🟠', 
            'medium': '🟡',
            'low': '🔵'
          }[issue.severity] || '⚪';
          
          console.log(`   ${severityIcon} ${issue.rule.key}`);
          console.log(`     💬 ${issue.message}`);
          console.log(`     📁 ${issue.location.file}:${issue.location.line}`);
          
          if (issue.semgrepData?.cwe?.length > 0) {
            console.log(`     🏷️  CWE: ${issue.semgrepData.cwe.join(', ')}`);
          }
          if (issue.semgrepData?.owasp?.length > 0) {
            console.log(`     🔒 OWASP: ${issue.semgrepData.owasp.join(', ')}`);
          }
          console.log('');
        });
      }

      console.log(`✅ Security analysis complete!`);
      
    } catch (error) {
      console.error(`❌ Security analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  async rulesCommand() {
    console.log('📋 Available Semgrep Rules\n');

    this.analyzer = new SemgrepAnalyzer();
    
    try {
      const rulesets = await this.analyzer.getAvailableRulesets();
      
      console.log('🛡️  Security Rules:');
      rulesets.security.forEach(rule => {
        console.log(`   • ${rule}`);
      });

      console.log('\n🎯 Quality Rules:');
      rulesets.quality.forEach(rule => {
        console.log(`   • ${rule}`);
      });

      console.log('\n⚡ Performance Rules:');
      rulesets.performance.forEach(rule => {
        console.log(`   • ${rule}`);
      });

      console.log('\n📁 Custom Rules:');
      console.log('   • Provide path to local YAML rules file');
      console.log('   • Example: --rules ./custom-security-rules.yml');

      console.log('\n💡 Usage Examples:');
      console.log('   semgrep-analyzer analyze /path --rules p/security-audit');
      console.log('   semgrep-analyzer analyze /path --rules p/owasp-top-10');
      console.log('   semgrep-analyzer analyze /path --rules custom-rules.yml');
      
    } catch (error) {
      console.warn(`⚠️  Could not fetch available rulesets: ${error.message}`);
      console.log('💡 Common rulesets: p/security-audit, p/owasp-top-10, p/cwe-top-25');
    }
  }

  async validateCommand(args) {
    const targetPath = args[0];
    if (!targetPath) {
      console.error('❌ Target path required');
      console.log('Usage: semgrep-analyzer validate <path>');
      process.exit(1);
    }

    console.log(`✅ Validating target: ${targetPath}\n`);

    this.analyzer = new SemgrepAnalyzer();
    
    try {
      const validation = await this.analyzer.validateTarget(targetPath);
      
      if (validation.valid) {
        console.log('✅ Target Validation Results:');
        console.log(`   📁 Path: ${validation.target.path}`);
        console.log(`   📊 Type: ${validation.target.type}`);
        console.log(`   🔍 Analyzable: ${validation.target.analyzable ? 'Yes' : 'No'}`);
        console.log('\n✅ Target is ready for analysis!');
      } else {
        console.log('❌ Target Validation Failed:');
        console.log(`   Error: ${validation.error}`);
        console.log('\n💡 Please check the path and try again.');
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async capabilitiesCommand() {
    console.log('🔧 Semgrep Analyzer Capabilities\n');

    this.analyzer = new SemgrepAnalyzer();
    const capabilities = this.analyzer.getCapabilities();

    console.log(`📊 Analyzer: ${capabilities.name} v${capabilities.version}`);
    console.log(`🎯 Tier: ${capabilities.tier} (Priority: ${capabilities.priority})`);
    console.log(`📈 Market Share: ${capabilities.marketShare}\n`);

    console.log('🚀 Features:');
    Object.entries(capabilities.features).forEach(([feature, enabled]) => {
      const icon = enabled ? '✅' : '❌';
      console.log(`   ${icon} ${feature}`);
    });

    console.log('\n📋 Data Types:');
    Object.entries(capabilities.dataTypes).forEach(([type, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${type}`);
    });

    console.log('\n🌍 Languages:');
    const languages = capabilities.languages || [];
    languages.forEach(lang => {
      console.log(`   • ${lang}`);
    });

    console.log('\n🔗 Integrations:');
    Object.entries(capabilities.integrations).forEach(([integration, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${integration}`);
    });

    console.log('\n🏙️  City Visualization Mapping:');
    Object.entries(capabilities.cityMapping).forEach(([element, description]) => {
      console.log(`   🏗️  ${element}: ${description}`);
    });

    console.log('\n🛡️  Compliance Support:');
    Object.entries(capabilities.compliance).forEach(([standard, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${standard.toUpperCase()}`);
    });
  }

  parseAnalyzeOptions(args) {
    const options = {};
    
    // Parse --rules option
    if (args.includes('--rules')) {
      options.rules = this.getOptionValue(args, '--rules');
    }
    
    // Parse --severity option
    if (args.includes('--severity')) {
      const severity = this.getOptionValue(args, '--severity');
      options.severity = severity.split(',');
    }
    
    // Parse --exclude option
    if (args.includes('--exclude')) {
      const exclude = this.getOptionValue(args, '--exclude');
      options.exclude = exclude.split(',');
    }
    
    // Parse --lang option
    if (args.includes('--lang')) {
      const lang = this.getOptionValue(args, '--lang');
      options.languages = lang.split(',');
    }
    
    return options;
  }

  getOptionValue(args, option) {
    const index = args.indexOf(option);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }
    return null;
  }

  groupIssuesBySeverity(issues) {
    const grouped = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    issues.forEach(issue => {
      const severity = issue.severity || 'low';
      if (grouped[severity]) {
        grouped[severity].push(issue);
      }
    });
    
    return grouped;
  }

  showHelp() {
    console.log(`
🛡️  Semgrep Analyzer CLI - Topolop Security Analysis Integration

USAGE:
  semgrep-analyzer <command> [args]

COMMANDS:
  test                Test Semgrep CLI availability and connection
  config              Show configuration status and requirements
  analyze <path>      Run comprehensive security analysis on target
  security <path>     Run security-focused analysis with OWASP rules
  rules               List available Semgrep rulesets  
  validate <path>     Validate target path for analysis
  capabilities        Show analyzer capabilities and features
  help                Show this help message

ANALYSIS OPTIONS:
  --rules <rules>     Specify rules/ruleset (default: p/security-audit)
  --severity <list>   Filter by severity: ERROR,WARNING,INFO
  --exclude <list>    Exclude file patterns (comma-separated)
  --lang <list>       Filter by languages (comma-separated)

EXAMPLES:
  semgrep-analyzer test
  semgrep-analyzer analyze /path/to/project
  semgrep-analyzer security /path/to/project --rules p/owasp-top-10
  semgrep-analyzer analyze /path --rules custom-rules.yml --severity ERROR,WARNING
  semgrep-analyzer validate /path/to/project
  semgrep-analyzer capabilities

For more information, visit: https://github.com/topolop/topolop
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new SemgrepCLI();
  cli.run().catch(error => {
    console.error(`💥 CLI Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = SemgrepCLI;