/**
 * Enhanced Correlation Engine - Function-Level Clustering
 *
 * Builds on the smart deduplication engine to provide function-level
 * issue clustering and enhanced correlation analysis.
 *
 * Created: 2025-09-19
 * Author: Claude Code Analysis
 */

import {
  UnifiedIssue,
  UnifiedEntity,
  UnifiedEntityParams,
  IssueSeverity,
  AnalysisType,
  UnifiedIssueParams
} from '@topolop/shared-types';

import {
  SmartDeduplicationEngine,
  DuplicateGroup
} from './deduplication-engine';

export interface SimpleFunctionBoundary {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface FunctionCluster {
  boundary: SimpleFunctionBoundary;
  issues: UnifiedIssue[];
  hotspotScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CorrelationResult {
  functionClusters: FunctionCluster[];
  crossFunctionGroups: Array<{
    issues: UnifiedIssue[];
    reason: string;
    confidence: number;
  }>;
  proximityGroups: Array<{
    issues: UnifiedIssue[];
    filePath: string;
    lineRange: { start: number; end: number };
  }>;
  statistics: {
    totalIssues: number;
    clusteredIssues: number;
    functionsAnalyzed: number;
    hotspotFunctions: number;
  };
}

/**
 * Enhanced Correlation Engine with Function-Level Analysis
 */
export class EnhancedCorrelationEngine {
  private deduplicationEngine: SmartDeduplicationEngine;

  constructor() {
    this.deduplicationEngine = new SmartDeduplicationEngine();
  }

  /**
   * Analyze issues with function-level clustering
   */
  public analyzeCorrelations(
    issues: UnifiedIssue[],
    fileContents?: Map<string, string>
  ): CorrelationResult {
    // First deduplicate issues
    const dedupResult = this.deduplicationEngine.deduplicateIssues(issues);
    const cleanIssues = dedupResult.deduplicatedIssues;

    // Parse function boundaries if file contents provided
    const functionBoundaries = fileContents
      ? this.parseBasicFunctionBoundaries(fileContents)
      : this.createFileLevelBoundaries(cleanIssues);

    // Cluster issues by function
    const functionClusters = this.clusterIssuesByFunction(cleanIssues, functionBoundaries);

    // Find cross-function correlations
    const crossFunctionGroups = this.findCrossFunctionCorrelations(cleanIssues, functionClusters);

    // Group remaining issues by proximity
    const proximityGroups = this.createProximityGroups(cleanIssues, functionClusters);

    const statistics = {
      totalIssues: issues.length,
      clusteredIssues: dedupResult.statistics.deduplicatedCount,
      functionsAnalyzed: functionBoundaries.length,
      hotspotFunctions: functionClusters.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length
    };

    return {
      functionClusters,
      crossFunctionGroups,
      proximityGroups,
      statistics
    };
  }

  /**
   * Parse basic function boundaries from file contents
   */
  private parseBasicFunctionBoundaries(fileContents: Map<string, string>): SimpleFunctionBoundary[] {
    const boundaries: SimpleFunctionBoundary[] = [];

    for (const [filePath, content] of fileContents) {
      const lines = content.split('\n');
      const fileBoundaries = this.parseFileFunctions(lines, filePath);
      boundaries.push(...fileBoundaries);
    }

    return boundaries;
  }

  /**
   * Simple function parsing for TypeScript/JavaScript
   */
  private parseFileFunctions(lines: string[], filePath: string): SimpleFunctionBoundary[] {
    const boundaries: SimpleFunctionBoundary[] = [];

    // Basic patterns for function detection
    const functionPatterns = [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,  // function declarations
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,  // arrow functions
      /^\s*(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\(/  // method declarations
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const functionName = match[1];
          const startLine = i + 1;
          const endLine = this.findFunctionEnd(lines, i);

          boundaries.push({
            name: functionName,
            filePath,
            startLine,
            endLine
          });
          break;
        }
      }
    }

    return boundaries;
  }

