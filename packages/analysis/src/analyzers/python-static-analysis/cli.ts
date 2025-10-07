#!/usr/bin/env node

/**
 * Python Static Analysis CLI
 *
 * Command-line interface for Pylint + MyPy unified analysis
 * following Phase 3 security-first implementation.
 */

import PythonStaticAnalyzer, { PythonAnalysisResult } from './python-static-analyzer';
import * as path from 'path';
import * as fs from 'fs';

interface CLIOptions {
  target: string;
  output?: string;
  format: 'json' | 'table' | 'summary';
  verbose: boolean;
  pylintOnly: boolean;
  mypyOnly: boolean;
  help: boolean;
}

class PythonStaticAnalysisCLI {
  private analyzer: PythonStaticAnalyzer;

  constructor() {
    this.analyzer = new PythonStaticAnalyzer();
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
      target: '.',
      format: 'summary',
      verbose: false,
      pylintOnly: false,
      mypyOnly: false,
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
        case '--pylint-only':
          options.pylintOnly = true;
          break;
        case '--mypy-only':
          options.mypyOnly = true;
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
Python Static Analysis CLI - Topolop Phase 3 Security Tools

USAGE:
  python-static-analysis [OPTIONS] [PATH]

ARGUMENTS:
  PATH                    Directory or file to analyze (default: current directory)

OPTIONS:
  -h, --help             Show this help message
  -o, --output FILE      Save results to file
  -f, --format FORMAT    Output format: json, table, summary (default: summary)
  -v, --verbose          Verbose output with detailed information
  --pylint-only          Run only Pylint analysis
  --mypy-only            Run only MyPy type checking

EXAMPLES:
  python-static-analysis src/
  python-static-analysis --format json --output results.json
  python-static-analysis --pylint-only --verbose src/main.py
  python-static-analysis --mypy-only --format table src/

SECURITY FEATURES:
  • Static analysis only - no code execution
  • Container isolation ready
  • Comprehensive input validation
  • Secure temporary cache handling
  • Limited directory traversal depth

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
        console.log(`🔍 Analyzing Python code at: ${path.resolve(options.target)}`);
        console.log(`📊 Output format: ${options.format}`);

        // Check tool availability
        const availability = await this.analyzer.isAvailable();
        console.log(`🔧 Tool availability:`);
        console.log(`   Pylint: ${availability.pylint ? '✅' : '❌'}`);
        console.log(`   MyPy: ${availability.mypy ? '✅' : '❌'}`);

        if (!availability.overall) {
          console.error('❌ No Python analysis tools available. Please install pylint and/or mypy.');
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
  private async runAnalysis(options: CLIOptions): Promise<PythonAnalysisResult> {
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
  private formatOutput(result: PythonAnalysisResult, options: CLIOptions): string {
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
  private formatSummary(result: PythonAnalysisResult, options: CLIOptions): string {
    const stats = result.combinedStatistics;
    const lines: string[] = [];

    lines.push('🐍 Python Static Analysis Results');
    lines.push('='.repeat(50));
    lines.push(`📊 Files analyzed: ${stats.filesAnalyzed}`);
    lines.push(`🔍 Total issues: ${stats.totalIssues}`);
    lines.push(`⚠️  Critical issues: ${stats.criticalIssues}`);
    lines.push(`⏱️  Execution time: ${stats.executionTime}ms`);
    lines.push('');

    if (result.pylintResult && !options.mypyOnly) {
      const pylint = result.pylintResult.statistics;
      lines.push('📋 Pylint Results:');
      lines.push(`   Errors: ${pylint.errorCount}`);
      lines.push(`   Warnings: ${pylint.warningCount}`);
      lines.push(`   Refactor suggestions: ${pylint.refactorCount}`);
      lines.push(`   Style conventions: ${pylint.conventionCount}`);
      if (pylint.globalNote !== null) {
        lines.push(`   Code quality score: ${pylint.globalNote.toFixed(2)}/10`);
      }
      lines.push('');
    }

    if (result.mypyResult && !options.pylintOnly) {
      const mypy = result.mypyResult.statistics;
      lines.push('🔤 MyPy Type Analysis:');
      lines.push(`   Type errors: ${mypy.errorCount}`);
      lines.push(`   Warnings: ${mypy.warningCount}`);
      lines.push(`   Notes: ${mypy.noteCount}`);
      lines.push(`   Files with issues: ${mypy.filesWithErrors}`);
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
  private formatTable(result: PythonAnalysisResult, options: CLIOptions): string {
    const lines: string[] = [];

    lines.push('Python Static Analysis - Detailed Results');
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
  const cli = new PythonStaticAnalysisCLI();
  cli.run(process.argv.slice(2)).catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}

export default PythonStaticAnalysisCLI;