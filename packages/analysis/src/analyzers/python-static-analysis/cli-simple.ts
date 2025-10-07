#!/usr/bin/env node

/**
 * Simplified Python Static Analysis CLI
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
  format: 'json' | 'summary';
  verbose: boolean;
  help: boolean;
}

class PythonStaticAnalysisCLI {
  private analyzer: PythonStaticAnalyzer;

  constructor() {
    this.analyzer = new PythonStaticAnalyzer();
  }

  /**
   * Parse command line arguments (simplified)
   */
  parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
      target: '.',
      format: 'summary',
      verbose: false,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-h' || arg === '--help') {
        options.help = true;
      } else if (arg === '-v' || arg === '--verbose') {
        options.verbose = true;
      } else if (arg === '--json') {
        options.format = 'json';
      } else if (arg === '-o' && i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg) {
          options.output = nextArg;
          i++; // Skip next argument
        }
      } else if (arg && !arg.startsWith('-')) {
        if (arg) options.target = arg;
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
  -o FILE                Save results to file
  --json                 Output in JSON format (default: summary)
  -v, --verbose          Verbose output with detailed information

EXAMPLES:
  python-static-analysis src/
  python-static-analysis --json -o results.json
  python-static-analysis -v src/main.py

SECURITY FEATURES:
  • Static analysis only - no code execution
  • Container isolation ready
  • Comprehensive input validation
  • Secure temporary cache handling
  • Limited directory traversal depth
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

        // Check tool availability
        const availability = await this.analyzer.isAvailable();
        console.log(`🔧 Pylint: ${availability.pylint ? '✅' : '❌'}`);
        console.log(`🔧 MyPy: ${availability.mypy ? '✅' : '❌'}`);

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
    if (options.format === 'json') {
      return JSON.stringify(result, null, 2);
    } else {
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

    if (result.pylintResult) {
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

    if (result.mypyResult) {
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
      const topIssues = result.unifiedIssues.slice(0, 10);

      for (const issue of topIssues) {
        const severity = String(issue.severity).toUpperCase().padEnd(8);
        const location = `${issue.entity.canonicalPath}:${issue.line}`;
        lines.push(`   ${severity} ${location} - ${issue.title}`);
      }
    }

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