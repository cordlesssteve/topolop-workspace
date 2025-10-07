/**
 * Phase 2: Workflow Integration - Enhanced Interfaces
 *
 * Extends the Phase 1 unified data model to support performance analysis,
 * enhanced dependency analysis, and architecture analysis.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 */

import {
  UnifiedIssue,
  UnifiedEntity,
  IssueSeverity,
  AnalysisType,
  IssueMetadata
} from './interfaces';

// Re-export AnalysisType for Phase 2 (now includes workflow types)
export { AnalysisType as WorkflowAnalysisType } from './interfaces';

/**
 * Performance metrics for APM integration
 */
export interface PerformanceMetrics {
  responseTime?: number;        // milliseconds
  memoryUsage?: number;        // MB
  cpuUsage?: number;           // percentage
  bundleSize?: number;         // bytes
  loadTime?: number;           // milliseconds
  throughput?: number;         // requests per second
  errorRate?: number;          // percentage
  availabilityScore?: number;  // percentage
  traceId?: string;            // APM trace identifier
  lastSeen?: string;           // Last seen timestamp
  coreWebVitals?: {
    lcp?: number;              // Largest Contentful Paint (ms)
    fid?: number;              // First Input Delay (ms)
    cls?: number;              // Cumulative Layout Shift (score)
  };
}

/**
 * Enhanced performance issue extending unified model
 */
export interface PerformanceIssue extends UnifiedIssue {
  analysisType: AnalysisType.APM_PERFORMANCE | AnalysisType.BUNDLE_OPTIMIZATION | AnalysisType.LIGHTHOUSE_AUDIT;
  performanceMetrics: PerformanceMetrics;
  performanceCategory: 'response_time' | 'memory' | 'cpu' | 'bundle_size' | 'loading' | 'availability' | 'web_vitals';
  impactLevel: 'user_facing' | 'system_level' | 'resource_consumption';
  optimizationOpportunity?: {
    potentialImprovement: string;
    effort: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Vulnerability information for dependencies
 */
export interface VulnerabilityInfo {
  id: string;
  cve?: string;
  severity: IssueSeverity;
  cvssScore?: number;
  description: string;
  patchedVersions?: string[];
  exploitExists?: boolean;
}

/**
 * Enhanced dependency information
 */
export interface DependencyInfo {
  packageName: string;
  version: string;
  type: 'direct' | 'transitive' | 'dev' | 'peer';
  depth: number;
  licenses: string[];
  vulnerabilities: VulnerabilityInfo[];
  latestVersion?: string;
  updateAvailable?: boolean;
  usageAnalysis?: {
    isUsed: boolean;
    usageCount: number;
    criticalUsage: boolean;
  };
}

/**
 * Enhanced dependency issue extending unified model
 */
export interface DependencyIssue extends UnifiedIssue {
  analysisType: AnalysisType.DEPENDENCY_SECURITY | AnalysisType.DEPENDENCY_LICENSING | AnalysisType.DEPENDENCY_USAGE;
  dependencyInfo: DependencyInfo;
  dependencyCategory: 'security' | 'licensing' | 'usage' | 'version_conflict' | 'supply_chain';
  supplyChainRisk: 'low' | 'medium' | 'high' | 'critical';
  remediationSuggestion?: {
    action: 'update' | 'remove' | 'replace' | 'review';
    description: string;
    automatable: boolean;
  };
}

/**
 * Architecture complexity metrics
 */
export interface ComplexityMetrics {
  cyclomaticComplexity?: number;
  cognitiveComplexity?: number;
  linesOfCode?: number;
  nestingDepth?: number;
  numberOfParameters?: number;
  numberOfMethods?: number;
  couplingLevel?: number;
  cohesionScore?: number;
  maintainabilityIndex?: number;
}

/**
 * Architecture analysis information
 */
export interface ArchitectureInfo {
  componentType: 'module' | 'class' | 'function' | 'interface' | 'package';
  designPattern?: string;
  complexityMetrics: ComplexityMetrics;
  couplingLevel: 'low' | 'medium' | 'high';
  cohesionLevel: 'low' | 'medium' | 'high';
  maintainabilityIndex?: number;
  technicalDebtMinutes?: number;
  circularDependencies?: string[];
}

/**
 * Enhanced architecture issue extending unified model
 */
export interface ArchitectureIssue extends UnifiedIssue {
  analysisType: AnalysisType.ARCHITECTURE_DESIGN | AnalysisType.ARCHITECTURE_DEBT;
  architectureInfo: ArchitectureInfo;
  architectureCategory: 'design_pattern' | 'complexity' | 'coupling' | 'cohesion' | 'dependency_cycle' | 'maintainability';
  technicalDebtLevel: 'low' | 'medium' | 'high' | 'critical';
  refactoringOpportunity?: {
    suggestedAction: string;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
  };
}

/**
 * Workflow correlation result combining multiple analysis dimensions
 */
export interface WorkflowCorrelationResult {
  staticIssues: UnifiedIssue[];
  performanceIssues: PerformanceIssue[];
  dependencyIssues: DependencyIssue[];
  architectureIssues: ArchitectureIssue[];

  correlations: WorkflowCorrelationGroup[];
  hotspots: WorkflowHotspot[];
  insights: WorkflowInsight[];

  statistics: {
    totalIssues: number;
    correlationsFound: number;
    hotspotsIdentified: number;
    workflowCoverage: {
      static: number;
      performance: number;
      dependencies: number;
      architecture: number;
    };
  };
}

/**
 * Multi-dimensional correlation group for workflow analysis
 */
export interface WorkflowCorrelationGroup {
  id: string;
  type: 'performance_security' | 'dependency_architecture' | 'complexity_performance' | 'multi_dimensional';
  primaryIssue: UnifiedIssue | PerformanceIssue | DependencyIssue | ArchitectureIssue;
  relatedIssues: (UnifiedIssue | PerformanceIssue | DependencyIssue | ArchitectureIssue)[];

  correlation: {
    strength: 'weak' | 'medium' | 'strong';
    confidence: number; // 0-1
    dimensions: string[]; // ['performance', 'security', 'architecture']
  };

  impact: {
    userExperience: 'none' | 'low' | 'medium' | 'high';
    systemStability: 'none' | 'low' | 'medium' | 'high';
    businessRisk: 'none' | 'low' | 'medium' | 'high';
  };

  recommendations: WorkflowRecommendation[];
}

/**
 * Enhanced hotspot with multi-dimensional analysis
 */
export interface WorkflowHotspot {
  id: string;
  entity: UnifiedEntity;

  scores: {
    overall: number;
    static: number;
    performance: number;
    dependencies: number;
    architecture: number;
  };

  issues: {
    static: UnifiedIssue[];
    performance: PerformanceIssue[];
    dependencies: DependencyIssue[];
    architecture: ArchitectureIssue[];
  };

  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  priority: number; // 1-10

  workflowImpact: {
    developmentVelocity: 'positive' | 'neutral' | 'negative';
    userExperience: 'positive' | 'neutral' | 'negative';
    systemReliability: 'positive' | 'neutral' | 'negative';
  };
}

/**
 * Actionable workflow insights
 */
export interface WorkflowInsight {
  id: string;
  type: 'optimization' | 'risk_mitigation' | 'best_practice' | 'dependency_update' | 'refactoring';
  title: string;
  description: string;

  affectedAreas: {
    files: string[];
    components: string[];
    dependencies?: string[];
  };

  recommendation: WorkflowRecommendation;

  metrics: {
    potentialTimeSavings?: string;
    performanceImprovement?: string;
    riskReduction?: string;
    maintainabilityGain?: string;
  };
}

/**
 * Actionable workflow recommendations
 */
export interface WorkflowRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  effort: 'trivial' | 'low' | 'medium' | 'high' | 'architectural';
  impact: 'low' | 'medium' | 'high' | 'transformative';

  steps: string[];
  automatable: boolean;
  tools?: string[];

  timeline: {
    estimated: string;
    urgency: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  };
}

/**
 * Adapter interface for performance monitoring tools
 */
export interface PerformanceAdapter {
  name: string;
  version: string;
  type: 'apm' | 'lighthouse' | 'bundle_analyzer' | 'profiler';

