import { UnifiedIssue } from '@topolop/shared-types';

export interface FunctionBoundary {
  functionName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  className?: string;
  namespace?: string;
  parameters: string[];
  returnType?: string;
  isMethod: boolean;
  isStatic: boolean;
  visibility: 'public' | 'private' | 'protected' | 'internal' | 'unknown';
  complexity?: number;
}

export interface FunctionCluster {
  boundary: FunctionBoundary;
  issues: UnifiedIssue[];
  severity: 'high' | 'medium' | 'low';
  hotspotScore: number;
  correlationStrength: number;
}

export interface LanguageParser {
  language: string;
  patterns: {
    functionDeclaration: RegExp[];
    classDeclaration: RegExp[];
    methodDeclaration: RegExp[];
    scopeMarkers: {
      open: string[];
      close: string[];
    };
  };
  parseFunctions(content: string, filePath: string): FunctionBoundary[];
}

export class FunctionBoundaryParser {
  private parsers: Map<string, LanguageParser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  public parseFunctionsInFile(content: string, filePath: string): FunctionBoundary[] {
    const extension = this.getFileExtension(filePath);
    const language = this.mapExtensionToLanguage(extension);
    const parser = this.parsers.get(language);

    if (!parser) {
      return this.createGenericBoundary(content, filePath);
    }

    return parser.parseFunctions(content, filePath);
  }

  public clusterIssuesByFunction(
    issues: UnifiedIssue[],
    boundaries: FunctionBoundary[]
  ): FunctionCluster[] {
    const clusters: FunctionCluster[] = [];
    const issuesByFile = this.groupIssuesByFile(issues);

    for (const [filePath, fileIssues] of issuesByFile) {
      const fileBoundaries = boundaries.filter(b => b.filePath === filePath);

      for (const boundary of fileBoundaries) {
        const functionIssues = this.findIssuesInFunction(fileIssues, boundary);

        if (functionIssues.length > 0) {
          clusters.push({
            boundary,
            issues: functionIssues,
            severity: this.calculateClusterSeverity(functionIssues),
            hotspotScore: this.calculateHotspotScore(functionIssues, boundary),
            correlationStrength: this.calculateCorrelationStrength(functionIssues)
          });
        }
      }
    }

    return clusters.sort((a, b) => b.hotspotScore - a.hotspotScore);
  }

  public enhancedCorrelationGroups(
    issues: UnifiedIssue[],
    functions: FunctionCluster[]
  ): Array<{
    type: 'function' | 'proximity' | 'cross-function';
    issues: UnifiedIssue[];
    context: {
      functionName?: string;
      filePath: string;
      correlationReason: string;
      confidence: number;
    };
  }> {
    const groups: Array<{
      type: 'function' | 'proximity' | 'cross-function';
      issues: UnifiedIssue[];
      context: {
        functionName?: string;
        filePath: string;
        correlationReason: string;
        confidence: number;
      };
    }> = [];

    // Function-level groups
    for (const cluster of functions) {
      if (cluster.issues.length > 1) {
        groups.push({
          type: 'function',
          issues: cluster.issues,
          context: {
            functionName: cluster.boundary.functionName,
            filePath: cluster.boundary.filePath,
            correlationReason: `Issues within function ${cluster.boundary.functionName}`,
            confidence: cluster.correlationStrength
          }
        });
      }
    }

    // Cross-function correlation (same file, different functions with similar issues)
    const remainingIssues = this.getRemainingIssues(issues, functions);
    const crossFunctionGroups = this.findCrossFunctionCorrelations(remainingIssues, functions);
    groups.push(...crossFunctionGroups);

    // Proximity-based for unclustered issues
    const unclustered = this.getUnclusteredIssues(remainingIssues, crossFunctionGroups);
    const proximityGroups = this.createProximityGroups(unclustered);
    groups.push(...proximityGroups);

    return groups;
  }

