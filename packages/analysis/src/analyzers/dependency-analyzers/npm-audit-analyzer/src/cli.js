#!/usr/bin/env node

/**
 * NPM Audit Analyzer CLI - Topolop Dependency Security Analysis
 *
 * Command-line interface for testing and using the npm audit analyzer.
 * Follows Topolop's established CLI patterns for consistency.
 */

const NPMAuditAnalyzer = require('./index');
const path = require('path');
const fs = require('fs-extra');

class NPMAuditCLI {
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
          await this.analyzePackage(args[1], args[2]);
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
    console.log('🔍 Testing NPM Audit Analyzer...\n');

    this.analyzer = new NPMAuditAnalyzer();

    try {
      const result = await this.analyzer.initialize();
      console.log('✅ Connection test successful!');
      console.log(`   Tool: ${result.tool}`);
      console.log(`   Version: ${result.version}`);
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      process.exit(1);
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    console.log(`🔍 Analyzing project: ${projectPath}\n`);

    this.analyzer = new NPMAuditAnalyzer();

    try {
      const result = await this.analyzer.analyzeProject(projectPath);

      console.log('\n📊 Analysis Results:');
      console.log(`   Tool: ${result.tool}`);
      console.log(`   Analysis Type: ${result.analysisType}`);
      console.log(`   Project: ${result.projectPath}`);
      console.log(`   Entities: ${result.entities.length}`);
      console.log(`   Issues: ${result.issues.length}`);

      if (result.issues.length > 0) {
        console.log('\n🔍 Vulnerabilities Found:');
        result.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.title}`);
          console.log(`      Package: ${issue.entity.name}`);
          console.log(`      Severity: ${issue.severity}`);
          console.log(`      Rule: ${issue.ruleId}`);
        });
      } else {
        console.log('\n✅ No vulnerabilities found!');
      }

      // Save results to file
      const outputPath = path.join(projectPath, 'npm-audit-topolop-results.json');
      await fs.writeJson(outputPath, result, { spaces: 2 });
      console.log(`\n📁 Results saved to: ${outputPath}`);

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzePackage(packageName, version = 'latest') {
    if (!packageName) {
      console.error('❌ Package name required');
      console.log('Usage: npm run analyze package <package-name> [version]');
      process.exit(1);
    }

    console.log(`🔍 Analyzing package: ${packageName}@${version}\n`);

    this.analyzer = new NPMAuditAnalyzer();

    try {
      const result = await this.analyzer.analyzePackage(packageName, version);

      console.log('\n📊 Package Analysis Results:');
      console.log(`   Package: ${packageName}@${version}`);
      console.log(`   Issues: ${result.issues.length}`);

      if (result.issues.length > 0) {
        console.log('\n🔍 Vulnerabilities Found:');
        result.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.title}`);
          console.log(`      Severity: ${issue.severity}`);
          console.log(`      Rule: ${issue.ruleId}`);
          if (issue.metadata.url) {
            console.log(`      URL: ${issue.metadata.url}`);
          }
        });
      } else {
        console.log('\n✅ No vulnerabilities found!');
      }

      // Save results to file
      const outputPath = `npm-audit-${packageName.replace('/', '-')}-results.json`;
      await fs.writeJson(outputPath, result, { spaces: 2 });
      console.log(`\n📁 Results saved to: ${outputPath}`);

    } catch (error) {
      console.error('❌ Package analysis failed:', error.message);
      process.exit(1);
    }
  }

  async showInfo() {
    console.log('🔍 NPM Audit Analyzer Information\n');

    this.analyzer = new NPMAuditAnalyzer();
    const info = this.analyzer.getInfo();

    console.log(`Name: ${info.displayName} (${info.name})`);
    console.log(`Description: ${info.description}`);
    console.log(`Analysis Type: ${info.analysisType}`);
    console.log(`\nCapabilities:`);
    Object.entries(info.capabilities).forEach(([key, value]) => {
      console.log(`   ${key}: ${value ? '✅' : '❌'}`);
    });
    console.log(`\nSupported Files: ${info.supportedFileTypes.join(', ')}`);
    console.log(`Required Tools: ${info.requiredTools.join(', ')}`);
  }

  async healthCheck() {
    console.log('🔍 NPM Audit Analyzer Health Check\n');

    this.analyzer = new NPMAuditAnalyzer();

    try {
      const health = await this.analyzer.healthCheck();

      console.log(`Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

      if (health.version) {
        console.log(`Version: ${health.version}`);
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

  showHelp() {
    console.log(`
🔍 NPM Audit Analyzer CLI - Topolop Dependency Security Analysis

Usage: node cli.js <command> [options]

Commands:
  test                     Test npm CLI connection and availability
  analyze [path]          Analyze project dependencies (default: current directory)
  package <name> [ver]    Analyze specific package (version optional)
  info                    Show analyzer information and capabilities
  health                  Run health check
  help                    Show this help message

Examples:
  node cli.js test
  node cli.js analyze
  node cli.js analyze /path/to/project
  node cli.js package express
  node cli.js package lodash 4.17.21
  node cli.js info
  node cli.js health

Note: This analyzer integrates with Topolop's unified analysis platform
for cross-tool correlation and city visualization.
    `);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new NPMAuditCLI();
  cli.run().catch(error => {
    console.error('🚨 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = NPMAuditCLI;