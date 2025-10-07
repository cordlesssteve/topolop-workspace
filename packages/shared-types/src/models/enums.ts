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
 */
export enum AnalysisType {
  // Core analysis types
  QUALITY = 'quality',         // Code quality, maintainability, technical debt
  SECURITY = 'security',       // Security vulnerabilities, SAST findings
  PERFORMANCE = 'performance', // Performance issues, optimization opportunities
  STYLE = 'style',            // Code style, formatting, conventions
  COMPLEXITY = 'complexity',   // Cyclomatic complexity, cognitive load
  SEMANTIC = 'semantic',       // Data flow, control flow, semantic analysis
  AI_POWERED = 'ai_powered',   // AI-generated insights, automated fixes

  // Workflow integration types
  APM_PERFORMANCE = 'apm_performance',        // Application Performance Monitoring
  DEPENDENCY_SECURITY = 'dependency_security', // Supply chain security
  DEPENDENCY_LICENSING = 'dependency_licensing', // License compliance
  DEPENDENCY_USAGE = 'dependency_usage',       // Dependency usage analysis
  ARCHITECTURE_DESIGN = 'architecture_design', // Design patterns and architecture
  ARCHITECTURE_DEBT = 'architecture_debt',     // Technical debt assessment
  BUNDLE_OPTIMIZATION = 'bundle_optimization', // Bundle size and optimization
  LIGHTHOUSE_AUDIT = 'lighthouse_audit'        // Web performance auditing
}
