/**
 * Formal Verification Types and Interfaces
 * Phase 5A: Blue Ocean Markets - Core type definitions
 * 
 * This module defines the unified type system for formal verification tools
 * in Topolop's Phase 5 expansion from "analysis platform" to "verification platform"
 */

/**
 * Core formal verification result types
 */
export type FormalVerificationStatus = 'verified' | 'partial' | 'unverified' | 'proving' | 'error' | 'timeout';
export type VerificationMethod = 'bounded_model_checking' | 'symbolic_execution' | 'contract_verification' | 'theorem_proving' | 'ai_assisted';
export type ConfidenceLevel = 'mathematical_proof' | 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'heuristic';

/**
 * Formal verification property types
 */
export interface VerificationProperty {
  id: string;
  name: string;
  description: string;
  propertyType: 'safety' | 'liveness' | 'security' | 'correctness' | 'performance';
  specification: string; // Formal specification (TLA+, contracts, etc.)
  verified: boolean;
  confidence: ConfidenceLevel;
  counterexample?: any; // If verification failed
  evidence?: any; // Supporting evidence for verification result
}

/**
 * Symbolic execution path information
 */
export interface SymbolicPath {
  pathId: string;
  pathCondition: string; // Symbolic path condition
  coverage: number; // Path coverage percentage
  testInputs: any[]; // Generated test inputs for this path
  reachableLines: number[];
  feasible: boolean;
  executionDepth: number;
}

/**
 * Mathematical proof information
 */
export interface MathematicalProof {
  proofId: string;
  theorem: string; // What was proven
  proofMethod: 'induction' | 'contradiction' | 'direct' | 'smt_solver' | 'model_checking';
  proofSteps: string[]; // Proof steps or trace
  verificationTime: number; // Time to prove (milliseconds)
  proofSize: number; // Proof complexity measure
  dependencies: string[]; // Other proofs this depends on
}

/**
 * Core formal verification result
 */
export interface FormalVerificationResult {
  // Identity
  id: string;
  toolName: string;
  version: string;
  
  // File/location information
  filePath: string;
  projectRoot: string;
  canonicalPath: string; // Relative from project root
  
  // Verification details
  status: FormalVerificationStatus;
  method: VerificationMethod;
  confidence: ConfidenceLevel;
  
  // Properties and proofs
  properties: VerificationProperty[];
  proofs: MathematicalProof[];
  symbolicPaths?: SymbolicPath[]; // For symbolic execution
  
  // Analysis metadata
  analysisTime: number; // Total analysis time (milliseconds)
  resourceUsage: {
    memory: number; // MB
    cpu: number; // CPU seconds
    iterations?: number; // For iterative methods
  };
  
  // Verification context
  specification?: string; // Input specification
  assumptions: string[]; // Verification assumptions
  limitations: string[]; // Known limitations of the verification
  
  // Integration with existing system
  correlationKey: string; // For correlation with static analysis
  timestamp: string;
  metadata: Record<string, any>;
}

/**
 * Base interface for all formal verification adapters
 */
export interface FormalVerificationAdapter {
  // Adapter metadata
  name: string;
  version: string;
  supportedLanguages: string[];
  verificationMethods: VerificationMethod[];
  
  // Core verification methods
  verify(
    filePath: string, 
    specification?: string,
    options?: FormalVerificationOptions
  ): Promise<FormalVerificationResult[]>;
  
  // Specification generation (for AI-assisted tools)
  generateSpecification?(
    code: string,
    language: string
  ): Promise<GeneratedSpecification>;
  
  // Tool-specific capabilities
  getCapabilities(): VerificationCapabilities;
  
  // Health and status
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<AdapterStatus>;
}

/**
 * Verification options and configuration
 */
export interface FormalVerificationOptions {
  // General options
  timeout?: number; // Maximum verification time (milliseconds)
  maxDepth?: number; // Maximum analysis depth
  maxIterations?: number; // For iterative methods
  
  // Specification options
  specificationFormat?: 'contracts' | 'tla+' | 'dafny' | 'jsdoc' | 'python_contracts';
  assumptionLevel?: 'minimal' | 'standard' | 'aggressive';
  
  // Performance options
  parallelization?: boolean;
  memoryLimit?: number; // MB
  
  // Tool-specific options
  toolOptions?: Record<string, any>;
}

/**
 * AI-generated specification result
 */
export interface GeneratedSpecification {
  specification: string;
  format: string; // Specification language/format
  confidence: number; // 0-1 confidence in generated spec
  properties: string[]; // Identified properties to verify
  assumptions: string[]; // Generated assumptions
  limitations: string[]; // Known limitations
  generationMethod: 'llm' | 'static_analysis' | 'hybrid';
  metadata: {
    model?: string; // If LLM-generated
    tokens?: number;
    processingTime: number;
  };
}

/**
 * Adapter capabilities and supported features
 */
export interface VerificationCapabilities {
  // Supported verification types
  supportsSymbolicExecution: boolean;
  supportsBoundedModelChecking: boolean;
  supportsContractVerification: boolean;
  supportsTheoremProving: boolean;
  
  // Language support
  supportedLanguages: string[];
  languageFeatures: Record<string, string[]>; // language -> supported features
  
  // Specification formats
  supportedSpecFormats: string[];
  
