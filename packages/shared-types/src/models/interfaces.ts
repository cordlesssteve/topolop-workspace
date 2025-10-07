/**
 * Topolop Phase 2: TRUE Unified Data Model Interfaces
 * 
 * Core interfaces for cross-tool data unification enabling real correlation
 * and hotspot detection across analysis tools.
 * 
 * Architecture: Adapter pattern preserves existing tool integrations while
 * building genuine unification through canonical entity identification.
 */

/**
 * Unified Entity constructor parameters
 */
export interface UnifiedEntityParams {
  id: string;
  type: string;
  name: string;
  canonicalPath: string;
}

/**
 * Canonical entity identification for cross-tool correlation
 * All tools normalize to relative-from-project-root paths
 */
export class UnifiedEntity {
  public id: string;
  public type: string;
  public name: string;
  public canonicalPath: string;        // "src/main/java/App.java" (universal)
  public originalIdentifier: string;   // Tool's native ID for debugging
  public toolName: string;             // Source tool name
  public confidence: number;           // Normalization confidence (0-1)

  constructor(params: UnifiedEntityParams);
  constructor(canonicalPath: string, originalIdentifier: string, toolName: string);
  constructor(
    paramsOrCanonicalPath: UnifiedEntityParams | string,
    originalIdentifier?: string,
    toolName?: string
  ) {
    if (typeof paramsOrCanonicalPath === 'string') {
      // Legacy constructor for backward compatibility
      this.canonicalPath = paramsOrCanonicalPath;
      this.originalIdentifier = originalIdentifier!;
      this.toolName = toolName!;
      this.confidence = 1.0;
      this.id = `entity-${this.canonicalPath}`;
      this.type = 'file';
      this.name = this.canonicalPath.split('/').pop() || this.canonicalPath;
    } else {
      // New constructor with parameters object
      this.id = paramsOrCanonicalPath.id;
      this.type = paramsOrCanonicalPath.type;
      this.name = paramsOrCanonicalPath.name;
      this.canonicalPath = paramsOrCanonicalPath.canonicalPath;
      this.originalIdentifier = this.canonicalPath;
      this.toolName = 'unified';
      this.confidence = 1.0;
    }
  }
}

/**
 * Issue severity mapping across all tools
 * Normalized to standard levels with tool-specific context preserved
 */
export enum IssueSeverity {
  CRITICAL = 'critical',    // Blocker/Critical/High-priority security issues
  HIGH = 'high',           // Major/High/Significant issues  
  MEDIUM = 'medium',       // Medium/Warning/Standard issues
  LOW = 'low',            // Minor/Low/Info issues
  INFO = 'info'           // Info/Note/Documentation issues
}

/**
 * Analysis type classification for filtering and correlation
 * Enables same-file clustering by analysis focus area
 * Extended in Phase 2 for workflow integration
 */
export enum AnalysisType {
  // Phase 1 types
  QUALITY = 'quality',         // Code quality, maintainability, technical debt
  SECURITY = 'security',       // Security vulnerabilities, SAST findings
  PERFORMANCE = 'performance', // Performance issues, optimization opportunities
  STYLE = 'style',            // Code style, formatting, conventions
  COMPLEXITY = 'complexity',   // Cyclomatic complexity, cognitive load
  SEMANTIC = 'semantic',       // Data flow, control flow, semantic analysis
  AI_POWERED = 'ai_powered',   // AI-generated insights, automated fixes

  // Phase 2 workflow integration types
  APM_PERFORMANCE = 'apm_performance',        // Application Performance Monitoring
  DEPENDENCY_SECURITY = 'dependency_security', // Supply chain security
  DEPENDENCY_LICENSING = 'dependency_licensing', // License compliance
  DEPENDENCY_USAGE = 'dependency_usage',       // Dependency usage analysis
  ARCHITECTURE_DESIGN = 'architecture_design', // Design patterns and architecture
  ARCHITECTURE_DEBT = 'architecture_debt',     // Technical debt assessment
  BUNDLE_OPTIMIZATION = 'bundle_optimization', // Bundle size and optimization
  LIGHTHOUSE_AUDIT = 'lighthouse_audit'        // Web performance auditing
}

