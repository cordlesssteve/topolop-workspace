#!/usr/bin/env node

/**
 * C/C++ Static Analysis CLI
 *
 * Command-line interface for Clang + CBMC unified analysis
 * following Phase 3 security-first implementation.
 */

import CppStaticAnalyzer, { CppAnalysisResult } from './cpp-static-analyzer';
import * as path from 'path';
import * as fs from 'fs';

interface CLIOptions {
  target: string;
  output?: string;
  format: 'json' | 'table' | 'summary';
  verbose: boolean;
  clangOnly: boolean;
  cbmcOnly: boolean;
  help: boolean;
}

class CppStaticAnalysisCLI {
  private analyzer: CppStaticAnalyzer;

  constructor() {
    this.analyzer = new CppStaticAnalyzer();
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
      target: '.',
      format: 'summary',
      verbose: false,
      clangOnly: false,
      cbmcOnly: false,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '-h':
        case '--help':
          options.help = true;
          break;
        case '-o':
        case '--output':
          if (i + 1 < args.length) {
            options.output = args[++i];
          }
          break;
        case '-f':
        case '--format':
          if (i + 1 < args.length) {
            const format = args[++i];
            if (format && ['json', 'table', 'summary'].includes(format)) {
              options.format = format as 'json' | 'table' | 'summary';
            }
          }
          break;
        case '-v':
        case '--verbose':
          options.verbose = true;
          break;
        case '--clang-only':
          options.clangOnly = true;
          break;
        case '--cbmc-only':
          options.cbmcOnly = true;
          break;
        default:
          if (arg && !arg.startsWith('-')) {
            options.target = arg;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Display help information
   */
  showHelp(): void {
    console.log(`
C/C++ Static Analysis CLI - Topolop Phase 3 Security Tools

USAGE:
  cpp-static-analysis [OPTIONS] [PATH]

ARGUMENTS:
  PATH                    Directory or file to analyze (default: current directory)

OPTIONS:
  -h, --help             Show this help message
  -o, --output FILE      Save results to file
  -f, --format FORMAT    Output format: json, table, summary (default: summary)
  -v, --verbose          Verbose output with detailed information
  --clang-only           Run only Clang static analyzer
  --cbmc-only            Run only CBMC bounded model checker

EXAMPLES:
  cpp-static-analysis src/
  cpp-static-analysis --format json --output results.json
  cpp-static-analysis --clang-only --verbose src/main.cpp
  cpp-static-analysis --cbmc-only --format table src/

SECURITY FEATURES:
  • Static analysis only - no code execution
  • Container isolation ready
  • Comprehensive input validation
  • Secure analysis with resource limits
  • Bounded model checking with safety constraints

For more information, see: docs/plans/PRIMARY_FEATURE_ROADMAP.md Phase 3
`);
  }

  /**
   * Run analysis based on CLI options
   */
  async run(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    if (options.help) {
      this.showHelp();
      return;
    }

    try {
      // Validate target path
      if (!fs.existsSync(options.target)) {
        console.error(`Error: Path not found: ${options.target}`);
        process.exit(1);
      }

      if (options.verbose) {
        console.log(`🔍 Analyzing C/C++ code at: ${path.resolve(options.target)}`);
        console.log(`📊 Output format: ${options.format}`);

        // Check tool availability
        const availability = await this.analyzer.isAvailable();
        console.log(`🔧 Tool availability:`);
        console.log(`   Clang Static Analyzer: ${availability.clang ? '✅' : '❌'}`);
        console.log(`   CBMC Model Checker: ${availability.cbmc ? '✅' : '❌'}`);

        if (!availability.overall) {
          console.error('❌ No C/C++ analysis tools available. Please install clang and/or cbmc.');
          process.exit(1);
        }
      }

      // Run analysis
      const result = await this.runAnalysis(options);

      // Format and display results
      const output = this.formatOutput(result, options);

      if (options.output) {
        fs.writeFileSync(options.output, output);
        if (options.verbose) {
          console.log(`💾 Results saved to: ${options.output}`);
        }
      } else {
        console.log(output);
      }

      // Exit with appropriate code
      const hasErrors = result.combinedStatistics.criticalIssues > 0;
      process.exit(hasErrors ? 1 : 0);

    } catch (error) {
      console.error(`❌ Analysis failed:`, error);
      process.exit(1);
    } finally {
      this.analyzer.cleanup();
    }
  }

  /**
   * Run analysis with options filtering
   */
  private async runAnalysis(options: CLIOptions): Promise<CppAnalysisResult> {
    const stat = fs.statSync(options.target);

    if (stat.isFile()) {
      return await this.analyzer.analyzeFiles([options.target]);
    } else {
      return await this.analyzer.analyzeDirectory(options.target);
    }
  }

  /**
   * Format output based on selected format
   */
  private formatOutput(result: CppAnalysisResult, options: CLIOptions): string {
    switch (options.format) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'table':
        return this.formatTable(result, options);

      case 'summary':
      default:
        return this.formatSummary(result, options);
    }
  }

  /**
   * Format results as summary
   */
  private formatSummary(result: CppAnalysisResult, options: CLIOptions): string {
    const stats = result.combinedStatistics;
    const lines: string[] = [];

    lines.push('⚡ C/C++ Static Analysis Results');
    lines.push('='.repeat(50));
    lines.push(`📊 Files analyzed: ${stats.filesAnalyzed}`);
    lines.push(`🔍 Total issues: ${stats.totalIssues}`);
    lines.push(`⚠️  Critical issues: ${stats.criticalIssues}`);
    lines.push(`⏱️  Execution time: ${stats.executionTime}ms`);
    lines.push('');

    if (result.clangResult && !options.cbmcOnly) {
      const clang = result.clangResult.statistics;
      lines.push('📋 Clang Static Analyzer Results:');
      lines.push(`   Errors: ${clang.errorCount}`);
      lines.push(`   Warnings: ${clang.warningCount}`);
      lines.push(`   Notes: ${clang.noteCount}`);
      lines.push(`   Checkers run: ${clang.checkersRun}`);
      if (result.clangResult.clangVersion) {
        lines.push(`   Clang version: ${result.clangResult.clangVersion}`);
      }
      lines.push('');
    }

    if (result.cbmcResult && !options.clangOnly) {
      const cbmc = result.cbmcResult.statistics;
      lines.push('🔬 CBMC Bounded Model Checker Results:');
      lines.push(`   Properties verified: ${cbmc.verifiedProperties}`);
      lines.push(`   Properties failed: ${cbmc.failedProperties}`);
      lines.push(`   Properties unknown: ${cbmc.unknownProperties}`);
      lines.push(`   Verification time: ${cbmc.verificationTime}ms`);
      if (result.cbmcResult.cbmcVersion) {
        lines.push(`   CBMC version: ${result.cbmcResult.cbmcVersion}`);
      }
      lines.push(`   Max unwinding: ${result.cbmcResult.boundingInfo.maxUnwinding}`);
      lines.push('');
    }

    // Show top issues if verbose
    if (options.verbose && result.unifiedIssues.length > 0) {
      lines.push('🔥 Top Issues:');
      const topIssues = result.unifiedIssues
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
          return (severityOrder[b.severity as keyof typeof severityOrder] || 0) - (severityOrder[a.severity as keyof typeof severityOrder] || 0);
        })
        .slice(0, 10);

      for (const issue of topIssues) {
        const severity = issue.severity.toUpperCase().padEnd(8);
        const location = `${issue.entity.canonicalPath}:${issue.line}`;
        lines.push(`   ${severity} ${location} - ${issue.title}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format results as table
   */
  private formatTable(result: CppAnalysisResult, options: CLIOptions): string {
    const lines: string[] = [];

    lines.push('C/C++ Static Analysis - Detailed Results');
    lines.push('='.repeat(80));

    if (result.unifiedIssues.length === 0) {
      lines.push('✅ No issues found!');
      return lines.join('\n');
    }

    // Table header
    lines.push('SEVERITY | TOOL   | FILE:LINE | RULE      | DESCRIPTION');
    lines.push('-'.repeat(80));

    // Sort issues by severity and location
    const sortedIssues = result.unifiedIssues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      const severityDiff = (severityOrder[b.severity as keyof typeof severityOrder] || 0) - (severityOrder[a.severity as keyof typeof severityOrder] || 0);
      if (severityDiff !== 0) return severityDiff;

      return a.entity.canonicalPath.localeCompare(b.entity.canonicalPath) ||
             (a.line || 0) - (b.line || 0);
    });

    for (const issue of sortedIssues) {
      const severity = issue.severity.toUpperCase().padEnd(8);
      const tool = issue.toolName.padEnd(6);
      const location = `${issue.entity.canonicalPath}:${issue.line || 0}`.padEnd(20);
      const rule = (issue.ruleId || '').substring(0, 9).padEnd(9);
      const description = issue.description.substring(0, 40);

      lines.push(`${severity} | ${tool} | ${location} | ${rule} | ${description}`);
    }

    lines.push('');
    lines.push(`Total: ${result.unifiedIssues.length} issues in ${result.combinedStatistics.filesAnalyzed} files`);

    return lines.join('\n');
  }
}

// CLI entry point
if (require.main === module) {
  const cli = new CppStaticAnalysisCLI();
  cli.run(process.argv.slice(2)).catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}

export default CppStaticAnalysisCLI;