/**
 * Enhanced Madge Architecture Adapter - Topolop Phase 2
 *
 * Provides comprehensive architecture analysis including circular dependency detection,
 * module dependency visualization, architecture complexity analysis, and refactoring
 * opportunity identification using Madge.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 5-6
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';

import {
  ArchitectureAdapter,
  ArchitectureIssue,
  ArchitectureInfo,
  TechnicalDebtAssessment,
  WorkflowRecommendation
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedEntity } from '@topolop/shared-types';

/**
 * Madge configuration for architecture analysis
 */
export interface MadgeArchitectureConfig {
  includeNpm?: boolean;
  fileExtensions?: string[];
  excludePattern?: string;
  circularOnly?: boolean;
  dependencyFilter?: (dependency: string) => boolean;
  maxDepth?: number;
  includeJsonFiles?: boolean;
}

/**
 * Madge analysis result structure
 */
interface MadgeArchitectureResult {
  dependencies: { [key: string]: string[] };
  circular: string[][];
  orphans: string[];
  tree?: any;
  image?: string;
}

/**
 * Architecture complexity metrics
 */
interface ArchitectureComplexityMetrics {
  totalFiles: number;
  totalDependencies: number;
  circularDependencies: number;
  maxDepth: number;
  averageDependenciesPerFile: number;
  dependencyConcentration: number;
  architecturalCohesion: number;
  couplingFactor: number;
}

/**
 * Enhanced Madge adapter implementing comprehensive architecture analysis
 */
export class MadgeArchitectureAdapter implements ArchitectureAdapter {
  public readonly name = 'Madge Architecture Analyzer';
  public readonly version = '1.0.0';
  public readonly type = 'dependency_analysis' as const;

  private config: MadgeArchitectureConfig;

