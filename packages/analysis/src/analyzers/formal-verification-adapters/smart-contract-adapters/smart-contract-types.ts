/**
 * Topolop Phase 5C: Smart Contract Verification Hub (#38)
 * Market Impact: $2B+ DeFi market, $10K-100K per project pricing
 * 
 * Smart contract specific types and interfaces for formal verification
 * Financial mathematics with life-or-death precision
 * 
 * STRATEGIC VALUE: Premium pricing for mathematical financial guarantees
 * MARKET OPPORTUNITY: DeFi protocols, enterprise blockchain, regulatory compliance
 */

import { 
  FormalVerificationResult, 
  VerificationProperty
} from '../base-interfaces/formal-verification-types';

/**
 * Smart Contract specific verification result
 */
export interface SmartContractVerificationResult extends FormalVerificationResult {
  contractInfo: {
    contractName: string;
    compiler: string;
    compilerVersion: string;
    networkTarget: string[];
    gasEstimates?: GasEstimate[];
  };

  // Financial invariants and properties
  financialInvariants: FinancialInvariant[];
  
  // Security vulnerabilities specific to smart contracts
  securityVulnerabilities: SmartContractVulnerability[];
  
  // Reentrancy analysis
  reentrancyAnalysis: ReentrancyAnalysis;
  
  // Integer overflow/underflow analysis
  arithmeticSafety: ArithmeticSafetyAnalysis;
  
  // Access control verification
  accessControl: AccessControlAnalysis;
  
  // Gas optimization analysis
  gasOptimization: GasOptimizationAnalysis;
  
  // Compliance and regulatory analysis
  compliance: ComplianceAnalysis;
}

/**
 * Financial invariants that must always hold
 */
export interface FinancialInvariant {
  id: string;
  description: string;
  type: 'balance_conservation' | 'supply_constraint' | 'exchange_rate' | 'collateral_ratio' | 'slippage_bound';
  expression: string; // Mathematical expression
  verified: boolean;
  counterexample?: any;
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
  financialImpact: {
    potentialLoss: number; // USD estimate
    affectedUsers: number;
    systemic: boolean; // Can this break the entire protocol?
  };
}

/**
 * Smart contract specific vulnerabilities
 */
export interface SmartContractVulnerability {
  id: string;
  type: SmartContractVulnerabilityType;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: {
    contract: string;
    function?: string;
    line: number;
    column?: number;
  };
  exploitability: 'theoretical' | 'difficult' | 'easy' | 'automated';
  financialRisk: {
    maxLoss: number; // Maximum possible loss in USD
    attackCost: number; // Cost to execute attack
    profitability: number; // Profit ratio for attacker
  };
  mitigations: string[];
  references: string[]; // Links to similar vulnerabilities
}

export type SmartContractVulnerabilityType = 
  | 'reentrancy'
  | 'integer_overflow'
  | 'integer_underflow'
  | 'unchecked_external_call'
  | 'delegatecall_injection'
  | 'timestamp_dependence'
  | 'block_hash_dependence'
  | 'tx_origin_authentication'
  | 'uninitialized_storage'
  | 'short_address_attack'
  | 'race_condition'
  | 'denial_of_service'
  | 'front_running'
  | 'sandwich_attack'
  | 'flash_loan_attack'
  | 'governance_attack'
  | 'oracle_manipulation'
  | 'bridge_vulnerability'
  | 'upgradeability_risk';

/**
 * Reentrancy attack analysis
 */
export interface ReentrancyAnalysis {
  vulnerable: boolean;
  vulnerableFunctions: Array<{
    functionName: string;
    callGraph: string[];
    stateChangesAfterExternalCall: boolean;
    exploitScenario?: string;
  }>;
  protectionMechanisms: Array<{
    type: 'mutex' | 'checks_effects_interactions' | 'reentrancy_guard';
    implemented: boolean;
    effectiveness: number; // 0-1 score
  }>;
}