  private initializeParsers(): void {
    // TypeScript/JavaScript Parser
    this.parsers.set('typescript', {
      language: 'typescript',
      patterns: {
        functionDeclaration: [
          /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm,
          /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/gm,
          /^\s*(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/gm
        ],
        classDeclaration: [
          /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/gm
        ],
        methodDeclaration: [
          /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm
        ],
        scopeMarkers: {
          open: ['{'],
          close: ['}']
        }
      },
      parseFunctions: (content: string, filePath: string) => this.parseTypeScriptFunctions(content, filePath)
    });

    // Java Parser
    this.parsers.set('java', {
      language: 'java',
      patterns: {
        functionDeclaration: [],
        classDeclaration: [
          /^\s*(?:public|private|protected)?\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/gm
        ],
        methodDeclaration: [
          /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(\w+|\w+<[^>]+>)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm
        ],
        scopeMarkers: {
          open: ['{'],
          close: ['}']
        }
      },
      parseFunctions: (content: string, filePath: string) => this.parseJavaFunctions(content, filePath)
    });

    // Python Parser
    this.parsers.set('python', {
      language: 'python',
      patterns: {
        functionDeclaration: [
          /^\s*(?:async\s+)?def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/gm
        ],
        classDeclaration: [
          /^\s*class\s+(\w+)(?:\([^)]*\))?\s*:/gm
        ],
        methodDeclaration: [
          /^\s*(?:async\s+)?def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/gm
        ],
        scopeMarkers: {
          open: [':'],
          close: [] // Python uses indentation
        }
      },
      parseFunctions: (content: string, filePath: string) => this.parsePythonFunctions(content, filePath)
    });

    // C# Parser
    this.parsers.set('csharp', {
      language: 'csharp',
      patterns: {
        functionDeclaration: [],
        classDeclaration: [
          /^\s*(?:public|private|protected|internal)?\s*(?:abstract\s+)?(?:sealed\s+)?(?:partial\s+)?class\s+(\w+)(?:\s*:\s*[\w,\s]+)?\s*\{/gm
        ],
        methodDeclaration: [
          /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:abstract\s+)?(?:override\s+)?(?:async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*\{/gm
        ],
        scopeMarkers: {
          open: ['{'],
          close: ['}']
        }
      },
      parseFunctions: (content: string, filePath: string) => this.parseCSharpFunctions(content, filePath)
    });
  }

  private parseTypeScriptFunctions(content: string, filePath: string): FunctionBoundary[] {
    const boundaries: FunctionBoundary[] = [];
    const lines = content.split('\n');

    // Function declarations
    const functionRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/;
    // Arrow functions
    const arrowFunctionRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>\s*\{/;
    // Method declarations
    const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match = line?.match(functionRegex) || line?.match(arrowFunctionRegex) || line?.match(methodRegex);

      if (match && line) {
        const functionName = match[1] || 'anonymous';
        const parameters = match[2] ? match[2].split(',').map(p => p.trim()) : [];
        const returnType = match[3] ? match[3].trim() : undefined;
        const endLine = this.findMatchingBrace(lines, i);

        boundaries.push({
          functionName,
          filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          parameters,
          returnType,
          isMethod: line.includes('class') || /^\s*(?:public|private|protected)/.test(line),
          isStatic: line.includes('static'),
          visibility: this.extractVisibility(line)
        });
      }
    }

    return boundaries;
  }

  private parseJavaFunctions(content: string, filePath: string): FunctionBoundary[] {
    const boundaries: FunctionBoundary[] = [];
    const lines = content.split('\n');

    const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const match = line.match(methodRegex);

      if (match) {
        const returnType = match[1] || 'void';
        const functionName = match[2] || 'anonymous';
        const parameters = match[3] ? match[3].split(',').map(p => p.trim()) : [];
        const endLine = this.findMatchingBrace(lines, i);

        boundaries.push({
          functionName,
          filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          parameters,
          returnType,
          isMethod: true,
          isStatic: line.includes('static'),
          visibility: this.extractVisibility(line)
        });
      }
    }

    return boundaries;
  }

  private parsePythonFunctions(content: string, filePath: string): FunctionBoundary[] {
    const boundaries: FunctionBoundary[] = [];
    const lines = content.split('\n');

    const functionRegex = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const match = line.match(functionRegex);

      if (match) {
        const functionName = match[1] || 'anonymous';
        const parameters = match[2] ? match[2].split(',').map(p => p.trim()) : [];
        const returnType = match[3] ? match[3].trim() : undefined;
        const endLine = this.findPythonFunctionEnd(lines, i);

        boundaries.push({
          functionName,
          filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          parameters,
          returnType,
          isMethod: this.isInClass(lines, i),
          isStatic: line.includes('@staticmethod'),
          visibility: this.extractPythonVisibility(functionName)
        });
      }
    }

    return boundaries;
  }

