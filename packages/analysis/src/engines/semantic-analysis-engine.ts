/**
 * Semantic Analysis Engine for Phase 2 Advanced Correlation
 *
 * Provides AST-based semantic understanding for intelligent issue correlation
 * beyond simple proximity and pattern matching.
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedIssue } from '@topolop/shared-types';

// Note: Using dynamic import to avoid module resolution issues
const parseTypeScript = async (content: string) => {
  try {
    // Use dynamic import to avoid TypeScript compilation issues
    const parserModule = '@typescript-eslint/parser';
    const parser = await import(parserModule);
    return parser.parse(content, {
      loc: true,
      range: true,
      tokens: true,
      comments: true,
      ecmaVersion: 2022,
      sourceType: 'module'
    });
  } catch (error) {
    console.warn('TypeScript parser not available, skipping AST parsing');
    return null;
  }
};

/**
 * Semantic context for code analysis
 */
export interface SemanticContext {
  astNode: any;
  functionScope: string;
  variableScope: string[];
  dataFlowChain: DataFlowNode[];
  callGraph: CallRelationship[];
  controlFlow: ControlFlowNode[];
  dependencies: DependencyRelationship[];
}

/**
 * Data flow analysis node
 */
export interface DataFlowNode {
  id: string;
  type: 'variable' | 'function' | 'parameter' | 'return';
  name: string;
  filePath: string;
  line: number;
  column: number;
  dataType?: string;
  flowsTo: string[];    // IDs of nodes this flows to
  flowsFrom: string[];  // IDs of nodes this flows from
  taintLevel: 'clean' | 'tainted' | 'sanitized' | 'unknown';
}

/**
 * Function call relationship
 */
export interface CallRelationship {
  caller: {
    name: string;
    filePath: string;
    line: number;
  };
  callee: {
    name: string;
    filePath: string;
    line: number;
  };
  callType: 'direct' | 'indirect' | 'dynamic';
  parameters: DataFlowNode[];
}

/**
 * Control flow analysis node
 */
export interface ControlFlowNode {
  id: string;
  type: 'entry' | 'exit' | 'statement' | 'condition' | 'loop' | 'exception';
  filePath: string;
  startLine: number;
  endLine: number;
  predecessors: string[];
  successors: string[];
  dominates: string[];
  postDominates: string[];
}

/**
 * Dependency relationship between modules/files
 */
export interface DependencyRelationship {
  from: string;        // File path
  to: string;          // File path
  type: 'import' | 'require' | 'include' | 'reference';
  importedSymbols: string[];
  isExternal: boolean;
  packageName?: string;
}

/**
 * Semantic correlation result
 */
export interface SemanticCorrelation {
  primaryIssue: UnifiedIssue;
  relatedIssues: UnifiedIssue[];
  correlationType: 'data_flow' | 'control_flow' | 'call_graph' | 'dependency' | 'variable_scope';
  confidence: number;
  semanticContext: SemanticContext;
  riskPath?: DataFlowNode[];
  explanation: string;
}

/**
 * Main semantic analysis engine
 */
export class SemanticAnalysisEngine {
  private astCache: Map<string, any> = new Map();
  private dataFlowGraph: Map<string, DataFlowNode[]> = new Map();
  private callGraph: Map<string, CallRelationship[]> = new Map();
  private dependencyGraph: Map<string, DependencyRelationship[]> = new Map();

  /**
   * Analyze semantic relationships between issues
   */
  public async analyzeSemanticCorrelations(issues: UnifiedIssue[]): Promise<SemanticCorrelation[]> {
    const correlations: SemanticCorrelation[] = [];

    // Group issues by file for efficient processing
    const issuesByFile = this.groupIssuesByFile(issues);

    for (const [filePath, fileIssues] of issuesByFile) {
      try {
        // Parse AST for this file
        const ast = await this.getOrParseAST(filePath);
        if (!ast) continue;

        // Build semantic context for the file
        const semanticContext = await this.buildSemanticContext(filePath, ast);

        // Find semantic correlations within the file
        const fileCorrelations = this.findSemanticCorrelations(fileIssues, semanticContext);
        correlations.push(...fileCorrelations);

      } catch (error) {
        console.warn(`Failed to analyze semantic context for ${filePath}:`, error);
      }
    }

    // Find cross-file correlations using dependency graph
    const crossFileCorrelations = await this.findCrossFileCorrelations(issues);
    correlations.push(...crossFileCorrelations);

    return correlations;
  }