/**
 * Integer arithmetic safety analysis
 */
export interface ArithmeticSafetyAnalysis {
  overflowRisks: Array<{
    location: string;
    operation: 'addition' | 'multiplication' | 'exponentiation';
    variables: string[];
    maxPossibleValue: string; // May be very large number
    safetyMechanism?: 'safemath' | 'solidity_0_8' | 'manual_checks' | 'none';
  }>;
  underflowRisks: Array<{
    location: string;
    operation: 'subtraction' | 'division';
    variables: string[];
    minPossibleValue: string;
    safetyMechanism?: 'safemath' | 'solidity_0_8' | 'manual_checks' | 'none';
  }>;
  overallSafety: 'safe' | 'risky' | 'vulnerable';
}

/**
 * Access control analysis
 */
export interface AccessControlAnalysis {
  roles: Array<{
    name: string;
    permissions: string[];
    assignments: string[]; // Addresses or patterns
    privilegeEscalation: boolean;
  }>;
  criticalFunctions: Array<{
    name: string;
    accessRestriction: 'public' | 'restricted' | 'owner_only' | 'none';
    appropriateRestriction: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  ownershipModel: 'centralized' | 'multisig' | 'dao' | 'immutable' | 'unclear';
  ownershipRisks: string[];
}

/**
 * Gas optimization analysis
 */
export interface GasOptimizationAnalysis {
  totalGasUsage: number;
  gasHotspots: Array<{
    location: string;
    gasUsage: number;
    optimizationPotential: number; // Percentage reduction possible
    recommendations: string[];
  }>;
  gasAttackVectors: Array<{
    type: 'gas_griefing' | 'block_gas_limit' | 'gas_price_manipulation';
    vulnerable: boolean;
    description: string;
  }>;
}

/**
 * Compliance and regulatory analysis
 */
export interface ComplianceAnalysis {
  regulations: Array<{
    framework: 'MiCA' | 'SEC' | 'CFTC' | 'FinCEN' | 'GDPR' | 'AML' | 'KYC';
    compliant: boolean;
    requirements: string[];
    violations: string[];
    recommendations: string[];
  }>;
  auditRequirements: {
    formal_verification_required: boolean;
    manual_audit_required: boolean;
    continuous_monitoring_required: boolean;
    insurance_requirements: string[];
  };
}

/**
 * Gas estimation for different operations
 */
export interface GasEstimate {
  operation: string;
  gasUsed: number;
  gasLimit: number;
  gasPrice: number; // in Gwei
  costInETH: number;
  costInUSD?: number;
}

/**
 * Smart contract verification configuration
 */
export interface SmartContractVerificationConfig {
  // Target networks
  networks: ('ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'bsc' | 'avalanche')[];
  
  // Verification depth
  verificationLevel: 'basic' | 'standard' | 'comprehensive' | 'enterprise';
  
  // Financial analysis parameters
  financialAnalysis: {
    maxAcceptableLoss: number; // USD
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    requireFormalProofs: boolean;
    invariantChecking: boolean;
  };
  
  // Security analysis parameters
  securityAnalysis: {
    checkReentrancy: boolean;
    checkIntegerOverflow: boolean;
    checkAccessControl: boolean;
    checkGasOptimization: boolean;
    customVulnerabilityChecks: string[];
  };
  
  // Compliance requirements
  compliance: {
    regulatory_frameworks: string[];
    audit_requirements: string[];
    reporting_requirements: string[];
  };
  
  // Performance parameters
  timeout: number; // seconds
  maxContractSize: number; // bytes
  parallelAnalysis: boolean;
}

/**
 * Smart contract correlation group for cross-tool analysis
 */
export interface SmartContractCorrelationGroup {
  contractName: string;
  correlationId: string;
  
  // Results from different verification tools
  certora_results?: SmartContractVerificationResult;
  kontrol_results?: SmartContractVerificationResult;
  smtchecker_results?: SmartContractVerificationResult;
  slither_results?: any; // Static analysis
  mythx_results?: any; // Security analysis
  