  private parseCSharpFunctions(content: string, filePath: string): FunctionBoundary[] {
    const boundaries: FunctionBoundary[] = [];
    const lines = content.split('\n');

    const methodRegex = /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:abstract\s+)?(?:override\s+)?(?:async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const match = line.match(methodRegex);

      if (match) {
        const returnType = match[1] || 'void';
        const functionName = match[2] || 'anonymous';
        const parameters = match[3] ? match[3].split(',').map(p => p.trim()) : [];
        const endLine = this.findMatchingBrace(lines, i);

        boundaries.push({
          functionName,
          filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          parameters,
          returnType,
          isMethod: true,
          isStatic: line.includes('static'),
          visibility: this.extractVisibility(line)
        });
      }
    }

    return boundaries;
  }

  private findMatchingBrace(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i;
          }
        }
      }
    }

    return lines.length - 1;
  }

  private findPythonFunctionEnd(lines: string[], startLine: number): number {
    const startingLine = lines[startLine];
    if (!startingLine) return startLine;

    const baseIndentation = this.getIndentation(startingLine);

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line.trim() === '') continue;

      const currentIndentation = this.getIndentation(line);
      if (currentIndentation <= baseIndentation) {
        return i - 1;
      }
    }

    return lines.length - 1;
  }

  private getIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match && match[1] ? match[1].length : 0;
  }

  private isInClass(lines: string[], lineIndex: number): boolean {
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;

      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('class ')) return true;
      if (trimmedLine.startsWith('def ') && this.getIndentation(line) === 0) return false;
    }
    return false;
  }

  private extractVisibility(line: string): 'public' | 'private' | 'protected' | 'internal' | 'unknown' {
    if (line.includes('private')) return 'private';
    if (line.includes('protected')) return 'protected';
    if (line.includes('internal')) return 'internal';
    if (line.includes('public')) return 'public';
    return 'unknown';
  }

  private extractPythonVisibility(functionName: string): 'public' | 'private' | 'protected' | 'internal' | 'unknown' {
    if (functionName.startsWith('__') && functionName.endsWith('__')) return 'public'; // magic methods
    if (functionName.startsWith('__')) return 'private';
    if (functionName.startsWith('_')) return 'protected';
    return 'public';
  }

  private getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }

  private mapExtensionToLanguage(extension: string): string {
    const mapping: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'typescript',
      'jsx': 'typescript',
      'java': 'java',
      'py': 'python',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php'
    };

    return mapping[extension] || 'generic';
  }

  private createGenericBoundary(content: string, filePath: string): FunctionBoundary[] {
    // Fallback: treat entire file as one function
    const lines = content.split('\n');
    return [{
      functionName: 'file-scope',
      filePath,
      startLine: 1,
      endLine: lines.length,
      parameters: [],
      isMethod: false,
      isStatic: false,
      visibility: 'unknown'
    }];
  }

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

  private findIssuesInFunction(issues: UnifiedIssue[], boundary: FunctionBoundary): UnifiedIssue[] {
    return issues.filter(issue => {
      const line = issue.line;
      return line !== null && line >= boundary.startLine && line <= boundary.endLine;
    });
  }

  private calculateClusterSeverity(issues: UnifiedIssue[]): 'high' | 'medium' | 'low' {
    const highSeverityCount = issues.filter(i => i.severity === 'high' || i.severity === 'critical').length;
    const total = issues.length;

    if (highSeverityCount / total > 0.5) return 'high';
    if (highSeverityCount / total > 0.2) return 'medium';
    return 'low';
  }

  private calculateHotspotScore(issues: UnifiedIssue[], boundary: FunctionBoundary): number {
    const severityWeights = { critical: 10, high: 8, medium: 5, low: 2, info: 1 };
    const baseScore = issues.reduce((sum, issue) => sum + (severityWeights[issue.severity] || 1), 0);

    // Boost score for functions with high issue density
    const issuesPerLine = issues.length / (boundary.endLine - boundary.startLine + 1);
    const densityMultiplier = Math.min(3, 1 + issuesPerLine * 10);

    // Boost score for functions with multiple tool detections
    const uniqueTools = new Set(issues.map(i => i.toolName)).size;
    const toolMultiplier = 1 + (uniqueTools - 1) * 0.3;

    return Math.round(baseScore * densityMultiplier * toolMultiplier);
  }

  private calculateCorrelationStrength(issues: UnifiedIssue[]): number {
    if (issues.length < 2) return 0;

    // Calculate similarity between issues in the same function
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < issues.length; i++) {
      for (let j = i + 1; j < issues.length; j++) {
        const issueA = issues[i];
        const issueB = issues[j];
        if (!issueA || !issueB) continue;

        const similarity = this.calculateIssueSimilarity(issueA, issueB);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateIssueSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    let similarity = 0;

    // Rule similarity
    if (issue1.ruleId === issue2.ruleId) similarity += 0.4;

    // Analysis type similarity (as proxy for category)
    if (issue1.analysisType === issue2.analysisType) similarity += 0.3;

    // Proximity similarity (within same function)
    if (issue1.line && issue2.line) {
      const lineDistance = Math.abs(issue1.line - issue2.line);
      const proximityScore = Math.max(0, 1 - lineDistance / 20); // Decay over 20 lines
      similarity += proximityScore * 0.3;
    }

    return Math.min(1, similarity);
  }

  private getRemainingIssues(allIssues: UnifiedIssue[], clusters: FunctionCluster[]): UnifiedIssue[] {
    const clusteredIssues = new Set();
    for (const cluster of clusters) {
      for (const issue of cluster.issues) {
        clusteredIssues.add(issue);
      }
    }

    return allIssues.filter(issue => !clusteredIssues.has(issue));
  }

  private findCrossFunctionCorrelations(
    issues: UnifiedIssue[],
    clusters: FunctionCluster[]
  ): Array<{
    type: 'cross-function';
    issues: UnifiedIssue[];
    context: {
      filePath: string;
      correlationReason: string;
      confidence: number;
    };
  }> {
    // Implementation for cross-function correlations
    // Group by rule/category across different functions in same file
    return [];
  }

  private getUnclusteredIssues(
    remainingIssues: UnifiedIssue[],
    crossFunctionGroups: any[]
  ): UnifiedIssue[] {
    const groupedIssues = new Set();
    for (const group of crossFunctionGroups) {
      for (const issue of group.issues) {
        groupedIssues.add(issue);
      }
    }

    return remainingIssues.filter(issue => !groupedIssues.has(issue));
  }

  private createProximityGroups(issues: UnifiedIssue[]): Array<{
    type: 'proximity';
    issues: UnifiedIssue[];
    context: {
      filePath: string;
      correlationReason: string;
      confidence: number;
    };
  }> {
    // Implementation for basic proximity grouping
    return [];
  }
}