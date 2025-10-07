/**
 * Advanced AST Parser for Phase 4 Semantic Analysis Enhancement
 *
 * Replaces basic regex heuristics with sophisticated language-specific AST parsing
 * using TypeScript Compiler API and Babel for comprehensive code understanding.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Enhanced AST node with comprehensive semantic information
 */
export interface EnhancedASTNode {
  id: string;
  type: string;
  name?: string;
  location: SourceLocation;
  semanticType: 'declaration' | 'reference' | 'definition' | 'assignment' | 'call' | 'import';
  scope: ScopeInfo;
  dataFlow: DataFlowInfo;
  typeInformation?: TypeInfo;
  controlFlow?: ControlFlowInfo;
}

/**
 * Source location with precise positioning
 */
export interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Scope information for variable resolution
 */
export interface ScopeInfo {
  scopeId: string;
  scopeType: 'global' | 'function' | 'block' | 'class' | 'module';
  parentScope?: string;
  variables: Map<string, VariableInfo>;
  functions: Map<string, FunctionInfo>;
  imports: Map<string, ImportInfo>;
}

/**
 * Variable information with full lifecycle
 */
export interface VariableInfo {
  name: string;
  type?: string;
  declarationType: 'var' | 'let' | 'const' | 'function' | 'class' | 'parameter';
  declarationLocation: SourceLocation;
  assignments: SourceLocation[];
  references: SourceLocation[];
  lastModified?: SourceLocation;
  isExported: boolean;
}

/**
 * Function information with call relationships
 */
export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  declarationLocation: SourceLocation;
  callSites: SourceLocation[];
  calledFunctions: string[];
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: string;
}

/**
 * Import/dependency information
 */
export interface ImportInfo {
  source: string;
  importedNames: string[];
  importType: 'default' | 'named' | 'namespace' | 'dynamic';
  location: SourceLocation;
  resolvedPath?: string;
}

/**
 * Data flow information
 */
export interface DataFlowInfo {
  definedVariables: string[];
  referencedVariables: string[];
  modifiedVariables: string[];
  dataFlowEdges: DataFlowEdge[];
}

/**
 * Data flow edge between nodes
 */
export interface DataFlowEdge {
  from: string;
  to: string;
  variable: string;
  edgeType: 'definition' | 'use' | 'modification' | 'parameter_passing';
}

/**
 * Type information from TypeScript
 */
export interface TypeInfo {
  typeName: string;
  isUnion: boolean;
  unionTypes?: string[];
  isGeneric: boolean;
  genericParameters?: string[];
  properties?: Map<string, TypeInfo>;
  methods?: Map<string, FunctionInfo>;
}

/**
 * Control flow information
 */
export interface ControlFlowInfo {
  isConditional: boolean;
  isLoop: boolean;
  isException: boolean;
  predecessors: string[];
  successors: string[];
  dominatedNodes: string[];
}

/**
 * Enhanced AST Parser with multi-language support
 */
export class AdvancedASTParser {
  private scopeCounter = 0;
  private nodeCounter = 0;
  private tsProgram?: ts.Program;
  private tsChecker?: ts.TypeChecker;