  // Unified analysis
  aggregatedFinancialRisk: {
    totalPotentialLoss: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number; // 0-1
    consensusLevel: number; // Agreement between tools
  };
  
  // Cross-tool vulnerability correlation
  correlatedVulnerabilities: Array<{
    vulnerability_type: SmartContractVulnerabilityType;
    detected_by: string[]; // Which tools found it
    severity_consensus: 'info' | 'low' | 'medium' | 'high' | 'critical';
    false_positive_probability: number;
  }>;
  
  // Financial invariant verification status
  invariantVerificationStatus: Array<{
    invariant: FinancialInvariant;
    verification_tools: string[];
    proof_status: 'proven' | 'disproven' | 'unknown' | 'timeout';
    confidence_level: number;
  }>;
  
  // Deployment recommendation
  deploymentRecommendation: {
    safe_to_deploy: boolean;
    risk_factors: string[];
    required_mitigations: string[];
    insurance_eligibility: boolean;
    audit_completeness: number; // Percentage
  };
  
  // Risk assessment
  riskAssessment?: any;
}

/**
 * Smart contract verification statistics
 */
export interface SmartContractVerificationStats {
  totalContractsAnalyzed: number;
  vulnerabilitiesFound: number;
  financialRiskPrevented: number; // USD value
  
  // Breakdown by vulnerability type
  vulnerabilityBreakdown: Record<SmartContractVulnerabilityType, number>;
  
  // Tool effectiveness metrics
  toolEffectiveness: Record<string, {
    accuracy: number;
    coverage: number;
    performance: number;
    false_positive_rate: number;
  }>;
  
  // Financial impact metrics
  financialMetrics: {
    total_value_protected: number; // USD
    average_risk_per_contract: number;
    highest_risk_contract: number;
    risk_distribution: Record<string, number>; // risk_level -> count
  };
}

/**
 * Real-time smart contract monitoring
 */
export interface SmartContractMonitoring {
  contractAddress: string;
  network: string;
  
  // Real-time invariant monitoring
  invariantViolations: Array<{
    invariant: FinancialInvariant;
    violatedAt: Date;
    transactionHash: string;
    impact: number; // USD
    resolved: boolean;
  }>;
  
  // Anomaly detection
  anomalies: Array<{
    type: 'unusual_gas_usage' | 'large_transfer' | 'new_function_call' | 'ownership_change';
    detectedAt: Date;
    description: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    investigation_status: 'pending' | 'investigating' | 'resolved' | 'false_alarm';
  }>;
  
  // Performance metrics
  performance: {
    average_gas_usage: number;
    transaction_frequency: number;
    total_value_locked: number;
    user_activity: number;
  };
}

/**
 * DeFi protocol specific analysis
 */
export interface DeFiProtocolAnalysis {
  protocolType: 'dex' | 'lending' | 'yield_farming' | 'insurance' | 'derivatives' | 'bridge' | 'dao';
  
  // Economic security analysis
  economicSecurity: {
    total_value_locked: number;
    token_distribution: Record<string, number>;
    liquidity_depth: number;
    slippage_tolerance: number;
    impermanent_loss_risk: number;
  };
  
  // Oracle dependencies
  oracles: Array<{
    oracle_provider: string;
    data_feeds: string[];
    manipulation_resistance: number; // 0-1 score
    failsafe_mechanisms: string[];
  }>;
  
  // Governance analysis
  governance: {
    governance_token: string;
    voting_mechanism: string;
    proposal_threshold: number;
    execution_delay: number; // timelock
    centralization_risk: number; // 0-1 score
  };
  
  // Composability risks
  composability: {
    dependencies: string[]; // Other protocols this depends on
    dependent_protocols: string[]; // Protocols that depend on this
    systemic_risk: number; // Risk to broader DeFi ecosystem
  };
}

// All types are exported as named exports above