  /**
   * Find function end by counting braces
   */
  private findFunctionEnd(lines: string[], startLine: number): number {
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
            return i + 1;
          }
        }
      }
    }

    return lines.length;
  }

  /**
   * Create file-level boundaries when no content provided
   */
  private createFileLevelBoundaries(issues: UnifiedIssue[]): SimpleFunctionBoundary[] {
    const fileMap = new Map<string, { minLine: number; maxLine: number }>();

    for (const issue of issues) {
      const filePath = issue.entity.canonicalPath;
      const line = issue.line ?? 1;

      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, { minLine: line, maxLine: line });
      } else {
        const existing = fileMap.get(filePath)!;
        existing.minLine = Math.min(existing.minLine, line);
        existing.maxLine = Math.max(existing.maxLine, line);
      }
    }

    return Array.from(fileMap.entries()).map(([filePath, range]) => ({
      name: 'file-scope',
      filePath,
      startLine: range.minLine,
      endLine: range.maxLine
    }));
  }

  /**
   * Cluster issues by function boundaries
   */
  private clusterIssuesByFunction(
    issues: UnifiedIssue[],
    boundaries: SimpleFunctionBoundary[]
  ): FunctionCluster[] {
    const clusters: FunctionCluster[] = [];

    for (const boundary of boundaries) {
      const functionIssues = issues.filter(issue => {
        if (issue.entity.canonicalPath !== boundary.filePath) return false;
        if (issue.line === null || issue.line === undefined) return false;
        return issue.line >= boundary.startLine && issue.line <= boundary.endLine;
      });

      if (functionIssues.length > 0) {
        const hotspotScore = this.calculateHotspotScore(functionIssues, boundary);
        const riskLevel = this.calculateRiskLevel(hotspotScore);

        clusters.push({
          boundary,
          issues: functionIssues,
          hotspotScore,
          riskLevel
        });
      }
    }

    return clusters.sort((a, b) => b.hotspotScore - a.hotspotScore);
  }

  /**
   * Calculate hotspot score for a function
   */
  private calculateHotspotScore(issues: UnifiedIssue[], boundary: SimpleFunctionBoundary): number {
    const severityWeights = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
      info: 1
    };

    const baseScore = issues.reduce((sum, issue) => {
      return sum + (severityWeights[issue.severity] || 1);
    }, 0);

    // Factor in issue density
    const functionLines = boundary.endLine - boundary.startLine + 1;
    const density = issues.length / functionLines;
    const densityMultiplier = Math.min(3, 1 + density * 10);

    // Factor in tool diversity
    const uniqueTools = new Set(issues.map(i => i.toolName)).size;
    const toolMultiplier = 1 + (uniqueTools - 1) * 0.3;

    return Math.round(baseScore * densityMultiplier * toolMultiplier);
  }

  /**
   * Calculate risk level from hotspot score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  /**
   * Find issues that correlate across different functions
   */
  private findCrossFunctionCorrelations(
    issues: UnifiedIssue[],
    clusters: FunctionCluster[]
  ): Array<{
    issues: UnifiedIssue[];
    reason: string;
    confidence: number;
  }> {
    const correlations: Array<{
      issues: UnifiedIssue[];
      reason: string;
      confidence: number;
    }> = [];

    // Group by rule ID across different functions
    const ruleGroups = new Map<string, UnifiedIssue[]>();

    for (const issue of issues) {
      if (!ruleGroups.has(issue.ruleId)) {
        ruleGroups.set(issue.ruleId, []);
      }
      ruleGroups.get(issue.ruleId)!.push(issue);
    }

    for (const [ruleId, ruleIssues] of ruleGroups) {
      if (ruleIssues.length >= 2) {
        // Check if issues span multiple functions
        const functions = new Set(
          ruleIssues.map(issue => this.findFunctionForIssue(issue, clusters))
        );

        if (functions.size > 1) {
          correlations.push({
            issues: ruleIssues,
            reason: `Same rule violation (${ruleId}) across ${functions.size} functions`,
            confidence: 0.8
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Find which function contains an issue
   */
  private findFunctionForIssue(issue: UnifiedIssue, clusters: FunctionCluster[]): string {
    for (const cluster of clusters) {
      if (cluster.issues.includes(issue)) {
        return `${cluster.boundary.filePath}:${cluster.boundary.name}`;
      }
    }
    return `${issue.entity.canonicalPath}:unknown`;
  }

  /**
   * Create proximity groups for unclustered issues
   */
  private createProximityGroups(
    issues: UnifiedIssue[],
    clusters: FunctionCluster[]
  ): Array<{
    issues: UnifiedIssue[];
    filePath: string;
    lineRange: { start: number; end: number };
  }> {
    // Get issues not already in function clusters
    const clusteredIssues = new Set<UnifiedIssue>();
    for (const cluster of clusters) {
      for (const issue of cluster.issues) {
        clusteredIssues.add(issue);
      }
    }

    const unclusteredIssues = issues.filter(issue => !clusteredIssues.has(issue));

    // Group by file and proximity
    const fileGroups = new Map<string, UnifiedIssue[]>();
    for (const issue of unclusteredIssues) {
      const filePath = issue.entity.canonicalPath;
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath)!.push(issue);
    }

    const proximityGroups: Array<{
      issues: UnifiedIssue[];
      filePath: string;
      lineRange: { start: number; end: number };
    }> = [];

    for (const [filePath, fileIssues] of fileGroups) {
      if (fileIssues.length >= 2) {
        // Sort by line number
        const sortedIssues = fileIssues
          .filter(issue => issue.line !== null && issue.line !== undefined)
          .sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

        if (sortedIssues.length >= 2) {
          const firstIssue = sortedIssues[0];
          const lastIssue = sortedIssues[sortedIssues.length - 1];
          const startLine = firstIssue?.line ?? 1;
          const endLine = lastIssue?.line ?? 1;

          proximityGroups.push({
            issues: sortedIssues,
            filePath,
            lineRange: { start: startLine, end: endLine }
          });
        }
      }
    }

    return proximityGroups;
  }

  /**
   * Get top function hotspots with recommendations
   */
  public getTopHotspots(
    correlationResult: CorrelationResult,
    limit: number = 5
  ): Array<{
    function: SimpleFunctionBoundary;
    issues: UnifiedIssue[];
    hotspotScore: number;
    riskLevel: string;
    recommendations: string[];
  }> {
    return correlationResult.functionClusters
      .slice(0, limit)
      .map(cluster => ({
        function: cluster.boundary,
        issues: cluster.issues,
        hotspotScore: cluster.hotspotScore,
        riskLevel: cluster.riskLevel,
        recommendations: this.generateRecommendations(cluster)
      }));
  }

  /**
   * Generate recommendations for a function cluster
   */
  private generateRecommendations(cluster: FunctionCluster): string[] {
    const recommendations: string[] = [];
    const { issues, boundary } = cluster;

    // High issue count
    if (issues.length >= 5) {
      recommendations.push(`Review ${boundary.name} - contains ${issues.length} issues`);
    }

    // High severity issues
    const highSeverityCount = issues.filter(i =>
      i.severity === 'critical' || i.severity === 'high'
    ).length;

    if (highSeverityCount >= 2) {
      recommendations.push(`Priority: ${highSeverityCount} high/critical issues need immediate attention`);
    }

    // Security issues
    const securityCount = issues.filter(i =>
      i.analysisType === 'security' || i.ruleId.toLowerCase().includes('security')
    ).length;

    if (securityCount > 0) {
      recommendations.push(`Security review needed - ${securityCount} security issues detected`);
    }

    // Multiple tools
    const toolCount = new Set(issues.map(i => i.toolName)).size;
    if (toolCount >= 3) {
      recommendations.push(`Multiple analysis tools flagged this function - consider refactoring`);
    }

    return recommendations;
  }
}