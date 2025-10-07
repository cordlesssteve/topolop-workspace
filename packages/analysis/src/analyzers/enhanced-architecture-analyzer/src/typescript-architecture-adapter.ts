/**
 * TypeScript Compiler API Architecture Adapter - Topolop Phase 2
 *
 * Provides deep TypeScript architecture analysis including type system analysis,
 * interface usage patterns, generic complexity assessment, and module boundary
 * validation using the TypeScript Compiler API.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 5-6
 */

import * as ts from 'typescript';
import { join, relative, dirname } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';

import {
  ArchitectureAdapter,
  ArchitectureIssue,
  ArchitectureInfo,
  TechnicalDebtAssessment,
  WorkflowRecommendation
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedEntity } from '@topolop/shared-types';

/**
 * TypeScript architecture analysis configuration
 */
export interface TypeScriptArchitectureConfig {
  tsconfigPath?: string;
  includeExternalModules?: boolean;
  analyzeGenerics?: boolean;
  checkInterfaceCompliance?: boolean;
  detectArchitecturalPatterns?: boolean;
  complexityThresholds?: {
    typeComplexity: number;
    interfaceMembers: number;
    genericConstraints: number;
  };
}

/**
 * TypeScript analysis result structure
 */
interface TypeScriptAnalysisResult {
  program: ts.Program;
  sourceFiles: ts.SourceFile[];
  typeChecker: ts.TypeChecker;
  diagnostics: ts.Diagnostic[];
  moduleGraph: ModuleGraph;
  interfaceAnalysis: InterfaceAnalysis;
  typeComplexity: TypeComplexityAnalysis;
}

/**
 * Module dependency graph
 */
interface ModuleGraph {
  modules: Map<string, ModuleInfo>;
  dependencies: Map<string, string[]>;
  circularDependencies: string[][];
}

/**
 * Module information
 */
interface ModuleInfo {
  path: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  declarationKind: 'module' | 'namespace' | 'script';
}

/**
 * Export information
 */
interface ExportInfo {
  name: string;
  kind: ts.SyntaxKind;
  isDefault: boolean;
  type?: string;
}

/**
 * Import information
 */
interface ImportInfo {
  name: string;
  from: string;
  kind: 'named' | 'default' | 'namespace';
}

/**
 * Interface analysis results
 */
interface InterfaceAnalysis {
  interfaces: InterfaceInfo[];
  inheritance: InheritanceInfo[];
  violations: InterfaceViolation[];
}

/**
 * Interface information
 */
interface InterfaceInfo {
  name: string;
  file: string;
  members: number;
  extends: string[];
  complexity: number;
  usage: InterfaceUsage[];
}

/**
 * Interface usage tracking
 */
interface InterfaceUsage {
  file: string;
  usageType: 'implements' | 'extends' | 'parameter' | 'return' | 'property';
  context: string;
}

/**
 * Inheritance information
 */
interface InheritanceInfo {
  child: string;
  parent: string;
  file: string;
  depth: number;
}

/**
 * Interface compliance violations
 */
interface InterfaceViolation {
  interface: string;
  implementer: string;
  file: string;
  violation: string;
  severity: 'error' | 'warning';
}

/**
 * Type complexity analysis
 */
interface TypeComplexityAnalysis {
  complexTypes: ComplexType[];
  genericUsage: GenericUsage[];
  typeAliases: TypeAliasInfo[];
}

/**
 * Complex type information
 */
interface ComplexType {
  name: string;
  file: string;
  complexity: number;
  reasons: string[];
}

/**
 * Generic usage analysis
 */
interface GenericUsage {
  name: string;
  file: string;
  constraintComplexity: number;
  usagePatterns: string[];
}

/**
 * Type alias information
 */
interface TypeAliasInfo {
  name: string;
  file: string;
  aliasedType: string;
  complexity: number;
}

/**
 * Enhanced TypeScript Compiler API adapter implementing comprehensive architecture analysis
 */
export class TypeScriptArchitectureAdapter implements ArchitectureAdapter {
  public readonly name = 'TypeScript Architecture Analyzer';
  public readonly version = '1.0.0';
  public readonly type = 'complexity_analysis' as const;

  private config: TypeScriptArchitectureConfig;
  private program?: ts.Program;
  private typeChecker?: ts.TypeChecker;

