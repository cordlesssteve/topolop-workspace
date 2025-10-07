import { UnifiedEntity } from './UnifiedEntity';
import { IssueSeverity, AnalysisType } from './enums';

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
