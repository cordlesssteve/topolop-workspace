/**
 * ESLint Architectural Rules Adapter - Topolop Phase 2
 *
 * Provides architectural analysis through custom ESLint rules including design pattern
 * enforcement, layered architecture validation, and import/export pattern analysis.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 5-6
 */

import { ESLint } from 'eslint';
import { join, relative, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';

import {
  ArchitectureAdapter,
  ArchitectureIssue,
  ArchitectureInfo,
  TechnicalDebtAssessment,
  WorkflowRecommendation
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedEntity, UnifiedIssue } from '@topolop/shared-types';

/**
 * ESLint architecture analysis configuration
 */
export interface ESLintArchitectureConfig {
  eslintConfigPath?: string;
  architecturalRules?: ArchitecturalRule[];
  layerDefinitions?: LayerDefinition[];
  importPatterns?: ImportPattern[];
  customRules?: CustomRule[];
  ignorePatterns?: string[];
}

/**
 * Architectural rule definition
 */
interface ArchitecturalRule {
  name: string;
  pattern: string;
  violation: string;
  severity: 'error' | 'warn' | 'info';
  category: 'layering' | 'coupling' | 'naming' | 'imports' | 'exports';
}

/**
 * Layer definition for layered architecture validation
 */
interface LayerDefinition {
  name: string;
  pattern: string;
  allowedDependencies: string[];
  description: string;
}

/**
 * Import pattern validation
 */
interface ImportPattern {
  from: string;
  to: string;
  allowed: boolean;
  reason: string;
}

/**
 * Custom ESLint rule configuration
 */
interface CustomRule {
  name: string;
  meta: {
    type: 'problem' | 'suggestion' | 'layout';
    docs: {
      description: string;
      category: string;
    };
    schema: any[];
  };
  create: (context: any) => any;
}

/**
 * ESLint analysis result
 */
interface ESLintArchitectureResult {
  results: ESLint.LintResult[];
  architecturalViolations: ArchitecturalViolation[];
  layerViolations: LayerViolation[];
  importViolations: ImportViolation[];
  patternViolations: PatternViolation[];
}

/**
 * Architectural violation
 */
interface ArchitecturalViolation {
  rule: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
}

/**
 * Layer violation
 */
interface LayerViolation {
  fromLayer: string;
  toLayer: string;
  file: string;
  import: string;
  reason: string;
}

/**
 * Import violation
 */
interface ImportViolation {
  file: string;
  import: string;
  pattern: string;
  violation: string;
}

/**
 * Pattern violation
 */
interface PatternViolation {
  pattern: string;
  file: string;
  violation: string;
  suggestion: string;
}

/**
 * Enhanced ESLint adapter implementing architectural analysis
 */
export class ESLintArchitectureAdapter implements ArchitectureAdapter {
  public readonly name = 'ESLint Architecture Analyzer';
  public readonly version = '1.0.0';
  public readonly type = 'pattern_detection' as const;

  private config: ESLintArchitectureConfig;
  private eslint?: ESLint;

  constructor(config: ESLintArchitectureConfig = {}) {
    this.config = {
      architecturalRules: this.getDefaultArchitecturalRules(),
      layerDefinitions: this.getDefaultLayerDefinitions(),
      importPatterns: this.getDefaultImportPatterns(),
      customRules: [],
      ignorePatterns: ['node_modules/**', 'dist/**', 'build/**'],
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
   * Analyze architecture using ESLint rules
   */
  async analyzeArchitecture(projectPath: string): Promise<ArchitectureIssue[]> {
    try {
      // Initialize ESLint with architectural configuration
      await this.initializeESLint(projectPath);

      // Run ESLint analysis
      const analysisResult = await this.runESLintAnalysis(projectPath);

      // Generate architecture issues
      const issues: ArchitectureIssue[] = [];

      // Add architectural violations
      issues.push(...this.createArchitecturalViolationIssues(analysisResult.architecturalViolations, projectPath));

      // Add layer violations
      issues.push(...this.createLayerViolationIssues(analysisResult.layerViolations, projectPath));

      // Add import violations
      issues.push(...this.createImportViolationIssues(analysisResult.importViolations, projectPath));

      // Add pattern violations
      issues.push(...this.createPatternViolationIssues(analysisResult.patternViolations, projectPath));

      return issues;

    } catch (error) {
      console.error('Error analyzing architecture with ESLint:', error);
      return [];
    }
  }

  /**
   * Detect design patterns in code structure
   */
  detectDesignPatterns(codeStructure: any): ArchitectureIssue[] {
    // This would integrate with the ESLint analysis to detect patterns
    return [];
  }

  /**
   * Assess technical debt based on ESLint architectural issues
   */
  assessTechnicalDebt(issues: ArchitectureIssue[]): TechnicalDebtAssessment {
    const layerIssues = issues.filter(issue => issue.architectureCategory === 'coupling');
    const importIssues = issues.filter(issue => issue.title.includes('import') || issue.title.includes('Import'));
    const patternIssues = issues.filter(issue => issue.architectureCategory === 'design_pattern');

    const totalScore = this.calculateESLintDebtScore(issues);

    return {
      totalDebtMinutes: totalScore,
      debtRatio: Math.min((totalScore / 1000) * 100, 100),
      ratingCategory: this.categorizeDebtLevel(totalScore),
      breakdown: {
        complexity: issues.filter(issue => issue.architectureCategory === 'complexity').length,
        coupling: issues.filter(issue => issue.architectureCategory === 'coupling').length,
        duplication: patternIssues.length,
        maintainability: issues.length - layerIssues.length - importIssues.length - patternIssues.length
      },
      recommendations: {
        immediate: ['Fix critical layer violations', 'Resolve circular imports'],
        shortTerm: ['Refactor high-coupling modules', 'Implement design patterns'],
        longTerm: ['Establish architectural guidelines', 'Implement automated checks']
      }
    };
  }

  // Capabilities
  capabilities = {
    circularDependencyDetection: false,
    complexityAnalysis: true,
    patternRecognition: true,
    refactoringGuidance: true
  };

  /**
   * Initialize ESLint with architectural configuration
   */
  private async initializeESLint(projectPath: string): Promise<void> {
    const eslintConfig = await this.createESLintConfig(projectPath);

    this.eslint = new ESLint({
      baseConfig: eslintConfig,
      ignore: true
    });
  }

  /**
   * Create ESLint configuration with architectural rules
   */
  private async createESLintConfig(projectPath: string): Promise<any> {
    const baseConfig: any = {
      env: {
        es2021: true,
        node: true,
        browser: true
      },
      extends: [
        'eslint:recommended'
      ],
      parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
      },
      rules: {}
    };

    // Check if TypeScript project
    const hasTypeScript = existsSync(join(projectPath, 'tsconfig.json'));
    if (hasTypeScript) {
      baseConfig.parser = '@typescript-eslint/parser';
      baseConfig.extends.push('@typescript-eslint/recommended');
      baseConfig.plugins = ['@typescript-eslint'];
    }

    // Add architectural rules
    this.addArchitecturalRules(baseConfig);

    // Load existing ESLint config if specified
    if (this.config.eslintConfigPath && existsSync(this.config.eslintConfigPath)) {
      const existingConfig = JSON.parse(readFileSync(this.config.eslintConfigPath, 'utf8'));
      return { ...existingConfig, ...baseConfig };
    }

    return baseConfig;
  }

  /**
   * Add architectural rules to ESLint configuration
   */
  private addArchitecturalRules(config: any): void {
    // Import/export pattern rules
    config.rules['no-restricted-imports'] = ['error', {
      patterns: this.getRestrictedImportPatterns()
    }];

    // File naming conventions
    config.rules['filename-rules'] = ['error', {
      pattern: /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.(js|ts|jsx|tsx)$/
    }];

    // Architecture-specific rules
    for (const rule of this.config.architecturalRules || []) {
      config.rules[rule.name] = [rule.severity, {
        pattern: rule.pattern,
        message: rule.violation
      }];
    }
  }

  /**
   * Get restricted import patterns for layered architecture
   */
  private getRestrictedImportPatterns(): string[] {
    const patterns: string[] = [];

    for (const pattern of this.config.importPatterns || []) {
      if (!pattern.allowed) {
        patterns.push(pattern.from);
      }
    }

    return patterns;
  }

  /**
   * Run ESLint analysis and process results
   */
  private async runESLintAnalysis(projectPath: string): Promise<ESLintArchitectureResult> {
    if (!this.eslint) throw new Error('ESLint not initialized');

    // Get files to lint
    const filesToLint = await this.eslint.lintFiles([join(projectPath, '**/*.{js,ts,jsx,tsx}')]);

    // Process results
    const architecturalViolations = this.extractArchitecturalViolations(filesToLint);
    const layerViolations = this.extractLayerViolations(filesToLint, projectPath);
    const importViolations = this.extractImportViolations(filesToLint);
    const patternViolations = this.extractPatternViolations(filesToLint);

    return {
      results: filesToLint,
      architecturalViolations,
      layerViolations,
      importViolations,
      patternViolations
    };
  }

  /**
   * Extract architectural violations from ESLint results
   */
  private extractArchitecturalViolations(results: ESLint.LintResult[]): ArchitecturalViolation[] {
    const violations: ArchitecturalViolation[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        if (this.isArchitecturalRule(message.ruleId)) {
          violations.push({
            rule: message.ruleId || 'unknown',
            file: result.filePath,
            line: message.line,
            column: message.column,
            message: message.message,
            severity: this.eslintSeverityToString(message.severity),
            category: this.getArchitecturalCategory(message.ruleId)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Extract layer violations
   */
  private extractLayerViolations(results: ESLint.LintResult[], projectPath: string): LayerViolation[] {
    const violations: LayerViolation[] = [];

    for (const result of results) {
      const fileLayer = this.determineFileLayer(result.filePath, projectPath);

      for (const message of result.messages) {
        if (message.ruleId === 'no-restricted-imports') {
          const importPath = this.extractImportPath(message.message);
          const importLayer = this.determineImportLayer(importPath, projectPath);

          if (fileLayer && importLayer && !this.isLayerDependencyAllowed(fileLayer, importLayer)) {
            violations.push({
              fromLayer: fileLayer.name,
              toLayer: importLayer.name,
              file: result.filePath,
              import: importPath,
              reason: `Layer '${fileLayer.name}' should not depend on '${importLayer.name}'`
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Extract import violations
   */
  private extractImportViolations(results: ESLint.LintResult[]): ImportViolation[] {
    const violations: ImportViolation[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        if (message.ruleId === 'no-restricted-imports') {
          const importPath = this.extractImportPath(message.message);
          const violatedPattern = this.findViolatedImportPattern(importPath);

          if (violatedPattern) {
            violations.push({
              file: result.filePath,
              import: importPath,
              pattern: violatedPattern.from,
              violation: violatedPattern.reason
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Extract pattern violations
   */
  private extractPatternViolations(results: ESLint.LintResult[]): PatternViolation[] {
    const violations: PatternViolation[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        if (message.ruleId === 'filename-rules' || this.isPatternRule(message.ruleId)) {
          violations.push({
            pattern: message.ruleId || 'unknown',
            file: result.filePath,
            violation: message.message,
            suggestion: this.generatePatternSuggestion(message.ruleId, message.message)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Determine file layer based on path
   */
  private determineFileLayer(filePath: string, projectPath: string): LayerDefinition | null {
    const relativePath = relative(projectPath, filePath);

    for (const layer of this.config.layerDefinitions || []) {
      const regex = new RegExp(layer.pattern);
      if (regex.test(relativePath)) {
        return layer;
      }
    }

    return null;
  }

  /**
   * Determine import layer
   */
  private determineImportLayer(importPath: string, projectPath: string): LayerDefinition | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      return null; // Would need more context to resolve
    }

    // Handle absolute imports
    for (const layer of this.config.layerDefinitions || []) {
      const regex = new RegExp(layer.pattern);
      if (regex.test(importPath)) {
        return layer;
      }
    }

    return null;
  }

  /**
   * Check if layer dependency is allowed
   */
  private isLayerDependencyAllowed(fromLayer: LayerDefinition, toLayer: LayerDefinition): boolean {
    return fromLayer.allowedDependencies.includes(toLayer.name);
  }

  /**
   * Helper method to create proper ArchitectureIssue objects
   */
  private createArchitectureIssue(
    id: string,
    title: string,
    description: string,
    entity: UnifiedEntity,
    severity: IssueSeverity,
    ruleId: string,
    line: number,
    column: number,
    architectureInfo: ArchitectureInfo,
    architectureCategory: 'design_pattern' | 'complexity' | 'coupling' | 'cohesion' | 'dependency_cycle' | 'maintainability',
    technicalDebtLevel: 'low' | 'medium' | 'high' | 'critical',
    refactoringOpportunity?: any
  ): ArchitectureIssue {
    const baseIssue = new UnifiedIssue({
      id,
      entity,
      severity,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      title,
      description,
      ruleId,
      line,
      column,
      endLine: line,
      endColumn: column + 1,
      toolName: 'ESLint Architecture Analyzer'
    });

    return {
      ...baseIssue,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      architectureInfo,
      architectureCategory,
      technicalDebtLevel,
      refactoringOpportunity
    } as ArchitectureIssue;
  }

  /**
   * Create architectural violation issues
   */
  private createArchitecturalViolationIssues(
    violations: ArchitecturalViolation[],
    projectPath: string
  ): ArchitectureIssue[] {
    return violations.map(violation => this.createArchitectureIssue(
      `eslint-arch-${violation.rule}-${violation.file.replace(/[^a-zA-Z0-9]/g, '_')}-${violation.line}`,
      `Architectural rule violation: ${violation.rule}`,
      violation.message,
      new UnifiedEntity({
        id: `eslint-violation-${violation.rule}`,
        type: 'rule_violation',
        name: violation.rule,
        canonicalPath: violation.file
      }),
      this.eslintSeverityToIssueSeverity(violation.severity),
      violation.rule,
      violation.line,
      violation.column,
      {
        componentType: 'module',
        designPattern: violation.category,
        complexityMetrics: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          maintainabilityIndex: 90
        },
        couplingLevel: 'medium',
        cohesionLevel: 'medium'
      },
      this.mapCategoryToArchitectureCategory(violation.category),
      this.eslintSeverityToDebtLevel(violation.severity),
      {
        suggestedAction: `Fix ${violation.rule} violation`,
        effort: 'low',
        impact: 'medium'
      }
    ));
  }

  /**
   * Create layer violation issues
   */
  private createLayerViolationIssues(
    violations: LayerViolation[],
    projectPath: string
  ): ArchitectureIssue[] {
    return violations.map(violation => ({
      id: `eslint-layer-${violation.fromLayer}-${violation.toLayer}-${violation.file.replace(/[^a-zA-Z0-9]/g, '_')}`,
      title: `Layer violation: ${violation.fromLayer} -> ${violation.toLayer}`,
      description: violation.reason,
      entity: new UnifiedEntity({
        id: `layer-violation-${violation.fromLayer}`,
        type: 'layer_violation',
        name: `${violation.fromLayer} -> ${violation.toLayer}`,
        canonicalPath: violation.file
      }),
      severity: IssueSeverity.HIGH,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      ruleId: 'layer-violation',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'ESLint Architecture Analyzer',
      metadata: {},
      createdAt: new Date().toISOString(),
      architectureInfo: {
        componentType: 'module',
        designPattern: 'layered_architecture',
        complexityMetrics: {
          cyclomaticComplexity: 2,
          cognitiveComplexity: 3,
          maintainabilityIndex: 80
        },
        couplingLevel: 'high',
        cohesionLevel: 'low'
      },
      architectureCategory: 'coupling',
      technicalDebtLevel: 'high',
      refactoringOpportunity: {
        suggestedAction: 'Refactor to respect layer boundaries',
        effort: 'medium',
        impact: 'high'
      },
      recommendations: [
        {
          type: 'architecture',
          priority: 'high',
          description: `Fix layer violation: ${violation.fromLayer} should not depend on ${violation.toLayer}`,
          effort: 'medium',
          implementation: 'Refactor code to respect layered architecture boundaries',
          benefits: ['Better separation of concerns', 'Improved maintainability', 'Cleaner architecture']
        }
      ]
    } as unknown as ArchitectureIssue));
  }

  /**
   * Create import violation issues
   */
  private createImportViolationIssues(
    violations: ImportViolation[],
    projectPath: string
  ): ArchitectureIssue[] {
    return violations.map(violation => ({
      id: `eslint-import-${violation.pattern.replace(/[^a-zA-Z0-9]/g, '_')}-${violation.file.replace(/[^a-zA-Z0-9]/g, '_')}`,
      title: `Import pattern violation: ${violation.pattern}`,
      description: violation.violation,
      entity: new UnifiedEntity({
        id: `import-violation-${violation.pattern}`,
        type: 'import_violation',
        name: violation.import,
        canonicalPath: violation.file
      }),
      severity: IssueSeverity.MEDIUM,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      ruleId: 'import-pattern-violation',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'ESLint Architecture Analyzer',
      metadata: {},
      createdAt: new Date().toISOString(),
      architectureInfo: {
        componentType: 'module',
        designPattern: 'import_pattern',
        complexityMetrics: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 2,
          maintainabilityIndex: 85
        },
        couplingLevel: 'medium',
        cohesionLevel: 'medium'
      },
      architectureCategory: 'coupling',
      technicalDebtLevel: 'medium',
      refactoringOpportunity: {
        suggestedAction: 'Fix import pattern violation',
        effort: 'low',
        impact: 'medium'
      },
      recommendations: [
        {
          type: 'fix',
          priority: 'medium',
          description: `Fix import pattern violation for ${violation.import}`,
          effort: 'low',
          implementation: 'Update import to follow architectural patterns',
          benefits: ['Better code organization', 'Consistent import patterns', 'Improved maintainability']
        }
      ]
    } as unknown as ArchitectureIssue));
  }

  /**
   * Create pattern violation issues
   */
  private createPatternViolationIssues(
    violations: PatternViolation[],
    projectPath: string
  ): ArchitectureIssue[] {
    return violations.map(violation => ({
      id: `eslint-pattern-${violation.pattern.replace(/[^a-zA-Z0-9]/g, '_')}-${violation.file.replace(/[^a-zA-Z0-9]/g, '_')}`,
      title: `Pattern violation: ${violation.pattern}`,
      description: violation.violation,
      entity: new UnifiedEntity({
        id: `pattern-violation-${violation.pattern}`,
        type: 'pattern_violation',
        name: violation.pattern,
        canonicalPath: violation.file
      }),
      severity: IssueSeverity.LOW,
      analysisType: AnalysisType.ARCHITECTURE_DESIGN,
      ruleId: violation.pattern,
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'ESLint Architecture Analyzer',
      metadata: {},
      createdAt: new Date().toISOString(),
      architectureInfo: {
        componentType: 'module',
        designPattern: 'naming_pattern',
        complexityMetrics: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 1,
          maintainabilityIndex: 95
        },
        couplingLevel: 'low',
        cohesionLevel: 'high'
      },
      architectureCategory: 'design_pattern',
      technicalDebtLevel: 'low',
      refactoringOpportunity: {
        suggestedAction: violation.suggestion,
        effort: 'low',
        impact: 'low'
      },
      recommendations: [
        {
          type: 'style',
          priority: 'low',
          description: `Fix pattern violation: ${violation.pattern}`,
          effort: 'low',
          implementation: violation.suggestion,
          benefits: ['Consistent code style', 'Better readability', 'Team standards compliance']
        }
      ]
    } as unknown as ArchitectureIssue));
  }

  // Default configurations and utility methods

  private getDefaultArchitecturalRules(): ArchitecturalRule[] {
    return [
      {
        name: 'no-business-logic-in-ui',
        pattern: 'components/.+\\.(js|ts|jsx|tsx)$',
        violation: 'Business logic should not be in UI components',
        severity: 'error',
        category: 'layering'
      },
      {
        name: 'no-direct-database-access',
        pattern: 'database\\.',
        violation: 'Direct database access not allowed outside data layer',
        severity: 'error',
        category: 'layering'
      },
      {
        name: 'consistent-naming-conventions',
        pattern: '[A-Z][a-zA-Z0-9]*',
        violation: 'Use consistent naming conventions',
        severity: 'warn',
        category: 'naming'
      }
    ];
  }

  private getDefaultLayerDefinitions(): LayerDefinition[] {
    return [
      {
        name: 'presentation',
        pattern: '^(components|pages|views)/',
        allowedDependencies: ['business', 'shared'],
        description: 'UI components and pages'
      },
      {
        name: 'business',
        pattern: '^(services|domain|business)/',
        allowedDependencies: ['data', 'shared'],
        description: 'Business logic and services'
      },
      {
        name: 'data',
        pattern: '^(data|repositories|adapters)/',
        allowedDependencies: ['shared'],
        description: 'Data access and external services'
      },
      {
        name: 'shared',
        pattern: '^(shared|utils|common)/',
        allowedDependencies: [],
        description: 'Shared utilities and common code'
      }
    ];
  }

  private getDefaultImportPatterns(): ImportPattern[] {
    return [
      {
        from: 'components/**',
        to: 'data/**',
        allowed: false,
        reason: 'UI components should not directly access data layer'
      },
      {
        from: 'pages/**',
        to: 'data/**',
        allowed: false,
        reason: 'Pages should not directly access data layer'
      },
      {
        from: 'business/**',
        to: 'components/**',
        allowed: false,
        reason: 'Business logic should not depend on UI components'
      }
    ];
  }

  // Utility methods

  private isArchitecturalRule(ruleId: string | null): boolean {
    if (!ruleId) return false;
    return this.config.architecturalRules?.some(rule => rule.name === ruleId) || false;
  }

  private getArchitecturalCategory(ruleId: string | null): string {
    if (!ruleId) return 'unknown';
    const rule = this.config.architecturalRules?.find(r => r.name === ruleId);
    return rule?.category || 'unknown';
  }

  private eslintSeverityToString(severity: number): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 2: return 'error';
      case 1: return 'warning';
      default: return 'info';
    }
  }

  private eslintSeverityToIssueSeverity(severity: string): IssueSeverity {
    switch (severity) {
      case 'error': return IssueSeverity.HIGH;
      case 'warning': return IssueSeverity.MEDIUM;
      default: return IssueSeverity.LOW;
    }
  }

  private eslintSeverityToDebtLevel(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'error': return 'high';
      case 'warning': return 'medium';
      default: return 'low';
    }
  }

  private mapCategoryToArchitectureCategory(category: string): 'design_pattern' | 'complexity' | 'coupling' | 'cohesion' | 'dependency_cycle' | 'maintainability' {
    switch (category) {
      case 'layering': return 'coupling';
      case 'coupling': return 'coupling';
      case 'naming': return 'design_pattern';
      case 'imports': return 'coupling';
      case 'exports': return 'coupling';
      default: return 'maintainability';
    }
  }

  private extractImportPath(message: string): string {
    // Extract import path from ESLint message
    const match = message.match(/['"`]([^'"`]+)['"`]/);
    return match?.[1] || '';
  }

  private findViolatedImportPattern(importPath: string): ImportPattern | null {
    return this.config.importPatterns?.find(pattern =>
      !pattern.allowed && importPath.includes(pattern.from)
    ) || null;
  }

  private isPatternRule(ruleId: string | null): boolean {
    return ruleId === 'filename-rules' || false;
  }

  private generatePatternSuggestion(ruleId: string | null, message: string): string {
    switch (ruleId) {
      case 'filename-rules':
        return 'Use kebab-case for file names';
      default:
        return 'Follow project naming conventions';
    }
  }

  private getViolationFixSuggestion(violation: ArchitecturalViolation): string {
    switch (violation.rule) {
      case 'no-business-logic-in-ui':
        return 'Move business logic to service layer';
      case 'no-direct-database-access':
        return 'Use repository pattern for data access';
      case 'consistent-naming-conventions':
        return 'Update naming to follow project conventions';
      default:
        return 'Fix architectural rule violation';
    }
  }

  private calculateESLintDebtScore(issues: ArchitectureIssue[]): number {
    return issues.reduce((score, issue) => {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL: return score + 8;
        case IssueSeverity.HIGH: return score + 5;
        case IssueSeverity.MEDIUM: return score + 3;
        case IssueSeverity.LOW: return score + 1;
        default: return score;
      }
    }, 0);
  }

  private categorizeDebtLevel(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 40) return 'E';  // critical
    if (score >= 25) return 'D';  // high
    if (score >= 15) return 'C';  // medium
    if (score >= 5) return 'B';   // low-medium
    return 'A';                   // excellent
  }

  private estimateESLintRemediationTime(issues: ArchitectureIssue[]): string {
    const totalEffort = issues.reduce((time, issue) => {
      const effort = issue.refactoringOpportunity?.effort || 'low';
      switch (effort) {
        case 'high': return time + 4;
        case 'medium': return time + 2;
        case 'low': return time + 0.5;
        default: return time + 2;
      }
    }, 0);

    if (totalEffort < 5) return '1-2 days';
    if (totalEffort < 15) return '1-2 weeks';
    if (totalEffort < 30) return '1 month';
    return '2+ months';
  }

  private generateESLintRecommendations(
    layerIssues: ArchitectureIssue[],
    importIssues: ArchitectureIssue[],
    patternIssues: ArchitectureIssue[]
  ): WorkflowRecommendation[] {
    const recommendations: WorkflowRecommendation[] = [];

    if (layerIssues.length > 0) {
      recommendations.push({
        action: `Fix ${layerIssues.length} layer boundary violations`,
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        steps: [
          'Identify layer boundary violations',
          'Refactor code to respect layered architecture',
          'Update imports and dependencies'
        ],
        automatable: false,
        tools: ['ESLint'],
        timeline: {
          estimated: '1-2 weeks',
          urgency: 'short_term'
        }
      });
    }

    if (importIssues.length > 0) {
      recommendations.push({
        action: `Fix ${importIssues.length} import pattern violations`,
        priority: 'medium',
        effort: 'low',
        impact: 'medium',
        steps: [
          'Review import patterns',
          'Update imports to follow architectural patterns',
          'Add ESLint rules to prevent future violations'
        ],
        automatable: true,
        tools: ['ESLint', 'auto-import'],
        timeline: {
          estimated: '2-3 days',
          urgency: 'immediate'
        }
      });
    }

    if (patternIssues.length > 0) {
      recommendations.push({
        action: `Fix ${patternIssues.length} pattern violations`,
        priority: 'low',
        effort: 'low',
        impact: 'low',
        steps: [
          'Update code to follow naming conventions',
          'Apply consistent code style',
          'Configure automated formatting'
        ],
        automatable: true,
        tools: ['ESLint', 'Prettier'],
        timeline: {
          estimated: '1 day',
          urgency: 'medium_term'
        }
      });
    }

    return recommendations;
  }
}

export default ESLintArchitectureAdapter;