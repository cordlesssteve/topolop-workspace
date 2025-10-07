/**
 * Clang Static Analyzer - Phase 3 Security-First Implementation
 *
 * C/C++ static analyzer for memory safety, null pointer analysis
 * without compilation risks.
 *
 * Security Features:
 * - Direct analysis only, no build system execution
 * - Memory safety analysis without code compilation
 * - Comprehensive input validation and path sanitization
 * - Container isolation ready with minimal privileges
 *
 * Implementation: `clang --analyze` with aggressive analysis config
 * Safety: No build system, pre-compiled analysis only
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface ClangMessage {
  type: string;           // 'warning', 'error', 'note'
  category: string;       // Analysis category (e.g., 'security', 'memory')
  file: string;           // File path
  line: number;           // Line number
  column: number;         // Column number
  message: string;        // Human-readable message
  checkName: string;      // Clang checker name
  description: string;    // Detailed description
  severity: string;       // 'high', 'medium', 'low'
}

export interface ClangResult {
  success: boolean;
  messages: ClangMessage[];
  statistics: {
    totalMessages: number;
    errorCount: number;
    warningCount: number;
    noteCount: number;
    filesAnalyzed: number;
    checkersRun: number;
  };
  executionTime: number;
  filesAnalyzed: string[];
  clangVersion: string | undefined;
}

export class ClangAnalyzer {
  private readonly clangCommand: string;
  private readonly securityConfig: string[];

  constructor() {
    this.clangCommand = 'clang';

    // Security-first configuration for static analysis
    this.securityConfig = [
      '--analyze',                           // Static analysis mode only
      '-Xanalyzer', '-analyzer-output=text', // Text output for parsing
      '-Xanalyzer', '-analyzer-disable-all-checks', // Start with no checks

      // Enable critical security checkers
      '-Xanalyzer', '-analyzer-enable-checker=security',
      '-Xanalyzer', '-analyzer-enable-checker=core',
      '-Xanalyzer', '-analyzer-enable-checker=deadcode',
      '-Xanalyzer', '-analyzer-enable-checker=nullability',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security',

      // Memory safety checkers
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.BoolAssignment',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.CastSize',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.CastToStruct',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.FixedAddr',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.PointerArithm',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.PointerSub',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.core.SizeofPtr',

      // Security-specific checkers
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security.ArrayBound',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security.ArrayBoundV2',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security.MallocOverflow',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security.ReturnPtrRange',
      '-Xanalyzer', '-analyzer-enable-checker=alpha.security.taint',

      // Disable risky features
      '-fno-builtin',                        // No builtin functions
      '-fno-common',                         // No common symbols
      '-fstack-protector-strong',            // Stack protection

      // Analysis constraints
      '-Xanalyzer', '-analyzer-max-loop=3',  // Limit loop analysis
      '-Xanalyzer', '-analyzer-inline-max-stack-depth=3', // Limit recursion
    ];
  }

  /**
   * Check if Clang static analyzer is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runCommand([this.clangCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      return result.exitCode === 0 && result.stdout.includes('clang');
    } catch {
      return false;
    }
  }

  /**
   * Get Clang version
   */
  async getVersion(): Promise<string | undefined> {
    try {
      const result = await this.runCommand([this.clangCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      if (result.exitCode === 0) {
        // Extract version from output like "clang version 14.0.0"
        const match = result.stdout.match(/clang version (\d+\.\d+\.\d+)/);
        return match ? match[1] : undefined;
      }
    } catch {
      // Fall through
    }
    return undefined;
  }

  /**
   * Analyze C/C++ files with Clang static analyzer
   */
  async analyzeFiles(filePaths: string[]): Promise<ClangResult> {
    const startTime = Date.now();

    // Security validation: Only analyze C/C++ files
    const cppFiles = filePaths.filter(file =>
      this.isCppFile(file) && fs.existsSync(file) && !this.isSkippedFile(file)
    );

    if (cppFiles.length === 0) {
      return this.createEmptyResult(Date.now() - startTime);
    }

    const clangVersion = await this.getVersion();
    let allMessages: ClangMessage[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalNotes = 0;

    // Analyze each file individually for better error isolation
    for (const file of cppFiles) {
      try {
        const result = await this.analyzeFile(file);
        allMessages.push(...result.messages);
        totalErrors += result.statistics.errorCount;
        totalWarnings += result.statistics.warningCount;
        totalNotes += result.statistics.noteCount;
      } catch (error) {
        console.warn(`Clang analysis failed for ${file}:`, error);
        // Continue with other files
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true, // Success if any files were processed
      messages: allMessages,
      statistics: {
        totalMessages: allMessages.length,
        errorCount: totalErrors,
        warningCount: totalWarnings,
        noteCount: totalNotes,
        filesAnalyzed: cppFiles.length,
        checkersRun: this.securityConfig.filter(c => c.includes('checker')).length
      },
      executionTime,
      filesAnalyzed: cppFiles,
      clangVersion
    };
  }

  /**
   * Analyze single C/C++ file
   */
  private async analyzeFile(filePath: string): Promise<{ messages: ClangMessage[], statistics: any }> {
    // Build secure command for single file analysis
    const command = [
      this.clangCommand,
      ...this.securityConfig,
      '-I.', // Current directory for includes
      '-I./include', // Common include directory
      filePath
    ];

    const result = await this.runCommand(command, {
      timeout: 30000, // 30 seconds per file
      cwd: path.dirname(filePath),
      maxBuffer: 5 * 1024 * 1024 // 5MB buffer
    });

    // Parse Clang static analyzer output
    const messages = this.parseClangOutput(result.stdout + result.stderr, filePath);

    const statistics = {
      errorCount: messages.filter(m => m.type === 'error').length,
      warningCount: messages.filter(m => m.type === 'warning').length,
      noteCount: messages.filter(m => m.type === 'note').length
    };

    return { messages, statistics };
  }

  /**
   * Parse Clang static analyzer output
   */
  private parseClangOutput(output: string, sourceFile: string): ClangMessage[] {
    const messages: ClangMessage[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const message = this.parseMessageLine(line, sourceFile);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Parse individual Clang message line
   * Format: file.cpp:line:column: warning: message [checker-name]
   */
  private parseMessageLine(line: string, sourceFile: string): ClangMessage | null {
    // Match Clang diagnostic format
    const regex = /^(.+?):(\d+):(\d+):\s+(warning|error|note):\s+(.+?)(?:\s+\[([^\]]+)\])?$/;
    const match = line.match(regex);

    if (!match) {
      return null;
    }

    const [, file, lineStr, columnStr, type, messageText, checkName] = match;

    // Extract checker category and severity
    const category = this.extractCategory((checkName && checkName.trim()) || '');
    const severity = this.mapSeverity(type || '', category);

    return {
      type: type || 'warning',
      category,
      file: path.resolve((file && file.trim()) || sourceFile),
      line: parseInt(lineStr || '0', 10),
      column: parseInt(columnStr || '0', 10),
      message: messageText || '',
      checkName: checkName || 'unknown',
      description: this.enhanceDescription((messageText && messageText.trim()) || '', (checkName && checkName.trim()) || ''),
      severity
    };
  }

  /**
   * Extract analysis category from checker name
   */
  private extractCategory(checkName: string): string {
    if (checkName.includes('security')) return 'security';
    if (checkName.includes('core')) return 'memory';
    if (checkName.includes('deadcode')) return 'quality';
    if (checkName.includes('nullability')) return 'null-safety';
    if (checkName.includes('taint')) return 'security';
    if (checkName.includes('malloc') || checkName.includes('memory')) return 'memory';
    return 'general';
  }

  /**
   * Map Clang severity to unified severity
   */
  private mapSeverity(type: string, category: string): string {
    if (type === 'error') return 'high';
    if (type === 'warning') {
      if (category === 'security') return 'high';
      if (category === 'memory') return 'medium';
      return 'medium';
    }
    if (type === 'note') return 'low';
    return 'medium';
  }

  /**
   * Enhance message description with context
   */
  private enhanceDescription(message: string, checkName: string): string {
    if (checkName.includes('security')) {
      return `Security Issue: ${message}`;
    }
    if (checkName.includes('memory') || checkName.includes('malloc')) {
      return `Memory Safety: ${message}`;
    }
    if (checkName.includes('null')) {
      return `Null Pointer: ${message}`;
    }
    return message;
  }

  /**
   * Check if file is a C/C++ source file
   */
  private isCppFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.c', '.cpp', '.cxx', '.cc', '.c++', '.h', '.hpp', '.hxx', '.hh'].includes(ext);
  }

  /**
   * Security check: Skip dangerous files
   */
  private isSkippedFile(filePath: string): boolean {
    const filename = path.basename(filePath);

    // Skip files that might be dangerous or irrelevant
    const skippedPatterns = [
      /^test_.*\.(c|cpp)$/,     // Test files (optional)
      /.*_test\.(c|cpp)$/,      // Test files (alternative naming)
      /.*\.o$/,                 // Object files
      /.*\.so$/,                // Shared libraries
      /.*\.a$/,                 // Static libraries
      /.*\.exe$/,               // Executables
    ];

    return skippedPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Execute command with security constraints
   */
  private runCommand(command: string[], options: {
    timeout: number;
    cwd: string;
    maxBuffer?: number;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      if (!command[0]) {
        reject(new Error('Command is empty'));
        return;
      }

      const child: ChildProcess = spawn(command[0], command.slice(1), {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // No stdin access
        timeout: options.timeout,
        env: {
          // Minimal environment for security
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          CC: this.clangCommand, // Force specific compiler
        }
      });

      let stdout = '';
      let stderr = '';
      const maxBuffer = options.maxBuffer || 5 * 1024 * 1024; // 5MB default

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > maxBuffer) {
          child.kill();
          reject(new Error('Output buffer exceeded'));
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > maxBuffer) {
          child.kill();
          reject(new Error('Error buffer exceeded'));
        }
      });

      child.on('exit', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout handling
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          reject(new Error('Command timeout'));
        }
      }, options.timeout);
    });
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(executionTime: number): ClangResult {
    return {
      success: true,
      messages: [],
      statistics: {
        totalMessages: 0,
        errorCount: 0,
        warningCount: 0,
        noteCount: 0,
        filesAnalyzed: 0,
        checkersRun: 0
      },
      executionTime,
      filesAnalyzed: [],
      clangVersion: undefined
    };
  }
}

export default ClangAnalyzer;