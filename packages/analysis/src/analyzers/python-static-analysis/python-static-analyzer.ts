/**
 * Python Static Analysis Unified Adapter
 *
 * Combines Pylint and MyPy analyzers with security-first implementation
 * following the Phase 3 roadmap security principles:
 * - No arbitrary code execution
 * - Container isolation ready
 * - Comprehensive input validation
 * - Fail-safe design
 */

import PylintAnalyzer, { PylintResult, PylintMessage } from './pylint-analyzer';
import MyPyAnalyzer, { MyPyResult, MyPyMessage } from './mypy-analyzer';
import { UnifiedIssue, UnifiedEntity, UnifiedAnalysisResult, IssueSeverity, AnalysisType, AnalysisResultMetadata } from '@topolop/shared-types';
import * as path from 'path';

export interface PythonAnalysisResult {
  success: boolean;
  pylintResult: PylintResult | null;
  mypyResult: MyPyResult | null;
  combinedStatistics: {
    totalIssues: number;
    pylintIssues: number;
    mypyIssues: number;
    criticalIssues: number;
    filesAnalyzed: number;
    executionTime: number;
  };
  unifiedIssues: UnifiedIssue[];
}

// Simple result interface for toUnifiedAnalysisResult method
export interface SimpleUnifiedAnalysisResult {
  toolName: string;
  analysisType: string;
  timestamp: string;
  issues: UnifiedIssue[];
  metadata: {
    source: string;
    sourceVersion: string;
    analyzedAt: string;
    combinedStatistics: any;
    pylintAvailable: boolean;
    mypyAvailable: boolean;
    toolsUsed: string[];
  };
}

export class PythonStaticAnalyzer {
  private pylintAnalyzer: PylintAnalyzer;
  private mypyAnalyzer: MyPyAnalyzer;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.pylintAnalyzer = new PylintAnalyzer();
    this.mypyAnalyzer = new MyPyAnalyzer();
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Check if Python static analysis tools are available
   */
  async isAvailable(): Promise<{ pylint: boolean; mypy: boolean; overall: boolean }> {
    const [pylintAvailable, mypyAvailable] = await Promise.all([
      this.pylintAnalyzer.isAvailable(),
      this.mypyAnalyzer.isAvailable()
    ]);

    return {
      pylint: pylintAvailable,
      mypy: mypyAvailable,
      overall: pylintAvailable || mypyAvailable // At least one tool available
    };
  }

  /**
   * Analyze Python files using both Pylint and MyPy
   */
  async analyzeFiles(filePaths: string[]): Promise<PythonAnalysisResult> {
    const startTime = Date.now();

    // Security validation: Only Python files
    const pythonFiles = filePaths.filter(file =>
      file.endsWith('.py') && !this.isSkippedFile(file)
    );

    if (pythonFiles.length === 0) {
      return this.createEmptyResult(Date.now() - startTime);
    }

    // Run both analyzers in parallel for performance
    const [pylintResult, mypyResult] = await Promise.all([
      this.runPylintSafely(pythonFiles),
      this.runMyPySafely(pythonFiles)
    ]);

    const executionTime = Date.now() - startTime;

    // Convert to unified issues
    const unifiedIssues = this.convertToUnifiedIssues(pylintResult, mypyResult);

    // Calculate combined statistics
    const combinedStatistics = this.calculateCombinedStatistics(
      pylintResult,
      mypyResult,
      pythonFiles.length,
      executionTime
    );

    return {
      success: (pylintResult?.success || false) || (mypyResult?.success || false),
      pylintResult,
      mypyResult,
      combinedStatistics,
      unifiedIssues
    };
  }

  /**
   * Analyze a directory for Python files
   */
  async analyzeDirectory(directoryPath: string): Promise<PythonAnalysisResult> {
    const pythonFiles = this.findPythonFiles(directoryPath);
    return this.analyzeFiles(pythonFiles);
  }

  /**
   * Convert to Topolop's UnifiedAnalysisResult format
   */
  toUnifiedAnalysisResult(result: PythonAnalysisResult): SimpleUnifiedAnalysisResult {
    return {
      toolName: 'python-static-analysis',
      analysisType: 'static-analysis',
      timestamp: new Date().toISOString(),
      issues: result.unifiedIssues,
      metadata: {
        source: 'python-static-analysis',
        sourceVersion: '1.0.0',
        analyzedAt: new Date().toISOString(),
        combinedStatistics: result.combinedStatistics,
        pylintAvailable: result.pylintResult !== null,
        mypyAvailable: result.mypyResult !== null,
        toolsUsed: [
          ...(result.pylintResult ? ['pylint'] : []),
          ...(result.mypyResult ? ['mypy'] : [])
        ]
      }
    };
  }

  /**
   * Run Pylint with error handling
   */
  private async runPylintSafely(files: string[]): Promise<PylintResult | null> {
    try {
      const available = await this.pylintAnalyzer.isAvailable();
      if (!available) {
        return null;
      }
      return await this.pylintAnalyzer.analyzeFiles(files);
    } catch (error) {
      console.warn('Pylint analysis failed:', error);
      return null;
    }
  }

  /**
   * Run MyPy with error handling
   */
  private async runMyPySafely(files: string[]): Promise<MyPyResult | null> {
    try {
      const available = await this.mypyAnalyzer.isAvailable();
      if (!available) {
        return null;
      }
      return await this.mypyAnalyzer.analyzeFiles(files);
    } catch (error) {
      console.warn('MyPy analysis failed:', error);
      return null;
    }
  }

