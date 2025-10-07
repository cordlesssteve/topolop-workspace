/**
 * Smart Deduplication Engine for Enhanced Correlation v2.0
 *
 * Identifies and merges similar/duplicate issues from multiple analysis tools
 * to reduce noise and provide cleaner correlation results.
 *
 * Created: 2025-09-19
 * Author: Claude Code Analysis
 */

import {
  UnifiedIssue,
  UnifiedEntity,
  IssueSeverity,
  AnalysisType,
  UnifiedIssueParams,
  IssueMetadata
} from '@topolop/shared-types';

import {
  FunctionBoundaryParser,
  FunctionBoundary,
  FunctionCluster
} from './function-boundary-parser';

/**
 * Similarity threshold configuration for different match types
 */
export interface SimilarityThresholds {
  exactMatch: number;        // 1.0 = identical
  nearMatch: number;         // 0.8-0.99 = very similar
  relatedMatch: number;      // 0.6-0.79 = related/family
  weakMatch: number;         // 0.4-0.59 = possibly related
}

/**
 * Confidence factors for deduplication decisions
 */
export interface DeduplicationConfidence {
  overall: number;           // 0-1 overall confidence
  factors: {
    pathSimilarity: number;  // Same/similar file paths
    lineSimilarity: number;  // Same/nearby line numbers
    ruleSimilarity: number;  // Same/related rules
    messageSimilarity: number; // Similar message content
    toolReliability: number; // Tool reputation weighting
    contextSimilarity: number; // Code context similarity
  };
  evidenceStrength: 'weak' | 'moderate' | 'strong' | 'definitive';
}

/**
 * Result of deduplication analysis
 */
export interface DuplicateGroup {
  id: string;
  primaryIssue: UnifiedIssue;      // Best/highest quality issue to keep
  duplicateIssues: UnifiedIssue[]; // Issues to merge into primary
  confidence: DeduplicationConfidence;
  mergeStrategy: 'keep_primary' | 'merge_metadata' | 'aggregate_scores';
  preservedEvidence: IssueMetadata; // Combined evidence from all sources
}

/**
 * Smart Deduplication Engine with Function-Level Clustering
 */
export class SmartDeduplicationEngine {
  private readonly thresholds: SimilarityThresholds = {
    exactMatch: 1.0,
    nearMatch: 0.85,
    relatedMatch: 0.65,
    weakMatch: 0.45
  };

  private readonly toolReliabilityWeights: Map<string, number> = new Map([
    ['sonarqube', 0.9],      // High reliability, enterprise-grade
    ['semgrep', 0.85],       // High reliability, security focus
    ['codeql', 0.9],         // High reliability, GitHub backing
    ['veracode', 0.88],      // High reliability, enterprise security
    ['checkmarx', 0.87],     // High reliability, comprehensive SAST
    ['deepsource', 0.82],    // Good reliability, AI-powered
    ['codeclimate', 0.8],    // Good reliability, maintainability focus
    ['codacy', 0.75],        // Moderate reliability, broad coverage
  ]);

  private readonly functionParser: FunctionBoundaryParser;