  // Performance characteristics
  typicalAnalysisTime: string; // Human-readable description
  scalabilityLimits: {
    maxFileSize?: number;
    maxFunctionComplexity?: number;
    maxLoopDepth?: number;
  };
  
  // Integration features
  supportsIncrementalVerification: boolean;
  supportsParallelization: boolean;
  requiresExternalDependencies: boolean;
}

/**
 * Adapter status and health information
 */
export interface AdapterStatus {
  available: boolean;
  version: string;
  lastCheck: string;
  dependencies: {
    name: string;
    available: boolean;
    version?: string;
  }[];
  performance: {
    averageVerificationTime: number; // milliseconds
    successRate: number; // 0-1
    recentAnalyses: number; // Count of recent analyses
  };
  errors: string[]; // Recent errors
}

/**
 * Formal verification correlation group
 * Extends existing correlation system for formal methods
 */
export interface FormalCorrelationGroup {
  // Base correlation info
  correlationId: string;
  files: string[];
  correlationType: 'formal_static' | 'multi_formal' | 'proof_dependency' | 'specification_overlap';
  
  // Formal verification specific
  verificationResults: FormalVerificationResult[];
  proofRelationships: ProofDependency[];
  
  // Mathematical confidence
  mathematicalConfidence: ConfidenceLevel;
  proofCoverage: number; // What percentage of properties are proven
  
  // Cross-dimensional analysis
  staticAnalysisCorrelation?: any; // Correlation with static analysis results
  riskAssessment: {
    unverifiedCriticalPaths: string[];
    proofGaps: string[];
    specificationCompleteness: number; // 0-1
  };
}

/**
 * Proof dependency relationships
 */
export interface ProofDependency {
  dependentProof: string;
  dependsOnProof: string;
  dependencyType: 'lemma' | 'axiom' | 'theorem' | 'specification';
  strength: 'required' | 'helpful' | 'optional';
}

/**
 * Enhanced correlation engine V3 interface
 */
export interface EnhancedCorrelationEngineV3 {
  // Existing methods (from V1.5)
  analyzeCorrelations(issues: any[]): any[];
  
  // New formal methods correlation
  analyzeFormalMethodsCorrelations(
    staticIssues: any[],
    formalVerificationResults: FormalVerificationResult[],
    symbolicExecutionPaths: SymbolicPath[]
  ): FormalCorrelationGroup[];
  
  // Mathematical proof analysis
  generateMathematicalProofSummary(
    correlations: FormalCorrelationGroup[]
  ): ProofBasedConfidenceScore;
  
  // Verification completeness assessment
  assessVerificationCompleteness(
    codebase: any
  ): VerificationCoverageReport;
}

/**
 * Proof-based confidence scoring
 */
export interface ProofBasedConfidenceScore {
  overallConfidence: ConfidenceLevel;
  mathematicallyProven: number; // Percentage of code with mathematical proofs
  highConfidenceVerified: number; // Percentage with high-confidence verification
  unverified: number; // Percentage with no formal verification
  
  criticalPathsCovered: boolean; // Are critical execution paths verified?
  securityPropertiesVerified: boolean; // Are security properties formally verified?
  
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    benefit: string;
  }[];
}

/**
 * Verification coverage report
 */
export interface VerificationCoverageReport {
  totalFiles: number;
  verifiedFiles: number;
  partiallyVerifiedFiles: number;
  unverifiedFiles: number;
  
  coverageByCategory: {
    safety: number; // 0-1
    security: number;
    correctness: number;
    performance: number;
  };
  
  criticalPathAnalysis: {
    totalCriticalPaths: number;
    verifiedCriticalPaths: number;
    unverifiedCriticalPaths: string[];
  };
  
  proofStatistics: {
    totalProofs: number;
    automaticProofs: number;
    manualProofs: number;
    averageProofTime: number;
  };
}

/**
 * Language-specific formal verification interfaces
 */

// JavaScript/TypeScript formal verification
export interface JavaScriptFormalVerifier extends FormalVerificationAdapter {
  verifyAsyncCode(filePath: string): Promise<FormalVerificationResult[]>;
  verifyPromiseChains(filePath: string): Promise<FormalVerificationResult[]>;
  generateJSDocContracts(code: string): Promise<GeneratedSpecification>;
}

// Python formal verification
export interface PythonFormalVerifier extends FormalVerificationAdapter {
  verifyWithContracts(filePath: string): Promise<FormalVerificationResult[]>;
  generatePythonContracts(code: string): Promise<GeneratedSpecification>;
  verifyDataClasses(filePath: string): Promise<FormalVerificationResult[]>;
}

// LLM-Assisted specification generation
export interface LLMAssistedSpecGenerator {
  generateFromNaturalLanguage(
    description: string,
    targetFormat: string
  ): Promise<GeneratedSpecification>;
  
  improveSpecification(
    existingSpec: string,
    feedback: string
  ): Promise<GeneratedSpecification>;
  
  validateSpecification(
    specification: string,
    code: string
  ): Promise<SpecificationValidation>;
}

export interface SpecificationValidation {
  valid: boolean;
  completeness: number; // 0-1
  issues: {
    type: 'missing_property' | 'ambiguous_specification' | 'inconsistency';
    description: string;
    severity: 'high' | 'medium' | 'low';
    suggestions: string[];
  }[];
}