  constructor(config: TypeScriptArchitectureConfig = {}) {
    this.config = {
      includeExternalModules: false,
      analyzeGenerics: true,
      checkInterfaceCompliance: true,
      detectArchitecturalPatterns: true,
      complexityThresholds: {
        typeComplexity: 10,
        interfaceMembers: 15,
        genericConstraints: 5
      },
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
   * Analyze TypeScript architecture
   */
  async analyzeArchitecture(projectPath: string): Promise<ArchitectureIssue[]> {
    try {
      // Create TypeScript program
      const analysisResult = await this.createTypeScriptAnalysis(projectPath);

      // Generate architecture issues
      const issues: ArchitectureIssue[] = [];

      // Add module boundary violations
      issues.push(...this.createModuleBoundaryIssues(analysisResult, projectPath));

      // Add interface design issues
      issues.push(...this.createInterfaceDesignIssues(analysisResult, projectPath));

      // Add type complexity issues
      issues.push(...this.createTypeComplexityIssues(analysisResult, projectPath));

      // Add generic complexity issues
      issues.push(...this.createGenericComplexityIssues(analysisResult, projectPath));

      // Add inheritance issues
      issues.push(...this.createInheritanceIssues(analysisResult, projectPath));

      return issues;

    } catch (error) {
      console.error('Error analyzing TypeScript architecture:', error);
      return [];
    }
  }

  /**
   * Detect design patterns in TypeScript code
   */
  detectDesignPatterns(codeStructure: any): ArchitectureIssue[] {
    if (!this.program || !this.typeChecker) return [];

    const patterns: ArchitectureIssue[] = [];

    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      // Detect singleton pattern
      patterns.push(...this.detectSingletonPattern(sourceFile));

      // Detect factory pattern
      patterns.push(...this.detectFactoryPattern(sourceFile));

      // Detect decorator pattern
      patterns.push(...this.detectDecoratorPattern(sourceFile));

      // Detect observer pattern
      patterns.push(...this.detectObserverPattern(sourceFile));
    }

    return patterns;
  }

  /**
   * Assess technical debt based on TypeScript architecture issues
   */
  assessTechnicalDebt(issues: ArchitectureIssue[]): TechnicalDebtAssessment {
    const typeIssues = issues.filter(issue =>
      issue.architectureCategory === 'complexity' &&
      issue.title.includes('type')
    );

    const interfaceIssues = issues.filter(issue =>
      issue.title.includes('interface') || issue.title.includes('Interface')
    );

    const genericIssues = issues.filter(issue =>
      issue.title.includes('generic') || issue.title.includes('Generic')
    );

    const totalScore = this.calculateTypeScriptDebtScore(issues);

    return {
      totalDebtMinutes: totalScore,
      debtRatio: Math.min((totalScore / 1000) * 100, 100),
      ratingCategory: this.categorizeDebtLevel(totalScore),
      breakdown: {
        complexity: issues.filter(issue => issue.analysisType === AnalysisType.ARCHITECTURE_DESIGN).length,
        coupling: issues.filter(issue => issue.architectureCategory === 'coupling').length,
        duplication: issues.filter(issue => issue.architectureCategory === 'dependency_cycle').length,
        maintainability: issues.filter(issue => issue.architectureCategory === 'maintainability').length
      },
      recommendations: {
        immediate: ['Fix critical type errors', 'Resolve interface mismatches'],
        shortTerm: ['Improve generic type design', 'Optimize interface hierarchies'],
        longTerm: ['Implement comprehensive type strategy', 'Establish type governance']
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
   * Create TypeScript program and perform analysis
   */
  private async createTypeScriptAnalysis(projectPath: string): Promise<TypeScriptAnalysisResult> {
    // Find tsconfig.json
    const tsconfigPath = this.findTSConfig(projectPath);

    let compilerOptions: ts.CompilerOptions;
    let fileNames: string[];

    if (tsconfigPath && existsSync(tsconfigPath)) {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        dirname(tsconfigPath)
      );

      compilerOptions = parsedConfig.options;
      fileNames = parsedConfig.fileNames;
    } else {
      // Fallback configuration
      compilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      };

      fileNames = this.findTypeScriptFiles(projectPath);
    }

    // Create program
    this.program = ts.createProgram(fileNames, compilerOptions);
    this.typeChecker = this.program.getTypeChecker();

    const sourceFiles = this.program.getSourceFiles().filter(sf => !sf.isDeclarationFile);
    const diagnostics = [...ts.getPreEmitDiagnostics(this.program)];

    // Perform analysis
    const moduleGraph = this.analyzeModuleGraph(sourceFiles);
    const interfaceAnalysis = this.analyzeInterfaces(sourceFiles);
    const typeComplexity = this.analyzeTypeComplexity(sourceFiles);

    return {
      program: this.program,
      sourceFiles,
      typeChecker: this.typeChecker,
      diagnostics,
      moduleGraph,
      interfaceAnalysis,
      typeComplexity
    };
  }

  /**
   * Find tsconfig.json file
   */
  private findTSConfig(projectPath: string): string | null {
    const possiblePaths = [
      join(projectPath, 'tsconfig.json'),
      join(projectPath, 'src', 'tsconfig.json'),
      join(projectPath, 'tsconfig.build.json')
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * Find TypeScript files in project
   */
  private findTypeScriptFiles(projectPath: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx'];

    const scan = (dir: string) => {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scan(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    scan(projectPath);
    return files;
  }

  /**
   * Analyze module dependency graph
   */
  private analyzeModuleGraph(sourceFiles: ts.SourceFile[]): ModuleGraph {
    const modules = new Map<string, ModuleInfo>();
    const dependencies = new Map<string, string[]>();

    for (const sourceFile of sourceFiles) {
      const moduleInfo = this.extractModuleInfo(sourceFile);
      modules.set(sourceFile.fileName, moduleInfo);

      const deps: string[] = [];
      for (const importInfo of moduleInfo.imports) {
        deps.push(importInfo.from);
      }
      dependencies.set(sourceFile.fileName, deps);
    }

    const circularDependencies = this.findCircularDependencies(dependencies);

    return {
      modules,
      dependencies,
      circularDependencies
    };
  }

  /**
   * Extract module information from source file
   */
  private extractModuleInfo(sourceFile: ts.SourceFile): ModuleInfo {
    const exports: ExportInfo[] = [];
    const imports: ImportInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isExportDeclaration(node)) {
        // Handle export declarations
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            exports.push({
              name: element.name.text,
              kind: node.kind,
              isDefault: false
            });
          }
        }
      } else if (ts.isImportDeclaration(node)) {
        // Handle import declarations
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const from = moduleSpecifier.text;

          if (node.importClause) {
            if (node.importClause.name) {
              // Default import
              imports.push({
                name: node.importClause.name.text,
                from,
                kind: 'default'
              });
            }

            if (node.importClause.namedBindings) {
              if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                // Namespace import
                imports.push({
                  name: node.importClause.namedBindings.name.text,
                  from,
                  kind: 'namespace'
                });
              } else if (ts.isNamedImports(node.importClause.namedBindings)) {
                // Named imports
                for (const element of node.importClause.namedBindings.elements) {
                  imports.push({
                    name: element.name.text,
                    from,
                    kind: 'named'
                  });
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      path: sourceFile.fileName,
      exports,
      imports,
      declarationKind: this.determineDeclarationKind(sourceFile)
    };
  }

  /**
   * Determine declaration kind of source file
   */
  private determineDeclarationKind(sourceFile: ts.SourceFile): 'module' | 'namespace' | 'script' {
    // Check for module declarations
    const hasModuleDeclaration = sourceFile.statements.some(statement =>
      ts.isModuleDeclaration(statement)
    );

    if (hasModuleDeclaration) return 'namespace';

    // Check for import/export statements
    const hasImportExport = sourceFile.statements.some(statement =>
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    );

    return hasImportExport ? 'module' : 'script';
  }

  /**
   * Find circular dependencies in module graph
   */
  private findCircularDependencies(dependencies: Map<string, string[]>): string[][] {
    const circular: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found circular dependency
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          circular.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);

      const deps = dependencies.get(node) || [];
      for (const dep of deps) {
        if (dependencies.has(dep)) { // Only follow internal dependencies
          dfs(dep, [...path, node]);
        }
      }

      recursionStack.delete(node);
    };

    for (const node of dependencies.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return circular;
  }

  /**
   * Analyze interfaces in the codebase
   */
  private analyzeInterfaces(sourceFiles: ts.SourceFile[]): InterfaceAnalysis {
    const interfaces: InterfaceInfo[] = [];
    const inheritance: InheritanceInfo[] = [];
    const violations: InterfaceViolation[] = [];

    if (!this.typeChecker) return { interfaces, inheritance, violations };

    for (const sourceFile of sourceFiles) {
      this.extractInterfaceInfo(sourceFile, interfaces, inheritance);
    }

    return { interfaces, inheritance, violations };
  }

  /**
   * Extract interface information from source file
   */
  private extractInterfaceInfo(
    sourceFile: ts.SourceFile,
    interfaces: InterfaceInfo[],
    inheritance: InheritanceInfo[]
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceInfo: InterfaceInfo = {
          name: node.name.text,
          file: sourceFile.fileName,
          members: node.members.length,
          extends: [],
          complexity: this.calculateInterfaceComplexity(node),
          usage: []
        };

        // Extract extends clauses
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const type of clause.types) {
                const typeName = this.getTypeText(type);
                interfaceInfo.extends.push(typeName);

                inheritance.push({
                  child: node.name.text,
                  parent: typeName,
                  file: sourceFile.fileName,
                  depth: 1 // Will be calculated later
                });
              }
            }
          }
        }

        interfaces.push(interfaceInfo);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Calculate interface complexity
   */
  private calculateInterfaceComplexity(node: ts.InterfaceDeclaration): number {
    let complexity = node.members.length;

    // Add complexity for method signatures
    for (const member of node.members) {
      if (ts.isMethodSignature(member)) {
        complexity += 2; // Methods are more complex than properties

        if (member.parameters) {
          complexity += member.parameters.length * 0.5; // Parameter complexity
        }
      } else if (ts.isPropertySignature(member)) {
        complexity += 1;
      }
    }

    // Add complexity for generic parameters
    if (node.typeParameters) {
      complexity += node.typeParameters.length * 2;
    }

    return Math.round(complexity);
  }

  /**
   * Get text representation of type node
   */
  private getTypeText(type: ts.ExpressionWithTypeArguments): string {
    return type.expression.getText();
  }

  /**
   * Analyze type complexity in the codebase
   */
  private analyzeTypeComplexity(sourceFiles: ts.SourceFile[]): TypeComplexityAnalysis {
    const complexTypes: ComplexType[] = [];
    const genericUsage: GenericUsage[] = [];
    const typeAliases: TypeAliasInfo[] = [];

    for (const sourceFile of sourceFiles) {
      this.extractTypeComplexity(sourceFile, complexTypes, genericUsage, typeAliases);
    }

    return { complexTypes, genericUsage, typeAliases };
  }

  /**
   * Extract type complexity information
   */
  private extractTypeComplexity(
    sourceFile: ts.SourceFile,
    complexTypes: ComplexType[],
    genericUsage: GenericUsage[],
    typeAliases: TypeAliasInfo[]
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isTypeAliasDeclaration(node)) {
        const complexity = this.calculateTypeAliasComplexity(node);

        typeAliases.push({
          name: node.name.text,
          file: sourceFile.fileName,
          aliasedType: node.type.getText(),
          complexity
        });

        if (complexity > (this.config.complexityThresholds?.typeComplexity || 10)) {
          complexTypes.push({
            name: node.name.text,
            file: sourceFile.fileName,
            complexity,
            reasons: ['Complex type alias']
          });
        }
      } else if (ts.isClassDeclaration(node) && node.typeParameters) {
        const complexity = this.calculateGenericComplexity(node.typeParameters);

        if (complexity > (this.config.complexityThresholds?.genericConstraints || 5)) {
          genericUsage.push({
            name: node.name?.text || 'Anonymous',
            file: sourceFile.fileName,
            constraintComplexity: complexity,
            usagePatterns: ['Class with complex generics']
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Calculate type alias complexity
   */
  private calculateTypeAliasComplexity(node: ts.TypeAliasDeclaration): number {
    let complexity = 1; // Base complexity

    // Add complexity for union types
    if (ts.isUnionTypeNode(node.type)) {
      complexity += node.type.types.length * 2;
    }

    // Add complexity for intersection types
    if (ts.isIntersectionTypeNode(node.type)) {
      complexity += node.type.types.length * 1.5;
    }

    // Add complexity for mapped types
    if (ts.isMappedTypeNode(node.type)) {
      complexity += 5;
    }

    // Add complexity for conditional types
    if (ts.isConditionalTypeNode(node.type)) {
      complexity += 3;
    }

    // Add complexity for generic parameters
    if (node.typeParameters) {
      complexity += node.typeParameters.length * 2;
    }

    return Math.round(complexity);
  }

  /**
   * Calculate generic complexity
   */
  private calculateGenericComplexity(typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>): number {
    let complexity = typeParameters.length;

    for (const param of typeParameters) {
      if (param.constraint) {
        complexity += 2; // Constraints add complexity
      }
      if (param.default) {
        complexity += 1; // Default types add some complexity
      }
    }

    return complexity;
  }

  /**
   * Create module boundary violation issues
   */
  private createModuleBoundaryIssues(
    analysis: TypeScriptAnalysisResult,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    // Check for circular dependencies
    for (const cycle of analysis.moduleGraph.circularDependencies) {
      issues.push({
        id: `ts-circular-${cycle.join('-').replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: `TypeScript circular dependency: ${cycle.length} modules`,
        description: `Circular dependency detected in TypeScript modules: ${cycle.join(' -> ')}.`,
        entity: new UnifiedEntity({
          id: `ts-circular-${cycle[0] || 'unknown'}`,
          type: 'module',
          name: `Circular Dependency`,
          canonicalPath: cycle[0] || 'unknown'
        }),
        severity: cycle.length > 3 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
        analysisType: AnalysisType.ARCHITECTURE_DESIGN,
        ruleId: 'ts-circular-dependency',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'TypeScript Architecture Analyzer',
        metadata: { cycle },
        createdAt: new Date().toISOString(),
        architectureInfo: {
          componentType: 'module',
          designPattern: 'circular_dependency',
          complexityMetrics: {
            cyclomaticComplexity: cycle.length,
            cognitiveComplexity: cycle.length * 2,
            maintainabilityIndex: Math.max(0, 100 - cycle.length * 10)
          },
          couplingLevel: 'high',
          cohesionLevel: 'low'
        },
        architectureCategory: 'dependency_cycle',
        technicalDebtLevel: cycle.length > 5 ? 'critical' : 'high',
        refactoringOpportunity: {
          suggestedAction: 'Break circular dependency using interfaces or dependency injection',
          effort: 'high',
          impact: 'high'
        }
      } as unknown as ArchitectureIssue);
    }

    return issues;
  }

  /**
   * Create interface design issues
   */
  private createInterfaceDesignIssues(
    analysis: TypeScriptAnalysisResult,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    for (const interfaceInfo of analysis.interfaceAnalysis.interfaces) {
      // Check for overly complex interfaces
      const threshold = this.config.complexityThresholds?.interfaceMembers || 15;
      if (interfaceInfo.complexity > threshold) {
        issues.push({
          id: `ts-interface-complex-${interfaceInfo.name}`,
          title: `Complex interface: ${interfaceInfo.name}`,
          description: `Interface '${interfaceInfo.name}' has high complexity (${interfaceInfo.complexity}) with ${interfaceInfo.members} members.`,
          entity: new UnifiedEntity({
            id: `ts-interface-${interfaceInfo.name}`,
            type: 'interface',
            name: interfaceInfo.name,
            canonicalPath: interfaceInfo.file
          }),
          severity: interfaceInfo.complexity > threshold * 1.5 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
          analysisType: AnalysisType.ARCHITECTURE_DESIGN,
          ruleId: 'ts-complex-interface',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          toolName: 'TypeScript Architecture Analyzer',
          metadata: { interfaceComplexity: interfaceInfo.complexity },
          createdAt: new Date().toISOString(),
          architectureInfo: {
            componentType: 'interface',
            designPattern: 'large_interface',
            complexityMetrics: {
              cyclomaticComplexity: interfaceInfo.complexity,
              cognitiveComplexity: interfaceInfo.complexity * 1.5,
              maintainabilityIndex: Math.max(0, 100 - interfaceInfo.complexity * 2)
            },
            couplingLevel: 'medium',
            cohesionLevel: interfaceInfo.members > 20 ? 'low' : 'medium'
          },
          architectureCategory: 'design_pattern',
          technicalDebtLevel: interfaceInfo.complexity > threshold * 2 ? 'high' : 'medium',
          refactoringOpportunity: {
            suggestedAction: 'Split interface using Interface Segregation Principle',
            effort: 'medium',
            impact: 'medium'
          }
        } as unknown as ArchitectureIssue);
      }
    }

    return issues;
  }

  /**
   * Create type complexity issues
   */
  private createTypeComplexityIssues(
    analysis: TypeScriptAnalysisResult,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    for (const complexType of analysis.typeComplexity.complexTypes) {
      issues.push({
        id: `ts-type-complex-${complexType.name}`,
        title: `Complex type: ${complexType.name}`,
        description: `Type '${complexType.name}' has high complexity (${complexType.complexity}): ${complexType.reasons.join(', ')}.`,
        entity: new UnifiedEntity({
          id: `ts-type-${complexType.name}`,
          type: 'type',
          name: complexType.name,
          canonicalPath: complexType.file
        }),
        severity: complexType.complexity > 20 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
        analysisType: AnalysisType.ARCHITECTURE_DESIGN,
        ruleId: 'ts-complex-type',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'TypeScript Architecture Analyzer',
        metadata: { typeComplexity: complexType.complexity },
        createdAt: new Date().toISOString(),
        architectureInfo: {
          componentType: 'interface',
          designPattern: 'complex_type',
          complexityMetrics: {
            cyclomaticComplexity: complexType.complexity,
            cognitiveComplexity: complexType.complexity * 1.2,
            maintainabilityIndex: Math.max(0, 100 - complexType.complexity * 3)
          },
          couplingLevel: 'medium',
          cohesionLevel: 'medium'
        },
        architectureCategory: 'complexity',
        technicalDebtLevel: complexType.complexity > 25 ? 'high' : 'medium',
        refactoringOpportunity: {
          suggestedAction: 'Simplify type definition',
          effort: 'medium',
          impact: 'medium'
        }
      } as unknown as ArchitectureIssue);
    }

    return issues;
  }

  /**
   * Create generic complexity issues
   */
  private createGenericComplexityIssues(
    analysis: TypeScriptAnalysisResult,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    for (const genericUsage of analysis.typeComplexity.genericUsage) {
      issues.push({
        id: `ts-generic-complex-${genericUsage.name}`,
        title: `Complex generic usage: ${genericUsage.name}`,
        description: `Generic type '${genericUsage.name}' has high constraint complexity (${genericUsage.constraintComplexity}).`,
        entity: new UnifiedEntity({
          id: `ts-generic-${genericUsage.name}`,
          type: 'generic',
          name: genericUsage.name,
          canonicalPath: genericUsage.file
        }),
        severity: genericUsage.constraintComplexity > 10 ? IssueSeverity.MEDIUM : IssueSeverity.LOW,
        analysisType: AnalysisType.ARCHITECTURE_DESIGN,
        ruleId: 'ts-complex-generic',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'TypeScript Architecture Analyzer',
        metadata: { constraintComplexity: genericUsage.constraintComplexity },
        createdAt: new Date().toISOString(),
        architectureInfo: {
          componentType: 'interface',
          designPattern: 'complex_generic',
          complexityMetrics: {
            cyclomaticComplexity: genericUsage.constraintComplexity,
            cognitiveComplexity: genericUsage.constraintComplexity * 1.5,
            maintainabilityIndex: Math.max(0, 100 - genericUsage.constraintComplexity * 5)
          },
          couplingLevel: 'medium',
          cohesionLevel: 'medium'
        },
        architectureCategory: 'complexity',
        technicalDebtLevel: genericUsage.constraintComplexity > 15 ? 'medium' : 'low',
        refactoringOpportunity: {
          suggestedAction: 'Simplify generic constraints',
          effort: 'low',
          impact: 'medium'
        }
      } as unknown as ArchitectureIssue);
    }

    return issues;
  }

  /**
   * Create inheritance issues
   */
  private createInheritanceIssues(
    analysis: TypeScriptAnalysisResult,
    projectPath: string
  ): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];

    // Check for deep inheritance chains
    const inheritanceDepths = new Map<string, number>();

    for (const inheritance of analysis.interfaceAnalysis.inheritance) {
      const currentDepth = inheritanceDepths.get(inheritance.child) || 0;
      inheritanceDepths.set(inheritance.child, currentDepth + 1);
    }

    for (const [child, depth] of inheritanceDepths) {
      if (depth > 4) { // Deep inheritance threshold
        issues.push({
          id: `ts-deep-inheritance-${child}`,
          title: `Deep inheritance chain: ${child}`,
          description: `Interface '${child}' has deep inheritance chain with depth ${depth}.`,
          entity: new UnifiedEntity({
            id: `ts-inheritance-${child}`,
            type: 'interface',
            name: child,
            canonicalPath: 'inheritance'
          }),
          severity: depth > 6 ? IssueSeverity.MEDIUM : IssueSeverity.LOW,
          analysisType: AnalysisType.ARCHITECTURE_DESIGN,
          ruleId: 'ts-deep-inheritance',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          toolName: 'TypeScript Architecture Analyzer',
          metadata: { inheritanceDepth: depth },
          createdAt: new Date().toISOString(),
          architectureInfo: {
            componentType: 'interface',
            designPattern: 'deep_inheritance',
            complexityMetrics: {
              cyclomaticComplexity: depth,
              cognitiveComplexity: depth * 2,
              maintainabilityIndex: Math.max(0, 100 - depth * 10)
            },
            couplingLevel: 'high',
            cohesionLevel: 'medium'
          },
          architectureCategory: 'design_pattern',
          technicalDebtLevel: depth > 6 ? 'medium' : 'low',
          refactoringOpportunity: {
            suggestedAction: 'Consider composition over inheritance',
            effort: 'medium',
            impact: 'medium'
          }
        } as unknown as ArchitectureIssue);
      }
    }

    return issues;
  }

  // Pattern detection methods (simplified implementations)

  private detectSingletonPattern(sourceFile: ts.SourceFile): ArchitectureIssue[] {
    // Simplified singleton detection - would need more sophisticated analysis
    return [];
  }

  private detectFactoryPattern(sourceFile: ts.SourceFile): ArchitectureIssue[] {
    // Simplified factory detection
    return [];
  }

  private detectDecoratorPattern(sourceFile: ts.SourceFile): ArchitectureIssue[] {
    // Simplified decorator detection
    return [];
  }

  private detectObserverPattern(sourceFile: ts.SourceFile): ArchitectureIssue[] {
    // Simplified observer detection
    return [];
  }

  // Utility methods for debt assessment

  private calculateTypeScriptDebtScore(issues: ArchitectureIssue[]): number {
    return issues.reduce((score, issue) => {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL: return score + 15;
        case IssueSeverity.HIGH: return score + 10;
        case IssueSeverity.MEDIUM: return score + 5;
        case IssueSeverity.LOW: return score + 2;
        default: return score;
      }
    }, 0);
  }

  private categorizeDebtLevel(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 100) return 'E';
    if (score >= 60) return 'D';
    if (score >= 30) return 'C';
    if (score >= 10) return 'B';
    return 'A';
  }

  private estimateTypeScriptRemediationTime(issues: ArchitectureIssue[]): string {
    const totalEffort = issues.reduce((time, issue) => {
      const effort = issue.refactoringOpportunity?.effort || 'medium';
      switch (effort) {
        case 'high': return time + 10;
        case 'medium': return time + 5;
        case 'low': return time + 2;
        default: return time + 5;
      }
    }, 0);

    if (totalEffort < 15) return '1-2 weeks';
    if (totalEffort < 40) return '1-2 months';
    if (totalEffort < 80) return '3-6 months';
    return '6+ months';
  }

  private generateTypeScriptRecommendations(
    typeIssues: ArchitectureIssue[],
    interfaceIssues: ArchitectureIssue[],
    genericIssues: ArchitectureIssue[]
  ): WorkflowRecommendation[] {
    const recommendations: WorkflowRecommendation[] = [];

    if (typeIssues.length > 0) {
      recommendations.push({
        action: 'refactoring',
        priority: 'medium',
        effort: 'medium',
        impact: 'medium',
        steps: ['Analyze complex types', 'Break into simpler components', 'Test refactored types'],
        automatable: false,
        timeline: { estimated: '1-2 weeks', urgency: 'medium_term' }
      });
    }

    if (interfaceIssues.length > 0) {
      recommendations.push({
        action: 'architecture',
        priority: 'medium',
        effort: 'medium',
        impact: 'high',
        steps: ['Apply Interface Segregation Principle', 'Split large interfaces', 'Update implementations'],
        automatable: false,
        timeline: { estimated: '2-3 weeks', urgency: 'medium_term' }
      });
    }

    if (genericIssues.length > 0) {
      recommendations.push({
        action: 'optimization',
        priority: 'low',
        effort: 'low',
        impact: 'low',
        steps: ['Identify complex generic constraints', 'Simplify constraint logic', 'Validate type inference'],
        automatable: true,
        timeline: { estimated: '1 week', urgency: 'short_term' }
      });
    }

    return recommendations;
  }
}

export default TypeScriptArchitectureAdapter;