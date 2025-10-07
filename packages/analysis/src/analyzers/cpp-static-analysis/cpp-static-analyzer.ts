/**
 * C/C++ Static Analysis Unified Adapter
 *
 * Combines Clang Static Analyzer and CBMC Bounded Model Checker with
 * security-first implementation following the Phase 3 roadmap principles:
 * - No arbitrary code execution
 * - Container isolation ready
 * - Comprehensive input validation
 * - Fail-safe design
 */

import ClangAnalyzer, { ClangResult, ClangMessage } from './clang-analyzer';
import CBMCAnalyzer, { CBMCResult, CBMCMessage } from './cbmc-analyzer';
import { UnifiedIssue, UnifiedEntity, IssueSeverity, AnalysisType } from '@topolop/shared-types';
import * as path from 'path';

export interface CppAnalysisResult {
  success: boolean;
  clangResult: ClangResult | null;
  cbmcResult: CBMCResult | null;
  combinedStatistics: {
    totalIssues: number;
    clangIssues: number;
    cbmcIssues: number;
    criticalIssues: number;
    filesAnalyzed: number;
    executionTime: number;
  };
  unifiedIssues: UnifiedIssue[];
}

// Simple result interface for toUnifiedAnalysisResult method
export interface SimpleCppUnifiedAnalysisResult {
  toolName: string;
  analysisType: string;
  timestamp: string;
  issues: UnifiedIssue[];
  metadata: {
    source: string;
    sourceVersion: string;
    analyzedAt: string;
    combinedStatistics: any;
    clangAvailable: boolean;
    cbmcAvailable: boolean;
    toolsUsed: string[];
  };
}

export class CppStaticAnalyzer {
  private clangAnalyzer: ClangAnalyzer;
  private cbmcAnalyzer: CBMCAnalyzer;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.clangAnalyzer = new ClangAnalyzer();
    this.cbmcAnalyzer = new CBMCAnalyzer();
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Check if C/C++ static analysis tools are available
   */
  async isAvailable(): Promise<{ clang: boolean; cbmc: boolean; overall: boolean }> {
    const [clangAvailable, cbmcAvailable] = await Promise.all([
      this.clangAnalyzer.isAvailable(),
      this.cbmcAnalyzer.isAvailable()
    ]);

    return {
      clang: clangAvailable,
      cbmc: cbmcAvailable,
      overall: clangAvailable || cbmcAvailable // At least one tool available
    };
  }

  /**
   * Analyze C/C++ files using both Clang Static Analyzer and CBMC
   */
  async analyzeFiles(filePaths: string[]): Promise<CppAnalysisResult> {
    const startTime = Date.now();

    // Security validation: Only C/C++ files
    const cppFiles = filePaths.filter(file =>
      this.isCppFile(file) && !this.isSkippedFile(file)
    );

    if (cppFiles.length === 0) {
      return this.createEmptyResult(Date.now() - startTime);
    }

    // Run both analyzers in parallel for performance
    const [clangResult, cbmcResult] = await Promise.all([
      this.runClangSafely(cppFiles),
      this.runCBMCSafely(cppFiles)
    ]);

    const executionTime = Date.now() - startTime;

    // Convert to unified issues
    const unifiedIssues = this.convertToUnifiedIssues(clangResult, cbmcResult);

    // Calculate combined statistics
    const combinedStatistics = this.calculateCombinedStatistics(
      clangResult,
      cbmcResult,
      cppFiles.length,
      executionTime
    );

    return {
      success: (clangResult?.success || false) || (cbmcResult?.success || false),
      clangResult,
      cbmcResult,
      combinedStatistics,
      unifiedIssues
    };
  }

  /**
   * Analyze a directory for C/C++ files
   */
  async analyzeDirectory(directoryPath: string): Promise<CppAnalysisResult> {
    const cppFiles = this.findCppFiles(directoryPath);
    return this.analyzeFiles(cppFiles);
  }

