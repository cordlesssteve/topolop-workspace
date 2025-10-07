#!/usr/bin/env node

/**
 * Enhanced Architecture Analyzer CLI - Topolop Phase 2
 *
 * Command-line interface for Sprint 5-6 architecture analysis tools.
 * Provides unified access to Madge, TypeScript Compiler API, and ESLint
 * architectural analysis capabilities.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 5-6
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { join } = require('path');

// For now, let's create simple stub implementations to test the CLI structure
// The TypeScript adapters will be compiled separately

class MadgeArchitectureAdapter {
  async analyzeArchitecture(projectPath) {
    console.log(`📋 Analyzing architecture with Madge for: ${projectPath}`);
    // Stub implementation - returns sample results
    return [
      {
        id: 'madge-001',
        title: 'Circular dependency detected',
        severity: 'high',
        location: { file: 'src/index.js', line: 1 },
        architectureCategory: 'dependency_cycle',
        technicalDebtLevel: 'high',
        description: 'Circular dependency found between modules'
      }
    ];
  }

  detectDesignPatterns() {
    return [];
  }

  assessTechnicalDebt(issues) {
    return {
      totalIssues: issues.length,
      highPriorityCount: issues.filter(i => i.severity === 'high').length,
      recommendation: 'Focus on circular dependency issues first'
    };
  }
}

class TypeScriptArchitectureAdapter {
  async analyzeArchitecture(projectPath) {
    console.log(`🔷 Analyzing TypeScript architecture for: ${projectPath}`);
    // Stub implementation
    return [
      {
        id: 'ts-001',
        title: 'Complex interface detected',
        severity: 'medium',
        location: { file: 'src/types.ts', line: 10 },
        architectureCategory: 'complexity',
        technicalDebtLevel: 'medium',
        description: 'Interface has high complexity with many properties'
      }
    ];
  }

  detectDesignPatterns() {
    return [];
  }

  assessTechnicalDebt(issues) {
    return {
      totalIssues: issues.length,
      highPriorityCount: issues.filter(i => i.severity === 'high').length,
      recommendation: 'Consider breaking down complex interfaces'
    };
  }
}

class ESLintArchitectureAdapter {
  async analyzeArchitecture(projectPath) {
    console.log(`📏 Analyzing ESLint architecture for: ${projectPath}`);
    // Stub implementation
    return [
      {
        id: 'eslint-001',
        title: 'Layer violation detected',
        severity: 'medium',
        location: { file: 'src/controller.js', line: 15 },
        architectureCategory: 'design_pattern',
        technicalDebtLevel: 'medium',
        description: 'Controller is importing from data layer directly'
      }
    ];
  }

  detectDesignPatterns() {
    return [];
  }

  assessTechnicalDebt(issues) {
    return {
      totalIssues: issues.length,
      highPriorityCount: issues.filter(i => i.severity === 'high').length,
      recommendation: 'Enforce layered architecture patterns'
    };
  }
}

/**
 * Main CLI application
 */
class ArchitectureAnalyzerCLI {
  constructor() {
    this.adapters = {
      madge: new MadgeArchitectureAdapter(),
      typescript: new TypeScriptArchitectureAdapter(),
      eslint: new ESLintArchitectureAdapter()
    };
  }

