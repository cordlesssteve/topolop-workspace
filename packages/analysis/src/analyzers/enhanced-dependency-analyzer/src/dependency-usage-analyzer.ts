/**
 * Dependency Usage Analyzer - Topolop Phase 2
 *
 * Analyzes actual usage of dependencies in codebase to identify unused packages,
 * dead code, and optimization opportunities.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { execSync } from 'child_process';

import {
  DependencyAdapter,
  DependencyIssue,
  DependencyInfo
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedIssue, UnifiedEntity } from '@topolop/shared-types';

/**
 * Usage analysis configuration
 */
export interface UsageAnalysisConfig {
  includeDevDependencies?: boolean;
  scanPaths?: string[];
  excludePaths?: string[];
  fileExtensions?: string[];
  deepAnalysis?: boolean;
  bundleAnalysis?: boolean;
}

/**
 * File usage analysis result
 */
interface FileUsageResult {
  filePath: string;
  imports: string[];
  requires: string[];
  dynamicImports: string[];
}

/**
 * Package usage statistics
 */
interface PackageUsageStats {
  packageName: string;
  totalReferences: number;
  fileCount: number;
  usagePattern: 'heavy' | 'moderate' | 'light' | 'unused';
  importTypes: {
    static: number;
    dynamic: number;
    require: number;
  };
  usedFeatures: string[];
  unusedSince?: Date;
}

/**
 * Bundle analysis result (if available)
 */
interface BundleAnalysisResult {
  packageName: string;
  bundleSize: number;
  gzippedSize: number;
  treeshakeable: boolean;
  unusedExports: string[];
}

/**
 * Dependency usage analyzer
 */
export class DependencyUsageAnalyzer implements DependencyAdapter {
  public readonly name = 'Dependency Usage Analyzer';
  public readonly version = '1.0.0';
  public readonly type = 'usage' as const;

  public readonly capabilities = {
    vulnerabilityScanning: false,
    licenseDetection: false,
    usageAnalysis: true,
    fixSuggestions: true
  };

  private config: UsageAnalysisConfig = {};
  private packageJson: any = null;
  private packageLock: any = null;

  /**
   * Initialize usage analyzer with configuration
   */
  async initialize(config: UsageAnalysisConfig): Promise<void> {
    this.config = {
      includeDevDependencies: false,
      scanPaths: ['src', 'lib', 'app'],
      excludePaths: ['node_modules', 'dist', 'build', '.git'],
      fileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'],
      deepAnalysis: false,
      bundleAnalysis: false,
      ...config
    };
  }

