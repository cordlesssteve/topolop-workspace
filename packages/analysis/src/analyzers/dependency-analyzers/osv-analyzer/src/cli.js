#!/usr/bin/env node

/**
 * OSV-Scanner Analyzer CLI - Topolop Multi-Ecosystem Dependency Security Analysis
 *
 * Command-line interface for testing and using the OSV-Scanner analyzer.
 * Supports multiple package ecosystems and comprehensive vulnerability scanning.
 */

const OSVAnalyzer = require('./index');
const path = require('path');
const fs = require('fs-extra');

class OSVAnalyzerCLI {
  constructor() {
    this.analyzer = null;
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    try {
      switch (command) {
        case 'test':
          await this.testConnection();
          break;
        case 'analyze':
          await this.analyzeProject(args[1]);
          break;
        case 'package':
          await this.analyzePackage(args[1], args[2], args[3]);
          break;
        case 'ecosystems':
          await this.showEcosystems();
          break;
        case 'info':
          await this.showInfo();
          break;
        case 'health':
          await this.healthCheck();
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error('🚨 CLI Error:', error.message);
      process.exit(1);
    }
  }

  async testConnection() {
    console.log('🔍 Testing OSV-Scanner Analyzer...\n');

    this.analyzer = new OSVAnalyzer();

    try {
      const result = await this.analyzer.initialize();
      console.log('✅ Connection test successful!');
      console.log(`   Tool: ${result.tool}`);
      console.log(`   Version: ${result.version}`);
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      console.log('\n💡 Installation instructions:');
      console.log('   1. Download from: https://github.com/google/osv-scanner/releases');
      console.log('   2. Extract to ~/scripts/osv-scanner or add to PATH');
      console.log('   3. Make executable: chmod +x osv-scanner');
      process.exit(1);
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    console.log(`🔍 Analyzing project: ${projectPath}\n`);

    this.analyzer = new OSVAnalyzer();

    try {
      const result = await this.analyzer.analyzeProject(projectPath);

      console.log('\n📊 Analysis Results:');
      console.log(`   Tool: ${result.tool}`);
      console.log(`   Analysis Type: ${result.analysisType}`);
      console.log(`   Project: ${result.projectPath}`);
      console.log(`   Sources Scanned: ${result.entities.length}`);
      console.log(`   Vulnerabilities: ${result.issues.length}`);

      if (result.metadata.scannedSources) {
        console.log('\n📁 Scanned Sources:');
        result.metadata.scannedSources.forEach(source => {
          console.log(`   ${source.path} (${source.packageCount} packages)`);
        });
      }

      if (result.issues.length > 0) {
        console.log('\n🔍 Vulnerabilities Found:');

        // Group by severity
        const bySeverity = result.issues.reduce((acc, issue) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, {});

        Object.entries(bySeverity).forEach(([severity, count]) => {
          const emoji = this._getSeverityEmoji(severity);
          console.log(`   ${emoji} ${severity.toUpperCase()}: ${count}`);
        });

        console.log('\n📋 Sample Vulnerabilities:');
        result.issues.slice(0, 5).forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.title}`);
          console.log(`      Package: ${issue.entity.name}`);
          console.log(`      Severity: ${issue.severity}`);
          console.log(`      ID: ${issue.metadata.osvId || issue.ruleId}`);
          if (issue.metadata.ecosystem) {
            console.log(`      Ecosystem: ${issue.metadata.ecosystem}`);
          }
        });

        if (result.issues.length > 5) {
          console.log(`   ... and ${result.issues.length - 5} more`);
        }
      } else {
        console.log('\n✅ No vulnerabilities found!');
      }

      // Save results to file
      const outputPath = path.join(projectPath, 'osv-scanner-topolop-results.json');
      await fs.writeJson(outputPath, result, { spaces: 2 });
      console.log(`\n📁 Results saved to: ${outputPath}`);

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzePackage(packageName, ecosystem = 'npm', version = 'latest') {
    if (!packageName) {
      console.error('❌ Package name required');
      console.log('Usage: npm run analyze package <package-name> [ecosystem] [version]');
      console.log('Example: npm run analyze package express npm latest');
      process.exit(1);
    }

    console.log(`🔍 Analyzing package: ${packageName}@${version} (${ecosystem})\n`);

    this.analyzer = new OSVAnalyzer();

    try {
      const result = await this.analyzer.analyzePackage(packageName, ecosystem, version);

      console.log('\n📊 Package Analysis Results:');
      console.log(`   Package: ${packageName}@${version}`);
      console.log(`   Ecosystem: ${ecosystem}`);
      console.log(`   Vulnerabilities: ${result.issues.length}`);

      if (result.issues.length > 0) {
        console.log('\n🔍 Vulnerabilities Found:');
        result.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.title}`);
          console.log(`      Severity: ${issue.severity}`);
          console.log(`      ID: ${issue.metadata.osvId || issue.ruleId}`);
          if (issue.metadata.aliases && issue.metadata.aliases.length > 0) {
            console.log(`      Aliases: ${issue.metadata.aliases.join(', ')}`);
          }
        });
      } else {
        console.log('\n✅ No vulnerabilities found!');
      }

