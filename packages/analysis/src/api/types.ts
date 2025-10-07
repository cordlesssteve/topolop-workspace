import { UnifiedIssue, UnifiedFileMetrics } from '@topolop/shared-types';

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  projectPath: string;
  tools?: string[];
  correlation?: CorrelationConfig;
  output?: OutputConfig;
}

export interface CorrelationConfig {
  enabled: boolean;
  proximityThreshold?: number;
  minToolCount?: number;
}

export interface OutputConfig {
  format?: 'json' | 'xml' | 'html';
  destination?: string;
  includeMetrics?: boolean;
}

/**
 * Analysis result container
 */
export interface AnalysisResult {
  issues: UnifiedIssue[];
  metrics: Map<string, UnifiedFileMetrics>;
  hotspots: Hotspot[];
  summary: AnalysisSummary;
  timestamp: string;
  duration: number;
}

/**
 * Hotspot representation
 */
export interface Hotspot {
  filePath: string;
  toolCount: number;
  issueCount: number;
  severityScore: number;
  tools: string[];
  issues: UnifiedIssue[];
}

/**
 * Analysis summary statistics
 */
export interface AnalysisSummary {
  totalIssues: number;
  totalFiles: number;
  toolsUsed: string[];
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  analysisTypes: {
    [key: string]: number;
  };
}
