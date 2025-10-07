/**
 * C/C++ Static Analysis Module
 *
 * Phase 3 Security-First Implementation
 * Exports Clang Static Analyzer and CBMC Bounded Model Checker
 * with unified adapter for cross-tool correlation.
 */

// Main unified analyzer
export { default as CppStaticAnalyzer } from './cpp-static-analyzer';
export type { CppAnalysisResult, SimpleCppUnifiedAnalysisResult } from './cpp-static-analyzer';

// Individual analyzers
export { default as ClangAnalyzer } from './clang-analyzer';
export type { ClangResult, ClangMessage } from './clang-analyzer';

export { default as CBMCAnalyzer } from './cbmc-analyzer';
export type { CBMCResult, CBMCMessage } from './cbmc-analyzer';

// CLI interface
export { default as CppStaticAnalysisCLI } from './cli';