      // Save results to file
      const outputPath = `osv-${packageName.replace('/', '-')}-${ecosystem}-results.json`;
      await fs.writeJson(outputPath, result, { spaces: 2 });
      console.log(`\n📁 Results saved to: ${outputPath}`);

    } catch (error) {
      console.error('❌ Package analysis failed:', error.message);
      process.exit(1);
    }
  }

  async showEcosystems() {
    console.log('🌐 OSV-Scanner Supported Ecosystems\n');

    this.analyzer = new OSVAnalyzer();
    const ecosystems = this.analyzer.getSupportedEcosystems();

    console.log('Supported package ecosystems:');
    ecosystems.forEach(ecosystem => {
      const description = this._getEcosystemDescription(ecosystem);
      console.log(`   📦 ${ecosystem.toUpperCase()}: ${description}`);
    });

    console.log('\nUsage examples:');
    console.log('   node cli.js package express npm');
    console.log('   node cli.js package requests pypi');
    console.log('   node cli.js package serde cargo');
    console.log('   node cli.js package github.com/gin-gonic/gin go');
  }

  async showInfo() {
    console.log('🔍 OSV-Scanner Analyzer Information\n');

    this.analyzer = new OSVAnalyzer();
    const info = this.analyzer.getInfo();

    console.log(`Name: ${info.displayName} (${info.name})`);
    console.log(`Description: ${info.description}`);
    console.log(`Analysis Type: ${info.analysisType}`);

    console.log(`\nCapabilities:`);
    Object.entries(info.capabilities).forEach(([key, value]) => {
      console.log(`   ${key}: ${value ? '✅' : '❌'}`);
    });

    console.log(`\nSupported Ecosystems (${info.supportedEcosystems.length}):`);
    info.supportedEcosystems.forEach(ecosystem => {
      console.log(`   📦 ${ecosystem}`);
    });

    console.log(`\nSupported Files: ${info.supportedFileTypes.join(', ')}`);
    console.log(`Required Tools: ${info.requiredTools.join(', ')}`);
  }

  async healthCheck() {
    console.log('🔍 OSV-Scanner Analyzer Health Check\n');

    this.analyzer = new OSVAnalyzer();

    try {
      const health = await this.analyzer.healthCheck();

      console.log(`Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

      if (health.version) {
        console.log(`Version: ${health.version}`);
      }

      if (health.binary) {
        console.log(`Binary: ${health.binary}`);
      }

      if (health.supportedEcosystems) {
        console.log(`Supported Ecosystems: ${health.supportedEcosystems}`);
      }

      if (health.issues && health.issues.length > 0) {
        console.log('\nIssues:');
        health.issues.forEach(issue => {
          console.log(`   ❌ ${issue}`);
        });
      }

      if (!health.healthy) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  }

  _getSeverityEmoji(severity) {
    switch (severity.toLowerCase()) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '🔵';
    }
  }

  _getEcosystemDescription(ecosystem) {
    const descriptions = {
      npm: 'Node.js packages',
      pypi: 'Python packages',
      cargo: 'Rust crates',
      go: 'Go modules',
      maven: 'Java/Maven artifacts',
      nuget: '.NET packages',
      composer: 'PHP packages',
      rubygems: 'Ruby gems'
    };

    return descriptions[ecosystem] || 'Package ecosystem';
  }

  showHelp() {
    console.log(`
🔍 OSV-Scanner Analyzer CLI - Multi-Ecosystem Vulnerability Scanning

Usage: node cli.js <command> [options]

Commands:
  test                           Test OSV-Scanner connection and availability
  analyze [path]                Analyze project dependencies (default: current directory)
  package <name> [eco] [ver]    Analyze specific package
  ecosystems                    Show supported package ecosystems
  info                          Show analyzer information and capabilities
  health                        Run health check
  help                          Show this help message

Examples:
  node cli.js test
  node cli.js analyze
  node cli.js analyze /path/to/project
  node cli.js package express npm latest
  node cli.js package requests pypi
  node cli.js package serde cargo 1.0.0
  node cli.js ecosystems
  node cli.js info
  node cli.js health

Supported Ecosystems:
  npm, pypi, cargo, go, maven, nuget, composer, rubygems

Note: This analyzer integrates with Topolop's unified analysis platform
for cross-tool correlation and city visualization.

OSV-Scanner uses the Open Source Vulnerabilities database maintained by Google.
More info: https://osv.dev
    `);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new OSVAnalyzerCLI();
  cli.run().catch(error => {
    console.error('🚨 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = OSVAnalyzerCLI;