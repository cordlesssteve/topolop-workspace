/**
 * Python Static Analysis Tools - Phase 3 Implementation
 *
 * Security-first static analysis tools for Python:
 * - Pylint: Code quality and style analysis
 * - MyPy: Static type checking
 * - Unified: Combined analysis with security constraints
 *
 * Following Phase 3 roadmap security principles:
 * - No arbitrary code execution
 * - Container isolation ready
 * - Comprehensive input validation
 * - Fail-safe design
 */

// Core analyzers
export { default as PylintAnalyzer } from './pylint-analyzer';
export { default as MyPyAnalyzer } from './mypy-analyzer';
export { default as PythonStaticAnalyzer } from './python-static-analyzer';

// CLI interface
export { default as PythonStaticAnalysisCLI } from './cli';

// Type definitions
export type {
  PylintMessage,
  PylintResult
} from './pylint-analyzer';

export type {
  MyPyMessage,
  MyPyResult
} from './mypy-analyzer';

export type {
  PythonAnalysisResult
} from './python-static-analyzer';

// Re-export unified model types for convenience
export type {
  UnifiedIssue,
  UnifiedEntity,
  UnifiedAnalysisResult
} from '@topolop/shared-types';

/**
 * Quick factory function to create analyzer instance
 */
export function createPythonStaticAnalyzer(projectRoot?: string) {
  const PythonStaticAnalyzerClass = require('./python-static-analyzer').default;
  return new PythonStaticAnalyzerClass(projectRoot);
}

/**
 * Check if Python static analysis tools are available
 */
export async function checkToolAvailability(): Promise<{
  pylint: boolean;
  mypy: boolean;
  overall: boolean;
}> {
  const PythonStaticAnalyzerClass = require('./python-static-analyzer').default;
  const analyzer = new PythonStaticAnalyzerClass();
  try {
    return await analyzer.isAvailable();
  } finally {
    analyzer.cleanup();
  }
}

/**
 * Analyze Python files with default configuration
 */
export async function analyzePythonFiles(
  filePaths: string[],
  projectRoot?: string
) {
  const PythonStaticAnalyzerClass = require('./python-static-analyzer').default;
  const analyzer = new PythonStaticAnalyzerClass(projectRoot);
  try {
    return await analyzer.analyzeFiles(filePaths);
  } finally {
    analyzer.cleanup();
  }
}

/**
 * Analyze Python directory with default configuration
 */
export async function analyzePythonDirectory(
  directoryPath: string,
  projectRoot?: string
) {
  const PythonStaticAnalyzerClass = require('./python-static-analyzer').default;
  const analyzer = new PythonStaticAnalyzerClass(projectRoot);
  try {
    return await analyzer.analyzeDirectory(directoryPath);
  } finally {
    analyzer.cleanup();
  }
}

/**
 * Tool configuration and metadata
 */
export const PYTHON_STATIC_ANALYSIS_CONFIG = {
  toolName: 'python-static-analysis',
  version: '1.0.0',
  phase: 3,
  security: {
    codeExecution: false,
    containerIsolation: true,
    inputValidation: true,
    tempCacheHandling: true
  },
  tools: {
    pylint: {
      description: 'Python code quality and style analysis',
      securityConfig: [
        '--disable=import-error',
        '--persistent=no',
        '--unsafe-load-any-extension=no',
        '--load-plugins=',
        '--init-hook='
      ]
    },
    mypy: {
      description: 'Static type checking for Python',
      securityConfig: [
        '--ignore-missing-imports',
        '--no-incremental',
        '--follow-imports=skip'
      ]
    }
  },
  supportedFileTypes: ['.py'],
  skipDirectories: [
    '__pycache__', '.git', '.svn', '.hg',
    'node_modules', 'venv', 'env', '.venv', '.env',
    '.tox', '.pytest_cache', 'build', 'dist',
    '.mypy_cache', '.coverage', 'htmlcov'
  ]
} as const;

import PylintAnalyzer from './pylint-analyzer';
import MyPyAnalyzer from './mypy-analyzer';
import PythonStaticAnalyzer from './python-static-analyzer';
import PythonStaticAnalysisCLI from './cli';

export default {
  PylintAnalyzer,
  MyPyAnalyzer,
  PythonStaticAnalyzer,
  PythonStaticAnalysisCLI,
  createPythonStaticAnalyzer,
  checkToolAvailability,
  analyzePythonFiles,
  analyzePythonDirectory,
  PYTHON_STATIC_ANALYSIS_CONFIG
};