  /**
   * Convert tool-specific issues to unified format
   */
  private convertToUnifiedIssues(
    pylintResult: PylintResult | null,
    mypyResult: MyPyResult | null
  ): UnifiedIssue[] {
    const issues: UnifiedIssue[] = [];

    // Convert Pylint messages
    if (pylintResult?.messages) {
      for (const message of pylintResult.messages) {
        issues.push(this.pylintMessageToUnified(message));
      }
    }

    // Convert MyPy messages
    if (mypyResult?.messages) {
      for (const message of mypyResult.messages) {
        issues.push(this.mypyMessageToUnified(message));
      }
    }

    return issues;
  }

  /**
   * Convert Pylint message to unified issue
   */
  private pylintMessageToUnified(message: PylintMessage): UnifiedIssue {
    const canonicalPath = path.relative(this.projectRoot, message.path);
    const entity = new UnifiedEntity({
      id: `${canonicalPath}:${message.line}`,
      type: 'file',
      name: path.basename(message.path),
      canonicalPath
    });

    return new UnifiedIssue({
      id: `pylint-${message.messageId}-${message.line}-${Date.now()}`,
      entity,
      severity: this.mapPylintSeverity(message.type),
      analysisType: AnalysisType.QUALITY,
      title: `${message.messageId}: ${message.symbol}`,
      description: message.message,
      ruleId: message.messageId,
      line: message.line,
      column: message.column,
      toolName: 'pylint',
      metadata: {
        pylintType: message.type,
        pylintSymbol: message.symbol,
        pylintModule: message.module,
        pylintObject: message.obj
      }
    });
  }

  /**
   * Convert MyPy message to unified issue
   */
  private mypyMessageToUnified(message: MyPyMessage): UnifiedIssue {
    const canonicalPath = path.relative(this.projectRoot, message.file);
    const entity = new UnifiedEntity({
      id: `${canonicalPath}:${message.line}`,
      type: 'file',
      name: path.basename(message.file),
      canonicalPath
    });

    return new UnifiedIssue({
      id: `mypy-${message.errorCode || 'unknown'}-${message.line}-${Date.now()}`,
      entity,
      severity: this.mapMypySeverity(message.severity),
      analysisType: AnalysisType.SEMANTIC,
      title: `MyPy ${message.severity}: ${message.errorCode || 'Type Error'}`,
      description: message.message + (message.hint ? ` (Hint: ${message.hint})` : ''),
      ruleId: message.errorCode || 'mypy-type-error',
      line: message.line,
      column: message.column,
      toolName: 'mypy',
      metadata: {
        mypyErrorCode: message.errorCode,
        mypyHint: message.hint,
        mypySeverity: message.severity
      }
    });
  }

  /**
   * Map Pylint severity to unified severity
   */
  private mapPylintSeverity(pylintType: string): IssueSeverity {
    switch (pylintType.toLowerCase()) {
      case 'error':
        return IssueSeverity.HIGH;
      case 'warning':
        return IssueSeverity.MEDIUM;
      case 'refactor':
        return IssueSeverity.LOW;
      case 'convention':
        return IssueSeverity.LOW;
      default:
        return IssueSeverity.MEDIUM;
    }
  }

  /**
   * Map MyPy severity to unified severity
   */
  private mapMypySeverity(mypySeverity: string): IssueSeverity {
    switch (mypySeverity.toLowerCase()) {
      case 'error':
        return IssueSeverity.HIGH;
      case 'warning':
        return IssueSeverity.MEDIUM;
      case 'note':
        return IssueSeverity.LOW;
      default:
        return IssueSeverity.MEDIUM;
    }
  }

  /**
   * Calculate combined statistics
   */
  private calculateCombinedStatistics(
    pylintResult: PylintResult | null,
    mypyResult: MyPyResult | null,
    filesAnalyzed: number,
    executionTime: number
  ) {
    const pylintIssues = pylintResult?.statistics.totalMessages || 0;
    const mypyIssues = mypyResult?.statistics.totalMessages || 0;
    const totalIssues = pylintIssues + mypyIssues;

    // Count critical issues (high severity errors)
    const criticalIssues =
      (pylintResult?.statistics.errorCount || 0) +
      (mypyResult?.statistics.errorCount || 0);

    return {
      totalIssues,
      pylintIssues,
      mypyIssues,
      criticalIssues,
      filesAnalyzed,
      executionTime
    };
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(executionTime: number): PythonAnalysisResult {
    return {
      success: true,
      pylintResult: null,
      mypyResult: null,
      combinedStatistics: {
        totalIssues: 0,
        pylintIssues: 0,
        mypyIssues: 0,
        criticalIssues: 0,
        filesAnalyzed: 0,
        executionTime
      },
      unifiedIssues: []
    };
  }

  /**
   * Find Python files with security constraints
   */
  private findPythonFiles(directory: string, maxDepth: number = 3): string[] {
    const files: string[] = [];
    const fs = require('fs');

    const scan = (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !this.isSkippedDirectory(entry.name)) {
            scan(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.py') && !this.isSkippedFile(fullPath)) {
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
   * Security check: Skip dangerous directories
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
   * Security check: Skip dangerous files
   */
  private isSkippedFile(filePath: string): boolean {
    const filename = path.basename(filePath);

    // Skip files that might be dangerous or irrelevant
    const skippedPatterns = [
      /^__.*\.py$/,     // Double underscore files (except __init__.py)
      /.*\.pyc$/,       // Compiled Python files
      /.*\.pyo$/,       // Optimized Python files
      /.*\.pyd$/,       // Python extension modules
      /test_.*\.py$/,   // Test files (optional - might want to analyze these)
      /.*_test\.py$/    // Test files (alternative naming)
    ];

    // Allow __init__.py but skip other __ files
    if (filename === '__init__.py') {
      return false;
    }

    return skippedPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.mypyAnalyzer.cleanup();
  }
}

export default PythonStaticAnalyzer;