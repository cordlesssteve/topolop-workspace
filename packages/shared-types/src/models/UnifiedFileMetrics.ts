import { UnifiedIssue } from './UnifiedIssue';
import { IssueSeverity, AnalysisType } from './enums';

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
 */
export interface AnalysisTypeDistribution {
  // Core types
  quality: number;
  security: number;
  performance: number;
  style: number;
  complexity: number;
  semantic: number;
  ai_powered: number;

  // Workflow types
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
    quality: 0,
    security: 0,
    performance: 0,
    style: 0,
    complexity: 0,
    semantic: 0,
    ai_powered: 0,
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

    const weightedScore =
      (this.severityDistribution.critical * severityWeights.critical) +
      (this.severityDistribution.high * severityWeights.high) +
      (this.severityDistribution.medium * severityWeights.medium) +
      (this.severityDistribution.low * severityWeights.low) +
      (this.severityDistribution.info * severityWeights.info);

    // Tool coverage bonus (more tools = higher confidence)
    const toolBonus = Math.min(this.toolCoverage.length * 5, 20);

    // Normalize to 0-100 scale
    this.hotspotScore = Math.min(weightedScore + toolBonus, 100);
  }
}