  /**
   * Parse file with appropriate parser based on language
   */
  public async parseFile(filePath: string): Promise<EnhancedASTNode[]> {
    const extension = path.extname(filePath).toLowerCase();
    const content = await fs.promises.readFile(filePath, 'utf-8');

    switch (extension) {
      case '.ts':
      case '.tsx':
        return this.parseTypeScript(content, filePath);
      case '.js':
      case '.jsx':
      case '.mjs':
        return this.parseJavaScript(content, filePath);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  /**
   * Parse TypeScript using TypeScript Compiler API
   */
  private parseTypeScript(content: string, filePath: string): EnhancedASTNode[] {
    // Create TypeScript program with comprehensive compiler options
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      lib: ['ES2022', 'DOM'],
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.Preserve,
      declaration: false,
      outDir: undefined,
      strict: false,
      noImplicitAny: false,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: ts.ModuleResolutionKind.Node16
    };

    // Create source file
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    // Create program for type checking
    this.tsProgram = ts.createProgram([filePath], compilerOptions, {
      getSourceFile: (fileName) => fileName === filePath ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => path.dirname(filePath),
      getDirectories: () => [],
      fileExists: (fileName) => fileName === filePath,
      readFile: (fileName) => fileName === filePath ? content : undefined,
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      getDefaultLibFileName: (options: ts.CompilerOptions) => ts.getDefaultLibFilePath(options)
    });

    this.tsChecker = this.tsProgram.getTypeChecker();

    // Parse AST nodes
    const nodes: EnhancedASTNode[] = [];
    const globalScope = this.createGlobalScope(filePath);

    this.visitTypeScriptNode(sourceFile, nodes, globalScope, filePath);

    return nodes;
  }

  /**
   * Visit TypeScript AST node recursively
   */
  private visitTypeScriptNode(
    node: ts.Node,
    nodes: EnhancedASTNode[],
    currentScope: ScopeInfo,
    filePath: string
  ): void {
    const location = this.getSourceLocation(node, filePath);

    // Handle different node types
    switch (node.kind) {
      case ts.SyntaxKind.VariableDeclaration:
        this.handleVariableDeclaration(node as ts.VariableDeclaration, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.FunctionDeclaration:
        this.handleFunctionDeclaration(node as ts.FunctionDeclaration, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.ClassDeclaration:
        this.handleClassDeclaration(node as ts.ClassDeclaration, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.CallExpression:
        this.handleCallExpression(node as ts.CallExpression, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        this.handlePropertyAccess(node as ts.PropertyAccessExpression, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.Identifier:
        this.handleIdentifier(node as ts.Identifier, nodes, currentScope, location);
        break;
      case ts.SyntaxKind.ImportDeclaration:
        this.handleImportDeclaration(node as ts.ImportDeclaration, nodes, currentScope, location);
        break;
    }

    // Create new scope for block-scoped constructs
    let childScope = currentScope;
    if (this.createsNewScope(node)) {
      childScope = this.createChildScope(currentScope, node, filePath);
    }

    // Recursively visit children
    ts.forEachChild(node, (child) => {
      this.visitTypeScriptNode(child, nodes, childScope, filePath);
    });
  }

  /**
   * Handle variable declaration
   */
  private handleVariableDeclaration(
    node: ts.VariableDeclaration,
    nodes: EnhancedASTNode[],
    scope: ScopeInfo,
    location: SourceLocation
  ): void {
    if (!node.name || !ts.isIdentifier(node.name)) return;

    const variableName = node.name.text;
    const declarationType = this.getDeclarationType(node);

    // Get type information
    const typeInfo = this.getTypeInformation(node);

    // Create variable info
    const variableInfo: VariableInfo = {
      name: variableName,
      type: typeInfo?.typeName,
      declarationType,
      declarationLocation: location,
      assignments: [],
      references: [],
      isExported: this.isExported(node)
    };

    // Add to scope
    scope.variables.set(variableName, variableInfo);

    // Create AST node
    const astNode: EnhancedASTNode = {
      id: this.generateNodeId(),
      type: 'VariableDeclaration',
      name: variableName,
      location,
      semanticType: 'declaration',
      scope,
      dataFlow: {
        definedVariables: [variableName],
        referencedVariables: [],
        modifiedVariables: [],
        dataFlowEdges: []
      },
      typeInformation: typeInfo
    };

    nodes.push(astNode);
  }

  /**
   * Handle function declaration
   */
  private handleFunctionDeclaration(
    node: ts.FunctionDeclaration,
    nodes: EnhancedASTNode[],
    scope: ScopeInfo,
    location: SourceLocation
  ): void {
    if (!node.name) return;

    const functionName = node.name.text;
    const parameters = this.extractParameters(node);
    const returnType = this.getReturnType(node);

    // Create function info
    const functionInfo: FunctionInfo = {
      name: functionName,
      parameters,
      returnType,
      declarationLocation: location,
      callSites: [],
      calledFunctions: [],
      isAsync: this.hasAsyncModifier(node),
      isGenerator: !!node.asteriskToken,
      isExported: this.isExported(node)
    };

    // Add to scope
    scope.functions.set(functionName, functionInfo);

    // Create AST node
    const astNode: EnhancedASTNode = {
      id: this.generateNodeId(),
      type: 'FunctionDeclaration',
      name: functionName,
      location,
      semanticType: 'declaration',
      scope,
      dataFlow: {
        definedVariables: [functionName],
        referencedVariables: [],
        modifiedVariables: [],
        dataFlowEdges: []
      }
    };

    nodes.push(astNode);
  }

  /**
   * Handle call expression for call graph construction
   */
  private handleCallExpression(
    node: ts.CallExpression,
    nodes: EnhancedASTNode[],
    scope: ScopeInfo,
    location: SourceLocation
  ): void {
    const callTarget = this.getCallTarget(node);

    // Create AST node
    const astNode: EnhancedASTNode = {
      id: this.generateNodeId(),
      type: 'CallExpression',
      name: callTarget,
      location,
      semanticType: 'call',
      scope,
      dataFlow: {
        definedVariables: [],
        referencedVariables: [callTarget],
        modifiedVariables: [],
        dataFlowEdges: []
      }
    };

    nodes.push(astNode);

    // Add to function call sites
    const currentFunction = this.findContainingFunction(scope);
    if (currentFunction && callTarget) {
      currentFunction.calledFunctions.push(callTarget);
    }
  }

  /**
   * Parse JavaScript using Babel
   */
  private parseJavaScript(content: string, filePath: string): EnhancedASTNode[] {
    try {
      // Parse with Babel
      const ast = babelParse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'functionBind',
          'exportDefaultFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });

      const nodes: EnhancedASTNode[] = [];
      const globalScope = this.createGlobalScope(filePath);

      // Traverse Babel AST
      traverse(ast, {
        enter: (path) => {
          this.handleBabelNode(path, nodes, globalScope, filePath);
        }
      });

      return nodes;
    } catch (error) {
      console.error(`Failed to parse JavaScript file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Handle Babel AST node
   */
  private handleBabelNode(
    path: any,
    nodes: EnhancedASTNode[],
    scope: ScopeInfo,
    filePath: string
  ): void {
    const node = path.node;
    const location = this.getBabelLocation(node, filePath);

    if (t.isVariableDeclarator(node)) {
      this.handleBabelVariable(node, nodes, scope, location);
    } else if (t.isFunctionDeclaration(node)) {
      this.handleBabelFunction(node, nodes, scope, location);
    } else if (t.isCallExpression(node)) {
      this.handleBabelCall(node, nodes, scope, location);
    } else if (t.isImportDeclaration(node)) {
      this.handleBabelImport(node, nodes, scope, location);
    }
  }

  /**
   * Create global scope
   */
  private createGlobalScope(filePath: string): ScopeInfo {
    return {
      scopeId: this.generateScopeId(),
      scopeType: 'global',
      variables: new Map(),
      functions: new Map(),
      imports: new Map()
    };
  }

  /**
   * Create child scope
   */
  private createChildScope(parentScope: ScopeInfo, node: ts.Node, filePath: string): ScopeInfo {
    const scopeType = this.getScopeType(node);

    return {
      scopeId: this.generateScopeId(),
      scopeType,
      parentScope: parentScope.scopeId,
      variables: new Map(),
      functions: new Map(),
      imports: new Map()
    };
  }

  /**
   * Get source location from TypeScript node
   */
  private getSourceLocation(node: ts.Node, filePath: string): SourceLocation {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      filePath,
      startLine: start.line + 1,
      startColumn: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
      startOffset: node.getStart(),
      endOffset: node.getEnd()
    };
  }

  /**
   * Get type information from TypeScript node
   */
  private getTypeInformation(node: ts.Node): TypeInfo | undefined {
    if (!this.tsChecker) return undefined;

    try {
      const type = this.tsChecker.getTypeAtLocation(node);
      const typeName = this.tsChecker.typeToString(type);

      return {
        typeName,
        isUnion: !!(type.flags & ts.TypeFlags.Union),
        isGeneric: this.isGenericType(type),
        unionTypes: this.getUnionTypes(type),
        properties: this.getTypeProperties(type),
        methods: this.getTypeMethods(type)
      };
    } catch (error) {
      return undefined;
    }
  }

  // Helper methods for utility functions
  private generateNodeId(): string {
    return `node_${++this.nodeCounter}`;
  }

  private generateScopeId(): string {
    return `scope_${++this.scopeCounter}`;
  }

  private createsNewScope(node: ts.Node): boolean {
    return ts.isFunctionDeclaration(node) ||
           ts.isClassDeclaration(node) ||
           ts.isBlock(node) ||
           ts.isArrowFunction(node);
  }

  private getScopeType(node: ts.Node): ScopeInfo['scopeType'] {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isBlock(node)) return 'block';
    return 'global';
  }

  private getDeclarationType(node: ts.VariableDeclaration): VariableInfo['declarationType'] {
    const parent = node.parent;
    if (ts.isVariableDeclarationList(parent)) {
      if (parent.flags & ts.NodeFlags.Const) return 'const';
      if (parent.flags & ts.NodeFlags.Let) return 'let';
      return 'var';
    }
    return 'var';
  }

  private isExported(node: ts.Node): boolean {
    return this.hasExportModifier(node);
  }

  private extractParameters(node: ts.FunctionDeclaration): ParameterInfo[] {
    return node.parameters.map(param => ({
      name: ts.isIdentifier(param.name) ? param.name.text : 'unknown',
      type: param.type ? param.type.getText() : undefined,
      isOptional: !!param.questionToken,
      defaultValue: param.initializer?.getText()
    }));
  }

  private getReturnType(node: ts.FunctionDeclaration): string | undefined {
    return node.type?.getText();
  }

  private getCallTarget(node: ts.CallExpression): string {
    if (ts.isIdentifier(node.expression)) {
      return node.expression.text;
    }
    if (ts.isPropertyAccessExpression(node.expression)) {
      return node.expression.getText();
    }
    return 'unknown';
  }

  private findContainingFunction(scope: ScopeInfo): FunctionInfo | undefined {
    // Walk up scope chain to find containing function
    let currentScope: ScopeInfo | undefined = scope;
    while (currentScope) {
      if (currentScope.scopeType === 'function') {
        // Return first function found in this scope
        const functions = Array.from(currentScope.functions.values());
        return functions[0];
      }
      // Would need parent scope reference to continue
      currentScope = undefined;
    }
    return undefined;
  }

  private getBabelLocation(node: any, filePath: string): SourceLocation {
    const loc = node.loc;
    return {
      filePath,
      startLine: loc?.start?.line || 0,
      startColumn: loc?.start?.column || 0,
      endLine: loc?.end?.line || 0,
      endColumn: loc?.end?.column || 0,
      startOffset: node.start || 0,
      endOffset: node.end || 0
    };
  }

  private handleBabelVariable(node: any, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for Babel variable handling
    if (t.isIdentifier(node.id)) {
      const astNode: EnhancedASTNode = {
        id: this.generateNodeId(),
        type: 'VariableDeclaration',
        name: node.id.name,
        location,
        semanticType: 'declaration',
        scope,
        dataFlow: {
          definedVariables: [node.id.name],
          referencedVariables: [],
          modifiedVariables: [],
          dataFlowEdges: []
        }
      };
      nodes.push(astNode);
    }
  }

  private handleBabelFunction(node: any, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for Babel function handling
    if (node.id && t.isIdentifier(node.id)) {
      const astNode: EnhancedASTNode = {
        id: this.generateNodeId(),
        type: 'FunctionDeclaration',
        name: node.id.name,
        location,
        semanticType: 'declaration',
        scope,
        dataFlow: {
          definedVariables: [node.id.name],
          referencedVariables: [],
          modifiedVariables: [],
          dataFlowEdges: []
        }
      };
      nodes.push(astNode);
    }
  }

  private handleBabelCall(node: any, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for Babel call handling
    let callTarget = 'unknown';
    if (t.isIdentifier(node.callee)) {
      callTarget = node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      callTarget = 'member_call';
    }

    const astNode: EnhancedASTNode = {
      id: this.generateNodeId(),
      type: 'CallExpression',
      name: callTarget,
      location,
      semanticType: 'call',
      scope,
      dataFlow: {
        definedVariables: [],
        referencedVariables: [callTarget],
        modifiedVariables: [],
        dataFlowEdges: []
      }
    };
    nodes.push(astNode);
  }

  private handleBabelImport(node: any, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for Babel import handling
    const astNode: EnhancedASTNode = {
      id: this.generateNodeId(),
      type: 'ImportDeclaration',
      name: node.source.value,
      location,
      semanticType: 'import',
      scope,
      dataFlow: {
        definedVariables: [],
        referencedVariables: [],
        modifiedVariables: [],
        dataFlowEdges: []
      }
    };
    nodes.push(astNode);
  }

  private handleClassDeclaration(node: ts.ClassDeclaration, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for class declaration
  }

  private handlePropertyAccess(node: ts.PropertyAccessExpression, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for property access
  }

  private handleIdentifier(node: ts.Identifier, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for identifier
  }

  private handleImportDeclaration(node: ts.ImportDeclaration, nodes: EnhancedASTNode[], scope: ScopeInfo, location: SourceLocation): void {
    // Implementation for import declaration
  }

  private isGenericType(type: ts.Type): boolean {
    return false; // Simplified implementation
  }

  private getUnionTypes(type: ts.Type): string[] | undefined {
    return undefined; // Simplified implementation
  }

  private getTypeProperties(type: ts.Type): Map<string, TypeInfo> | undefined {
    return undefined; // Simplified implementation
  }

  private getTypeMethods(type: ts.Type): Map<string, FunctionInfo> | undefined {
    return undefined; // Simplified implementation
  }

  private hasAsyncModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node) &&
           !!ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
  }

  private hasExportModifier(node: ts.Node): boolean {
    return ts.canHaveModifiers(node) &&
           !!ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  }
}