  /**
   * Get or parse AST for a file (with caching)
   */
  private async getOrParseAST(filePath: string): Promise<any | null> {
    if (this.astCache.has(filePath)) {
      return this.astCache.get(filePath);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);

      let ast = null;

      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        ast = await parseTypeScript(content);
      }
      // Add more parsers for other languages as needed

      if (ast) {
        this.astCache.set(filePath, ast);
      }

      return ast;

    } catch (error) {
      console.warn(`Failed to parse AST for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Build comprehensive semantic context for a file
   */
  private async buildSemanticContext(filePath: string, ast: any): Promise<SemanticContext> {
    const dataFlowNodes = this.extractDataFlowNodes(ast, filePath);
    const callRelationships = this.extractCallGraph(ast, filePath);
    const controlFlowNodes = this.extractControlFlow(ast, filePath);
    const dependencies = this.extractDependencies(ast, filePath);

    // Store in caches for cross-file analysis
    this.dataFlowGraph.set(filePath, dataFlowNodes);
    this.callGraph.set(filePath, callRelationships);
    this.dependencyGraph.set(filePath, dependencies);

    return {
      astNode: ast,
      functionScope: '',
      variableScope: [],
      dataFlowChain: dataFlowNodes,
      callGraph: callRelationships,
      controlFlow: controlFlowNodes,
      dependencies
    };
  }

  /**
   * Extract data flow nodes from AST
   */
  private extractDataFlowNodes(ast: any, filePath: string): DataFlowNode[] {
    const nodes: DataFlowNode[] = [];

    // Traverse AST to find variable declarations, assignments, and usage
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'VariableDeclarator' || node.type === 'AssignmentExpression') {
        const dataFlowNode: DataFlowNode = {
          id: `${filePath}:${node.loc?.start?.line}:${node.loc?.start?.column}`,
          type: node.type === 'VariableDeclarator' ? 'variable' : 'variable',
          name: this.extractVariableName(node),
          filePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          flowsTo: [],
          flowsFrom: [],
          taintLevel: 'unknown'
        };
        nodes.push(dataFlowNode);
      }
    });

    // Build flow relationships
    this.buildDataFlowRelationships(nodes, ast);

    return nodes;
  }

  /**
   * Extract call graph from AST
   */
  private extractCallGraph(ast: any, filePath: string): CallRelationship[] {
    const relationships: CallRelationship[] = [];
    const functionStack: string[] = ['global'];

    this.traverseASTWithFunctionContext(ast, functionStack, (node: any, currentFunction: string) => {
      if (node.type === 'CallExpression') {
        const relationship: CallRelationship = {
          caller: {
            name: currentFunction,
            filePath,
            line: node.loc?.start?.line || 0
          },
          callee: {
            name: this.extractCalleeName(node),
            filePath: this.resolveCalleeFilePath(this.extractCalleeName(node), ast, filePath),
            line: node.loc?.start?.line || 0
          },
          callType: 'direct',
          parameters: []
        };
        relationships.push(relationship);
      }
    });

    return relationships;
  }

  /**
   * Extract control flow from AST
   */
  private extractControlFlow(ast: any, filePath: string): ControlFlowNode[] {
    const nodes: ControlFlowNode[] = [];

    this.traverseAST(ast, (node: any) => {
      if (['IfStatement', 'WhileStatement', 'ForStatement', 'SwitchStatement'].includes(node.type)) {
        const cfNode: ControlFlowNode = {
          id: `${filePath}:${node.loc?.start?.line}:${node.type}`,
          type: this.mapASTTypeToControlFlow(node.type),
          filePath,
          startLine: node.loc?.start?.line || 0,
          endLine: node.loc?.end?.line || 0,
          predecessors: [],
          successors: [],
          dominates: [],
          postDominates: []
        };
        nodes.push(cfNode);
      }
    });

    // Build control flow relationships
    this.buildControlFlowRelationships(nodes);

    return nodes;
  }

  /**
   * Extract dependency relationships from AST
   */
  private extractDependencies(ast: any, filePath: string): DependencyRelationship[] {
    const dependencies: DependencyRelationship[] = [];

    this.traverseAST(ast, (node: any) => {
      if (node.type === 'ImportDeclaration' || node.type === 'CallExpression') {
        if (node.source || (node.callee?.name === 'require')) {
          const importPath = node.source?.value || node.arguments?.[0]?.value;
          if (importPath) {
            const dependency: DependencyRelationship = {
              from: filePath,
              to: this.resolveDependencyPath(importPath, filePath),
              type: node.type === 'ImportDeclaration' ? 'import' : 'require',
              importedSymbols: this.extractImportedSymbols(node),
              isExternal: !importPath.startsWith('.') && !importPath.startsWith('/'),
              packageName: this.extractPackageName(importPath)
            };
            dependencies.push(dependency);
          }
        }
      }
    });

    return dependencies;
  }

  /**
   * Find semantic correlations within analyzed context
   */
  private findSemanticCorrelations(issues: UnifiedIssue[], context: SemanticContext): SemanticCorrelation[] {
    const correlations: SemanticCorrelation[] = [];

    for (let i = 0; i < issues.length; i++) {
      for (let j = i + 1; j < issues.length; j++) {
        const issue1 = issues[i];
        const issue2 = issues[j];

        if (!issue1 || !issue2) continue;

        // Check for data flow correlation
        const dataFlowCorr = this.analyzeDataFlowCorrelation(issue1, issue2, context);
        if (dataFlowCorr) {
          correlations.push(dataFlowCorr);
        }

        // Check for control flow correlation
        const controlFlowCorr = this.analyzeControlFlowCorrelation(issue1, issue2, context);
        if (controlFlowCorr) {
          correlations.push(controlFlowCorr);
        }

        // Check for call graph correlation
        const callGraphCorr = this.analyzeCallGraphCorrelation(issue1, issue2, context);
        if (callGraphCorr) {
          correlations.push(callGraphCorr);
        }
      }
    }

    return correlations;
  }

  /**
   * Find cross-file correlations using dependency analysis
   */
  private async findCrossFileCorrelations(issues: UnifiedIssue[]): Promise<SemanticCorrelation[]> {
    const correlations: SemanticCorrelation[] = [];

    // Group issues by file
    const issuesByFile = this.groupIssuesByFile(issues);
    const files = Array.from(issuesByFile.keys());

    // Check each pair of files for dependency relationships
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];

        if (!file1 || !file2) continue;

        const deps1 = this.dependencyGraph.get(file1) || [];
        const deps2 = this.dependencyGraph.get(file2) || [];

        // Check if files have dependency relationship
        const hasDirectDep = deps1.some(d => d.to === file2) || deps2.some(d => d.to === file1);

        if (hasDirectDep) {
          const file1Issues = issuesByFile.get(file1) || [];
          const file2Issues = issuesByFile.get(file2) || [];

          // Find semantic correlations between dependent files
          const crossCorrelations = this.analyzeInterFileDependencyCorrelations(file1Issues, file2Issues);
          correlations.push(...crossCorrelations);
        }
      }
    }

    return correlations;
  }

  // Helper methods...

  private groupIssuesByFile(issues: UnifiedIssue[]): Map<string, UnifiedIssue[]> {
    const grouped = new Map<string, UnifiedIssue[]>();

    for (const issue of issues) {
      const filePath = issue.entity.canonicalPath;
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath)!.push(issue);
    }

    return grouped;
  }

  private traverseAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    callback(node);

    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
        continue; // Avoid circular references
      }

      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseAST(item, callback));
      } else if (child && typeof child === 'object') {
        this.traverseAST(child, callback);
      }
    }
  }

  private traverseASTWithFunctionContext(
    node: any,
    functionStack: string[],
    callback: (node: any, currentFunction: string) => void
  ): void {
    if (!node || typeof node !== 'object') return;

    // Check if this node represents a function definition
    let functionName: string | null = null;
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      functionName = node.id.name;
    } else if (node.type === 'FunctionExpression' && node.id?.name) {
      functionName = node.id.name;
    } else if (node.type === 'MethodDefinition' && node.key?.name) {
      functionName = node.key.name;
    } else if (node.type === 'VariableDeclarator' && node.init?.type === 'ArrowFunctionExpression' && node.id?.name) {
      functionName = node.id.name;
    }

    // Push new function onto stack if found
    if (functionName) {
      functionStack.push(functionName);
    }

    // Call callback with current function context
    const currentFunction = functionStack[functionStack.length - 1] || 'global';
    callback(node, currentFunction);

    // Recursively traverse children
    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
        continue; // Avoid circular references
      }

      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseASTWithFunctionContext(item, functionStack, callback));
      } else if (child && typeof child === 'object') {
        this.traverseASTWithFunctionContext(child, functionStack, callback);
      }
    }

    // Pop function from stack when exiting
    if (functionName) {
      functionStack.pop();
    }
  }

  private extractVariableName(node: any): string {
    if (node.id?.name) return node.id.name;
    if (node.left?.name) return node.left.name;
    return 'unknown';
  }

  private getCurrentFunctionName(node: any): string {
    // This method is now deprecated in favor of traverseASTWithFunctionContext
    // which maintains proper function context during traversal
    return 'global';
  }

  private extractCalleeName(node: any): string {
    if (node.callee?.name) return node.callee.name;
    if (node.callee?.property?.name) return node.callee.property.name;
    return 'unknown';
  }

  private mapASTTypeToControlFlow(type: string): ControlFlowNode['type'] {
    switch (type) {
      case 'IfStatement': return 'condition';
      case 'WhileStatement':
      case 'ForStatement': return 'loop';
      default: return 'statement';
    }
  }

  private buildDataFlowRelationships(nodes: DataFlowNode[], ast: any): void {
    // Basic data flow relationship building
    // Connect nodes that are likely to have data dependencies
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        if (!node1 || !node2) continue;

        // If nodes have the same name and are close in lines, they might be related
        if (node1.name === node2.name && Math.abs(node1.line - node2.line) <= 10) {
          node1.flowsTo.push(node2.id);
          node2.flowsFrom.push(node1.id);
        }
      }
    }
  }

  private buildControlFlowRelationships(nodes: ControlFlowNode[]): void {
    // Basic control flow relationship building
    // Connect nodes based on line proximity and control flow patterns
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const node1 = nodes[i];
        const node2 = nodes[j];

        if (!node1 || !node2) continue;

        // If node2 starts after node1 ends and they're close, create a relationship
        if (node2.startLine > node1.endLine && node2.startLine - node1.endLine <= 5) {
          node1.successors.push(node2.id);
          node2.predecessors.push(node1.id);
        }
      }
    }
  }

  private resolveDependencyPath(importPath: string, currentFile: string): string {
    if (importPath.startsWith('.')) {
      return path.resolve(path.dirname(currentFile), importPath);
    }
    return importPath;
  }

  private resolveCalleeFilePath(calleeName: string, ast: any, currentFilePath: string): string {
    // First, try to find if the callee is imported from another module
    const imports = this.extractDependencies(ast, currentFilePath);

    for (const imp of imports) {
      if (imp.importedSymbols.includes(calleeName)) {
        // Try to resolve the import path to an actual file
        const resolvedPath = this.resolveDependencyPath(imp.to, currentFilePath);

        // Add common file extensions if missing
        if (!resolvedPath.includes('.')) {
          const extensions = ['.js', '.ts', '.jsx', '.tsx'];
          for (const ext of extensions) {
            const pathWithExt = resolvedPath + ext;
            if (fs.existsSync(pathWithExt)) {
              return pathWithExt;
            }
          }
        }

        return resolvedPath;
      }
    }

    // If not found in imports, return current file path (local function)
    return currentFilePath;
  }

  private extractImportedSymbols(node: any): string[] {
    if (node.specifiers) {
      return node.specifiers.map((spec: any) => spec.imported?.name || spec.local?.name).filter(Boolean);
    }
    return [];
  }

  private extractPackageName(importPath: string): string | undefined {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return importPath.split('/')[0];
    }
    return undefined;
  }

  private analyzeDataFlowCorrelation(issue1: UnifiedIssue, issue2: UnifiedIssue, context: SemanticContext): SemanticCorrelation | null {
    // Basic data flow correlation - check if issues affect same variable scope
    if (issue1.line && issue2.line && Math.abs(issue1.line - issue2.line) <= 5) {
      // Simple heuristic: issues within 5 lines might share data flow
      return {
        primaryIssue: issue1,
        relatedIssues: [issue2],
        correlationType: 'data_flow',
        confidence: 0.3, // Low confidence for basic heuristic
        semanticContext: context,
        explanation: 'Issues within close proximity may share data flow patterns'
      };
    }
    return null;
  }

  private analyzeControlFlowCorrelation(issue1: UnifiedIssue, issue2: UnifiedIssue, context: SemanticContext): SemanticCorrelation | null {
    // Basic control flow correlation - check if issues are in same logical block
    const file1 = issue1.entity.canonicalPath;
    const file2 = issue2.entity.canonicalPath;

    if (file1 === file2 && issue1.line && issue2.line) {
      const lineDiff = Math.abs(issue1.line - issue2.line);
      if (lineDiff <= 10) {
        return {
          primaryIssue: issue1,
          relatedIssues: [issue2],
          correlationType: 'control_flow',
          confidence: Math.max(0.1, 1 - (lineDiff / 10)),
          semanticContext: context,
          explanation: `Issues in same file within ${lineDiff} lines may share control flow`
        };
      }
    }
    return null;
  }

  private analyzeCallGraphCorrelation(issue1: UnifiedIssue, issue2: UnifiedIssue, context: SemanticContext): SemanticCorrelation | null {
    // Basic call graph correlation - check for function-related patterns
    const msg1 = issue1.description?.toLowerCase() || '';
    const msg2 = issue2.description?.toLowerCase() || '';

    // Look for function-related keywords
    const functionKeywords = ['function', 'method', 'call', 'invoke', 'execute'];
    const hasFunction1 = functionKeywords.some(kw => msg1.includes(kw));
    const hasFunction2 = functionKeywords.some(kw => msg2.includes(kw));

    if (hasFunction1 && hasFunction2) {
      return {
        primaryIssue: issue1,
        relatedIssues: [issue2],
        correlationType: 'call_graph',
        confidence: 0.4,
        semanticContext: context,
        explanation: 'Both issues involve function-related patterns'
      };
    }
    return null;
  }

  private analyzeInterFileDependencyCorrelations(issues1: UnifiedIssue[], issues2: UnifiedIssue[]): SemanticCorrelation[] {
    const correlations: SemanticCorrelation[] = [];

    // Basic inter-file correlation - check for similar issue patterns
    for (const issue1 of issues1) {
      for (const issue2 of issues2) {
        if (issue1.ruleId === issue2.ruleId) {
          correlations.push({
            primaryIssue: issue1,
            relatedIssues: [issue2],
            correlationType: 'dependency',
            confidence: 0.6,
            semanticContext: {} as SemanticContext,
            explanation: `Same rule violation (${issue1.ruleId}) across dependent files`
          });
        }
      }
    }

    return correlations;
  }
}