/**
 * Issue metadata interface for type safety
 */
export interface IssueMetadata {
  [key: string]: any;
}

/**
 * Unified issue constructor parameters
 */
export interface UnifiedIssueParams {
  id: string;
  entity: UnifiedEntity;
  severity: IssueSeverity;
  analysisType: AnalysisType;
  title: string;
  description: string;
  ruleId: string;
  line?: number | null;
  column?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  toolName: string;
  metadata?: IssueMetadata;
}

/**
 * Core unified issue representation
 * Every tool adapter must produce this standardized format
 */
export class UnifiedIssue {
  public readonly id: string;
  public readonly entity: UnifiedEntity;
  public readonly severity: IssueSeverity;
  public readonly analysisType: AnalysisType;
  public readonly title: string;
  public readonly description: string;
  public readonly ruleId: string;
  public readonly line: number | null;
  public readonly column: number | null;
  public readonly endLine: number | null;
  public readonly endColumn: number | null;
  public readonly toolName: string;
  public readonly metadata: IssueMetadata;
  public readonly createdAt: string;

  constructor(params: UnifiedIssueParams) {
    this.id = params.id;
    this.entity = params.entity;
    this.severity = params.severity;
    this.analysisType = params.analysisType;
    this.title = params.title;
    this.description = params.description;
    this.ruleId = params.ruleId;
    this.line = params.line ?? null;
    this.column = params.column ?? null;
    this.endLine = params.endLine ?? null;
    this.endColumn = params.endColumn ?? null;
    this.toolName = params.toolName;
    this.metadata = params.metadata ?? {};
    this.createdAt = new Date().toISOString();
  }

  /**
   * Check if this issue is in proximity to another (within N lines)
   */
  public isNearby(otherIssue: UnifiedIssue, lineThreshold: number = 5): boolean {
    if (this.entity.canonicalPath !== otherIssue.entity.canonicalPath) {
      return false;
    }
    if (!this.line || !otherIssue.line) {
      return false;
    }
    return Math.abs(this.line - otherIssue.line) <= lineThreshold;
  }

  /**
   * Generate location fingerprint for deduplication
   */
  public getLocationFingerprint(): string {
    return `${this.entity.canonicalPath}:${this.line || 0}:${this.column || 0}`;
  }
}

/**
 * Severity distribution interface
 */
export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/**
 * Analysis type distribution interface
 * Extended for Phase 2 workflow integration
 */
export interface AnalysisTypeDistribution {
  // Phase 1 types
  quality: number;
  security: number;
  performance: number;
  style: number;
  complexity: number;
  semantic: number;
  ai_powered: number;

  // Phase 2 workflow types
  apm_performance: number;
  dependency_security: number;
  dependency_licensing: number;
  dependency_usage: number;
  architecture_design: number;
  architecture_debt: number;
  bundle_optimization: number;
  lighthouse_audit: number;
}

/**
 * File metrics metadata interface
 */
export interface FileMetricsMetadata {
  [key: string]: any;
}

/**
 * File-level metrics aggregated from all tools
 * Enables comprehensive file health assessment
 */
export class UnifiedFileMetrics {
  public entity: string;
  public issueCount: number = 0;
  public severityDistribution: SeverityDistribution = {
    critical: 0,
    high: 0, 
    medium: 0,
    low: 0,
    info: 0
  };
  public analysisTypeDistribution: AnalysisTypeDistribution = {
    // Phase 1 types
    quality: 0,
    security: 0,
    performance: 0,
    style: 0,
    complexity: 0,
    semantic: 0,
    ai_powered: 0,

    // Phase 2 workflow types
    apm_performance: 0,
    dependency_security: 0,
    dependency_licensing: 0,
    dependency_usage: 0,
    architecture_design: 0,
    architecture_debt: 0,
    bundle_optimization: 0,
    lighthouse_audit: 0
  };
  public toolCoverage: string[] = [];        // Which tools analyzed this file
  public hotspotScore: number = 0;           // Multi-dimensional risk score (0-100)
  public lastUpdated: string;
  public metadata: FileMetricsMetadata = {}; // Tool-specific metrics and data

