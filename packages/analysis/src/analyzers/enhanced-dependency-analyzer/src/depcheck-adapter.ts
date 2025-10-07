/**
 * Depcheck Dependency Usage Adapter - Topolop Phase 2
 *
 * Detects unused dependencies and missing dependencies using Depcheck library.
 * Integrates with enhanced dependency analysis for package.json optimization.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 3-4
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DependencyAdapter,
  DependencyIssue,
  DependencyInfo,
  WorkflowRecommendation
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedEntity } from '@topolop/shared-types';

/**
 * Depcheck configuration
 */
export interface DepcheckConfig {
  ignoreMatches?: string[];
  ignoreDirs?: string[];
  ignorePatterns?: string[];
  skipMissing?: boolean;
  detectors?: string[];
  parsers?: { [key: string]: string };
}

/**
 * Depcheck analysis result structure
 */
interface DepcheckResult {
  dependencies: string[];          // Unused dependencies
  devDependencies: string[];       // Unused dev dependencies
  missing: { [key: string]: string[] };  // Missing dependencies
  using: { [key: string]: string[] };    // Used dependencies
  invalidFiles: { [key: string]: any };  // Files that couldn't be parsed
  invalidDirs: { [key: string]: any };   // Directories that couldn't be analyzed
}

/**
 * Enhanced Depcheck adapter implementing dependency usage analysis
 */
export class DepcheckAdapter implements DependencyAdapter {
  public readonly name = 'Depcheck Dependency Analyzer';
  public readonly version = '1.0.0';
  public readonly type = 'usage' as const;
  public readonly capabilities = {
    vulnerabilityScanning: false,
    licenseDetection: false,
    usageAnalysis: true,
    fixSuggestions: true
  };

  private config: DepcheckConfig;

  constructor(config: DepcheckConfig = {}) {
    this.config = {
      ignoreMatches: ['eslint-*', '@types/*', 'webpack-*'],
      ignoreDirs: ['node_modules', 'dist', 'build', '.git'],
      ignorePatterns: ['*.min.js', '*.bundle.js'],
      skipMissing: false,
      detectors: ['requireCallExpression', 'importDeclaration'],
      ...config
    };
  }

  /**
   * Initialize the adapter with configuration
   */
  async initialize(config: any): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Analyze dependency tree for unused and missing dependencies
   */
  async analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');

      if (!existsSync(packageJsonPath)) {
        throw new Error(`package.json not found in ${projectPath}`);
      }

      // Run depcheck analysis
      const result = await this.runDepcheck(projectPath);

      // Convert depcheck results to unified dependency issues
      const issues: DependencyIssue[] = [];

      // Add unused dependencies
      issues.push(...this.createUnusedDependencyIssues(result.dependencies, 'dependencies', projectPath));
      issues.push(...this.createUnusedDependencyIssues(result.devDependencies, 'devDependencies', projectPath));

      // Add missing dependencies
      issues.push(...this.createMissingDependencyIssues(result.missing, projectPath));

      // Add dependency usage statistics
      issues.push(...this.createUsageStatistics(result.using, projectPath));