  constructor(customThresholds?: Partial<SimilarityThresholds>) {
    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds };
    }
    this.functionParser = new FunctionBoundaryParser();
  }

  /**
   * Find and group duplicate/similar issues
   */
  public findDuplicateGroups(issues: UnifiedIssue[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < issues.length; i++) {
      if (processed.has(issues[i]?.id || '')) continue;

      const primaryIssue = issues[i];
      if (!primaryIssue) continue;

      const duplicates: UnifiedIssue[] = [];

      // Find all similar issues
      for (let j = i + 1; j < issues.length; j++) {
        if (processed.has(issues[j]?.id || '')) continue;

        const currentIssue = issues[j];
        if (!currentIssue) continue;

        const similarity = this.calculateSimilarity(primaryIssue, currentIssue);

        if (similarity.overall >= this.thresholds.nearMatch) {
          duplicates.push(currentIssue);
          processed.add(currentIssue.id);
        }
      }

      // If we found duplicates, create a group
      if (duplicates.length > 0) {
        const group = this.createDuplicateGroup(primaryIssue, duplicates);
        groups.push(group);
        processed.add(primaryIssue?.id || '');
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two issues
   */
  private calculateSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): DeduplicationConfidence {
    const factors = {
      pathSimilarity: this.calculatePathSimilarity(issue1, issue2),
      lineSimilarity: this.calculateLineSimilarity(issue1, issue2),
      ruleSimilarity: this.calculateRuleSimilarity(issue1, issue2),
      messageSimilarity: this.calculateMessageSimilarity(issue1, issue2),
      toolReliability: this.calculateToolReliability(issue1, issue2),
      contextSimilarity: this.calculateContextSimilarity(issue1, issue2)
    };

    // Weighted overall similarity calculation
    const weights = {
      pathSimilarity: 0.25,    // Same file is very important
      lineSimilarity: 0.20,    // Proximity matters
      ruleSimilarity: 0.20,    // Same rule family
      messageSimilarity: 0.15, // Similar description
      toolReliability: 0.10,   // Tool quality
      contextSimilarity: 0.10  // Code context
    };

    const overall = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);

    const evidenceStrength = this.determineEvidenceStrength(overall, factors);

    return {
      overall,
      factors,
      evidenceStrength
    };
  }

  /**
   * Calculate path similarity (same file = high, same directory = medium, etc.)
   */
  private calculatePathSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    const path1 = issue1.entity.canonicalPath;
    const path2 = issue2.entity.canonicalPath;

    if (path1 === path2) return 1.0; // Exact same file

    const parts1 = path1.split('/');
    const parts2 = path2.split('/');

    // Calculate Jaccard similarity for path components
    const intersection = parts1.filter(part => parts2.includes(part)).length;
    const union = new Set([...parts1, ...parts2]).size;

    return intersection / union;
  }

  /**
   * Calculate line proximity similarity
   */
  private calculateLineSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    if (!issue1.line || !issue2.line) return 0.5; // No line info = neutral

    if (issue1.entity.canonicalPath !== issue2.entity.canonicalPath) return 0; // Different files

    const distance = Math.abs(issue1.line - issue2.line);

    if (distance === 0) return 1.0;           // Same line
    if (distance <= 3) return 0.9;           // Very close
    if (distance <= 10) return 0.7;          // Close
    if (distance <= 50) return 0.4;          // Same general area
    return 0.1;                              // Far apart
  }

  /**
   * Calculate rule similarity (same rule ID, rule family, CWE, etc.)
   */
  private calculateRuleSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    if (issue1.ruleId === issue2.ruleId) return 1.0; // Exact same rule

    // Check for rule family patterns (e.g., javascript:S2703 vs javascript:S2704)
    const rule1Base = issue1.ruleId.split(':')[0] || issue1.ruleId;
    const rule2Base = issue2.ruleId.split(':')[0] || issue2.ruleId;

    if (rule1Base === rule2Base) return 0.8; // Same tool/category

    // Check for CWE/OWASP similarity in metadata
    const cwe1 = this.extractCWE(issue1);
    const cwe2 = this.extractCWE(issue2);

    if (cwe1 && cwe2 && cwe1 === cwe2) return 0.7; // Same CWE

    // Check analysis type similarity
    if (issue1.analysisType === issue2.analysisType) return 0.5;

    return 0.2; // Different rule families
  }

  /**
   * Calculate message text similarity using simple overlap
   */
  private calculateMessageSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    const msg1 = issue1.description.toLowerCase();
    const msg2 = issue2.description.toLowerCase();

    if (msg1 === msg2) return 1.0; // Identical messages

    // Simple word overlap calculation
    const words1 = new Set(msg1.split(/\s+/));
    const words2 = new Set(msg2.split(/\s+/));

    const intersection = [...words1].filter(word => words2.has(word)).length;
    const union = new Set([...words1, ...words2]).size;

    return intersection / Math.max(union, 1);
  }

  /**
   * Calculate tool reliability factor
   */
  private calculateToolReliability(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    const weight1 = this.toolReliabilityWeights.get(issue1.toolName) || 0.5;
    const weight2 = this.toolReliabilityWeights.get(issue2.toolName) || 0.5;

    return (weight1 + weight2) / 2;
  }

  /**
   * Calculate code context similarity (placeholder for future AST integration)
   */
  private calculateContextSimilarity(issue1: UnifiedIssue, issue2: UnifiedIssue): number {
    // For now, use severity similarity as proxy for context
    const severityOrder = {
      [IssueSeverity.CRITICAL]: 5,
      [IssueSeverity.HIGH]: 4,
      [IssueSeverity.MEDIUM]: 3,
      [IssueSeverity.LOW]: 2,
      [IssueSeverity.INFO]: 1
    };

    const diff = Math.abs(severityOrder[issue1.severity] - severityOrder[issue2.severity]);
    return Math.max(0, (5 - diff) / 5);
  }

  /**
   * Extract CWE number from issue metadata
   */
  private extractCWE(issue: UnifiedIssue): string | null {
    const metadata = issue.metadata;

    // Check various metadata fields for CWE references
    const cweFields = ['cwe', 'cweId', 'cweNumber', 'tags', 'categories'];

    for (const field of cweFields) {
      const value = metadata[field];
      if (typeof value === 'string' && value.includes('CWE-')) {
        const match = value.match(/CWE-(\d+)/);
        if (match) return match[1] || null;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.includes('CWE-')) {
            const match = item.match(/CWE-(\d+)/);
            if (match) return match[1] || null;
          }
        }
      }
    }

    return null;
  }

  /**
   * Determine evidence strength based on similarity scores
   */
  private determineEvidenceStrength(
    overall: number,
    factors: DeduplicationConfidence['factors']
  ): 'weak' | 'moderate' | 'strong' | 'definitive' {
    if (overall >= 0.95) return 'definitive';
    if (overall >= 0.85) return 'strong';
    if (overall >= 0.65) return 'moderate';
    return 'weak';
  }

  /**
   * Create a duplicate group with merge strategy
   */
  private createDuplicateGroup(primary: UnifiedIssue, duplicates: UnifiedIssue[]): DuplicateGroup {
    const allIssues = [primary, ...duplicates];

    // Calculate average confidence across all pairs
    let totalConfidence = 0;
    let pairCount = 0;

    for (let i = 0; i < allIssues.length; i++) {
      for (let j = i + 1; j < allIssues.length; j++) {
        const issueA = allIssues[i];
        const issueB = allIssues[j];
        if (issueA && issueB) {
          totalConfidence += this.calculateSimilarity(issueA, issueB).overall;
        }
        pairCount++;
      }
    }

    const avgConfidence = totalConfidence / pairCount;

    // Select best issue as primary (highest tool reliability + severity)
    const bestIssue = this.selectBestIssue(allIssues);
    if (!bestIssue) {
      throw new Error('No best issue found in duplicate group');
    }
    const otherIssues = allIssues.filter(issue => issue.id !== bestIssue.id);

    const firstOther = otherIssues[0];
    const confidence = firstOther ? this.calculateSimilarity(bestIssue, firstOther) : {
      overall: 1.0,
      factors: {
        pathSimilarity: 1.0,
        lineSimilarity: 1.0,
        ruleSimilarity: 1.0,
        messageSimilarity: 1.0,
        toolReliability: 1.0,
        contextSimilarity: 1.0
      },
      evidenceStrength: 'definitive' as const
    };

    return {
      id: `dedup-group-${bestIssue.id}`,
      primaryIssue: bestIssue,
      duplicateIssues: otherIssues,
      confidence,
      mergeStrategy: this.determineMergeStrategy(confidence),
      preservedEvidence: this.combineEvidence(allIssues)
    };
  }

  /**
   * Select the best issue to keep as primary
   */
  private selectBestIssue(issues: UnifiedIssue[]): UnifiedIssue {
    return issues.reduce((best, current) => {
      const bestReliability = this.toolReliabilityWeights.get(best.toolName) || 0.5;
      const currentReliability = this.toolReliabilityWeights.get(current.toolName) || 0.5;

      // Prefer higher tool reliability
      if (currentReliability > bestReliability) return current;
      if (bestReliability > currentReliability) return best;

      // If same reliability, prefer higher severity
      const severityOrder = {
        [IssueSeverity.CRITICAL]: 5,
        [IssueSeverity.HIGH]: 4,
        [IssueSeverity.MEDIUM]: 3,
        [IssueSeverity.LOW]: 2,
        [IssueSeverity.INFO]: 1
      };

      if (severityOrder[current.severity] > severityOrder[best.severity]) return current;

      return best;
    });
  }

  /**
   * Determine merge strategy based on confidence
   */
  private determineMergeStrategy(confidence: DeduplicationConfidence): DuplicateGroup['mergeStrategy'] {
    if (confidence.overall >= 0.9) return 'merge_metadata';
    if (confidence.overall >= 0.7) return 'aggregate_scores';
    return 'keep_primary';
  }

  /**
   * Combine evidence from all issues in the group
   */
  private combineEvidence(issues: UnifiedIssue[]): IssueMetadata {
    const combined: IssueMetadata = {
      combinedFrom: issues.map(i => ({
        toolName: i.toolName,
        originalId: i.id,
        originalSeverity: i.severity,
        originalRule: i.ruleId
      })),
      allTools: Array.from(new Set(issues.map(i => i.toolName))),
      consensusSeverity: this.calculateConsensusSeverity(issues),
      evidenceCount: issues.length
    };

    // Merge all original metadata
    for (const issue of issues) {
      const toolKey = `${issue.toolName}_metadata`;
      combined[toolKey] = issue.metadata;
    }

    return combined;
  }

  /**
   * Calculate consensus severity from multiple issues
   */
  private calculateConsensusSeverity(issues: UnifiedIssue[]): IssueSeverity {
    const severityOrder = {
      [IssueSeverity.CRITICAL]: 5,
      [IssueSeverity.HIGH]: 4,
      [IssueSeverity.MEDIUM]: 3,
      [IssueSeverity.LOW]: 2,
      [IssueSeverity.INFO]: 1
    };

    const reverseOrder = {
      5: IssueSeverity.CRITICAL,
      4: IssueSeverity.HIGH,
      3: IssueSeverity.MEDIUM,
      2: IssueSeverity.LOW,
      1: IssueSeverity.INFO
    };

    const avgSeverity = issues.reduce((sum, issue) => {
      return sum + severityOrder[issue.severity];
    }, 0) / issues.length;

    return reverseOrder[Math.round(avgSeverity) as keyof typeof reverseOrder];
  }

  /**
   * Enhanced correlation using function-level clustering
   */
  public buildEnhancedCorrelationGroups(
    issues: UnifiedIssue[],
    fileContents: Map<string, string>
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
    // Parse function boundaries for all files
    const allBoundaries: FunctionBoundary[] = [];
    for (const [filePath, content] of fileContents) {
      const boundaries = this.functionParser.parseFunctionsInFile(content, filePath);
      allBoundaries.push(...boundaries);
    }

    // Cluster issues by function
    const functionClusters = this.functionParser.clusterIssuesByFunction(issues, allBoundaries);

    // Build enhanced correlation groups using function awareness
    return this.functionParser.enhancedCorrelationGroups(issues, functionClusters);
  }

  /**
   * Get function-level hotspots with detailed analysis
   */
  public getFunctionHotspots(
    issues: UnifiedIssue[],
    fileContents: Map<string, string>
  ): Array<{
    function: FunctionBoundary;
    issues: UnifiedIssue[];
    severity: 'high' | 'medium' | 'low';
    hotspotScore: number;
    metrics: {
      issueCount: number;
      uniqueTools: number;
      avgSeverity: number;
      issuesPerLine: number;
      complexity?: number;
    };
    recommendations: string[];
  }> {
    // Parse function boundaries
    const allBoundaries: FunctionBoundary[] = [];
    for (const [filePath, content] of fileContents) {
      const boundaries = this.functionParser.parseFunctionsInFile(content, filePath);
      allBoundaries.push(...boundaries);
    }

    // Cluster issues by function
    const functionClusters = this.functionParser.clusterIssuesByFunction(issues, allBoundaries);

    // Convert to detailed hotspot analysis
    return functionClusters.map(cluster => {
      const uniqueTools = new Set(cluster.issues.map(i => i.toolName)).size;
      const functionLines = cluster.boundary.endLine - cluster.boundary.startLine + 1;
      const issuesPerLine = cluster.issues.length / functionLines;

      const severityScores = {
        critical: 5, high: 4, medium: 3, low: 2, info: 1
      };
      const avgSeverity = cluster.issues.reduce((sum, issue) => {
        return sum + (severityScores[issue.severity] || 1);
      }, 0) / cluster.issues.length;

      const recommendations = this.generateFunctionRecommendations(cluster);

      return {
        function: cluster.boundary,
        issues: cluster.issues,
        severity: cluster.severity,
        hotspotScore: cluster.hotspotScore,
        metrics: {
          issueCount: cluster.issues.length,
          uniqueTools,
          avgSeverity,
          issuesPerLine,
          complexity: cluster.boundary.complexity
        },
        recommendations
      };
    }).sort((a, b) => b.hotspotScore - a.hotspotScore);
  }

  /**
   * Generate specific recommendations for function-level issues
   */
  private generateFunctionRecommendations(cluster: FunctionCluster): string[] {
    const recommendations: string[] = [];
    const { boundary, issues } = cluster;

    // High issue density
    const functionLines = boundary.endLine - boundary.startLine + 1;
    const issuesPerLine = issues.length / functionLines;
    if (issuesPerLine > 0.2) {
      recommendations.push(`Consider refactoring ${boundary.functionName} - high issue density (${issues.length} issues in ${functionLines} lines)`);
    }

    // Multiple tool detections
    const uniqueTools = new Set(issues.map(i => i.toolName)).size;
    if (uniqueTools >= 3) {
      recommendations.push(`Multiple analysis tools flagged this function - review for fundamental design issues`);
    }

    // High severity concentration
    const highSeverityCount = issues.filter(i => i.severity === 'high' || i.severity === 'critical').length;
    if (highSeverityCount >= 2) {
      recommendations.push(`Contains ${highSeverityCount} high/critical issues - prioritize immediate review`);
    }

    // Security issues
    const securityIssues = issues.filter(i =>
      i.analysisType === 'security' ||
      i.ruleId.toLowerCase().includes('security')
    );
    if (securityIssues.length > 0) {
      recommendations.push(`Contains ${securityIssues.length} security issues - conduct security review`);
    }

    // Large function size
    if (functionLines > 100) {
      recommendations.push(`Large function (${functionLines} lines) - consider breaking into smaller functions`);
    }

    // Too many parameters
    if (boundary.parameters.length > 5) {
      recommendations.push(`High parameter count (${boundary.parameters.length}) - consider parameter object or builder pattern`);
    }

    return recommendations;
  }

  /**
   * Apply deduplication to a list of issues, returning cleaned list
   */
  public deduplicateIssues(issues: UnifiedIssue[]): {
    deduplicatedIssues: UnifiedIssue[];
    duplicateGroups: DuplicateGroup[];
    statistics: {
      originalCount: number;
      deduplicatedCount: number;
      duplicatesRemoved: number;
      groupsFound: number;
    };
  } {
    const groups = this.findDuplicateGroups(issues);
    const keptIssues = new Set<string>();
    const processedIssues: UnifiedIssue[] = [];

    // Process duplicate groups
    for (const group of groups) {
      // Create enhanced primary issue with combined evidence
      const enhancedPrimary = this.createEnhancedIssue(group);
      processedIssues.push(enhancedPrimary);

      // Mark all issues in group as processed
      keptIssues.add(group.primaryIssue.id);
      for (const duplicate of group.duplicateIssues) {
        keptIssues.add(duplicate.id);
      }
    }

    // Add non-duplicate issues
    for (const issue of issues) {
      if (!keptIssues.has(issue.id)) {
        processedIssues.push(issue);
      }
    }

    return {
      deduplicatedIssues: processedIssues,
      duplicateGroups: groups,
      statistics: {
        originalCount: issues.length,
        deduplicatedCount: processedIssues.length,
        duplicatesRemoved: issues.length - processedIssues.length,
        groupsFound: groups.length
      }
    };
  }

  /**
   * Create enhanced issue with combined evidence from duplicate group
   */
  private createEnhancedIssue(group: DuplicateGroup): UnifiedIssue {
    const primary = group.primaryIssue;

    return new UnifiedIssue({
      id: `${primary.id}-enhanced`,
      entity: primary.entity,
      severity: group.preservedEvidence.consensusSeverity as IssueSeverity || primary.severity,
      analysisType: primary.analysisType,
      title: primary.title,
      description: this.enhanceDescription(primary, group),
      ruleId: primary.ruleId,
      line: primary.line,
      column: primary.column,
      endLine: primary.endLine,
      endColumn: primary.endColumn,
      toolName: `${primary.toolName}+${group.duplicateIssues.length}`,
      metadata: {
        ...primary.metadata,
        ...group.preservedEvidence,
        deduplicationInfo: {
          confidence: group.confidence.overall,
          evidenceStrength: group.confidence.evidenceStrength,
          mergeStrategy: group.mergeStrategy,
          duplicatesFound: group.duplicateIssues.length
        }
      }
    });
  }

  /**
   * Enhance description with information about merged duplicates
   */
  private enhanceDescription(primary: UnifiedIssue, group: DuplicateGroup): string {
    const toolNames = [primary.toolName, ...group.duplicateIssues.map(d => d.toolName)];
    const uniqueTools = Array.from(new Set(toolNames));

    let enhanced = primary.description;

    if (uniqueTools.length > 1) {
      enhanced += ` (Consensus from ${uniqueTools.length} tools: ${uniqueTools.join(', ')})`;
    }

    return enhanced;
  }
}