  /**
   * Convert to Topolop's UnifiedAnalysisResult format
   */
  toUnifiedAnalysisResult(result: CppAnalysisResult): SimpleCppUnifiedAnalysisResult {
    return {
      toolName: 'cpp-static-analysis',
      analysisType: 'static-analysis',
      timestamp: new Date().toISOString(),
      issues: result.unifiedIssues,
      metadata: {
        source: 'cpp-static-analysis',
        sourceVersion: '1.0.0',
        analyzedAt: new Date().toISOString(),
        combinedStatistics: result.combinedStatistics,
        clangAvailable: result.clangResult !== null,
        cbmcAvailable: result.cbmcResult !== null,
        toolsUsed: [
          ...(result.clangResult ? ['clang'] : []),
          ...(result.cbmcResult ? ['cbmc'] : [])
        ]
      }
    };
  }

  /**
   * Run Clang with error handling
   */
  private async runClangSafely(files: string[]): Promise<ClangResult | null> {
    try {
      const available = await this.clangAnalyzer.isAvailable();
      if (!available) {
        return null;
      }
      return await this.clangAnalyzer.analyzeFiles(files);
    } catch (error) {
      console.warn('Clang analysis failed:', error);
      return null;
    }
  }

  /**
   * Run CBMC with error handling
   */
  private async runCBMCSafely(files: string[]): Promise<CBMCResult | null> {
    try {
      const available = await this.cbmcAnalyzer.isAvailable();
      if (!available) {
        return null;
      }
      return await this.cbmcAnalyzer.analyzeFiles(files);
    } catch (error) {
      console.warn('CBMC analysis failed:', error);
      return null;
    }
  }

  /**
   * Convert tool-specific issues to unified format
   */
  private convertToUnifiedIssues(
    clangResult: ClangResult | null,
    cbmcResult: CBMCResult | null
  ): UnifiedIssue[] {
    const issues: UnifiedIssue[] = [];

    // Convert Clang messages
    if (clangResult?.messages) {
      for (const message of clangResult.messages) {
        issues.push(this.clangMessageToUnified(message));
      }
    }

    // Convert CBMC messages
    if (cbmcResult?.messages) {
      for (const message of cbmcResult.messages) {
        issues.push(this.cbmcMessageToUnified(message));
      }
    }

    return issues;
  }

  /**
   * Convert Clang message to unified issue
   */
  private clangMessageToUnified(message: ClangMessage): UnifiedIssue {
    const canonicalPath = path.relative(this.projectRoot, message.file);
    const entity = new UnifiedEntity({
      id: `${canonicalPath}:${message.line}`,
      type: 'file',
      name: path.basename(message.file),
      canonicalPath
    });

    return new UnifiedIssue({
      id: `clang-${message.checkName}-${message.line}-${Date.now()}`,
      entity,
      severity: this.mapClangSeverity(message.severity),
      analysisType: this.mapClangAnalysisType(message.category),
      title: `${message.category}: ${message.checkName}`,
      description: message.description,
      ruleId: message.checkName,
      line: message.line,
      column: message.column,
      toolName: 'clang',
      metadata: {
        clangType: message.type,
        clangCategory: message.category,
        clangCheckName: message.checkName,
        originalMessage: message.message
      }
    });
  }

  /**
   * Convert CBMC message to unified issue
   */
  private cbmcMessageToUnified(message: CBMCMessage): UnifiedIssue {
    const canonicalPath = path.relative(this.projectRoot, message.file);
    const entity = new UnifiedEntity({
      id: `${canonicalPath}:${message.line}`,
      type: 'file',
      name: path.basename(message.file),
      canonicalPath
    });

    return new UnifiedIssue({
      id: `cbmc-${message.property}-${message.line}-${Date.now()}`,
      entity,
      severity: this.mapCBMCSeverity(message.severity),
      analysisType: this.mapCBMCAnalysisType(message.property),
      title: `${message.property}: ${message.type}`,
      description: message.description,
      ruleId: message.property,
      line: message.line,
      column: 0, // CBMC doesn't typically provide column info
      toolName: 'cbmc',
      metadata: {
        cbmcType: message.type,
        cbmcProperty: message.property,
        cbmcFunction: message.function,
        cbmcTrace: message.trace
      }
    });
  }

  /**
   * Map Clang severity to unified severity
   */
  private mapClangSeverity(clangSeverity: string): IssueSeverity {
    switch (clangSeverity.toLowerCase()) {
      case 'critical':
        return IssueSeverity.CRITICAL;
      case 'high':
        return IssueSeverity.HIGH;
      case 'medium':
        return IssueSeverity.MEDIUM;
      case 'low':
        return IssueSeverity.LOW;
      default:
        return IssueSeverity.MEDIUM;
    }
  }