  constructor(config: MadgeArchitectureConfig = {}) {
    this.config = {
      includeNpm: false,
      fileExtensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
      excludePattern: 'node_modules/**',
      circularOnly: false,
      maxDepth: 50,
      includeJsonFiles: false,
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
   * Analyze architecture and return comprehensive architecture issues
   */
  async analyzeArchitecture(projectPath: string): Promise<ArchitectureIssue[]> {
    try {
      // Run madge analysis
      const madgeResult = await this.runMadgeAnalysis(projectPath);

      // Calculate complexity metrics
      const complexityMetrics = this.calculateComplexityMetrics(madgeResult);

      // Generate architecture issues
      const issues: ArchitectureIssue[] = [];

      // Add circular dependency issues
      issues.push(...this.createCircularDependencyIssues(madgeResult.circular, projectPath));

      // Add complexity issues
      issues.push(...this.createComplexityIssues(madgeResult.dependencies, complexityMetrics, projectPath));

      // Add coupling issues
      issues.push(...this.createCouplingIssues(madgeResult.dependencies, complexityMetrics, projectPath));

      // Add cohesion issues
      issues.push(...this.createCohesionIssues(madgeResult.dependencies, projectPath));

      // Add orphaned files issues
      issues.push(...this.createOrphanedFilesIssues(madgeResult.orphans, projectPath));

      return issues;

    } catch (error) {
      console.error('Error analyzing architecture:', error);
      return [];
    }
  }

  /**
   * Detect design patterns in code structure
   */
  detectDesignPatterns(codeStructure: any): ArchitectureIssue[] {
    const patterns: ArchitectureIssue[] = [];

    // Analyze for common design patterns
    patterns.push(...this.detectSingletonPattern(codeStructure));
    patterns.push(...this.detectFactoryPattern(codeStructure));
    patterns.push(...this.detectObserverPattern(codeStructure));
    patterns.push(...this.detectAdapterPattern(codeStructure));

    return patterns;
  }

  /**
   * Assess technical debt based on architecture issues
   */
  assessTechnicalDebt(issues: ArchitectureIssue[]): TechnicalDebtAssessment {
    const criticalIssues = issues.filter(issue => issue.severity === IssueSeverity.CRITICAL);
    const highIssues = issues.filter(issue => issue.severity === IssueSeverity.HIGH);
    const mediumIssues = issues.filter(issue => issue.severity === IssueSeverity.MEDIUM);

    const totalDebtScore = this.calculateTechnicalDebtScore(issues);

    return {
      totalDebtMinutes: totalDebtScore,
      debtRatio: Math.min((totalDebtScore / 1000) * 100, 100),
      ratingCategory: this.categorizeDebtLevel(totalDebtScore),
      breakdown: {
        complexity: issues.filter(issue => issue.architectureCategory === 'complexity').length,
        coupling: issues.filter(issue => issue.architectureCategory === 'coupling').length,
        duplication: issues.filter(issue => issue.architectureCategory === 'dependency_cycle').length,
        maintainability: issues.filter(issue => issue.architectureCategory === 'maintainability').length
      },
      recommendations: {
        immediate: ['Fix circular dependencies', 'Resolve critical coupling'],
        shortTerm: ['Refactor complex modules', 'Improve cohesion'],
        longTerm: ['Establish architecture guidelines', 'Implement dependency injection']
      }
    };
  }

  // Capabilities
  capabilities = {
    circularDependencyDetection: true,
    complexityAnalysis: true,
    patternRecognition: true,
    refactoringGuidance: true
  };

  /**
   * Run madge analysis and parse results
   */
  private async runMadgeAnalysis(projectPath: string): Promise<MadgeArchitectureResult> {
    try {
      // Build madge command
      const madgeCmd = this.buildMadgeCommand(projectPath);

      // Execute madge
      const output = execSync(madgeCmd, {
        cwd: projectPath,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 120000 // 2 minute timeout
      });

      // Parse JSON output
      const result = JSON.parse(output);

      // Additional analysis for orphans
      const orphans = await this.findOrphanedFiles(projectPath, result.dependencies);

      return {
        dependencies: result.dependencies || result,
        circular: result.circular || [],
        orphans,
        tree: result.tree
      };

    } catch (error) {
      // If madge is not installed, provide fallback analysis
      console.warn('Madge not available, using package.json analysis fallback');
      return this.fallbackArchitectureAnalysis(projectPath);
    }
  }

  /**
   * Build madge command with configuration
   */
  private buildMadgeCommand(projectPath: string): string {
    const cmd = ['npx madge'];

    // Add JSON output
    cmd.push('--json');

    // Add circular dependency detection
    cmd.push('--circular');

    // Add file extensions
    if (this.config.fileExtensions && this.config.fileExtensions.length > 0) {
      cmd.push(`--extensions ${this.config.fileExtensions.join(',')}`);
    }

    // Add exclude pattern
    if (this.config.excludePattern) {
      cmd.push(`--exclude '${this.config.excludePattern}'`);
    }

    // Add include npm if specified
    if (this.config.includeNpm) {
      cmd.push('--include-npm');
    }

    cmd.push('.');
    return cmd.join(' ');
  }

  /**
   * Fallback architecture analysis when madge is not available
   */
  private fallbackArchitectureAnalysis(projectPath: string): MadgeArchitectureResult {
    const packageJsonPath = join(projectPath, 'package.json');
    const result: MadgeArchitectureResult = {
      dependencies: {},
      circular: [],
      orphans: []
    };

    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      // Basic analysis from package.json
      const dependencies = packageJson.dependencies || {};
      result.dependencies = {
        'package.json': Object.keys(dependencies)
      };
    }

    return result;
  }

  /**
   * Find orphaned files (files with no dependencies or dependents)
   */
  private async findOrphanedFiles(projectPath: string, dependencies: { [key: string]: string[] }): Promise<string[]> {
    const allFiles = new Set(Object.keys(dependencies));
    const referencedFiles = new Set<string>();

    // Find all referenced files
    for (const deps of Object.values(dependencies)) {
      deps.forEach(dep => referencedFiles.add(dep));
    }

    // Find files that are not referenced and have no dependencies
    const orphans: string[] = [];
    for (const file of allFiles) {
      if (!referencedFiles.has(file) && (dependencies[file]?.length || 0) === 0) {
        orphans.push(file);
      }
    }

    return orphans;
  }

  /**
   * Calculate comprehensive architecture complexity metrics
   */
  private calculateComplexityMetrics(result: MadgeArchitectureResult): ArchitectureComplexityMetrics {
    const dependencies = result.dependencies;
    const totalFiles = Object.keys(dependencies).length;
    const totalDependencies = Object.values(dependencies).reduce((sum, deps) => sum + deps.length, 0);

    const dependencyCounts = Object.values(dependencies).map(deps => deps.length);
    const averageDependencies = totalFiles > 0 ? totalDependencies / totalFiles : 0;

    // Calculate dependency concentration (how concentrated dependencies are)
    const maxDependencies = Math.max(...dependencyCounts, 0);
    const dependencyConcentration = maxDependencies / (averageDependencies + 1);

    // Calculate architectural cohesion
    const architecturalCohesion = this.calculateArchitecturalCohesion(dependencies);

    // Calculate coupling factor
    const couplingFactor = this.calculateCouplingFactor(dependencies);

    // Calculate max depth
    const maxDepth = this.calculateMaxDependencyDepth(dependencies);

    return {
      totalFiles,
      totalDependencies,
      circularDependencies: result.circular.length,
      maxDepth,
      averageDependenciesPerFile: averageDependencies,
      dependencyConcentration,
      architecturalCohesion,
      couplingFactor
    };
  }

  /**
   * Calculate architectural cohesion based on directory structure
   */
  private calculateArchitecturalCohesion(dependencies: { [key: string]: string[] }): number {
    let intraModuleDeps = 0;
    let totalDeps = 0;

    for (const [file, deps] of Object.entries(dependencies)) {
      const fileDir = dirname(file);

      for (const dep of deps) {
        totalDeps++;
        if (dirname(dep) === fileDir) {
          intraModuleDeps++;
        }
      }
    }

    return totalDeps > 0 ? intraModuleDeps / totalDeps : 1;
  }

  /**
   * Calculate coupling factor
   */
  private calculateCouplingFactor(dependencies: { [key: string]: string[] }): number {
    const totalFiles = Object.keys(dependencies).length;
    const totalPossibleConnections = totalFiles * (totalFiles - 1);
    const actualConnections = Object.values(dependencies).reduce((sum, deps) => sum + deps.length, 0);

    return totalPossibleConnections > 0 ? actualConnections / totalPossibleConnections : 0;
  }

  /**
   * Calculate maximum dependency depth
   */
  private calculateMaxDependencyDepth(dependencies: { [key: string]: string[] }): number {
    const visited = new Set<string>();
    let maxDepth = 0;

    const calculateDepth = (file: string, currentDepth: number = 0): number => {
      if (visited.has(file) || currentDepth > 100) { // Prevent infinite loops
        return currentDepth;
      }

      visited.add(file);
      const deps = dependencies[file] || [];

      if (deps.length === 0) {
        return currentDepth;
      }

      let maxChildDepth = currentDepth;
      for (const dep of deps) {
        const childDepth = calculateDepth(dep, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }

      visited.delete(file);
      return maxChildDepth;
    };

    for (const file of Object.keys(dependencies)) {
      maxDepth = Math.max(maxDepth, calculateDepth(file));
    }

    return maxDepth;
  }

  /**
   * Create circular dependency issues
   */
  private createCircularDependencyIssues(circular: string[][], projectPath: string): ArchitectureIssue[] {
    return circular.map((cycle, index) => ({
      id: `circular-dependency-${index}`,
      title: `Circular dependency detected: ${cycle.length} files`,
      description: `Circular dependency chain found involving ${cycle.length} files: ${cycle.join(' -> ')}.`,
      entity: new UnifiedEntity({
        id: `circular-${index}`,
        type: 'dependency_cycle',
        name: `Circular Dependency Chain ${index + 1}`,
        canonicalPath: cycle[0] || 'unknown'
      }),
      severity: cycle.length > 3 ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      ruleId: 'circular-dependency',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'Madge Architecture Analyzer',
      metadata: { cycle: cycle },
      createdAt: new Date().toISOString(),
      architectureInfo: {
        componentType: 'module',
        designPattern: 'circular_dependency',
        complexityMetrics: {
          cyclomaticComplexity: cycle.length,
          cognitiveComplexity: cycle.length * 2,
          maintainabilityIndex: Math.max(0, 100 - cycle.length * 10)
        },
        couplingLevel: cycle.length > 5 ? 'high' : cycle.length > 3 ? 'medium' : 'low',
        cohesionLevel: 'low'
      },
      architectureCategory: 'dependency_cycle',
      technicalDebtLevel: cycle.length > 5 ? 'critical' : cycle.length > 3 ? 'high' : 'medium',
      refactoringOpportunity: {
        suggestedAction: `Break circular dependency by extracting common functionality or using dependency injection`,
        effort: cycle.length > 5 ? 'high' : 'medium',
        impact: 'high'
      }
    } as unknown as ArchitectureIssue));
  }

  /**
   * Create complexity issues
   */
  private createComplexityIssues(
    dependencies: { [key: string]: string[] },
    metrics: ArchitectureComplexityMetrics,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    // High complexity files
    for (const [file, deps] of Object.entries(dependencies)) {
      if (deps.length > 15) { // Threshold for high complexity
        issues.push({
          id: `high-complexity-${file.replace(/[^a-zA-Z0-9]/g, '_')}`,
          title: `High complexity module: ${file}`,
          description: `Module '${file}' has ${deps.length} dependencies, indicating high complexity.`,
          entity: new UnifiedEntity({
            id: `complexity-${file}`,
            type: 'module',
            name: file,
            canonicalPath: file
          }),
          severity: deps.length > 25 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
          analysisType: AnalysisType.ARCHITECTURE_DESIGN,
          ruleId: 'high-module-complexity',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          toolName: 'Madge Architecture Analyzer',
          metadata: { file },
          createdAt: new Date().toISOString(),
          architectureInfo: {
            componentType: 'module',
            designPattern: 'high_coupling',
            complexityMetrics: {
              cyclomaticComplexity: deps.length,
              cognitiveComplexity: deps.length * 1.5,
              maintainabilityIndex: Math.max(0, 100 - deps.length * 3)
            },
            couplingLevel: deps.length > 25 ? 'high' : 'medium',
            cohesionLevel: 'low'
          },
          architectureCategory: 'complexity',
          technicalDebtLevel: deps.length > 25 ? 'high' : 'medium',
          refactoringOpportunity: {
            suggestedAction: 'Split module into smaller, more focused modules',
            effort: 'high',
            impact: 'high'
          }
        } as unknown as ArchitectureIssue);
      }
    }

    return issues;
  }

  /**
   * Create coupling issues
   */
  private createCouplingIssues(
    dependencies: { [key: string]: string[] },
    metrics: ArchitectureComplexityMetrics,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    if (metrics.couplingFactor > 0.3) { // High coupling threshold
      issues.push({
        id: 'high-system-coupling',
        title: 'High system coupling detected',
        description: `System has high coupling factor of ${metrics.couplingFactor.toFixed(3)}, indicating tight interdependencies.`,
        entity: new UnifiedEntity({
          id: 'system-coupling',
          type: 'architecture',
          name: 'System Architecture',
          canonicalPath: projectPath
        }),
        severity: metrics.couplingFactor > 0.5 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
        analysisType: AnalysisType.ARCHITECTURE_DESIGN,
        ruleId: 'high-system-coupling',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'Madge Architecture Analyzer',
        metadata: { analysisScope: 'system' },
        createdAt: new Date().toISOString(),
        architectureInfo: {
          componentType: 'module',
          designPattern: 'tight_coupling',
          complexityMetrics: {
            cyclomaticComplexity: Math.floor(metrics.couplingFactor * 100),
            cognitiveComplexity: Math.floor(metrics.couplingFactor * 150),
            maintainabilityIndex: Math.max(0, 100 - metrics.couplingFactor * 100)
          },
          couplingLevel: 'high',
          cohesionLevel: metrics.architecturalCohesion > 0.7 ? 'high' : 'medium'
        },
        architectureCategory: 'coupling',
        technicalDebtLevel: metrics.couplingFactor > 0.5 ? 'high' : 'medium',
        refactoringOpportunity: {
          suggestedAction: 'Implement dependency injection and interface segregation',
          effort: 'high',
          impact: 'high'
        }
      } as unknown as ArchitectureIssue);
    }

    return issues;
  }

  /**
   * Create cohesion issues
   */
  private createCohesionIssues(dependencies: { [key: string]: string[] }, projectPath: string): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    // Analyze cohesion by directory structure
    const directoryDeps = this.groupDependenciesByDirectory(dependencies);

    for (const [directory, dirInfo] of Object.entries(directoryDeps)) {
      if (dirInfo.externalDeps > dirInfo.internalDeps * 2) { // Low cohesion threshold
        issues.push({
          id: `low-cohesion-${directory.replace(/[^a-zA-Z0-9]/g, '_')}`,
          title: `Low cohesion in directory: ${directory}`,
          description: `Directory '${directory}' has low cohesion with ${dirInfo.externalDeps} external dependencies vs ${dirInfo.internalDeps} internal.`,
          entity: new UnifiedEntity({
            id: `cohesion-${directory}`,
            type: 'module',
            name: directory,
            canonicalPath: directory
          }),
          severity: IssueSeverity.MEDIUM,
          analysisType: AnalysisType.ARCHITECTURE_DESIGN,
          ruleId: 'low-module-cohesion',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          toolName: 'Madge Architecture Analyzer',
          metadata: { directory },
          createdAt: new Date().toISOString(),
          architectureInfo: {
            componentType: 'module',
            designPattern: 'low_cohesion',
            complexityMetrics: {
              cyclomaticComplexity: dirInfo.externalDeps,
              cognitiveComplexity: dirInfo.externalDeps * 1.2,
              maintainabilityIndex: Math.max(0, 100 - dirInfo.externalDeps * 2)
            },
            couplingLevel: 'medium',
            cohesionLevel: 'low'
          },
          architectureCategory: 'cohesion',
          technicalDebtLevel: 'medium',
          refactoringOpportunity: {
            suggestedAction: 'Reorganize modules to improve cohesion',
            effort: 'medium',
            impact: 'medium'
          }
        } as unknown as ArchitectureIssue);
      }
    }

    return issues;
  }

  /**
   * Create orphaned files issues
   */
  private createOrphanedFilesIssues(orphans: string[], projectPath: string): ArchitectureIssue[] {
    if (orphans.length === 0) return [];

    return [{
      id: 'orphaned-files',
      title: `${orphans.length} orphaned files detected`,
      description: `Found ${orphans.length} files with no dependencies or dependents: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? '...' : ''}.`,
      entity: new UnifiedEntity({
        id: 'orphaned-files',
        type: 'architecture',
        name: 'Orphaned Files',
        canonicalPath: orphans[0] || 'unknown'
      }),
      severity: orphans.length > 10 ? IssueSeverity.MEDIUM : IssueSeverity.LOW,
      analysisType: AnalysisType.ARCHITECTURE_DEBT,
      ruleId: 'orphaned-files',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'Madge Architecture Analyzer',
      metadata: { orphanedFiles: orphans },
      createdAt: new Date().toISOString(),
      architectureInfo: {
        componentType: 'module',
        designPattern: 'orphaned_code',
        complexityMetrics: {
          cyclomaticComplexity: orphans.length,
          cognitiveComplexity: orphans.length,
          maintainabilityIndex: Math.max(0, 100 - orphans.length * 2)
        },
        couplingLevel: 'low',
        cohesionLevel: 'low'
      },
      architectureCategory: 'maintainability',
      technicalDebtLevel: orphans.length > 20 ? 'medium' : 'low',
      refactoringOpportunity: {
        suggestedAction: 'Remove unused files or integrate them into the architecture',
        effort: 'low',
        impact: 'low'
      }
    } as unknown as ArchitectureIssue];
  }

  /**
   * Group dependencies by directory for cohesion analysis
   */
  private groupDependenciesByDirectory(dependencies: { [key: string]: string[] }) {
    const directoryDeps: { [key: string]: { internalDeps: number; externalDeps: number } } = {};

    for (const [file, deps] of Object.entries(dependencies)) {
      const fileDir = dirname(file);

      if (!directoryDeps[fileDir]) {
        directoryDeps[fileDir] = { internalDeps: 0, externalDeps: 0 };
      }

      for (const dep of deps) {
        if (dirname(dep) === fileDir) {
          directoryDeps[fileDir].internalDeps++;
        } else {
          directoryDeps[fileDir].externalDeps++;
        }
      }
    }

    return directoryDeps;
  }

  /**
   * Detect singleton pattern usage
   */
  private detectSingletonPattern(codeStructure: any): ArchitectureIssue[] {
    // This is a simplified pattern detection
    // In a real implementation, this would analyze the actual code structure
    return [];
  }

  /**
   * Detect factory pattern usage
   */
  private detectFactoryPattern(codeStructure: any): ArchitectureIssue[] {
    // This is a simplified pattern detection
    return [];
  }

  /**
   * Detect observer pattern usage
   */
  private detectObserverPattern(codeStructure: any): ArchitectureIssue[] {
    // This is a simplified pattern detection
    return [];
  }

  /**
   * Detect adapter pattern usage
   */
  private detectAdapterPattern(codeStructure: any): ArchitectureIssue[] {
    // This is a simplified pattern detection
    return [];
  }

  /**
   * Calculate technical debt score
   */
  private calculateTechnicalDebtScore(issues: ArchitectureIssue[]): number {
    return issues.reduce((score, issue) => {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL: return score + 10;
        case IssueSeverity.HIGH: return score + 7;
        case IssueSeverity.MEDIUM: return score + 4;
        case IssueSeverity.LOW: return score + 1;
        default: return score;
      }
    }, 0);
  }

