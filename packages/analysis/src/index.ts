/**
 * topolop-analysis
 *
 * Universal analysis engine integrating 29+ static analysis tools
 * with advanced cross-tool correlation and deduplication.
 */

// Re-export shared types for convenience
export * from '@topolop/shared-types';

// Core analysis engines
export { EnhancedCorrelationEngine } from './engines/correlation-engine';
export { SmartDeduplicationEngine } from './engines/deduplication-engine';
export { DependencyAnalyzer } from './engines/dependency-analyzer';
export { TemporalAnalyzer } from './engines/temporal-analyzer';

// API (to be implemented)
// export { AnalysisEngine } from './api/analysis-engine';
// export { AnalysisConfig, AnalysisResult } from './api/types';

// CLI (to be implemented)
// export { CLI } from './cli';

export const VERSION = '0.1.0';