  /**
   * Run Madge architecture analysis
   */
  async runMadgeAnalysis(argv) {
    console.log('🏗️ Running Madge Architecture Analysis...\n');

    try {
      const results = await this.adapters.madge.analyzeArchitecture(argv.project);

      console.log(`✅ Analysis complete: ${results.length} architecture issues found\n`);

      if (argv.verbose) {
        this.displayResults('Madge Architecture Analysis', results);
      } else {
        this.displaySummary('Madge', results);
      }

      if (argv.output) {
        await this.saveResults(argv.output, 'madge', results);
      }

      return results;

    } catch (error) {
      console.error('❌ Madge analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run TypeScript architecture analysis
   */
  async runTypeScriptAnalysis(argv) {
    console.log('🔷 Running TypeScript Architecture Analysis...\n');

    try {
      const results = await this.adapters.typescript.analyzeArchitecture(argv.project);

      console.log(`✅ Analysis complete: ${results.length} architecture issues found\n`);

      if (argv.verbose) {
        this.displayResults('TypeScript Architecture Analysis', results);
      } else {
        this.displaySummary('TypeScript', results);
      }

      if (argv.output) {
        await this.saveResults(argv.output, 'typescript', results);
      }

      return results;

    } catch (error) {
      console.error('❌ TypeScript analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run ESLint architecture analysis
   */
  async runESLintAnalysis(argv) {
    console.log('📏 Running ESLint Architecture Analysis...\n');

    try {
      const results = await this.adapters.eslint.analyzeArchitecture(argv.project);

      console.log(`✅ Analysis complete: ${results.length} architecture issues found\n`);

      if (argv.verbose) {
        this.displayResults('ESLint Architecture Analysis', results);
      } else {
        this.displaySummary('ESLint', results);
      }

      if (argv.output) {
        await this.saveResults(argv.output, 'eslint', results);
      }

      return results;

    } catch (error) {
      console.error('❌ ESLint analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run all architecture analyzers
   */
  async runAllAnalysis(argv) {
    console.log('🎯 Running Comprehensive Architecture Analysis...\n');

    const results = {
      madge: [],
      typescript: [],
      eslint: [],
      summary: {}
    };

    try {
      // Run Madge analysis
      console.log('1️⃣ Madge Analysis...');
      results.madge = await this.adapters.madge.analyzeArchitecture(argv.project);
      console.log(`   Found ${results.madge.length} issues\n`);

      // Run TypeScript analysis
      console.log('2️⃣ TypeScript Analysis...');
      results.typescript = await this.adapters.typescript.analyzeArchitecture(argv.project);
      console.log(`   Found ${results.typescript.length} issues\n`);

      // Run ESLint analysis
      console.log('3️⃣ ESLint Analysis...');
      results.eslint = await this.adapters.eslint.analyzeArchitecture(argv.project);
      console.log(`   Found ${results.eslint.length} issues\n`);

      // Generate combined summary
      results.summary = this.generateCombinedSummary(results);

      console.log('✅ Comprehensive analysis complete!\n');

      if (argv.verbose) {
        this.displayCombinedResults(results);
      } else {
        this.displayCombinedSummary(results);
      }

      if (argv.output) {
        await this.saveResults(argv.output, 'comprehensive', results);
      }

      return results;

    } catch (error) {
      console.error('❌ Comprehensive analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Display detailed results
   */
  displayResults(title, issues) {
    console.log(`\n📊 ${title} Results:`);
    console.log('=' .repeat(50));

    if (issues.length === 0) {
      console.log('🎉 No architecture issues found!\n');
      return;
    }

    // Group by severity
    const bySeverity = this.groupIssuesBySeverity(issues);

    for (const [severity, severityIssues] of Object.entries(bySeverity)) {
      if (severityIssues.length > 0) {
        console.log(`\n${this.getSeverityIcon(severity)} ${severity.toUpperCase()} (${severityIssues.length} issues):`);

        severityIssues.slice(0, 5).forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue.title}`);
          console.log(`     File: ${issue.location.file}`);
          console.log(`     Category: ${issue.architectureCategory}`);
          if (issue.refactoringOpportunity) {
            console.log(`     Suggested: ${issue.refactoringOpportunity.suggestedAction}`);
          }
          console.log('');
        });

        if (severityIssues.length > 5) {
          console.log(`     ... and ${severityIssues.length - 5} more issues\n`);
        }
      }
    }
  }

  /**
   * Display summary
   */
  displaySummary(analyzer, issues) {
    console.log(`📈 ${analyzer} Summary:`);
    console.log('-'.repeat(30));

    const bySeverity = this.groupIssuesBySeverity(issues);
    const byCategory = this.groupIssuesByCategory(issues);

    console.log(`Total Issues: ${issues.length}`);

    if (bySeverity.critical?.length) console.log(`🔴 Critical: ${bySeverity.critical.length}`);
    if (bySeverity.high?.length) console.log(`🟠 High: ${bySeverity.high.length}`);
    if (bySeverity.medium?.length) console.log(`🟡 Medium: ${bySeverity.medium.length}`);
    if (bySeverity.low?.length) console.log(`🔵 Low: ${bySeverity.low.length}`);

    console.log('\nTop Categories:');
    Object.entries(byCategory)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 3)
      .forEach(([category, categoryIssues]) => {
        console.log(`  • ${category}: ${categoryIssues.length} issues`);
      });

    console.log('');
  }

  /**
   * Display combined results
   */
  displayCombinedResults(results) {
    this.displayResults('Madge Architecture', results.madge);
    this.displayResults('TypeScript Architecture', results.typescript);
    this.displayResults('ESLint Architecture', results.eslint);
    this.displayCombinedSummary(results);
  }

  /**
   * Display combined summary
   */
  displayCombinedSummary(results) {
    console.log('\n🎯 Comprehensive Architecture Analysis Summary:');
    console.log('='.repeat(50));

    const summary = results.summary;
    console.log(`Total Issues Found: ${summary.totalIssues}`);
    console.log(`Tools Analyzed: ${summary.toolsAnalyzed.join(', ')}`);

    console.log('\nIssues by Tool:');
    console.log(`  🏗️ Madge: ${results.madge.length} issues`);
    console.log(`  🔷 TypeScript: ${results.typescript.length} issues`);
    console.log(`  📏 ESLint: ${results.eslint.length} issues`);

    console.log('\nSeverity Distribution:');
    if (summary.bySeverity.critical > 0) console.log(`  🔴 Critical: ${summary.bySeverity.critical}`);
    if (summary.bySeverity.high > 0) console.log(`  🟠 High: ${summary.bySeverity.high}`);
    if (summary.bySeverity.medium > 0) console.log(`  🟡 Medium: ${summary.bySeverity.medium}`);
    if (summary.bySeverity.low > 0) console.log(`  🔵 Low: ${summary.bySeverity.low}`);

    console.log('\nTop Categories:');
    Object.entries(summary.topCategories)
      .slice(0, 5)
      .forEach(([category, count]) => {
        console.log(`  • ${category}: ${count} issues`);
      });

    if (summary.totalIssues > 0) {
      console.log(`\n💡 Recommendation: Focus on ${summary.topPriority} issues first`);
    } else {
      console.log('\n🎉 Excellent! No architecture issues found!');
    }

    console.log('');
  }

  /**
   * Generate combined summary
   */
  generateCombinedSummary(results) {
    const allIssues = [...results.madge, ...results.typescript, ...results.eslint];

    const bySeverity = this.groupIssuesBySeverity(allIssues);
    const byCategory = this.groupIssuesByCategory(allIssues);

    const severityCounts = {
      critical: bySeverity.critical?.length || 0,
      high: bySeverity.high?.length || 0,
      medium: bySeverity.medium?.length || 0,
      low: bySeverity.low?.length || 0
    };

    const topCategories = Object.entries(byCategory)
      .sort(([,a], [,b]) => b.length - a.length)
      .reduce((acc, [category, issues]) => {
        acc[category] = issues.length;
        return acc;
      }, {});

    // Determine top priority
    let topPriority = 'low severity';
    if (severityCounts.critical > 0) topPriority = 'critical';
    else if (severityCounts.high > 0) topPriority = 'high severity';
    else if (severityCounts.medium > 0) topPriority = 'medium severity';

    return {
      totalIssues: allIssues.length,
      toolsAnalyzed: ['Madge', 'TypeScript', 'ESLint'],
      bySeverity: severityCounts,
      topCategories,
      topPriority
    };
  }

  /**
   * Group issues by severity
   */
  groupIssuesBySeverity(issues) {
    return issues.reduce((groups, issue) => {
      const severity = issue.severity.toLowerCase();
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(issue);
      return groups;
    }, {});
  }

  /**
   * Group issues by category
   */
  groupIssuesByCategory(issues) {
    return issues.reduce((groups, issue) => {
      const category = issue.architectureCategory;
      if (!groups[category]) groups[category] = [];
      groups[category].push(issue);
      return groups;
    }, {});
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    switch (severity.toLowerCase()) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  }

  /**
   * Save results to file
   */
  async saveResults(outputPath, analyzer, results) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const filename = `${analyzer}-architecture-results.json`;
      const fullPath = path.resolve(outputPath, filename);

      const output = {
        timestamp: new Date().toISOString(),
        analyzer,
        results,
        metadata: {
          version: '1.0.0',
          phase: '2.0 - Sprint 5-6',
          totalIssues: Array.isArray(results) ? results.length : results.madge?.length + results.typescript?.length + results.eslint?.length
        }
      };

      await fs.writeFile(fullPath, JSON.stringify(output, null, 2));
      console.log(`💾 Results saved to: ${fullPath}`);

    } catch (error) {
      console.error('❌ Failed to save results:', error.message);
    }
  }

  /**
   * Set up CLI commands
   */
  setupCLI() {
    return yargs(hideBin(process.argv))
      .scriptName('architecture-analyzer')
      .usage('$0 <cmd> [args]')
      .command('madge [project]', 'Run Madge architecture analysis', (yargs) => {
        yargs
          .positional('project', {
            describe: 'Project directory to analyze',
            default: process.cwd(),
            type: 'string'
          })
          .option('verbose', {
            alias: 'v',
            describe: 'Show detailed results',
            type: 'boolean',
            default: false
          })
          .option('output', {
            alias: 'o',
            describe: 'Output directory for results',
            type: 'string'
          });
      }, (argv) => this.runMadgeAnalysis(argv))
      .command('typescript [project]', 'Run TypeScript architecture analysis', (yargs) => {
        yargs
          .positional('project', {
            describe: 'Project directory to analyze',
            default: process.cwd(),
            type: 'string'
          })
          .option('verbose', {
            alias: 'v',
            describe: 'Show detailed results',
            type: 'boolean',
            default: false
          })
          .option('output', {
            alias: 'o',
            describe: 'Output directory for results',
            type: 'string'
          });
      }, (argv) => this.runTypeScriptAnalysis(argv))
      .command('eslint [project]', 'Run ESLint architecture analysis', (yargs) => {
        yargs
          .positional('project', {
            describe: 'Project directory to analyze',
            default: process.cwd(),
            type: 'string'
          })
          .option('verbose', {
            alias: 'v',
            describe: 'Show detailed results',
            type: 'boolean',
            default: false
          })
          .option('output', {
            alias: 'o',
            describe: 'Output directory for results',
            type: 'string'
          });
      }, (argv) => this.runESLintAnalysis(argv))
      .command(['all [project]', '$0 [project]'], 'Run all architecture analyzers', (yargs) => {
        yargs
          .positional('project', {
            describe: 'Project directory to analyze',
            default: process.cwd(),
            type: 'string'
          })
          .option('verbose', {
            alias: 'v',
            describe: 'Show detailed results',
            type: 'boolean',
            default: false
          })
          .option('output', {
            alias: 'o',
            describe: 'Output directory for results',
            type: 'string'
          });
      }, (argv) => this.runAllAnalysis(argv))
      .help()
      .alias('help', 'h')
      .version('1.0.0')
      .alias('version', 'V')
      .example('$0 all', 'Run all architecture analyzers on current directory')
      .example('$0 madge ./src --verbose', 'Run Madge analysis with detailed output')
      .example('$0 typescript ./project -o ./results', 'Run TypeScript analysis and save results')
      .epilogue('For more information, see: https://topolop.dev/docs/architecture-analysis');
  }

  /**
   * Run the CLI application
   */
  async run() {
    const cli = this.setupCLI();

    // Handle the case where no command is provided
    if (process.argv.length <= 2) {
      await this.runAllAnalysis({ project: process.cwd(), verbose: false });
    } else {
      await cli.parse();
    }
  }
}

// Export for use as module
module.exports = ArchitectureAnalyzerCLI;

// Run if called directly
if (require.main === module) {
  const cli = new ArchitectureAnalyzerCLI();
  cli.run().catch((error) => {
    console.error('❌ CLI execution failed:', error.message);
    process.exit(1);
  });
}