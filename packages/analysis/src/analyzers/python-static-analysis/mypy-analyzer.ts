/**
 * MyPy Static Type Analysis Analyzer
 *
 * Security-first implementation following Phase 3 roadmap:
 * - Type analysis only, ignore missing imports
 * - SQLite cache in temp directory, no execution
 * - Python type checking without module execution
 *
 * Implementation: `--ignore-missing-imports --no-incremental`
 * Safety: SQLite cache in temp directory, no execution
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface MyPyMessage {
  file: string;          // File path
  line: number;          // Line number
  column: number;        // Column number (0-based)
  severity: string;      // 'error', 'warning', 'note'
  message: string;       // Human-readable message
  errorCode: string | undefined; // MyPy error code (e.g., 'misc', 'attr')
  hint: string | undefined;   // Helpful hint if available
}

export interface MyPyResult {
  success: boolean;
  messages: MyPyMessage[];
  statistics: {
    totalMessages: number;
    errorCount: number;
    warningCount: number;
    noteCount: number;
    filesChecked: number;
    filesWithErrors: number;
  };
  executionTime: number;
  filesAnalyzed: string[];
  mypyVersion: string | undefined;
}

export class MyPyAnalyzer {
  private readonly mypyCommand: string;
  private readonly securityConfig: string[];
  private readonly tempCacheDir: string;

  constructor() {
    this.mypyCommand = 'mypy';

    // Create secure temporary cache directory
    this.tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mypy-cache-'));

    // Security-first configuration: Type analysis only
    this.securityConfig = [
      '--ignore-missing-imports',       // Security: don't try to import modules
      '--no-incremental',               // Security: no incremental mode
      '--cache-dir', this.tempCacheDir, // Use temp cache directory
      '--show-column-numbers',          // Precise location info
      '--show-error-codes',             // Include error codes for classification
      '--no-error-summary',             // Clean output without summary
      '--show-absolute-path',           // Absolute paths for consistency
      '--follow-imports=skip',          // Security: don't follow imports
      '--ignore-errors',                // Continue on errors (don't stop)
      '--warn-unused-ignores',          // Detect unnecessary ignores
      '--warn-redundant-casts',         // Detect unnecessary casts
      '--warn-return-any',              // Warn about returning Any
      '--strict-equality',              // Strict equality checking
      '--no-implicit-optional',         // Explicit Optional types
      '--disallow-untyped-calls',       // Require typed function calls
      '--disallow-untyped-defs',        // Require typed function definitions
      '--disallow-incomplete-defs',     // Require complete function definitions
      '--check-untyped-defs',           // Check untyped function bodies
      '--disallow-untyped-decorators',  // Require typed decorators
      '--warn-unused-configs',          // Warn about unused config sections
    ];
  }

  /**
   * Cleanup cache directory on destruction
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.tempCacheDir)) {
        fs.rmSync(this.tempCacheDir, { recursive: true, force: true });
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Check if MyPy is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runCommand([this.mypyCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get MyPy version
   */
  async getVersion(): Promise<string | undefined> {
    try {
      const result = await this.runCommand([this.mypyCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      if (result.exitCode === 0) {
        // Extract version from output like "mypy 1.0.0 (compiled: yes)"
        const match = result.stdout.match(/mypy (\d+\.\d+\.\d+)/);
        return match ? match[1] : undefined;
      }
    } catch {
      // Fall through
    }
    return undefined;
  }

  /**
   * Analyze Python files with MyPy type checking
   */
  async analyzeFiles(filePaths: string[]): Promise<MyPyResult> {
    const startTime = Date.now();

    // Security validation: Only analyze Python files
    const pythonFiles = filePaths.filter(file =>
      file.endsWith('.py') && fs.existsSync(file)
    );

    if (pythonFiles.length === 0) {
      this.cleanup();
      return {
        success: true,
        messages: [],
        statistics: {
          totalMessages: 0,
          errorCount: 0,
          warningCount: 0,
          noteCount: 0,
          filesChecked: 0,
          filesWithErrors: 0
        },
        executionTime: Date.now() - startTime,
        filesAnalyzed: [],
        mypyVersion: await this.getVersion()
      };
    }

    try {
      // Build secure command with file paths
      const command = [
        this.mypyCommand,
        ...this.securityConfig,
        ...pythonFiles
      ];

      const result = await this.runCommand(command, {
        timeout: 180000, // 3 minutes timeout (type checking can be slow)
        cwd: process.cwd(),
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer (type checking produces lots of output)
      });

      const parsedResult = this.parseOutput(result.stdout, pythonFiles, Date.now() - startTime);
      parsedResult.mypyVersion = await this.getVersion();

      this.cleanup();
      return parsedResult;

    } catch (error) {
      this.cleanup();
      return {
        success: false,
        messages: [],
        statistics: {
          totalMessages: 0,
          errorCount: 0,
          warningCount: 0,
          noteCount: 0,
          filesChecked: pythonFiles.length,
          filesWithErrors: 0
        },
        executionTime: Date.now() - startTime,
        filesAnalyzed: pythonFiles,
        mypyVersion: await this.getVersion()
      };
    }
  }

  /**
   * Analyze a directory for Python files
   */
  async analyzeDirectory(directoryPath: string): Promise<MyPyResult> {
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
      '.mypy_cache', '.coverage', 'htmlcov',
      'site-packages', 'lib', 'lib64'
    ];
    return skippedDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Parse MyPy output
   */
  private parseOutput(output: string, filesAnalyzed: string[], executionTime: number): MyPyResult {
    const messages: MyPyMessage[] = [];
    const lines = output.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const message = this.parseMessageLine(line);
      if (message) {
        messages.push(message);
      }
    }

    // Calculate statistics
    const filesWithErrors = new Set(messages.map(m => m.file)).size;
    const statistics = {
      totalMessages: messages.length,
      errorCount: messages.filter(m => m.severity === 'error').length,
      warningCount: messages.filter(m => m.severity === 'warning').length,
      noteCount: messages.filter(m => m.severity === 'note').length,
      filesChecked: filesAnalyzed.length,
      filesWithErrors
    };

    return {
      success: true,
      messages,
      statistics,
      executionTime,
      filesAnalyzed,
      mypyVersion: undefined // Will be filled by caller
    };
  }

  /**
   * Parse individual MyPy message line
   * Format: file.py:line:column: severity: message [error-code]
   */
  private parseMessageLine(line: string): MyPyMessage | null {
    // MyPy output format: path:line:column: level: message [error-code]
    const match = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+?)(?:\s+\[([^\]]+)\])?$/);

    if (!match) {
      return null;
    }

    const [, file, lineStr, columnStr, severity, message, errorCode] = match;

    // Extract hint if present (some messages have hints on separate lines)
    let hint: string | undefined = undefined;
    const hintMatch = message?.match(/^(.+?)\s+\(hint:\s+(.+)\)$/);
    if (hintMatch) {
      hint = hintMatch[2];
    }

    return {
      file: path.resolve(file || ''),
      line: parseInt(lineStr || '0', 10),
      column: parseInt(columnStr || '0', 10),
      severity: severity || 'error',
      message: hintMatch ? (hintMatch[1] || message || '') : (message || ''),
      errorCode: errorCode || undefined,
      hint
    };
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
          MYPYPATH: '', // Security: no custom MyPy path
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
          stdout: stdout + stderr, // MyPy outputs to both stdout and stderr
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

export default MyPyAnalyzer;