  /**
   * Map CBMC severity to unified severity
   */
  private mapCBMCSeverity(cbmcSeverity: string): IssueSeverity {
    switch (cbmcSeverity.toLowerCase()) {
      case 'critical':
        return IssueSeverity.CRITICAL;
      case 'high':
        return IssueSeverity.HIGH;
      case 'medium':
        return IssueSeverity.MEDIUM;
      case 'low':
        return IssueSeverity.LOW;
      default:
        return IssueSeverity.HIGH; // Default to high for verification failures
    }
  }

  /**
   * Map Clang category to analysis type
   */
  private mapClangAnalysisType(category: string): AnalysisType {
    switch (category.toLowerCase()) {
      case 'security':
        return AnalysisType.SECURITY;
      case 'memory':
        return AnalysisType.SEMANTIC;
      case 'quality':
        return AnalysisType.QUALITY;
      case 'null-safety':
        return AnalysisType.SEMANTIC;
      default:
        return AnalysisType.QUALITY;
    }
  }

  /**
   * Map CBMC property to analysis type
   */
  private mapCBMCAnalysisType(property: string): AnalysisType {
    switch (property.toLowerCase()) {
      case 'array-bounds':
      case 'pointer-safety':
      case 'memory-safety':
        return AnalysisType.SEMANTIC;
      case 'overflow':
      case 'division-by-zero':
        return AnalysisType.SECURITY;
      case 'assertion':
      case 'uninitialized':
        return AnalysisType.QUALITY;
      default:
        return AnalysisType.SEMANTIC;
    }
  }

  /**
   * Calculate combined statistics
   */
  private calculateCombinedStatistics(
    clangResult: ClangResult | null,
    cbmcResult: CBMCResult | null,
    filesAnalyzed: number,
    executionTime: number
  ) {
    const clangIssues = clangResult?.statistics.totalMessages || 0;
    const cbmcIssues = cbmcResult?.statistics.totalProperties || 0;
    const totalIssues = clangIssues + cbmcIssues;

    // Count critical issues (high severity errors)
    const criticalIssues =
      (clangResult?.statistics.errorCount || 0) +
      (cbmcResult?.statistics.failedProperties || 0);

    return {
      totalIssues,
      clangIssues,
      cbmcIssues,
      criticalIssues,
      filesAnalyzed,
      executionTime
    };
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(executionTime: number): CppAnalysisResult {
    return {
      success: true,
      clangResult: null,
      cbmcResult: null,
      combinedStatistics: {
        totalIssues: 0,
        clangIssues: 0,
        cbmcIssues: 0,
        criticalIssues: 0,
        filesAnalyzed: 0,
        executionTime
      },
      unifiedIssues: []
    };
  }

  /**
   * Find C/C++ files with security constraints
   */
  private findCppFiles(directory: string, maxDepth: number = 3): string[] {
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
          } else if (entry.isFile() && this.isCppFile(fullPath) && !this.isSkippedFile(fullPath)) {
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
   * Check if file is a C/C++ source file
   */
  private isCppFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.c', '.cpp', '.cxx', '.cc', '.c++', '.h', '.hpp', '.hxx', '.hh'].includes(ext);
  }

  /**
   * Security check: Skip dangerous directories
   */
  private isSkippedDirectory(name: string): boolean {
    const skippedDirs = [
      '.git', '.svn', '.hg',
      'node_modules', 'build', 'dist', 'out',
      '.vscode', '.idea',
      'CMakeFiles', '.cmake',
      'target', 'bin', 'obj'
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
      /^test_.*\.(c|cpp|h|hpp)$/,  // Test files (optional)
      /.*_test\.(c|cpp|h|hpp)$/,   // Test files (alternative naming)
      /.*\.o$/,                    // Object files
      /.*\.so$/,                   // Shared libraries
      /.*\.a$/,                    // Static libraries
      /.*\.exe$/,                  // Executables
      /.*\.dll$/,                  // Windows libraries
      /.*\.dylib$/,                // macOS libraries
    ];

    return skippedPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Both analyzers are stateless, no cleanup needed
  }
}

export default CppStaticAnalyzer;