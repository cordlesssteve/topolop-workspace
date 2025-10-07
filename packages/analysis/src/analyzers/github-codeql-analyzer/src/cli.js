#!/usr/bin/env node

/**
 * GitHub CodeQL Analyzer CLI
 * 
 * Command-line interface for GitHub CodeQL semantic analysis integration
 * Provides testing, configuration, database management, and analysis capabilities
 */

const CodeQLAnalyzer = require('./index');
const CodeQLClient = require('./codeql-client');
const path = require('path');

class CodeQLCLI {
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
        case 'database':
          await this.databaseCommand(args.slice(1));
          break;
        case 'languages':
          await this.languagesCommand();
          break;
        case 'queries':
          await this.queriesCommand(args.slice(1));
          break;
        case 'validate':
          await this.validateCommand(args.slice(1));
          break;
        case 'capabilities':
          await this.capabilitiesCommand();
          break;
        case 'cleanup':
          await this.cleanupCommand();
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
    console.log('🧪 Testing GitHub CodeQL Analyzer Connection\n');

    const client = new CodeQLClient();
    const result = await client.testConnection();

    if (result.success) {
      console.log('✅ CodeQL CLI Test Results:');
      console.log(`   📍 CodeQL Path: ${result.codeqlPath}`);
      console.log(`   🔧 Version: ${result.version}`);
      console.log('\n✅ CodeQL is ready for semantic analysis!');
    } else {
      console.log('❌ CodeQL CLI Test Failed:');
      console.log(`   Error: ${result.error}`);
      console.log('\n💡 Installation instructions:');
      console.log('   1. Download CodeQL CLI from: https://github.com/github/codeql-cli-binaries/releases');
      console.log('   2. Extract and add to PATH');
      console.log('   3. Or install via GitHub CLI: gh extension install github/gh-codeql');
      console.log('\n🔗 Documentation: https://docs.github.com/en/code-security/codeql-cli');
    }
  }

  async configCommand() {
    console.log('⚙️  GitHub CodeQL Analyzer Configuration\n');

    this.analyzer = new CodeQLAnalyzer();
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

    console.log('\n🗄️  Database Location:');
    console.log(`   📁 ${status.databasesDirectory || 'Default: ./.topolop/codeql-databases'}`);

    console.log('\n🎯 Analysis Types:');
    console.log('   🛡️  Security: Vulnerability detection and CWE mapping');
    console.log('   🐛 Correctness: Logic errors and semantic bugs');
    console.log('   🎨 Maintainability: Code quality and maintainability issues');
    console.log('   📊 Custom: User-defined QL queries');

    console.log('\n💡 Usage Examples:');
    console.log('   codeql-analyzer analyze /path/to/project javascript');
    console.log('   codeql-analyzer security /path/to/project python');
    console.log('   codeql-analyzer database create /path/to/project java');
    console.log('   codeql-analyzer queries list javascript');
  }

  async analyzeCommand(args) {
    const sourcePath = args[0];
    const language = args[1];
    
    if (!sourcePath || !language) {
      console.error('❌ Source path and language required');
      console.log('Usage: codeql-analyzer analyze <path> <language> [options]');
      console.log('Example: codeql-analyzer analyze ./src javascript');
      process.exit(1);
    }

    console.log(`🔍 Analyzing codebase: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}\n`);

    const options = this.parseAnalyzeOptions(args.slice(2));
    
    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const result = await this.analyzer.analyzeCodebase(sourcePath, language, options);
      
      console.log('📊 Analysis Results:');
      console.log('==================');
      console.log(`Project: ${result.project.name}`);
      console.log(`Language: ${result.project.language}`);
      console.log(`Semantic Score: ${result.project.metrics.semanticScore}/100`);
      console.log(`Security Score: ${result.project.metrics.securityScore}/100`);
      console.log(`Overall Rating: ${result.project.overallRating}`);
      console.log(`Total Findings: ${result.issues.length}`);
      console.log(`Files Analyzed: ${result.files.length}`);
      console.log(`Districts: ${result.cityVisualization.districts.length}`);
      console.log(`Data Flow Findings: ${result.project.metrics.dataFlowFindings}`);

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
          if (issue.codeqlData?.dataFlow) {
            console.log(`     🔄 Data flow analysis available`);
          }
        });
      }

      console.log(`\n✅ Semantic analysis complete! Results mapped to unified data model.`);
      
      if (result.temporal.databaseInfo?.created) {
        console.log(`💾 Database created: ${result.metadata.databasePath}`);
      } else {
        console.log(`💾 Database reused: ${result.metadata.databasePath}`);
      }
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  async securityCommand(args) {
    const sourcePath = args[0];
    const language = args[1];
    
    if (!sourcePath || !language) {
      console.error('❌ Source path and language required');
      console.log('Usage: codeql-analyzer security <path> <language> [options]');
      console.log('Example: codeql-analyzer security ./src python');
      process.exit(1);
    }

    console.log(`🛡️  Security Analysis: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}\n`);

    const options = {
      ...this.parseAnalyzeOptions(args.slice(2)),
      queryType: 'security'
    };
    
    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const result = await this.analyzer.securityAnalysis(sourcePath, language, options);
      
      console.log('🛡️  Security Analysis Results:');
      console.log('==============================');
      console.log(`Security Score: ${result.project.metrics.securityScore}/100`);
      console.log(`Semantic Score: ${result.project.metrics.semanticScore}/100`);
      console.log(`Security Findings: ${result.project.metrics.securityFindings}`);
      console.log(`Critical Findings: ${result.project.metrics.criticalFindings}`);
      console.log(`Data Flow Findings: ${result.project.metrics.dataFlowFindings}`);

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
          
          if (issue.codeqlData?.cwe?.length > 0) {
            console.log(`     🏷️  CWE: ${issue.codeqlData.cwe.join(', ')}`);
          }
          if (issue.codeqlData?.dataFlow) {
            console.log(`     🔄 Data flow vulnerability detected`);
          }
          if (issue.codeqlData?.precision) {
            console.log(`     📊 Precision: ${issue.codeqlData.precision}`);
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

  async databaseCommand(args) {
    const subcommand = args[0];
    
    this.analyzer = new CodeQLAnalyzer();
    
    switch (subcommand) {
      case 'list':
        await this.databaseListCommand();
        break;
      case 'create':
        await this.databaseCreateCommand(args.slice(1));
        break;
      case 'cleanup':
        await this.databaseCleanupCommand();
        break;
      default:
        console.log('📊 Database Management Commands:');
        console.log('  list     - List existing CodeQL databases');
        console.log('  create   - Create CodeQL database only');
        console.log('  cleanup  - Clean up old databases');
        console.log('\nUsage: codeql-analyzer database <subcommand>');
    }
  }

  async databaseListCommand() {
    console.log('🗄️  CodeQL Databases\n');

    try {
      const databases = await this.analyzer.listDatabases();
      
      if (databases.length === 0) {
        console.log('📭 No CodeQL databases found');
        return;
      }

      console.log(`📊 Found ${databases.length} databases:\n`);
      
      databases.forEach(db => {
        console.log(`📁 ${db.name}`);
        console.log(`   📍 Path: ${db.path}`);
        console.log(`   🎯 Language: ${db.language}`);
        console.log(`   📅 Created: ${db.created ? new Date(db.created).toLocaleString() : 'Unknown'}`);
        console.log('');
      });
      
    } catch (error) {
      console.error(`❌ Failed to list databases: ${error.message}`);
    }
  }

  async databaseCreateCommand(args) {
    const sourcePath = args[0];
    const language = args[1];
    
    if (!sourcePath || !language) {
      console.error('❌ Source path and language required');
      console.log('Usage: codeql-analyzer database create <path> <language>');
      process.exit(1);
    }

    console.log(`🏗️  Creating CodeQL Database`);
    console.log(`   📁 Source: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}\n`);

    try {
      const result = await this.analyzer.createDatabase(sourcePath, language);
      
      if (result.created) {
        console.log('✅ Database created successfully!');
      } else {
        console.log('✅ Database already exists and was reused');
      }
      
      console.log(`📍 Path: ${result.databasePath}`);
      console.log(`🎯 Language: ${result.language}`);
      
    } catch (error) {
      console.error(`❌ Database creation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async databaseCleanupCommand() {
    console.log('🗑️  Cleaning up old CodeQL databases...\n');

    try {
      const result = await this.analyzer.cleanupDatabases();
      
      console.log(`✅ Cleanup complete:`);
      console.log(`   🗑️  Databases cleaned: ${result.cleanedCount}`);
      console.log(`   📊 Total databases: ${result.totalDatabases}`);
      
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
    }
  }

  async languagesCommand() {
    console.log('🌍 Supported Languages\n');

    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const languages = await this.analyzer.getSupportedLanguages();
      
      console.log(`📋 CodeQL supports ${languages.length} languages:\n`);
      
      languages.forEach(lang => {
        const icon = this.getLanguageIcon(lang);
        console.log(`   ${icon} ${lang}`);
      });

      console.log('\n💡 Usage Examples:');
      console.log('   codeql-analyzer analyze ./src javascript');
      console.log('   codeql-analyzer security ./app python');
      console.log('   codeql-analyzer database create ./project java');
      
    } catch (error) {
      console.error(`❌ Failed to get supported languages: ${error.message}`);
    }
  }

  async queriesCommand(args) {
    const language = args[0];
    
    if (!language) {
      console.error('❌ Language required');
      console.log('Usage: codeql-analyzer queries <language>');
      console.log('Example: codeql-analyzer queries javascript');
      process.exit(1);
    }

    console.log(`📋 Available CodeQL Queries for ${language}\n`);

    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const result = await this.analyzer.getAvailableQueries(language);
      
      if (result.total === 0) {
        console.log(`❌ No queries found for language: ${language}`);
        return;
      }

      console.log(`📊 Found ${result.total} queries (showing sample):\n`);
      
      result.queries.forEach(query => {
        console.log(`   📄 ${query}`);
      });

      if (result.total > result.queries.length) {
        console.log(`   ... and ${result.total - result.queries.length} more`);
      }

      console.log('\n🎯 Query Categories:');
      console.log('   🛡️  Security: Vulnerability detection');
      console.log('   🐛 Correctness: Logic and semantic errors');
      console.log('   🎨 Maintainability: Code quality issues');
      console.log('   📊 Performance: Performance anti-patterns');
      
    } catch (error) {
      console.error(`❌ Failed to get queries for ${language}: ${error.message}`);
    }
  }

  async validateCommand(args) {
    const sourcePath = args[0];
    const language = args[1];
    
    if (!sourcePath || !language) {
      console.error('❌ Source path and language required');
      console.log('Usage: codeql-analyzer validate <path> <language>');
      process.exit(1);
    }

    console.log(`✅ Validating codebase: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}\n`);

    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const validation = await this.analyzer.validateCodebase(sourcePath, language);
      
      if (validation.valid) {
        console.log('✅ Validation Results:');
        console.log(`   📁 Path: ${validation.codebase.path}`);
        console.log(`   🎯 Language: ${validation.codebase.language}`);
        console.log(`   📊 Type: ${validation.codebase.type}`);
        console.log(`   🔍 Analyzable: ${validation.codebase.analyzable ? 'Yes' : 'No'}`);
        console.log('\n✅ Codebase is ready for CodeQL analysis!');
      } else {
        console.log('❌ Validation Failed:');
        console.log(`   Error: ${validation.error}`);
        console.log('\n💡 Please check the path and language, then try again.');
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async capabilitiesCommand() {
    console.log('🔧 GitHub CodeQL Analyzer Capabilities\n');

    this.analyzer = new CodeQLAnalyzer();
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
      const icon = this.getLanguageIcon(lang);
      console.log(`   ${icon} ${lang}`);
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

    console.log('\n🎯 Query Types:');
    Object.entries(capabilities.queryTypes).forEach(([type, description]) => {
      console.log(`   📊 ${type}: ${description}`);
    });
  }

  async cleanupCommand() {
    console.log('🗑️  Cleaning up CodeQL resources...\n');

    this.analyzer = new CodeQLAnalyzer();
    
    try {
      const result = await this.analyzer.cleanupDatabases();
      
      console.log('✅ Cleanup Results:');
      console.log(`   🗑️  Old databases removed: ${result.cleanedCount}`);
      console.log(`   📊 Total databases: ${result.totalDatabases}`);
      console.log('\n💾 Disk space freed from old CodeQL databases.');
      
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
    }
  }

  parseAnalyzeOptions(args) {
    const options = {};
    
    // Parse --queries option
    if (args.includes('--queries')) {
      options.queries = this.getOptionValue(args, '--queries');
    }
    
    // Parse --overwrite-db option
    if (args.includes('--overwrite-db')) {
      options.overwriteDatabase = true;
    }
    
    // Parse --threads option
    if (args.includes('--threads')) {
      const threads = this.getOptionValue(args, '--threads');
      options.threads = parseInt(threads);
    }
    
    // Parse --output option
    if (args.includes('--output')) {
      options.outputFile = this.getOptionValue(args, '--output');
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

  getLanguageIcon(language) {
    const icons = {
      'javascript': '🟨',
      'typescript': '🔷',
      'python': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'csharp': '🔵',
      'go': '🐹',
      'ruby': '💎',
      'swift': '🦉',
      'kotlin': '🎯',
      'scala': '📊'
    };
    return icons[language] || '📄';
  }

  showHelp() {
    console.log(`
🔍 GitHub CodeQL Analyzer CLI - Topolop Semantic Analysis Integration

USAGE:
  codeql-analyzer <command> [args]

COMMANDS:
  test                    Test CodeQL CLI availability and connection
  config                  Show configuration status and requirements
  analyze <path> <lang>   Run comprehensive semantic analysis
  security <path> <lang>  Run security-focused analysis
  database <subcommand>   Manage CodeQL databases (list, create, cleanup)
  languages               List supported programming languages
  queries <language>      List available queries for language
  validate <path> <lang>  Validate codebase for analysis
  capabilities            Show analyzer capabilities and features
  cleanup                 Clean up old databases and temporary files
  help                    Show this help message

DATABASE SUBCOMMANDS:
  list                    List existing CodeQL databases
  create <path> <lang>    Create database without running queries
  cleanup                 Remove old databases to free disk space

ANALYSIS OPTIONS:
  --queries <path>        Custom queries file or suite
  --overwrite-db          Recreate database if exists
  --threads <n>           Number of threads for analysis
  --output <file>         Custom SARIF output file

EXAMPLES:
  codeql-analyzer test
  codeql-analyzer analyze ./src javascript
  codeql-analyzer security ./app python --threads 4
  codeql-analyzer database create ./project java
  codeql-analyzer database list
  codeql-analyzer languages
  codeql-analyzer queries javascript
  codeql-analyzer validate ./codebase cpp
  codeql-analyzer capabilities
  codeql-analyzer cleanup

SUPPORTED LANGUAGES:
  JavaScript, TypeScript, Python, Java, C/C++, C#, Go, Ruby, Swift, Kotlin, Scala

For more information, visit:
  - CodeQL Documentation: https://docs.github.com/en/code-security/codeql-cli
  - Topolop Project: https://github.com/topolop/topolop
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new CodeQLCLI();
  cli.run().catch(error => {
    console.error(`💥 CLI Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = CodeQLCLI;