/**
 * Dependency Analysis and Correlation System
 *
 * Analyzes module dependencies, import relationships, and cross-file correlations
 * to identify architectural issues and security vulnerabilities.
 */

import { DependencyRelationship } from './semantic-analysis-engine';
import { UnifiedIssue } from '@topolop/shared-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dependency graph analysis result
 */
export interface DependencyAnalysis {
  dependencies: DependencyRelationship[];
  modules: ModuleInfo[];
  clusters: DependencyCluster[];
  violations: ArchitecturalViolation[];
  metrics: DependencyMetrics;
  correlations: CrossFileDependencyCorrelation[];
}

/**
 * Module information
 */
export interface ModuleInfo {
  filePath: string;
  name: string;
  type: 'internal' | 'external' | 'builtin';
  size: number;
  exports: ExportInfo[];
  imports: ImportInfo[];
  dependencies: string[];
  dependents: string[];
  complexity: number;
  coupling: CouplingMetrics;
}

/**
 * Export information
 */
export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'type' | 'interface';
  isDefault: boolean;
  line: number;
  usageCount: number;
}

/**
 * Import information
 */
export interface ImportInfo {
  name: string;
  source: string;
  type: 'named' | 'default' | 'namespace' | 'dynamic';
  line: number;
  usageCount: number;
  isExternal: boolean;
}

/**
 * Coupling metrics
 */
export interface CouplingMetrics {
  afferentCoupling: number;  // Ca: modules that depend on this module
  efferentCoupling: number;  // Ce: modules this module depends on
  instability: number;       // I = Ce / (Ca + Ce)
  abstractness: number;      // A: ratio of abstract to concrete elements
  distance: number;          // D: distance from main sequence
}

/**
 * Dependency cluster
 */
export interface DependencyCluster {
  id: string;
  modules: string[];
  type: 'circular' | 'hub' | 'chain' | 'fan_out' | 'fan_in';
  strength: number;
  issues: string[];
  recommendations: string[];
  metadata?: { [key: string]: any };
}

/**
 * Architectural violation
 */
export interface ArchitecturalViolation {
  id: string;
  type: 'circular_dependency' | 'wrong_layer_dependency' | 'layer_violation' | 'external_coupling' | 'god_module' | 'orphan_module';
  severity: 'low' | 'medium' | 'high' | 'critical';
  modules: string[];
  description: string;
  impact: string;
  recommendations: string[];
  relatedIssues: UnifiedIssue[];
}

/**
 * Cross-file dependency correlation
 */
export interface CrossFileDependencyCorrelation {
  id: string;
  sourceFile: string;
  targetFile: string;
  issues: UnifiedIssue[];
  dependencyPath: string[];
  correlationType: 'direct_dependency' | 'transitive_dependency' | 'circular_dependency' | 'shared_dependency';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}

/**
 * Dependency metrics
 */
export interface DependencyMetrics {
  totalModules: number;
  totalDependencies: number;
  externalDependencies: number;
  circularDependencies: number;
  averageCoupling: number;
  maxDepth: number;
  modularity: number;
  stability: number;
}

/**
 * Package.json analysis
 */
export interface PackageAnalysis {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  vulnerabilities: PackageVulnerability[];
  outdatedPackages: OutdatedPackage[];
  licenseIssues: LicenseIssue[];
}

/**
 * Package vulnerability
 */
export interface PackageVulnerability {
  package: string;
  version: string;
  vulnerability: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  cve?: string;
  recommendation: string;
}

/**
 * Outdated package
 */
export interface OutdatedPackage {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  location: string;
}

/**
 * License issue
 */
export interface LicenseIssue {
  package: string;
  license: string;
  issue: 'incompatible' | 'missing' | 'copyleft' | 'commercial';
  recommendation: string;
}

/**
 * Main dependency analyzer
 */
export class DependencyAnalyzer {
  private moduleCache: Map<string, ModuleInfo> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();

  /**
   * Analyze complete dependency structure
   */
  public async analyzeDependencies(projectRoot: string, issues: UnifiedIssue[]): Promise<DependencyAnalysis> {
    // Discover all modules in the project
    const modules = await this.discoverModules(projectRoot);

    // Build dependency relationships
    const dependencies = await this.buildDependencyGraph(modules);

    // Analyze dependency clusters
    const clusters = this.analyzeDependencyClusters(dependencies);

    // Detect architectural violations
    const violations = this.detectArchitecturalViolations(modules, dependencies);

    // Calculate metrics
    const metrics = this.calculateDependencyMetrics(modules, dependencies);

    // Find cross-file correlations
    const correlations = this.findCrossFileDependencyCorrelations(issues, dependencies);

    return {
      dependencies,
      modules,
      clusters,
      violations,
      metrics,
      correlations
    };
  }

