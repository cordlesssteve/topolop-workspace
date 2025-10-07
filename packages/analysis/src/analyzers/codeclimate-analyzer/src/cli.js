#!/usr/bin/env node

/**
 * CodeClimate Analyzer CLI
 * 
 * Command-line interface for testing and using the CodeClimate analyzer.
 * Provides commands for testing connectivity, searching repositories, and analyzing projects.
 */

const CodeClimateAnalyzer = require('./index');

class CodeClimateCLI {
  constructor() {
    this.analyzer = null;
  }

  async run() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    console.log('🔍 CodeClimate Analyzer CLI');
    console.log('============================\n');

    try {
      switch (command) {
        case 'test':
          await this.testConnection();
          break;

        case 'config':
          await this.checkConfiguration();
          break;

        case 'repos':
        case 'repositories':
          await this.listRepositories(args[0]);
          break;

        case 'search':
          await this.searchRepositories(args[0]);
          break;

        case 'analyze':
          await this.analyzeRepository(args[0]);
          break;

        case 'validate':
          await this.validateRepository(args[0]);
          break;

        case 'capabilities':
          await this.showCapabilities();
          break;

        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;

        default:
          console.log('❌ Unknown command:', command);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async testConnection() {
    console.log('🔌 Testing CodeClimate connection...\n');
    
    if (!this.isConfigured()) {
      console.log('⚠️  CodeClimate not configured');
      this.showConfigurationHelp();
      return;
    }

    try {
      this.analyzer = new CodeClimateAnalyzer();
      await this.analyzer.initialize();
      console.log('✅ Connection test successful!');
    } catch (error) {
      console.log('❌ Connection test failed:', error.message);
      this.showConfigurationHelp();
    }
  }

  async checkConfiguration() {
    console.log('⚙️  Checking CodeClimate configuration...\n');
    
    this.analyzer = new CodeClimateAnalyzer();
    const status = this.analyzer.getConfigurationStatus();
    
    console.log(`Configuration Status: ${status.configured ? '✅ Configured' : '❌ Not Configured'}\n`);
    
    if (status.requirements.length > 0) {
      console.log('Requirements:');
      status.requirements.forEach(req => {
        const icon = req.required ? '🔴' : '🟡';
        const reqStatus = req.required ? 'Required' : 'Optional';
        console.log(`  ${icon} ${req.name} (${reqStatus})`);
        console.log(`     ${req.description}`);
        if (req.default) {
          console.log(`     Default: ${req.default}`);
        }
        console.log();
      });
    }
  }

  async listRepositories(pageLimit) {
    console.log('📋 Listing your CodeClimate repositories...\n');
    
    if (!await this.ensureInitialized()) return;

    try {
      const limit = pageLimit ? parseInt(pageLimit, 10) : 10;
      const repos = await this.analyzer.getRepositories({ pageSize: limit });
      
      if (repos.repositories.length === 0) {
        console.log('No repositories found');
        return;
      }

      console.log(`Found ${repos.total} repositories (showing first ${repos.repositories.length}):\n`);
      
      repos.repositories.forEach((repo, index) => {
        const attrs = repo.attributes;
        console.log(`${index + 1}. ${attrs.human_name || attrs.github_slug}`);
        console.log(`   ID: ${repo.id}`);
        console.log(`   GitHub: ${attrs.github_slug}`);
        console.log(`   Rating: ${attrs.rating?.letter || 'Not rated'}`);
        console.log(`   Coverage: ${attrs.test_coverage_value || 0}%`);
        console.log(`   Last Activity: ${attrs.last_activity_at ? new Date(attrs.last_activity_at).toLocaleDateString() : 'Never'}`);
        console.log();
      });
    } catch (error) {
      console.log('❌ Failed to list repositories:', error.message);
    }
  }

  async searchRepositories(query) {
    if (!query) {
      console.log('❌ Please provide a GitHub repository slug (e.g., "owner/repo")');
      return;
    }

    console.log(`🔍 Searching for repository: ${query}...\n`);
    
    if (!await this.ensureInitialized()) return;

    try {
      const result = await this.analyzer.searchRepositories(query);
      
      if (result.repositories.length === 0) {
        console.log(`No repositories found matching "${query}"`);
        console.log('\n💡 Tips:');
        console.log('   • Make sure the repository is added to CodeClimate');
        console.log('   • Use the format "owner/repository-name"');
        console.log('   • Check your access permissions');
        return;
      }

      console.log(`✅ Found ${result.repositories.length} matching repositories:\n`);
      
      result.repositories.forEach((repo, index) => {
        const attrs = repo.attributes;
        console.log(`${index + 1}. ${attrs.human_name || attrs.github_slug}`);
        console.log(`   ID: ${repo.id}`);
        console.log(`   GitHub: ${attrs.github_slug}`);
        console.log(`   Rating: ${attrs.rating?.letter || 'Not rated'}`);
        console.log(`   Score: ${attrs.rating?.measure?.value || 0}`);
        console.log(`   Coverage: ${attrs.test_coverage_value || 0}%`);
        console.log();
      });
    } catch (error) {
      console.log('❌ Search failed:', error.message);
    }
  }

  async analyzeRepository(repoIdentifier) {
    if (!repoIdentifier) {
      console.log('❌ Please provide a repository ID or GitHub slug');
      console.log('   Usage: node cli.js analyze "owner/repo" or analyze "12345"');
      return;
    }

    console.log(`📊 Analyzing repository: ${repoIdentifier}...\n`);
    
    if (!await this.ensureInitialized()) return;

    try {
      const analysis = await this.analyzer.analyzeRepository(repoIdentifier);
      
      console.log('📋 Analysis Results:');
      console.log('==================\n');
      
      // Project summary
      console.log(`Project: ${analysis.project.name}`);
      console.log(`GitHub: ${analysis.project.githubSlug || 'N/A'}`);
      console.log(`Overall Rating: ${analysis.project.overallRating}`);
      console.log();
      
      // Metrics
      console.log('📊 Metrics:');
      const metrics = analysis.project.metrics;
      console.log(`   Lines of Code: ${metrics.linesOfCode?.toLocaleString() || 'N/A'}`);
      console.log(`   Maintainability Score: ${metrics.maintainabilityScore || 'N/A'}`);
      console.log(`   Test Coverage: ${metrics.testCoverage || 0}%`);
      console.log(`   Technical Debt: ${Math.round((metrics.technicalDebtMinutes || 0) / 60)}h`);
      console.log();
      
      // Issues
      console.log('🐛 Issues:');
      console.log(`   Total Issues: ${analysis.issues.length}`);
      
      if (analysis.issues.length > 0) {
        const severityCounts = {};
        const typeCounts = {};
        
        analysis.issues.forEach(issue => {
          severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
          typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
        });
        
        console.log('   By Severity:');
        Object.entries(severityCounts).forEach(([severity, count]) => {
          console.log(`     ${severity}: ${count}`);
        });
        
        console.log('   By Type:');
        Object.entries(typeCounts).forEach(([type, count]) => {
          console.log(`     ${type}: ${count}`);
        });
      }
      console.log();
      
      // City visualization
      console.log('🏙️  City Visualization:');
      console.log(`   Districts: ${analysis.cityVisualization.districts.length}`);
      console.log(`   Buildings (Files): ${analysis.files.length}`);
      
      if (analysis.cityVisualization.districts.length > 0) {
        console.log('   District Overview:');
        analysis.cityVisualization.districts.forEach(district => {
          console.log(`     ${district.name}: ${district.files.length} files, ${district.overallCondition} condition`);
        });
      }
      
      console.log('\n✅ Analysis completed successfully!');
    } catch (error) {
      console.log('❌ Analysis failed:', error.message);
    }
  }

  async validateRepository(repoIdentifier) {
    if (!repoIdentifier) {
      console.log('❌ Please provide a repository ID or GitHub slug');
      return;
    }

    console.log(`✅ Validating repository: ${repoIdentifier}...\n`);
    
    if (!await this.ensureInitialized()) return;

    try {
      const validation = await this.analyzer.validateRepository(repoIdentifier);
      
      if (validation.valid) {
        console.log('✅ Repository is valid and accessible!\n');
        console.log('Repository Details:');
        console.log(`   Name: ${validation.repository.name}`);
        console.log(`   GitHub: ${validation.repository.githubSlug}`);
        console.log(`   Rating: ${validation.repository.rating}`);
        console.log(`   Last Analyzed: ${validation.repository.lastAnalyzed ? new Date(validation.repository.lastAnalyzed).toLocaleDateString() : 'Never'}`);
      } else {
        console.log('❌ Repository validation failed!');
        console.log(`   Error: ${validation.error}`);
        
        console.log('\n💡 Troubleshooting:');
        console.log('   • Ensure the repository exists in CodeClimate');
        console.log('   • Check your access permissions');
        console.log('   • Verify the repository ID or GitHub slug format');
      }
    } catch (error) {
      console.log('❌ Validation failed:', error.message);
    }
  }

  async showCapabilities() {
    console.log('🔧 CodeClimate Analyzer Capabilities\n');
    
    this.analyzer = new CodeClimateAnalyzer();
    const capabilities = this.analyzer.getCapabilities();
    
    console.log(`Analyzer: ${capabilities.name} v${capabilities.version}`);
    console.log(`Source: ${capabilities.source}`);
    console.log(`Tier: ${capabilities.tier} (${capabilities.priority} priority)`);
    console.log(`Market Share: ${capabilities.marketShare}`);
    console.log();
    
    console.log('Features:');
    Object.entries(capabilities.features).forEach(([feature, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    console.log();
    
    console.log('Data Types:');
    Object.entries(capabilities.dataTypes).forEach(([dataType, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${dataType.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    console.log();
    
    console.log('Integrations:');
    Object.entries(capabilities.integrations).forEach(([integration, supported]) => {
      const icon = supported ? '✅' : '❌';
      console.log(`   ${icon} ${integration}`);
    });
    console.log();
    
    console.log('City Visualization Mapping:');
    Object.entries(capabilities.cityMapping).forEach(([element, description]) => {
      console.log(`   🏙️  ${element}: ${description}`);
    });
  }

  showHelp() {
    console.log('CodeClimate Analyzer CLI Commands:\n');
    console.log('🔧 Configuration & Testing:');
    console.log('   config         Check configuration status');
    console.log('   test          Test connection to CodeClimate');
    console.log('   capabilities  Show analyzer capabilities\n');
    
    console.log('📋 Repository Management:');
    console.log('   repos [limit] List your repositories');
    console.log('   search <slug> Search for repository by GitHub slug');
    console.log('   validate <id> Validate repository access\n');
    
    console.log('📊 Analysis:');
    console.log('   analyze <id>  Analyze repository (ID or GitHub slug)\n');
    
    console.log('💡 Examples:');
    console.log('   node cli.js test');
    console.log('   node cli.js repos 5');
    console.log('   node cli.js search "rails/rails"');
    console.log('   node cli.js analyze "owner/repository"');
    console.log('   node cli.js analyze "12345"\n');
    
    console.log('🛠️  Setup:');
    console.log('   Set CODECLIMATE_TOKEN environment variable with your API token');
    console.log('   Get your token from: https://codeclimate.com/profile/tokens');
  }

  showConfigurationHelp() {
    console.log('\n🛠️  Configuration Help:');
    console.log('========================');
    console.log('To use the CodeClimate analyzer:');
    console.log();
    console.log('1. Get your API token from: https://codeclimate.com/profile/tokens');
    console.log('2. Set the environment variable:');
    console.log('   export CODECLIMATE_TOKEN="your-api-token"');
    console.log();
    console.log('3. Test the connection:');
    console.log('   node cli.js test');
    console.log();
    console.log('4. List your repositories:');
    console.log('   node cli.js repos');
  }

  async ensureInitialized() {
    if (!this.isConfigured()) {
      console.log('⚠️  CodeClimate not configured');
      this.showConfigurationHelp();
      return false;
    }

    if (!this.analyzer) {
      this.analyzer = new CodeClimateAnalyzer();
      await this.analyzer.initialize();
    }
    
    return true;
  }

  isConfigured() {
    return !!(process.env.CODECLIMATE_TOKEN);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new CodeClimateCLI();
  cli.run().catch(error => {
    console.error(`❌ CLI Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = CodeClimateCLI;