  // Core methods
  initialize(config: any): Promise<void>;
  getPerformanceMetrics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<PerformanceIssue[]>;
  analyzePerformanceData(rawData: any): PerformanceIssue[];

  // Capabilities
  capabilities: {
    realTimeMonitoring: boolean;
    historicalData: boolean;
    alerting: boolean;
    customMetrics: boolean;
  };
}

/**
 * Adapter interface for enhanced dependency analysis
 */
export interface DependencyAdapter {
  name: string;
  version: string;
  type: 'security' | 'licensing' | 'usage' | 'supply_chain';

  // Core methods
  initialize(config: any): Promise<void>;
  analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]>;
  checkLicenseCompliance(dependencies: DependencyInfo[]): Promise<DependencyIssue[]>;
  assessSupplyChainRisk(dependency: DependencyInfo): 'low' | 'medium' | 'high' | 'critical';

  // Capabilities
  capabilities: {
    vulnerabilityScanning: boolean;
    licenseDetection: boolean;
    usageAnalysis: boolean;
    fixSuggestions: boolean;
  };
}

/**
 * Adapter interface for architecture analysis tools
 */
export interface ArchitectureAdapter {
  name: string;
  version: string;
  type: 'dependency_analysis' | 'complexity_analysis' | 'pattern_detection' | 'debt_assessment';

  // Core methods
  initialize(config: any): Promise<void>;
  analyzeArchitecture(projectPath: string): Promise<ArchitectureIssue[]>;
  detectDesignPatterns(codeStructure: any): ArchitectureIssue[];
  assessTechnicalDebt(issues: ArchitectureIssue[]): TechnicalDebtAssessment;

  // Capabilities
  capabilities: {
    circularDependencyDetection: boolean;
    complexityAnalysis: boolean;
    patternRecognition: boolean;
    refactoringGuidance: boolean;
  };
}

/**
 * Technical debt assessment result
 */
export interface TechnicalDebtAssessment {
  totalDebtMinutes: number;
  debtRatio: number; // percentage
  ratingCategory: 'A' | 'B' | 'C' | 'D' | 'E'; // A=excellent, E=critical

  breakdown: {
    complexity: number;
    coupling: number;
    duplication: number;
    maintainability: number;
  };

  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

/**
 * Enhanced unified analysis result for Phase 2
 */
export interface WorkflowAnalysisResult {
  // Core Phase 1 data
  projectRoot: string;
  staticIssues: UnifiedIssue[];

  // Phase 2 workflow data
  performanceIssues: PerformanceIssue[];
  dependencyIssues: DependencyIssue[];
  architectureIssues: ArchitectureIssue[];

  // Enhanced analysis
  workflowCorrelations: WorkflowCorrelationResult;
  workflowHotspots: WorkflowHotspot[];
  workflowInsights: WorkflowInsight[];

  // Comprehensive metrics
  workflowMetrics: {
    totalIssues: number;
    coverageByType: {
      static: number;
      performance: number;
      dependencies: number;
      architecture: number;
    };
    riskDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    automationOpportunities: number;
  };

  // Processing metadata
  analyzedAt: string;
  toolsCovered: string[];
  processingTime: number; // milliseconds
}