  /**
   * Discover all modules in the project
   */
  private async discoverModules(projectRoot: string): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];
    const jsFiles = await this.findJavaScriptFiles(projectRoot);

    for (const filePath of jsFiles) {
      try {
        const moduleInfo = await this.analyzeModule(filePath);
        modules.push(moduleInfo);
        this.moduleCache.set(filePath, moduleInfo);
      } catch (error) {
        console.warn(`Failed to analyze module ${filePath}:`, error);
      }
    }

    return modules;
  }

  /**
   * Find all JavaScript/TypeScript files in project
   */
  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    const scan = async (currentDir: string): Promise<void> => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common ignore patterns
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await scan(dir);
    return files;
  }

  /**
   * Analyze individual module
   */
  private async analyzeModule(filePath: string): Promise<ModuleInfo> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);

    const imports = this.extractImports(content, filePath);
    const exports = this.extractExports(content, filePath);
    const dependencies = imports.map(imp => imp.source);

    return {
      filePath,
      name: path.basename(filePath, path.extname(filePath)),
      type: this.determineModuleType(filePath),
      size: stats.size,
      exports,
      imports,
      dependencies,
      dependents: [], // Will be populated during graph building
      complexity: this.calculateModuleComplexity(content),
      coupling: {
        afferentCoupling: 0,
        efferentCoupling: dependencies.length,
        instability: 0,
        abstractness: 0,
        distance: 0
      }
    };
  }

  /**
   * Extract import statements from code
   */
  private extractImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // ES6 imports
      const importMatch = line.match(/import\s+(?:(\{[^}]+\})|([^,\s]+)(?:\s*,\s*\{[^}]+\})?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch && importMatch[3]) {
        const source = importMatch[3];
        const isExternal = !source.startsWith('.') && !source.startsWith('/');

        if (importMatch[1]) {
          // Named imports: import { a, b } from 'module'
          const namedImports = importMatch[1].replace(/[{}]/g, '').split(',');
          namedImports.forEach(name => {
            imports.push({
              name: name.trim(),
              source: this.resolveImportPath(source, filePath),
              type: 'named',
              line: lineNumber,
              usageCount: this.countUsage(content, name.trim()),
              isExternal
            });
          });
        } else if (importMatch[2]) {
          // Default import: import name from 'module'
          imports.push({
            name: importMatch[2],
            source: this.resolveImportPath(source, filePath),
            type: 'default',
            line: lineNumber,
            usageCount: this.countUsage(content, importMatch[2]),
            isExternal
          });
        }
      }

      // CommonJS requires
      const requireMatch = line.match(/(?:const|let|var)\s+(?:(\{[^}]+\})|([^=\s]+))\s*=\s*require\(['"]([^'"]+)['"]\)/);
      if (requireMatch && requireMatch[3]) {
        const source = requireMatch[3];
        const isExternal = !source.startsWith('.') && !source.startsWith('/');

        const name = requireMatch[1] || requireMatch[2] || 'unknown';
        imports.push({
          name: name,
          source: this.resolveImportPath(source, filePath),
          type: 'default',
          line: lineNumber,
          usageCount: this.countUsage(content, name),
          isExternal
        });
      }

      // Dynamic imports
      const dynamicImportMatch = line.match(/import\(['"]([^'"]+)['"]\)/);
      if (dynamicImportMatch && dynamicImportMatch[1]) {
        const source = dynamicImportMatch[1];
        imports.push({
          name: 'dynamic_import',
          source: this.resolveImportPath(source, filePath),
          type: 'dynamic',
          line: lineNumber,
          usageCount: 1,
          isExternal: !source.startsWith('.') && !source.startsWith('/')
        });
      }
    });

    return imports;
  }

  /**
   * Extract export statements from code
   */
  private extractExports(content: string, filePath: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Named exports: export { a, b }
      const namedExportMatch = line.match(/export\s+\{([^}]+)\}/);
      if (namedExportMatch && namedExportMatch[1]) {
        const names = namedExportMatch[1].split(',');
        names.forEach(name => {
          exports.push({
            name: name.trim(),
            type: 'variable',
            isDefault: false,
            line: lineNumber,
            usageCount: 0 // Will be calculated separately
          });
        });
      }

      // Default export
      const defaultExportMatch = line.match(/export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|(\w+))/);
      if (defaultExportMatch) {
        const name = defaultExportMatch[1] || defaultExportMatch[2] || defaultExportMatch[3] || 'default';
        exports.push({
          name,
          type: defaultExportMatch[1] ? 'function' : defaultExportMatch[2] ? 'class' : 'variable',
          isDefault: true,
          line: lineNumber,
          usageCount: 0
        });
      }

      // Function exports: export function name()
      const functionExportMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
      if (functionExportMatch && functionExportMatch[1]) {
        exports.push({
          name: functionExportMatch[1],
          type: 'function',
          isDefault: false,
          line: lineNumber,
          usageCount: 0
        });
      }

      // Class exports: export class Name
      const classExportMatch = line.match(/export\s+(?:abstract\s+)?class\s+(\w+)/);
      if (classExportMatch && classExportMatch[1]) {
        exports.push({
          name: classExportMatch[1],
          type: 'class',
          isDefault: false,
          line: lineNumber,
          usageCount: 0
        });
      }

      // Variable exports: export const/let/var
      const varExportMatch = line.match(/export\s+(?:const|let|var)\s+(\w+)/);
      if (varExportMatch && varExportMatch[1]) {
        exports.push({
          name: varExportMatch[1],
          type: 'variable',
          isDefault: false,
          line: lineNumber,
          usageCount: 0
        });
      }
    });

    return exports;
  }

  /**
   * Build dependency graph and calculate coupling metrics
   */
  private async buildDependencyGraph(modules: ModuleInfo[]): Promise<DependencyRelationship[]> {
    const dependencies: DependencyRelationship[] = [];

    // Build dependency relationships
    for (const module of modules) {
      for (const imp of module.imports) {
        if (!imp.isExternal) {
          const dependency: DependencyRelationship = {
            from: module.filePath,
            to: imp.source,
            type: imp.type === 'dynamic' ? 'require' : 'import',
            importedSymbols: [imp.name],
            isExternal: false
          };
          dependencies.push(dependency);

          // Update dependency graph
          if (!this.dependencyGraph.has(module.filePath)) {
            this.dependencyGraph.set(module.filePath, []);
          }
          this.dependencyGraph.get(module.filePath)!.push(imp.source);
        }
      }
    }

    // Calculate coupling metrics
    this.calculateCouplingMetrics(modules, dependencies);

    return dependencies;
  }

  /**
   * Calculate coupling metrics for all modules
   */
  private calculateCouplingMetrics(modules: ModuleInfo[], dependencies: DependencyRelationship[]): void {
    // Build reverse dependency map (dependents)
    const dependentsMap = new Map<string, string[]>();

    dependencies.forEach(dep => {
      if (!dependentsMap.has(dep.to)) {
        dependentsMap.set(dep.to, []);
      }
      dependentsMap.get(dep.to)!.push(dep.from);
    });

    // Update module metrics
    modules.forEach(module => {
      const dependents = dependentsMap.get(module.filePath) || [];
      module.dependents = dependents;

      const ca = dependents.length;  // Afferent coupling
      const ce = module.dependencies.length;  // Efferent coupling

      module.coupling = {
        afferentCoupling: ca,
        efferentCoupling: ce,
        instability: ca + ce > 0 ? ce / (ca + ce) : 0,
        abstractness: this.calculateAbstractness(module),
        distance: 0 // Will be calculated after abstractness
      };

      // Calculate distance from main sequence
      const instability = module.coupling.instability;
      const abstractness = module.coupling.abstractness;
      module.coupling.distance = Math.abs(abstractness + instability - 1);
    });
  }

  /**
   * Analyze dependency clusters
   */
  private analyzeDependencyClusters(dependencies: DependencyRelationship[]): DependencyCluster[] {
    const clusters: DependencyCluster[] = [];

    // Find circular dependencies
    const circularClusters = this.findCircularDependencies(dependencies);
    clusters.push(...circularClusters);

    // Find hub modules (high fan-in)
    const hubClusters = this.findHubModules(dependencies);
    clusters.push(...hubClusters);

    // Find fan-out modules (high fan-out)
    const fanOutClusters = this.findFanOutModules(dependencies);
    clusters.push(...fanOutClusters);

    return clusters;
  }

  /**
   * Detect architectural violations
   */
  private detectArchitecturalViolations(modules: ModuleInfo[], dependencies: DependencyRelationship[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];

    // Detect circular dependencies
    const circularViolations = this.detectCircularDependencies(dependencies);
    violations.push(...circularViolations);

    // Detect god modules (too many dependencies)
    const godModuleViolations = this.detectGodModules(modules);
    violations.push(...godModuleViolations);

    // Detect orphan modules (no dependents)
    const orphanViolations = this.detectOrphanModules(modules);
    violations.push(...orphanViolations);

    // Detect layer violations
    const layerViolations = this.detectLayerViolations(dependencies);
    violations.push(...layerViolations);

    return violations;
  }

  /**
   * Find cross-file dependency correlations
   */
  private findCrossFileDependencyCorrelations(issues: UnifiedIssue[], dependencies: DependencyRelationship[]): CrossFileDependencyCorrelation[] {
    const correlations: CrossFileDependencyCorrelation[] = [];

    // Group issues by file
    const issuesByFile = new Map<string, UnifiedIssue[]>();
    issues.forEach(issue => {
      const filePath = issue.entity.canonicalPath;
      if (!issuesByFile.has(filePath)) {
        issuesByFile.set(filePath, []);
      }
      issuesByFile.get(filePath)!.push(issue);
    });

    // Check each dependency relationship for correlated issues
    dependencies.forEach(dep => {
      const sourceIssues = issuesByFile.get(dep.from) || [];
      const targetIssues = issuesByFile.get(dep.to) || [];

      if (sourceIssues.length > 0 && targetIssues.length > 0) {
        const correlation = this.analyzeIssueCorrelation(sourceIssues, targetIssues, dep);
        if (correlation) {
          correlations.push(correlation);
        }
      }
    });

    return correlations;
  }

  // Helper methods...

  private determineModuleType(filePath: string): ModuleInfo['type'] {
    if (filePath.includes('node_modules')) return 'external';
    if (filePath.includes('src') || filePath.includes('lib')) return 'internal';
    return 'builtin';
  }

  private calculateModuleComplexity(content: string): number {
    // Simple complexity calculation based on control structures
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s*{/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /&&|\|\|/g
    ];

    let complexity = 1; // Base complexity
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private resolveImportPath(importPath: string, currentFile: string): string {
    if (importPath.startsWith('.')) {
      return path.resolve(path.dirname(currentFile), importPath);
    }
    return importPath;
  }

  private countUsage(content: string, name: string): number {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = content.match(regex);
    return matches ? matches.length - 1 : 0; // Subtract 1 for the declaration
  }

  private calculateAbstractness(module: ModuleInfo): number {
    if (module.exports.length === 0) return 0;

    const abstractElements = module.exports.filter(exp =>
      exp.type === 'interface' || exp.type === 'type' ||
      (exp.type === 'class' && exp.name.includes('Abstract'))
    ).length;

    return abstractElements / module.exports.length;
  }

  private findCircularDependencies(dependencies: DependencyRelationship[]): DependencyCluster[] {
    // Build adjacency list from dependencies
    const graph = new Map<string, Set<string>>();
    const allNodes = new Set<string>();

    for (const dep of dependencies) {
      if (!dep.isExternal) { // Only analyze internal dependencies
        allNodes.add(dep.from);
        allNodes.add(dep.to);

        if (!graph.has(dep.from)) {
          graph.set(dep.from, new Set());
        }
        graph.get(dep.from)!.add(dep.to);
      }
    }

    // Find strongly connected components using Tarjan's algorithm
    const cycles: DependencyCluster[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const indices = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    const stackArray: string[] = [];
    let index = 0;

    const strongConnect = (node: string) => {
      indices.set(node, index);
      lowLinks.set(node, index);
      index++;
      stackArray.push(node);
      stack.add(node);

      // Consider successors of node
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!indices.has(neighbor)) {
          // Successor has not yet been visited; recurse on it
          strongConnect(neighbor);
          lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(neighbor)!));
        } else if (stack.has(neighbor)) {
          // Successor is in stack and hence in current SCC
          lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(neighbor)!));
        }
      }

      // If node is a root node, pop the stack and generate an SCC
      if (lowLinks.get(node) === indices.get(node)) {
        const scc: string[] = [];
        let currentNode: string;
        do {
          currentNode = stackArray.pop()!;
          stack.delete(currentNode);
          scc.push(currentNode);
        } while (currentNode !== node);

        // Only add as cycle if it has more than one node or self-references
        const firstNode = scc[0];
        const hasSelfReference = firstNode && graph.get(firstNode)?.has(firstNode);
        if (scc.length > 1 || (scc.length === 1 && hasSelfReference)) {
          cycles.push({
            id: `circular-${cycles.length + 1}`,
            modules: scc,
            type: 'circular',
            strength: scc.length,
            issues: [], // Populated later when correlating with issues
            recommendations: [this.generateCircularDependencyRecommendation({ modules: scc } as DependencyCluster)]
          });
        }
      }
    };

    // Run Tarjan's algorithm on all unvisited nodes
    for (const node of allNodes) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return cycles;
  }

  private findHubModules(dependencies: DependencyRelationship[]): DependencyCluster[] {
    // Hub modules are modules that many other modules depend on (high in-degree)
    const incomingCounts = new Map<string, Set<string>>();
    const outgoingCounts = new Map<string, Set<string>>();

    // Count incoming and outgoing dependencies for each module
    for (const dep of dependencies) {
      if (!dep.isExternal) {
        // Track incoming dependencies (modules that depend on this one)
        if (!incomingCounts.has(dep.to)) {
          incomingCounts.set(dep.to, new Set());
        }
        incomingCounts.get(dep.to)!.add(dep.from);

        // Track outgoing dependencies (modules this one depends on)
        if (!outgoingCounts.has(dep.from)) {
          outgoingCounts.set(dep.from, new Set());
        }
        outgoingCounts.get(dep.from)!.add(dep.to);
      }
    }

    const hubs: DependencyCluster[] = [];
    const hubThreshold = Math.max(3, Math.ceil(incomingCounts.size * 0.1)); // At least 3 or 10% of modules

    for (const [module, dependents] of incomingCounts) {
      if (dependents.size >= hubThreshold) {
        const outgoing = outgoingCounts.get(module)?.size || 0;
        const centrality = dependents.size / (dependents.size + outgoing + 1); // Favor high in-degree

        hubs.push({
          id: `hub-${module}`,
          modules: [module],
          type: 'hub',
          strength: dependents.size,
          issues: [], // Will be populated during correlation
          metadata: {
            incomingCount: dependents.size,
            outgoingCount: outgoing,
            centrality: centrality,
            dependents: Array.from(dependents)
          },
          recommendations: [
            `Consider splitting ${module} to reduce coupling`,
            `Extract common interfaces to reduce direct dependencies`,
            `Monitor changes carefully as ${dependents.size} modules depend on this`
          ]
        });
      }
    }

    // Sort by strength (most connected first)
    return hubs.sort((a, b) => b.strength - a.strength);
  }

  private findFanOutModules(dependencies: DependencyRelationship[]): DependencyCluster[] {
    // Fan-out modules are modules that depend on many other modules (high out-degree)
    const outgoingCounts = new Map<string, Set<string>>();
    const incomingCounts = new Map<string, Set<string>>();

    // Count outgoing and incoming dependencies for each module
    for (const dep of dependencies) {
      if (!dep.isExternal) {
        // Track outgoing dependencies (modules this one depends on)
        if (!outgoingCounts.has(dep.from)) {
          outgoingCounts.set(dep.from, new Set());
        }
        outgoingCounts.get(dep.from)!.add(dep.to);

        // Track incoming dependencies (modules that depend on this one)
        if (!incomingCounts.has(dep.to)) {
          incomingCounts.set(dep.to, new Set());
        }
        incomingCounts.get(dep.to)!.add(dep.from);
      }
    }

    const fanOuts: DependencyCluster[] = [];
    const fanOutThreshold = Math.max(4, Math.ceil(outgoingCounts.size * 0.15)); // At least 4 or 15% of modules

    for (const [module, dependencies] of outgoingCounts) {
      if (dependencies.size >= fanOutThreshold) {
        const incoming = incomingCounts.get(module)?.size || 0;
        const coupling = dependencies.size / (dependencies.size + incoming + 1); // Favor high out-degree

        fanOuts.push({
          id: `fanout-${module}`,
          modules: [module],
          type: 'fan_out',
          strength: dependencies.size,
          issues: [], // Will be populated during correlation
          metadata: {
            outgoingCount: dependencies.size,
            incomingCount: incoming,
            coupling: coupling,
            dependencies: Array.from(dependencies)
          },
          recommendations: [
            `Consider dependency injection to reduce direct coupling in ${module}`,
            `Extract common dependencies into shared modules`,
            `Use interfaces to decouple from concrete implementations`,
            `Review if ${module} has too many responsibilities`
          ]
        });
      }
    }

    // Sort by strength (most dependencies first)
    return fanOuts.sort((a, b) => b.strength - a.strength);
  }

  private detectCircularDependencies(dependencies: DependencyRelationship[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];

    // Use the circular dependency finder we just implemented
    const cycles = this.findCircularDependencies(dependencies);

    for (const cycle of cycles) {
      violations.push({
        id: `circular-dep-${cycle.id}`,
        type: 'circular_dependency',
        severity: cycle.modules.length > 3 ? 'high' : 'medium',
        modules: cycle.modules,
        description: `Circular dependency involving ${cycle.modules.length} modules: ${cycle.modules.join(' → ')}`,
        impact: `Maintainability: ${(cycle.modules.length * 0.2 * 100).toFixed(0)}%, Testability: ${(cycle.modules.length * 0.15 * 100).toFixed(0)}%, Reliability: ${(cycle.modules.length * 0.1 * 100).toFixed(0)}%`,
        recommendations: cycle.recommendations,
        relatedIssues: [] // Populated later when correlating with issues
      });
    }

    return violations;
  }

  private detectGodModules(modules: ModuleInfo[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];
    const threshold = 20; // Modules with more than 20 dependencies

    modules.forEach(module => {
      if (module.dependencies.length > threshold) {
        violations.push({
          id: `god_module_${module.name}`,
          type: 'god_module',
          severity: 'high',
          modules: [module.filePath],
          description: `Module has too many dependencies (${module.dependencies.length})`,
          impact: 'High coupling makes the module difficult to maintain and test',
          recommendations: [
            'Split module into smaller, focused modules',
            'Apply Single Responsibility Principle',
            'Use dependency injection to reduce coupling'
          ],
          relatedIssues: []
        });
      }
    });

    return violations;
  }

  private detectOrphanModules(modules: ModuleInfo[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];

    modules.forEach(module => {
      if (module.dependents.length === 0 && !this.isEntryPoint(module.filePath)) {
        violations.push({
          id: `orphan_module_${module.name}`,
          type: 'orphan_module',
          severity: 'medium',
          modules: [module.filePath],
          description: 'Module is not used by any other module',
          impact: 'Dead code increases bundle size and maintenance overhead',
          recommendations: [
            'Remove unused module if truly dead code',
            'Ensure module is properly exported and imported',
            'Add to entry points if this is a standalone module'
          ],
          relatedIssues: []
        });
      }
    });

    return violations;
  }

  private detectLayerViolations(dependencies: DependencyRelationship[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];

    // Define common architectural layer patterns
    const layerPatterns = {
      'presentation': ['view', 'component', 'ui', 'frontend', 'client', 'page', 'screen'],
      'business': ['service', 'logic', 'domain', 'business', 'core', 'engine'],
      'data': ['data', 'repository', 'dao', 'model', 'entity', 'db', 'database', 'storage'],
      'infrastructure': ['config', 'util', 'helper', 'lib', 'framework', 'external', 'api']
    };

    // Classify modules by layer based on path patterns
    const moduleLayer = new Map<string, string>();
    for (const dep of dependencies) {
      [dep.from, dep.to].forEach(modulePath => {
        if (!moduleLayer.has(modulePath)) {
          const pathLower = modulePath.toLowerCase();
          let detectedLayer = 'unknown';

          for (const [layer, patterns] of Object.entries(layerPatterns)) {
            if (patterns.some(pattern => pathLower.includes(pattern))) {
              detectedLayer = layer;
              break;
            }
          }
          moduleLayer.set(modulePath, detectedLayer);
        }
      });
    }

    // Define allowed layer dependencies (lower layers can depend on higher layers)
    const layerHierarchy = ['infrastructure', 'data', 'business', 'presentation'];
    const layerIndex = new Map(layerHierarchy.map((layer, index) => [layer, index]));

    // Check for layer violations
    for (const dep of dependencies) {
      if (!dep.isExternal) {
        const fromLayer = moduleLayer.get(dep.from) || 'unknown';
        const toLayer = moduleLayer.get(dep.to) || 'unknown';

        if (fromLayer !== 'unknown' && toLayer !== 'unknown') {
          const fromIndex = layerIndex.get(fromLayer) ?? -1;
          const toIndex = layerIndex.get(toLayer) ?? -1;

          // Violation: higher layer depending on lower layer
          if (fromIndex > toIndex && fromIndex !== -1 && toIndex !== -1) {
            violations.push({
              id: `layer-violation-${violations.length + 1}`,
              type: 'layer_violation',
              severity: 'medium',
              modules: [dep.from, dep.to],
              description: `Layer violation: ${fromLayer} layer (${dep.from}) depends on ${toLayer} layer (${dep.to})`,
              impact: `Architecture: Breaks layered architecture principles, increases coupling, reduces maintainability`,
              recommendations: [
                `Move dependency from ${toLayer} to ${fromLayer} layer or higher`,
                `Use dependency inversion principle with interfaces`,
                `Consider extracting common functionality to infrastructure layer`,
                `Review if modules are correctly categorized by layer`
              ],
              relatedIssues: []
            });
          }
        }
      }
    }

    return violations;
  }

  private isEntryPoint(filePath: string): boolean {
    const entryPatterns = [
      'index.js', 'index.ts', 'main.js', 'main.ts',
      'app.js', 'app.ts', 'server.js', 'server.ts'
    ];
    const fileName = path.basename(filePath);
    return entryPatterns.includes(fileName);
  }

  private calculateDependencyMetrics(modules: ModuleInfo[], dependencies: DependencyRelationship[]): DependencyMetrics {
    const externalDependencies = dependencies.filter(dep => dep.isExternal).length;
    const averageCoupling = modules.reduce((sum, module) =>
      sum + module.coupling.afferentCoupling + module.coupling.efferentCoupling, 0) / modules.length;

    return {
      totalModules: modules.length,
      totalDependencies: dependencies.length,
      externalDependencies,
      circularDependencies: this.findCircularDependencies(dependencies).length,
      averageCoupling,
      maxDepth: this.calculateMaxDependencyDepth(dependencies),
      modularity: this.calculateModularity(modules),
      stability: this.calculateStability(modules)
    };
  }

  private calculateMaxDependencyDepth(dependencies: DependencyRelationship[]): number {
    // Build adjacency list for internal dependencies only
    const graph = new Map<string, Set<string>>();
    const allNodes = new Set<string>();

    for (const dep of dependencies) {
      if (!dep.isExternal) {
        allNodes.add(dep.from);
        allNodes.add(dep.to);

        if (!graph.has(dep.from)) {
          graph.set(dep.from, new Set());
        }
        graph.get(dep.from)!.add(dep.to);
      }
    }

    if (allNodes.size === 0) return 0;

    // Find maximum depth from any node using DFS
    let maxDepth = 0;

    const dfs = (node: string, visited: Set<string>, depth: number): number => {
      if (visited.has(node)) {
        // Circular dependency detected, return current depth
        return depth;
      }

      visited.add(node);
      let currentMaxDepth = depth;

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        const neighborDepth = dfs(neighbor, new Set(visited), depth + 1);
        currentMaxDepth = Math.max(currentMaxDepth, neighborDepth);
      }

      return currentMaxDepth;
    };

    // Try from each node to find the maximum possible depth
    for (const node of allNodes) {
      const depth = dfs(node, new Set(), 0);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private calculateModularity(modules: ModuleInfo[]): number {
    if (modules.length === 0) return 0;

    // Calculate Newman modularity Q
    // Q = (1/2m) * Σ[Aij - (ki*kj)/(2m)] * δ(ci, cj)
    // where m = total edges, Aij = adjacency matrix, ki = degree of node i, ci = community of node i

    // First, build the adjacency matrix from module dependencies
    const moduleMap = new Map<string, number>();
    modules.forEach((module, index) => {
      moduleMap.set(module.filePath, index);
    });

    const n = modules.length;
    const adjacency = Array(n).fill(0).map(() => Array(n).fill(0));
    let totalEdges = 0;

    // Build adjacency matrix
    for (let i = 0; i < n; i++) {
      const module = modules[i];
      if (module && module.dependencies) {
        for (const depPath of module.dependencies) {
          const targetIndex = moduleMap.get(depPath);
          if (targetIndex !== undefined && targetIndex !== i && adjacency[i]) {
            adjacency[i]![targetIndex] = 1;
            totalEdges++;
          }
        }
      }
    }

    if (totalEdges === 0) return 0;

    // Calculate node degrees
    const degrees = modules.map((_, i) =>
      (adjacency[i]?.reduce((sum, val) => sum + val, 0) || 0) +
      adjacency.reduce((sum, row) => sum + (row[i] || 0), 0)
    );

    // For modularity calculation, we need to define communities
    // Here we use a simple heuristic based on directory structure
    const communities = new Map<string, number>();
    let communityId = 0;

    for (const module of modules) {
      const dir = path.dirname(module.filePath);
      if (!communities.has(dir)) {
        communities.set(dir, communityId++);
      }
    }

    // Calculate modularity
    let modularity = 0;
    const m = totalEdges;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const moduleI = modules[i];
        const moduleJ = modules[j];
        if (!moduleI || !moduleJ) continue;

        const communityI = communities.get(path.dirname(moduleI.filePath)) || 0;
        const communityJ = communities.get(path.dirname(moduleJ.filePath)) || 0;

        if (communityI === communityJ) {
          const deltaFunction = 1;
          const expectedEdges = (degrees[i] * degrees[j]) / (2 * m);
          const adjacencyValue = adjacency[i]?.[j] || 0;
          modularity += (adjacencyValue - expectedEdges) * deltaFunction;
        }
      }
    }

    modularity = modularity / (2 * m);

    // Normalize to 0-1 range (modularity can be negative)
    return Math.max(0, Math.min(1, (modularity + 1) / 2));
  }

  private calculateStability(modules: ModuleInfo[]): number {
    const avgInstability = modules.reduce((sum, module) => sum + module.coupling.instability, 0) / modules.length;
    return 1 - avgInstability; // Stability is inverse of instability
  }

  private analyzeIssueCorrelation(sourceIssues: UnifiedIssue[], targetIssues: UnifiedIssue[], dependency: DependencyRelationship): CrossFileDependencyCorrelation | null {
    // Check for correlated issue types or patterns
    const correlatedIssues = [...sourceIssues, ...targetIssues];

    if (this.hasCorrelatedIssueTypes(sourceIssues, targetIssues)) {
      return {
        id: `dep_corr_${Date.now()}`,
        sourceFile: dependency.from,
        targetFile: dependency.to,
        issues: correlatedIssues,
        dependencyPath: [dependency.from, dependency.to],
        correlationType: 'direct_dependency',
        confidence: this.calculateCorrelationConfidence(sourceIssues, targetIssues),
        riskLevel: this.assessCorrelationRisk(sourceIssues, targetIssues),
        explanation: this.generateCorrelationExplanation(sourceIssues, targetIssues, dependency)
      };
    }

    return null;
  }

  private hasCorrelatedIssueTypes(issues1: UnifiedIssue[], issues2: UnifiedIssue[]): boolean {
    const types1 = new Set(issues1.map(issue => issue.ruleId));
    const types2 = new Set(issues2.map(issue => issue.ruleId));

    // Check for common issue types
    for (const type of types1) {
      if (types2.has(type)) {
        return true;
      }
    }

    return false;
  }

  private calculateCorrelationConfidence(issues1: UnifiedIssue[], issues2: UnifiedIssue[]): number {
    // Sophisticated confidence calculation based on multiple factors
    let confidence = 0.0;

    // Factor 1: Issue type similarity (40% weight)
    const types1 = new Set(issues1.map(issue => issue.analysisType));
    const types2 = new Set(issues2.map(issue => issue.analysisType));
    const typeIntersection = new Set([...types1].filter(type => types2.has(type)));
    const typeUnion = new Set([...types1, ...types2]);
    const typeSimilarity = typeUnion.size > 0 ? typeIntersection.size / typeUnion.size : 0;
    confidence += typeSimilarity * 0.4;

    // Factor 2: Severity correlation (25% weight)
    const severities1 = issues1.map(issue => issue.severity);
    const severities2 = issues2.map(issue => issue.severity);
    const severityMap = { 'info': 1, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };

    const avgSeverity1 = severities1.reduce((sum, sev) => sum + (severityMap[sev] || 1), 0) / severities1.length;
    const avgSeverity2 = severities2.reduce((sum, sev) => sum + (severityMap[sev] || 1), 0) / severities2.length;
    const severityDiff = Math.abs(avgSeverity1 - avgSeverity2);
    const severityConfidence = Math.max(0, 1 - (severityDiff / 3)); // Normalize to 0-1
    confidence += severityConfidence * 0.25;

    // Factor 3: Issue density correlation (20% weight)
    const density1 = issues1.length;
    const density2 = issues2.length;
    const maxDensity = Math.max(density1, density2);
    const minDensity = Math.min(density1, density2);
    const densityRatio = maxDensity > 0 ? minDensity / maxDensity : 1;
    confidence += densityRatio * 0.2;

    // Factor 4: Tool diversity (15% weight)
    const tools1 = new Set(issues1.map(issue => issue.toolName));
    const tools2 = new Set(issues2.map(issue => issue.toolName));
    const toolIntersection = new Set([...tools1].filter(tool => tools2.has(tool)));
    const toolDiversity = toolIntersection.size > 0 ? Math.min(1, toolIntersection.size / 2) : 0;
    confidence += toolDiversity * 0.15;

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  private assessCorrelationRisk(issues1: UnifiedIssue[], issues2: UnifiedIssue[]): 'low' | 'medium' | 'high' {
    const totalIssues = issues1.length + issues2.length;
    const criticalIssues = [...issues1, ...issues2].filter(issue => issue.severity === 'critical').length;

    if (criticalIssues > 0 || totalIssues > 10) return 'high';
    if (totalIssues > 5) return 'medium';
    return 'low';
  }

  private generateCorrelationExplanation(issues1: UnifiedIssue[], issues2: UnifiedIssue[], dependency: DependencyRelationship): string {
    return `Files ${dependency.from} and ${dependency.to} have correlated issues, potentially indicating a shared architectural problem or propagated defect through their dependency relationship.`;
  }

  private generateCircularDependencyRecommendation(cycle: DependencyCluster): string {
    if (cycle.modules.length === 2) {
      return `Break circular dependency between ${cycle.modules[0]} and ${cycle.modules[1]} by introducing an interface or extracting shared code to a separate module.`;
    } else if (cycle.modules.length <= 4) {
      return `Resolve circular dependency chain involving ${cycle.modules.length} modules by identifying the core responsibility and extracting it to a dedicated module that others can depend on.`;
    } else {
      return `Large circular dependency (${cycle.modules.length} modules) indicates architectural issues. Consider breaking into separate bounded contexts or applying the Dependency Inversion Principle.`;
    }
  }
}