// Core entity types
export { UnifiedEntity, UnifiedEntityParams } from './models/UnifiedEntity';
export { UnifiedIssue, UnifiedIssueParams, IssueMetadata } from './models/UnifiedIssue';
export {
  UnifiedFileMetrics,
  SeverityDistribution,
  AnalysisTypeDistribution,
  FileMetricsMetadata
} from './models/UnifiedFileMetrics';

// Enumerations
export { IssueSeverity, AnalysisType } from './models/enums';

// Phase 2 adapter interfaces
export * from './models/phase2-interfaces';

// Legacy interfaces (for backward compatibility)
export * from './models/interfaces';

// Version
export const VERSION = '0.1.0';