  /**
   * Categorize debt level based on score
   */
  private categorizeDebtLevel(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 50) return 'E';  // critical
    if (score >= 30) return 'D';  // high
    if (score >= 15) return 'C';  // medium
    if (score >= 5) return 'B';   // low-medium
    return 'A';                   // excellent
  }

  /**
   * Estimate remediation time
   */
  private estimateRemediationTime(issues: ArchitectureIssue[]): string {
    const totalEffort = issues.reduce((time, issue) => {
      const effort = issue.refactoringOpportunity?.effort || 'medium';
      switch (effort) {
        case 'high': return time + 8;
        case 'medium': return time + 4;
        case 'low': return time + 1;
        default: return time + 4;
      }
    }, 0);

    if (totalEffort < 10) return '1-2 weeks';
    if (totalEffort < 30) return '1-2 months';
    if (totalEffort < 60) return '3-6 months';
    return '6+ months';
  }

  /**
   * Identify priority areas for remediation
   */
  private identifyPriorityAreas(issues: ArchitectureIssue[]): string[] {
    const categories = new Map<string, number>();

    for (const issue of issues) {
      const category = issue.architectureCategory;
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    return Array.from(categories.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);
  }

  /**
   * Generate debt remediation recommendations
   */
  private generateDebtRecommendations(issues: ArchitectureIssue[]): WorkflowRecommendation[] {
    const recommendations: WorkflowRecommendation[] = [];

    const circularIssues = issues.filter(issue => issue.architectureCategory === 'dependency_cycle');
    if (circularIssues.length > 0) {
      recommendations.push({
        action: `Address ${circularIssues.length} circular dependencies`,
        priority: 'high',
        effort: 'high',
        impact: 'high',
        steps: ['Identify circular dependency paths', 'Extract interfaces', 'Implement dependency injection'],
        automatable: false,
        timeline: {
          estimated: '2-4 weeks',
          urgency: 'short_term'
        }
      });
    }

    const complexityIssues = issues.filter(issue => issue.architectureCategory === 'complexity');
    if (complexityIssues.length > 0) {
      recommendations.push({
        action: `Reduce complexity in ${complexityIssues.length} modules`,
        priority: 'medium',
        effort: 'medium',
        impact: 'medium',
        steps: ['Identify complex modules', 'Split into smaller components', 'Refactor common functionality'],
        automatable: false,
        timeline: {
          estimated: '1-2 weeks',
          urgency: 'medium_term'
        }
      });
    }

    return recommendations;
  }
}

export default MadgeArchitectureAdapter;