  constructor(entity: string) {
    this.entity = entity;
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Add an issue to the metrics
   */
  public addIssue(unifiedIssue: UnifiedIssue): void {
    this.issueCount++;
    this.severityDistribution[unifiedIssue.severity]++;
    this.analysisTypeDistribution[unifiedIssue.analysisType]++;
    
    if (!this.toolCoverage.includes(unifiedIssue.toolName)) {
      this.toolCoverage.push(unifiedIssue.toolName);
    }
    
    this.lastUpdated = new Date().toISOString();
    this._updateHotspotScore();
  }

  /**
   * Calculate hotspot score based on issue severity and distribution
   */
  private _updateHotspotScore(): void {
    const severityWeights = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 2,
      info: 1
    };

    let weightedScore = 0;
    for (const [severity, count] of Object.entries(this.severityDistribution)) {
      weightedScore += count * severityWeights[severity as keyof SeverityDistribution];
    }

    // Factor in tool coverage (more tools = higher confidence)
    const coverageMultiplier = Math.min(this.toolCoverage.length / 3, 2.0);
    
    // Normalize to 0-100 scale with diminishing returns
    this.hotspotScore = Math.min(Math.round(Math.sqrt(weightedScore) * coverageMultiplier * 10), 100);
  }

  /**
   * Get risk level based on hotspot score
   */
  public getRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    if (this.hotspotScore >= 80) return 'critical';
    if (this.hotspotScore >= 60) return 'high';
    if (this.hotspotScore >= 30) return 'medium';
    return 'low';
  }
}

/**
 * Correlation group for issues in proximity
 */
export interface CorrelationGroup {
  id: string;
  canonicalPath: string;
  issues: UnifiedIssue[];
  lineRange: { start: number; end: number };
  riskScore: number;
  analysisTypes: AnalysisType[];
  toolCoverage: string[];
}

/**
 * Hotspot detection for high-risk areas
 */
export interface DetectedHotspot {
  id: string;
  canonicalPath: string;
  riskScore: number;
  issueCount: number;
  lineRange: { start: number; end: number };
  severityDistribution: SeverityDistribution;
  analysisTypeDistribution: AnalysisTypeDistribution;
  toolCoverage: string[];
  recommendedActions: string[];
}

/**
 * Analysis result metadata interface
 */
export interface AnalysisResultMetadata {
  source: string;
  sourceVersion: string;
  analyzedAt: string;
  message?: string;
  [key: string]: any;
}

/**
 * Main unified analysis result container
 * Aggregates all issues and provides correlation analysis
 */
export class UnifiedAnalysisResult {
  public readonly projectRoot: string;
  public readonly issues: UnifiedIssue[] = [];
  public readonly fileMetrics: Map<string, UnifiedFileMetrics> = new Map();
  public correlationGroups: CorrelationGroup[] = [];
  public hotspots: DetectedHotspot[] = [];
  public metadata: AnalysisResultMetadata | null = null;
  public readonly createdAt: string;
  public deduplicationStats?: {
    originalCount: number;
    deduplicatedCount: number;
    duplicatesRemoved: number;
    groupsFound: number;
  };

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add issue and update file metrics automatically
   */
  public addIssue(issue: UnifiedIssue): void {
    this.issues.push(issue);
    
    // Update file metrics
    if (!this.fileMetrics.has(issue.entity.canonicalPath)) {
      this.fileMetrics.set(issue.entity.canonicalPath, new UnifiedFileMetrics(issue.entity.canonicalPath));
    }
    
    this.fileMetrics.get(issue.entity.canonicalPath)!.addIssue(issue);
  }