  /**
   * Analyze dependency usage patterns
   */
  async analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]> {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageLockPath = join(projectPath, 'package-lock.json');

    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project path');
    }

    try {
      // Load package configuration
      this.packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      this.packageLock = existsSync(packageLockPath)
        ? JSON.parse(readFileSync(packageLockPath, 'utf8'))
        : null;

      // Get all dependencies to analyze
      const dependencies = this.getAllDependencies();

      // Scan codebase for usage patterns
      const fileUsages = await this.scanCodebaseUsage(projectPath);

      // Analyze usage for each dependency
      const usageStats = this.analyzePackageUsage(dependencies, fileUsages);

      // Optional: Bundle analysis
      let bundleResults: BundleAnalysisResult[] = [];
      if (this.config.bundleAnalysis) {
        bundleResults = await this.performBundleAnalysis(projectPath, dependencies);
      }

      // Generate dependency issues
      const issues: DependencyIssue[] = [];

      for (const [packageName, stats] of Object.entries(usageStats)) {
        const dependencyInfo = this.createDependencyInfo(packageName, stats);
        const bundleInfo = bundleResults.find(b => b.packageName === packageName);

        // Create issues for unused or problematic dependencies
        if (stats.usagePattern === 'unused') {
          issues.push(this.createUnusedDependencyIssue(dependencyInfo, projectPath));
        }

        if (bundleInfo && bundleInfo.bundleSize > 100000) { // > 100KB
          issues.push(this.createLargeBundleIssue(dependencyInfo, bundleInfo, projectPath));
        }

        if (stats.totalReferences === 1 && stats.fileCount === 1) {
          issues.push(this.createSingleUseIssue(dependencyInfo, projectPath));
        }
      }

      return issues;

    } catch (error) {
      throw new Error(`Usage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check license compliance (not applicable for usage analysis)
   */
  async checkLicenseCompliance(dependencies: DependencyInfo[]): Promise<DependencyIssue[]> {
    return [];
  }

  /**
   * Assess supply chain risk based on usage patterns
   */
  assessSupplyChainRisk(dependency: DependencyInfo): 'low' | 'medium' | 'high' | 'critical' {
    if (!dependency.usageAnalysis) return 'medium';

    const usage = dependency.usageAnalysis;

    // Unused dependencies are lower risk but still concerning
    if (!usage.isUsed) return 'low';

    // Heavy usage with many references is higher risk
    if (usage.usageCount > 50 && usage.criticalUsage) return 'high';
    if (usage.usageCount > 20) return 'medium';

    return 'low';
  }

  /**
   * Get all dependencies from package.json
   */
  private getAllDependencies(): string[] {
    const deps = Object.keys(this.packageJson.dependencies || {});
    const devDeps = this.config.includeDevDependencies
      ? Object.keys(this.packageJson.devDependencies || {})
      : [];

    return [...deps, ...devDeps];
  }

  /**
   * Scan codebase for import/require usage
   */
  private async scanCodebaseUsage(projectPath: string): Promise<FileUsageResult[]> {
    const results: FileUsageResult[] = [];
    const scanPaths = this.config.scanPaths!.map(p => join(projectPath, p));

    for (const scanPath of scanPaths) {
      if (existsSync(scanPath)) {
        const files = this.findSourceFiles(scanPath);
        for (const file of files) {
          const usage = this.analyzeFileUsage(file);
          if (usage.imports.length > 0 || usage.requires.length > 0 || usage.dynamicImports.length > 0) {
            results.push(usage);
          }
        }
      }
    }

    return results;
  }

  /**
   * Find all source files to analyze
   */
  private findSourceFiles(dirPath: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (!this.config.excludePaths!.some(excluded => entry.includes(excluded))) {
          files.push(...this.findSourceFiles(fullPath));
        }
      } else if (stat.isFile()) {
        // Include files with relevant extensions
        if (this.config.fileExtensions!.includes(extname(entry))) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Analyze import/require usage in a single file
   */
  private analyzeFileUsage(filePath: string): FileUsageResult {
    const content = readFileSync(filePath, 'utf8');
    const imports: string[] = [];
    const requires: string[] = [];
    const dynamicImports: string[] = [];

    // ES6 import statements
    const importRegex = /import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }

    // CommonJS require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1]) requires.push(match[1]);
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      if (match[1]) dynamicImports.push(match[1]);
    }

    return {
      filePath,
      imports: this.normalizePackageNames(imports.filter((imp): imp is string => imp !== undefined)),
      requires: this.normalizePackageNames(requires.filter((req): req is string => req !== undefined)),
      dynamicImports: this.normalizePackageNames(dynamicImports.filter((imp): imp is string => imp !== undefined))
    };
  }

  /**
   * Normalize package names (remove subpaths, resolve scoped packages)
   */
  private normalizePackageNames(imports: string[]): string[] {
    return imports
      .filter(imp => imp != null && !imp.startsWith('.') && !imp.startsWith('/')) // Filter out relative imports
      .map(imp => {
        // Handle scoped packages
        if (imp.startsWith('@')) {
          const parts = imp.split('/');
          return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : imp;
        }
        // Handle regular packages
        const packageName = imp.split('/')[0];
        return packageName || imp; // Fallback to original if split fails
      })
      .filter((imp, index, array) => imp && array.indexOf(imp) === index); // Remove duplicates and empty strings
  }

  /**
   * Analyze usage patterns for each package
   */
  private analyzePackageUsage(
    dependencies: string[],
    fileUsages: FileUsageResult[]
  ): Record<string, PackageUsageStats> {
    const stats: Record<string, PackageUsageStats> = {};

    for (const dep of dependencies) {
      let totalReferences = 0;
      let fileCount = 0;
      const staticImports = new Set<string>();
      const dynamicImportCount = new Set<string>();
      const requireCount = new Set<string>();

      for (const fileUsage of fileUsages) {
        let fileHasPackage = false;

        // Count static imports
        if (fileUsage.imports.includes(dep)) {
          staticImports.add(fileUsage.filePath);
          fileHasPackage = true;
        }

        // Count requires
        if (fileUsage.requires.includes(dep)) {
          requireCount.add(fileUsage.filePath);
          fileHasPackage = true;
        }

        // Count dynamic imports
        if (fileUsage.dynamicImports.includes(dep)) {
          dynamicImportCount.add(fileUsage.filePath);
          fileHasPackage = true;
        }

        if (fileHasPackage) {
          fileCount++;
          totalReferences++;
        }
      }

      // Determine usage pattern
      let usagePattern: PackageUsageStats['usagePattern'];
      if (totalReferences === 0) {
        usagePattern = 'unused';
      } else if (totalReferences >= 10) {
        usagePattern = 'heavy';
      } else if (totalReferences >= 5) {
        usagePattern = 'moderate';
      } else {
        usagePattern = 'light';
      }

      stats[dep] = {
        packageName: dep,
        totalReferences,
        fileCount,
        usagePattern,
        importTypes: {
          static: staticImports.size,
          dynamic: dynamicImportCount.size,
          require: requireCount.size
        },
        usedFeatures: [], // Would need deeper analysis
        unusedSince: usagePattern === 'unused' ? new Date() : undefined
      };
    }

    return stats;
  }

  /**
   * Perform bundle analysis if available
   */
  private async performBundleAnalysis(
    projectPath: string,
    dependencies: string[]
  ): Promise<BundleAnalysisResult[]> {
    // This would integrate with webpack-bundle-analyzer or similar tools
    // For now, return empty array
    return [];
  }

  /**
   * Create dependency info from usage stats
   */
  private createDependencyInfo(packageName: string, stats: PackageUsageStats): DependencyInfo {
    const isDev = !!this.packageJson.devDependencies?.[packageName];
    const version = this.packageJson.dependencies?.[packageName] ||
                   this.packageJson.devDependencies?.[packageName] ||
                   'unknown';

    return {
      packageName,
      version,
      type: isDev ? 'dev' : 'direct',
      depth: 0,
      licenses: [],
      vulnerabilities: [],
      updateAvailable: false,
      usageAnalysis: {
        isUsed: stats.usagePattern !== 'unused',
        usageCount: stats.totalReferences,
        criticalUsage: stats.usagePattern === 'heavy'
      }
    };
  }

  /**
   * Create issue for unused dependency
   */
  private createUnusedDependencyIssue(
    dependencyInfo: DependencyInfo,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `unused-${dependencyInfo.packageName}`,
      title: `Unused Dependency: ${dependencyInfo.packageName}`,
      description: `Package ${dependencyInfo.packageName} is declared as a dependency but not used in the codebase`,
      severity: IssueSeverity.MEDIUM,
      analysisType: AnalysisType.DEPENDENCY_USAGE,

      entity: {
        id: `dep-${dependencyInfo.packageName}`,
        name: dependencyInfo.packageName,
        type: 'dependency',
        canonicalPath: `node_modules/${dependencyInfo.packageName}`,
        originalIdentifier: dependencyInfo.packageName,
        toolName: this.name,
        confidence: 0.9
      },

      ruleId: 'usage-analysis',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'usage',
      supplyChainRisk: 'low',

      remediationSuggestion: {
        action: 'remove',
        description: `Remove unused dependency: npm uninstall ${dependencyInfo.packageName}`,
        automatable: true
      },

      metadata: {
        toolName: this.name,
        category: 'optimization',
        confidence: 0.9,
        tags: ['unused-dependency', 'optimization']
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `${dependencyInfo.packageName}-unused`
    } as DependencyIssue;
  }

  /**
   * Create issue for large bundle dependency
   */
  private createLargeBundleIssue(
    dependencyInfo: DependencyInfo,
    bundleInfo: BundleAnalysisResult,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `large-bundle-${dependencyInfo.packageName}`,
      title: `Large Bundle Impact: ${dependencyInfo.packageName}`,
      description: `Package ${dependencyInfo.packageName} adds ${Math.round(bundleInfo.bundleSize / 1024)}KB to bundle size`,
      severity: bundleInfo.bundleSize > 500000 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      analysisType: AnalysisType.DEPENDENCY_USAGE,

      entity: {
        id: `dep-${dependencyInfo.packageName}`,
        name: dependencyInfo.packageName,
        type: 'dependency',
        canonicalPath: `node_modules/${dependencyInfo.packageName}`,
        originalIdentifier: dependencyInfo.packageName,
        toolName: this.name,
        confidence: 0.9
      },

      ruleId: 'usage-analysis',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'usage',
      supplyChainRisk: 'medium',

      remediationSuggestion: {
        action: 'review',
        description: `Consider lighter alternatives or optimize usage of ${dependencyInfo.packageName}`,
        automatable: false
      },

      metadata: {
        toolName: this.name,
        category: 'performance',
        confidence: 0.8,
        tags: ['bundle-size', 'performance']
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `${dependencyInfo.packageName}-large-bundle`
    } as DependencyIssue;
  }

  /**
   * Create issue for single-use dependency
   */
  private createSingleUseIssue(
    dependencyInfo: DependencyInfo,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `single-use-${dependencyInfo.packageName}`,
      title: `Single Use Dependency: ${dependencyInfo.packageName}`,
      description: `Package ${dependencyInfo.packageName} is only used in one location - consider inlining or alternative`,
      severity: IssueSeverity.LOW,
      analysisType: AnalysisType.DEPENDENCY_USAGE,

      entity: {
        id: `dep-${dependencyInfo.packageName}`,
        name: dependencyInfo.packageName,
        type: 'dependency',
        canonicalPath: `node_modules/${dependencyInfo.packageName}`,
        originalIdentifier: dependencyInfo.packageName,
        toolName: this.name,
        confidence: 0.9
      },

      ruleId: 'usage-analysis',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'usage',
      supplyChainRisk: 'low',

      remediationSuggestion: {
        action: 'review',
        description: `Consider if ${dependencyInfo.packageName} can be replaced with native functionality or inlined`,
        automatable: false
      },

      metadata: {
        toolName: this.name,
        category: 'optimization',
        confidence: 0.7,
        tags: ['single-use', 'optimization']
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `${dependencyInfo.packageName}-single-use`
    } as DependencyIssue;
  }
}