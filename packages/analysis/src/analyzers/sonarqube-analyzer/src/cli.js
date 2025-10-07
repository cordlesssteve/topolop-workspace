#!/usr/bin/env node

const SonarQubeAnalyzer = require('./index');

/**
 * SonarQube Analyzer CLI
 * 
 * Command-line interface for testing and using the SonarQube analyzer
 */
class SonarQubeAnalyzerCLI {
  constructor() {
    this.analyzer = null;
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      this.showUsage();
      return;
    }

    const command = args[0];
    
    try {
      switch (command) {
        case 'test':
          await this.testConnection();
          break;
        case 'config':
          await this.showConfiguration();
          break;
        case 'search':
          await this.searchProjects(args[1]);
          break;
        case 'analyze':
          await this.analyzeProject(args[1]);
          break;
        case 'validate':
          await this.validateProject(args[1]);
          break;
        case 'capabilities':
          this.showCapabilities();
          break;
        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showUsage();
      }
    } catch (error) {
      console.error(`❌ Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  showUsage() {
    console.log(`
🔍 SonarQube Analyzer CLI - Topolop Layer 1 Data Source

USAGE:
  node cli.js <command> [options]

COMMANDS:
  test                    Test connection to SonarQube
  config                  Show current configuration status
  search [term]           Search for projects (optional search term)
  analyze <projectKey>    Analyze a specific project
  validate <projectKey>   Validate project exists and is accessible
  capabilities            Show analyzer capabilities

ENVIRONMENT VARIABLES:
  SONARQUBE_TOKEN         SonarQube API token (required)
  SONARQUBE_ORG           SonarCloud organization (required for SonarCloud)
  SONARQUBE_URL           SonarQube server URL (default: https://sonarcloud.io)

EXAMPLES:
  node cli.js test
  node cli.js search "my-project"
  node cli.js analyze "my-org_my-project"
  node cli.js validate "my-org_my-project"
`);
  }

  async testConnection() {
    console.log('🔌 Testing SonarQube connection...\n');
    
    this.analyzer = new SonarQubeAnalyzer();
    const configStatus = this.analyzer.getConfigurationStatus();
    
    if (!configStatus.configured) {
      console.error('❌ Configuration incomplete:');
      configStatus.requirements.forEach(req => {
        console.error(`   • ${req.name}: ${req.description}`);
      });
      return;
    }

    await this.analyzer.initialize();
    console.log('✅ Connection test successful!');
  }

  async showConfiguration() {
    console.log('⚙️  SonarQube Analyzer Configuration\n');
    
    this.analyzer = new SonarQubeAnalyzer();
    const configStatus = this.analyzer.getConfigurationStatus();
    const capabilities = this.analyzer.getCapabilities();
    
    console.log(`📊 Analyzer: ${capabilities.name} v${capabilities.version}`);
    console.log(`🎯 Tier: ${capabilities.tier} (${capabilities.priority} priority)`);
    console.log(`📈 Market Share: ${capabilities.marketShare}`);
    console.log(`🏢 Organization: ${this.analyzer.config.organization || 'Not set'}`);
    console.log(`📡 Server: ${this.analyzer.config.baseUrl}`);
    console.log(`🔑 Token: ${this.analyzer.config.token ? '✅ Set' : '❌ Not set'}`);
    console.log(`⚙️  Configured: ${configStatus.configured ? '✅ Yes' : '❌ No'}`);
    
    if (!configStatus.configured) {
      console.log('\n❌ Missing requirements:');
      configStatus.requirements.forEach(req => {
        console.log(`   • ${req.name}: ${req.description} ${req.required ? '(required)' : '(optional)'}`);
      });
    }
  }

  async searchProjects(searchTerm) {
    console.log(`🔍 Searching SonarQube projects${searchTerm ? ` for: "${searchTerm}"` : ''}...\n`);
    
    this.analyzer = new SonarQubeAnalyzer();
    const result = await this.analyzer.searchProjects(searchTerm, { pageSize: 20 });
    
    if (result.projects.length === 0) {
      console.log('📭 No projects found.');
      return;
    }

    console.log(`📋 Found ${result.total} projects (showing first ${result.projects.length}):\n`);
    
    result.projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.key}`);
      console.log(`   Name: ${project.name}`);
      console.log(`   Visibility: ${project.visibility}`);
      console.log(`   Last Analysis: ${project.lastAnalysisDate || 'Never'}`);
      console.log('');
    });
  }

  async analyzeProject(projectKey) {
    if (!projectKey) {
      console.error('❌ Project key is required for analysis');
      this.showUsage();
      return;
    }

    console.log(`🔍 Starting SonarQube analysis for: ${projectKey}\n`);
    
    this.analyzer = new SonarQubeAnalyzer();
    const unifiedData = await this.analyzer.analyzeProject(projectKey);
    
    // Generate and display summary
    const summary = this.analyzer.generateAnalysisSummary(unifiedData);
    
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('==================');
    console.log(`Project: ${summary.project.key}`);
    console.log(`Overall Rating: ${summary.project.overallRating}`);
    console.log(`Quality Gate: ${summary.project.qualityGateStatus}`);
    console.log(`City Condition: ${summary.cityVisualization.overallCityCondition}`);
    
    console.log('\n📈 METRICS');
    console.log('----------');
    console.log(`Lines of Code: ${summary.metrics.linesOfCode.toLocaleString()}`);
    console.log(`Cyclomatic Complexity: ${summary.metrics.cyclomaticComplexity}`);
    console.log(`Test Coverage: ${summary.metrics.testCoverage}%`);
    console.log(`Code Duplication: ${summary.metrics.duplicationPercentage}%`);
    console.log(`Technical Debt: ${summary.metrics.technicalDebtHours} hours`);
    
    console.log('\n🐛 ISSUES');
    console.log('---------');
    console.log(`Total Issues: ${summary.issues.total}`);
    
    Object.entries(summary.issues.bySeverity).forEach(([severity, count]) => {
      const severityEmoji = {
        'critical': '🚨',
        'high': '⚠️',
        'medium': '🟡',
        'low': '🔵',
        'info': 'ℹ️'
      };
      console.log(`${severityEmoji[severity] || '•'} ${severity}: ${count}`);
    });
    
    console.log(`🔥 Security Hotspots: ${summary.issues.securityHotspots}`);
    
    console.log('\n🏙️  CITY VISUALIZATION');
    console.log('--------------------');
    console.log(`Districts: ${summary.cityVisualization.districts}`);
    console.log(`Buildings: ${summary.cityVisualization.buildings}`);
    console.log(`Overall Condition: ${summary.cityVisualization.overallCityCondition}`);
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('------------------');
      summary.recommendations.forEach((rec, index) => {
        const priorityEmoji = {
          'high': '🚨',
          'medium': '⚠️',
          'low': '💡'
        };
        console.log(`${index + 1}. ${priorityEmoji[rec.priority]} ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
      });
    }
    
    // Save results
    const fs = require('fs');
    const outputPath = `./sonarqube-analysis-${projectKey.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(unifiedData, null, 2));
    console.log(`\n💾 Full analysis saved to: ${outputPath}`);
  }

  async validateProject(projectKey) {
    if (!projectKey) {
      console.error('❌ Project key is required for validation');
      this.showUsage();
      return;
    }

    console.log(`🔍 Validating SonarQube project: ${projectKey}\n`);
    
    this.analyzer = new SonarQubeAnalyzer();
    const validation = await this.analyzer.validateProject(projectKey);
    
    if (validation.valid) {
      console.log('✅ Project validation successful!');
      console.log(`   Key: ${validation.project.key}`);
      console.log(`   Name: ${validation.project.name}`);
      console.log(`   Visibility: ${validation.project.visibility}`);
      console.log(`   Last Analysis: ${validation.project.lastAnalysisDate || 'Never'}`);
    } else {
      console.log('❌ Project validation failed:');
      console.log(`   Error: ${validation.error}`);
    }
  }

  showCapabilities() {
    console.log('🔧 SonarQube Analyzer Capabilities\n');
    
    this.analyzer = new SonarQubeAnalyzer();
    const capabilities = this.analyzer.getCapabilities();
    
    console.log(`📊 ${capabilities.name} v${capabilities.version}`);
    console.log(`🎯 Tier ${capabilities.tier} (${capabilities.priority} priority)`);
    console.log(`📈 Market Share: ${capabilities.marketShare}\n`);
    
    console.log('✨ FEATURES:');
    Object.entries(capabilities.features).forEach(([feature, supported]) => {
      console.log(`   ${supported ? '✅' : '❌'} ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    
    console.log('\n📋 DATA TYPES:');
    Object.entries(capabilities.dataTypes).forEach(([dataType, supported]) => {
      console.log(`   ${supported ? '✅' : '❌'} ${dataType.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    
    console.log('\n🔗 INTEGRATIONS:');
    Object.entries(capabilities.integrations).forEach(([integration, supported]) => {
      console.log(`   ${supported ? '✅' : '❌'} ${integration.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    
    console.log('\n🏙️  CITY MAPPING:');
    Object.entries(capabilities.cityMapping).forEach(([element, description]) => {
      console.log(`   🏢 ${element}: ${description}`);
    });
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new SonarQubeAnalyzerCLI();
  cli.run().catch(error => {
    console.error(`❌ CLI Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = SonarQubeAnalyzerCLI;