  /**
   * Build correlation groups for issues in proximity
   */
  public buildCorrelationGroups(): void {
    const groups: Map<string, UnifiedIssue[]> = new Map();
    
    // Group issues by file and proximity
    for (const issue of this.issues) {
      const key = issue.entity.canonicalPath;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(issue);
    }

    this.correlationGroups = [];
    
    for (const [canonicalPath, fileIssues] of groups.entries()) {
      if (fileIssues.length < 2) continue;

      // Sort by line number for proximity analysis
      fileIssues.sort((a, b) => (a.line || 0) - (b.line || 0));

      let currentGroup: UnifiedIssue[] = [];
      let lastLine = -Infinity;

      for (const issue of fileIssues) {
        const line = issue.line || 0;
        
        if (line - lastLine <= 10) { // Within 10 lines
          currentGroup.push(issue);
        } else {
          if (currentGroup.length >= 2) {
            this._createCorrelationGroup(canonicalPath, currentGroup);
          }
          currentGroup = [issue];
        }
        lastLine = line;
      }

      // Handle final group
      if (currentGroup.length >= 2) {
        this._createCorrelationGroup(canonicalPath, currentGroup);
      }
    }
  }

  /**
   * Create a correlation group from issues
   */
  private _createCorrelationGroup(canonicalPath: string, issues: UnifiedIssue[]): void {
    const lines = issues.map(i => i.line || 0).filter(l => l > 0);
    const lineRange = {
      start: Math.min(...lines),
      end: Math.max(...lines)
    };

    const analysisTypes = Array.from(new Set(issues.map(i => i.analysisType)));
    const toolCoverage = Array.from(new Set(issues.map(i => i.toolName)));
    
    // Calculate risk score based on severity and tool diversity
    let riskScore = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL: riskScore += 10; break;
        case IssueSeverity.HIGH: riskScore += 7; break;
        case IssueSeverity.MEDIUM: riskScore += 4; break;
        case IssueSeverity.LOW: riskScore += 2; break;
        case IssueSeverity.INFO: riskScore += 1; break;
      }
    }
    
    // Boost score for tool diversity
    riskScore *= Math.min(toolCoverage.length / 2, 1.5);

    this.correlationGroups.push({
      id: `correlation-${canonicalPath.replace(/[^a-zA-Z0-9]/g, '-')}-${lineRange.start}`,
      canonicalPath,
      issues,
      lineRange,
      riskScore: Math.round(riskScore),
      analysisTypes,
      toolCoverage
    });
  }

  /**
   * Generate hotspots from file metrics and correlation groups
   */
  public generateHotspots(): void {
    this.hotspots = [];

    // Generate hotspots from high-risk files
    for (const [canonicalPath, metrics] of this.fileMetrics.entries()) {
      if (metrics.hotspotScore >= 50) {
        const recommendedActions = this._generateRecommendedActions(metrics);
        
        this.hotspots.push({
          id: `hotspot-${canonicalPath.replace(/[^a-zA-Z0-9]/g, '-')}`,
          canonicalPath,
          riskScore: metrics.hotspotScore,
          issueCount: metrics.issueCount,
          lineRange: { start: 1, end: -1 }, // File-level hotspot
          severityDistribution: metrics.severityDistribution,
          analysisTypeDistribution: metrics.analysisTypeDistribution,
          toolCoverage: metrics.toolCoverage,
          recommendedActions
        });
      }
    }

    // Sort by risk score descending
    this.hotspots.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Generate recommended actions based on file metrics
   */
  private _generateRecommendedActions(metrics: UnifiedFileMetrics): string[] {
    const actions: string[] = [];

    if (metrics.severityDistribution.critical > 0) {
      actions.push(`Address ${metrics.severityDistribution.critical} critical security/quality issues immediately`);
    }
    
    if (metrics.severityDistribution.high > 2) {
      actions.push(`Refactor to resolve ${metrics.severityDistribution.high} high-severity issues`);
    }

    if (metrics.analysisTypeDistribution.security > 0) {
      actions.push('Conduct security review and penetration testing');
    }

    if (metrics.analysisTypeDistribution.complexity > 2) {
      actions.push('Consider breaking down complex functions into smaller components');
    }

    if (metrics.toolCoverage.length >= 4) {
      actions.push('File flagged by multiple tools - prioritize comprehensive review');
    }

    return actions;
  }

  /**
   * Apply smart deduplication to reduce noise and duplicates
   */
  public deduplicateIssues(): void {
    // Import here to avoid circular dependency
    const { SmartDeduplicationEngine } = require('./deduplication-engine');
    const engine = new SmartDeduplicationEngine();

    const result = engine.deduplicateIssues(this.issues);

    // Replace issues with deduplicated ones
    this.issues.length = 0; // Clear existing issues
    this.issues.push(...result.deduplicatedIssues);

    // Store deduplication statistics
    this.deduplicationStats = result.statistics;

    // Rebuild file metrics with deduplicated issues
    this.fileMetrics.clear();
    for (const issue of this.issues) {
      if (!this.fileMetrics.has(issue.entity.canonicalPath)) {
        this.fileMetrics.set(issue.entity.canonicalPath, new UnifiedFileMetrics(issue.entity.canonicalPath));
      }
      this.fileMetrics.get(issue.entity.canonicalPath)!.addIssue(issue);
    }
  }

  /**
   * Analyze issues with enhanced function-level correlation
   */
  public buildEnhancedCorrelations(fileContents?: Map<string, string>): {
    functionClusters: Array<{
      boundary: { name: string; filePath: string; startLine: number; endLine: number };
      issues: UnifiedIssue[];
      hotspotScore: number;
      riskLevel: string;
    }>;
    crossFunctionGroups: Array<{
      issues: UnifiedIssue[];
      reason: string;
      confidence: number;
    }>;
    statistics: {
      totalIssues: number;
      clusteredIssues: number;
      functionsAnalyzed: number;
      hotspotFunctions: number;
    };
  } {
    const { EnhancedCorrelationEngine } = require('./enhanced-correlation-engine');
    const engine = new EnhancedCorrelationEngine();
    return engine.analyzeCorrelations(this.issues, fileContents);
  }

  /**
   * Get summary statistics
   */
  public getSummary(): {
    totalIssues: number;
    filesAnalyzed: number;
    correlationGroups: number;
    hotspots: number;
    toolsCovered: string[];
    severityBreakdown: SeverityDistribution;
    analysisTypeBreakdown: AnalysisTypeDistribution;
    deduplicationStats?: {
      originalCount: number;
      deduplicatedCount: number;
      duplicatesRemoved: number;
      groupsFound: number;
    };
  } {
    const toolsCovered = Array.from(new Set(this.issues.map(i => i.toolName)));
    
    const severityBreakdown: SeverityDistribution = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0
    };
    
    const analysisTypeBreakdown: AnalysisTypeDistribution = {
      // Phase 1 types
      quality: 0, security: 0, performance: 0, style: 0,
      complexity: 0, semantic: 0, ai_powered: 0,

      // Phase 2 workflow types
      apm_performance: 0, dependency_security: 0, dependency_licensing: 0,
      dependency_usage: 0, architecture_design: 0, architecture_debt: 0,
      bundle_optimization: 0, lighthouse_audit: 0
    };

    for (const issue of this.issues) {
      severityBreakdown[issue.severity]++;
      analysisTypeBreakdown[issue.analysisType]++;
    }

    return {
      totalIssues: this.issues.length,
      filesAnalyzed: this.fileMetrics.size,
      correlationGroups: this.correlationGroups.length,
      hotspots: this.hotspots.length,
      toolsCovered,
      severityBreakdown,
      analysisTypeBreakdown,
      deduplicationStats: this.deduplicationStats
    };
  }
}