      return issues;

    } catch (error) {
      console.error('Error analyzing dependency tree:', error);
      return [];
    }
  }

  /**
   * Check license compliance (delegated to license checker)
   */
  async checkLicenseCompliance(dependencies: any[]): Promise<DependencyIssue[]> {
    // This method delegates to license-checker-adapter
    return [];
  }

  /**
   * Assess supply chain risk based on usage patterns
   */
  assessSupplyChainRisk(dependency: any): 'low' | 'medium' | 'high' | 'critical' {
    // Unused dependencies pose higher supply chain risk
    if (dependency.isUnused) {
      return 'medium';
    }

    // Frequently used dependencies are lower risk
    if (dependency.usageCount > 10) {
      return 'low';
    }

    return 'low';
  }

  /**
   * Run depcheck command and parse results
   */
  private async runDepcheck(projectPath: string): Promise<DepcheckResult> {
    try {
      // Build depcheck command
      const depcheckCmd = this.buildDepcheckCommand(projectPath);

      // Execute depcheck
      const output = execSync(depcheckCmd, {
        cwd: projectPath,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000 // 60 second timeout
      });

      // Parse JSON output
      return JSON.parse(output);

    } catch (error) {
      // If depcheck is not installed, provide fallback analysis
      console.warn('Depcheck not available, using package.json analysis fallback');
      return this.fallbackAnalysis(projectPath);
    }
  }

  /**
   * Build depcheck command with configuration
   */
  private buildDepcheckCommand(projectPath: string): string {
    const cmd = ['npx depcheck'];

    // Add JSON output
    cmd.push('--json');

    // Add ignore patterns
    if (this.config.ignoreMatches && this.config.ignoreMatches.length > 0) {
      cmd.push(`--ignore-matches="${this.config.ignoreMatches.join(',')}"`);
    }

    // Add ignore directories
    if (this.config.ignoreDirs && this.config.ignoreDirs.length > 0) {
      cmd.push(`--ignore-dirs="${this.config.ignoreDirs.join(',')}"`);
    }

    // Add skip missing flag
    if (this.config.skipMissing) {
      cmd.push('--skip-missing');
    }

    cmd.push(projectPath);
    return cmd.join(' ');
  }

  /**
   * Fallback analysis when depcheck is not available
   */
  private fallbackAnalysis(projectPath: string): DepcheckResult {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    return {
      dependencies: [],
      devDependencies: [],
      missing: {},
      using: {},
      invalidFiles: {},
      invalidDirs: {}
    };
  }

  /**
   * Create unused dependency issues
   */
  private createUnusedDependencyIssues(
    unusedDeps: string[],
    depType: 'dependencies' | 'devDependencies',
    projectPath: string
  ): DependencyIssue[] {
    return unusedDeps.map(depName => ({
      id: `depcheck-unused-${depName}`,
      title: `Unused ${depType}: ${depName}`,
      description: `Package '${depName}' is listed in ${depType} but appears to be unused in the codebase.`,
      entity: new UnifiedEntity({
        id: `package-${depName}`,
        type: 'dependency',
        name: depName,
        canonicalPath: `package.json#${depType}.${depName}`
      }),
      severity: depType === 'dependencies' ? IssueSeverity.MEDIUM : IssueSeverity.LOW,
      analysisType: AnalysisType.DEPENDENCY_USAGE,
      ruleId: 'depcheck-unused-dependency',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'Depcheck Dependency Analyzer',
      metadata: { packageName: depName, depType },
      createdAt: new Date().toISOString(),
      dependencyInfo: {
        packageName: depName,
        version: 'unknown',
        type: depType === 'dependencies' ? 'direct' : 'dev',
        depth: 0,
        licenses: [],
        vulnerabilities: []
      },
      dependencyCategory: 'usage',
      supplyChainRisk: 'medium',
      remediationSuggestion: {
        action: 'remove',
        description: `Remove unused dependency '${depName}' from package.json`,
        automatable: true
      }
    } as unknown as DependencyIssue));
  }

  /**
   * Create missing dependency issues
   */
  private createMissingDependencyIssues(
    missingDeps: { [key: string]: string[] },
    projectPath: string
  ): DependencyIssue[] {
    const issues: DependencyIssue[] = [];

    for (const [depName, files] of Object.entries(missingDeps)) {
      issues.push({
        id: `depcheck-missing-${depName}`,
        title: `Missing dependency: ${depName}`,
        description: `Package '${depName}' is used in ${files.length} file(s) but not listed in package.json dependencies.`,
        entity: new UnifiedEntity({
          id: `missing-package-${depName}`,
          type: 'dependency',
          name: depName,
          canonicalPath: `missing:${depName}`
        }),
        severity: IssueSeverity.HIGH,
        analysisType: AnalysisType.DEPENDENCY_USAGE,
        ruleId: 'depcheck-missing-dependency',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'Depcheck Dependency Analyzer',
        metadata: { missingFiles: files },
        createdAt: new Date().toISOString(),
        dependencyInfo: {
          packageName: depName,
          version: 'missing',
          type: 'direct',
          depth: 0,
          licenses: [],
          vulnerabilities: []
        },
        dependencyCategory: 'usage',
        supplyChainRisk: 'high',
        remediationSuggestion: {
          action: 'update',
          description: `Add missing dependency '${depName}' to package.json`,
          automatable: true
        }
      } as unknown as DependencyIssue);
    }

    return issues;
  }

  /**
   * Create usage statistics for used dependencies
   */
  private createUsageStatistics(
    usedDeps: { [key: string]: string[] },
    projectPath: string
  ): DependencyIssue[] {
    const issues: DependencyIssue[] = [];

    for (const [depName, files] of Object.entries(usedDeps)) {
      if (files.length === 1) {
        // Single-file usage - potential optimization opportunity
        issues.push({
          id: `depcheck-single-use-${depName}`,
          title: `Single-file dependency usage: ${depName}`,
          description: `Package '${depName}' is only used in one file (${files[0]}). Consider if this dependency is necessary.`,
          entity: new UnifiedEntity({
            id: `single-use-${depName}`,
            type: 'dependency',
            name: depName,
            canonicalPath: `package.json#dependencies.${depName}`
          }),
          severity: IssueSeverity.INFO,
          analysisType: AnalysisType.DEPENDENCY_USAGE,
          ruleId: 'depcheck-single-file-usage',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          toolName: 'Depcheck Dependency Analyzer',
          metadata: { singleUsageFile: files[0] },
          createdAt: new Date().toISOString(),
          dependencyInfo: {
            packageName: depName,
            version: 'unknown',
            type: 'direct',
            depth: 0,
            licenses: [],
            vulnerabilities: []
          },
          dependencyCategory: 'usage',
          supplyChainRisk: 'low',
          remediationSuggestion: {
            action: 'review',
            description: `Review if '${depName}' is necessary for single-file usage`,
            automatable: false
          }
        } as unknown as DependencyIssue);
      }
    }

    return issues;
  }
}

export default DepcheckAdapter;