/**
 * Pylint Static-Only Mode Analyzer
 *
 * Security-first implementation following Phase 3 roadmap:
 * - AST parsing only, disable imports and execution
 * - No module imports, no persistent cache
 * - Static analysis without execution risks
 *
 * Implementation: `--disable=import-error` with comprehensive exclusions
 * Safety: No module imports, no persistent cache
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface PylintMessage {
  type: string;        // 'error', 'warning', 'refactor', 'convention'
  module: string;      // Module name
  obj: string;         // Object name (function, class, etc.)
  line: number;        // Line number
  column: number;      // Column number
  message: string;     // Human-readable message
  messageId: string;   // Pylint message ID (e.g., 'C0103')
  symbol: string;      // Symbolic name for the message
  path: string;        // File path
}

export interface PylintResult {
  success: boolean;
  messages: PylintMessage[];
  statistics: {
    totalMessages: number;
    errorCount: number;
    warningCount: number;
    refactorCount: number;
    conventionCount: number;
    globalNote: number | null;
  };
  executionTime: number;
  filesAnalyzed: string[];
}

export class PylintAnalyzer {
  private readonly pylintCommand: string;
  private readonly securityConfig: string[];

  constructor() {
    this.pylintCommand = 'pylint';

    // Security-first configuration: Static analysis only
    this.securityConfig = [
      '--output-format=json',           // Machine-readable output
      '--disable=import-error',         // Disable import checking (security)
      '--disable=no-member',            // Disable dynamic member checking
      '--disable=unused-import',        // May fail without proper imports
      '--reports=no',                   // No detailed reports (performance)
      '--score=yes',                    // Include global score
      '--persistent=no',                // No persistent cache (security)
      '--unsafe-load-any-extension=no', // Security: no loading extensions
      '--load-plugins=',                // Security: no plugins
      '--init-hook=',                   // Security: no initialization hooks
      '--ignore-patterns=.*\\.pyc',     // Ignore compiled Python files
      '--ignore=venv,env,.venv,.env',   // Ignore virtual environments
      '--max-line-length=120',          // Reasonable line length
      '--good-names=i,j,k,ex,Run,_',    // Common acceptable variable names
    ];
  }

  /**
   * Check if Pylint is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runCommand([this.pylintCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Analyze Python files with Pylint in static-only mode
   */
  async analyzeFiles(filePaths: string[]): Promise<PylintResult> {
    const startTime = Date.now();

    // Security validation: Only analyze Python files
    const pythonFiles = filePaths.filter(file =>
      file.endsWith('.py') && fs.existsSync(file)
    );

    if (pythonFiles.length === 0) {
      return {
        success: true,
        messages: [],
        statistics: {
          totalMessages: 0,
          errorCount: 0,
          warningCount: 0,
          refactorCount: 0,
          conventionCount: 0,
          globalNote: null
        },
        executionTime: Date.now() - startTime,
        filesAnalyzed: []
      };
    }

    try {
      // Build secure command with file paths
      const command = [
        this.pylintCommand,
        ...this.securityConfig,
        ...pythonFiles
      ];

      const result = await this.runCommand(command, {
        timeout: 120000, // 2 minutes timeout
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return this.parseOutput(result.stdout, pythonFiles, Date.now() - startTime);

    } catch (error) {
      return {
        success: false,
        messages: [],
        statistics: {
          totalMessages: 0,
          errorCount: 0,
          warningCount: 0,
          refactorCount: 0,
          conventionCount: 0,
          globalNote: null
        },
        executionTime: Date.now() - startTime,
        filesAnalyzed: pythonFiles
      };
    }
  }

  /**
   * Analyze a directory for Python files
   */
  async analyzeDirectory(directoryPath: string): Promise<PylintResult> {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory not found: ${directoryPath}`);
    }

    const pythonFiles = this.findPythonFiles(directoryPath);
    return this.analyzeFiles(pythonFiles);
  }

  /**
   * Find Python files in directory (security: limited depth)
   */
  private findPythonFiles(directory: string, maxDepth: number = 3): string[] {
    const files: string[] = [];

    const scan = (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Security: Skip dangerous directories
          if (entry.isDirectory() && !this.isSkippedDirectory(entry.name)) {
            scan(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.py')) {
            files.push(fullPath);
          }
        }
      } catch {
        // Silently skip directories we can't read
      }
    };

    scan(directory, 0);
    return files;
  }

  /**
   * Check if directory should be skipped for security
   */
  private isSkippedDirectory(name: string): boolean {
    const skippedDirs = [
      '__pycache__', '.git', '.svn', '.hg',
      'node_modules', 'venv', 'env', '.venv', '.env',
      '.tox', '.pytest_cache', 'build', 'dist',
      '.mypy_cache', '.coverage', 'htmlcov'
    ];
    return skippedDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Parse Pylint JSON output
   */
  private parseOutput(output: string, filesAnalyzed: string[], executionTime: number): PylintResult {
    try {
      // Pylint outputs JSON array of messages, plus score on stderr sometimes
      const lines = output.trim().split('\n').filter(line => line.trim());
      let messages: PylintMessage[] = [];
      let globalNote: number | null = null;

      for (const line of lines) {
        try {
          // Try parsing as JSON message array
          const parsed = JSON.parse(line);
          if (Array.isArray(parsed)) {
            messages = parsed.map(msg => ({
              type: msg.type || 'unknown',
              module: msg.module || '',
              obj: msg.obj || '',
              line: msg.line || 0,
              column: msg.column || 0,
              message: msg.message || '',
              messageId: msg['message-id'] || '',
              symbol: msg.symbol || '',
              path: msg.path || ''
            }));
          }
        } catch {
          // Try extracting score from text line
          const scoreMatch = line.match(/Your code has been rated at ([\d.-]+)\/10/);
          if (scoreMatch && scoreMatch[1]) {
            globalNote = parseFloat(scoreMatch[1]);
          }
        }
      }

      // Calculate statistics
      const statistics = {
        totalMessages: messages.length,
        errorCount: messages.filter(m => m.type === 'error').length,
        warningCount: messages.filter(m => m.type === 'warning').length,
        refactorCount: messages.filter(m => m.type === 'refactor').length,
        conventionCount: messages.filter(m => m.type === 'convention').length,
        globalNote
      };

      return {
        success: true,
        messages,
        statistics,
        executionTime,
        filesAnalyzed
      };

    } catch (error) {
      return {
        success: false,
        messages: [],
        statistics: {
          totalMessages: 0,
          errorCount: 0,
          warningCount: 0,
          refactorCount: 0,
          conventionCount: 0,
          globalNote: null
        },
        executionTime,
        filesAnalyzed
      };
    }
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
          PYTHONPATH: '', // Security: no custom Python path
          PYTHONDONTWRITEBYTECODE: '1', // Security: no bytecode writing
        }
      });

      let stdout = '';
      let stderr = '';
      const maxBuffer = options.maxBuffer || 1024 * 1024; // 1MB default

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
          stdout: stdout + stderr, // Pylint sometimes outputs to stderr
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', reject);

      // Security timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, options.timeout);
    });
  }
}

export default PylintAnalyzer;