/**
 * Default Configuration for Topolop Layer 1 Data Sources
 * 
 * This file contains all configurable values used across Layer 1 analyzers.
 * Values can be overridden by environment variables or configuration files.
 */

const defaultConfig = {
  // Runtime Profiling Configuration
  runtime: {
    perf: {
      defaultDuration: 10,      // seconds to profile
      defaultFrequency: 99,     // sampling frequency (Hz)
      maxDuration: 300,         // maximum profile duration (seconds)
      timeout: 30000,           // execution timeout (ms)
      maxTargets: 3,            // maximum number of targets to profile
      topHotspotsLimit: 10      // number of top hotspots to return
    }
  },

  // Formal Methods Configuration
  formalMethods: {
    // Python Analysis
    python: {
      timeout: 180000,          // 3 minutes timeout for Python containers
      maxExecutionTime: 120000, // 2 minutes max execution time
      dockerTimeout: 5000,      // docker command timeout
      analysisTimeout: 30000,   // individual analysis timeout
      topResultsLimit: 10       // number of top results to return
    },

    // C/C++ Analysis  
    cpp: {
      timeout: 300000,          // 5 minutes timeout for C++ containers
      cppcheckTimeout: 60000,   // 1 minute for cppcheck
      clangTimeout: 60000,      // 1 minute for clang analyzer
      valgrindTimeout: 30000,   // 30 seconds for valgrind
      cbmcTimeout: 60000        // 1 minute for CBMC
    },

    // TypeScript Analysis
    typescript: {
      compileTimeout: 30000,    // 30 seconds for TypeScript compilation
      checkUnusedByDefault: true, // check for unused variables by default
      strictByDefault: false    // don't enforce strict mode by default
    },

    // JavaScript Analysis
    javascript: {
      eslintTimeout: 30000,     // 30 seconds for ESLint
      madgeTimeout: 15000,      // 15 seconds for Madge dependency analysis
      maxFileSize: 1048576      // 1MB max file size to analyze
    },

    // Universal Formal Methods
    universal: {
      kleeTimeout: 60000,       // 1 minute for KLEE
      tlaplusTimeout: 120000,   // 2 minutes for TLA+ model checking
      maxAnalysisTime: 300000   // 5 minutes maximum analysis time
    }
  },

  // AST Analysis Configuration
  ast: {
    maxFileSize: 10485760,      // 10MB max file size for AST parsing
    maxDepth: 1000,             // maximum AST traversal depth
    timeoutPerFile: 30000       // 30 seconds per file timeout
  },

  // Git Analysis Configuration  
  git: {
    maxCommits: 1000,           // maximum number of commits to analyze
    maxFileHistory: 100,        // maximum file history entries
    analysisTimeout: 60000      // 1 minute timeout for git operations
  },

  // Cache Configuration
  cache: {
    enabled: true,              // enable caching by default
    ttl: 3600000,              // cache TTL: 1 hour
    maxEntries: 1000           // maximum cache entries
  },

  // Logging Configuration
  logging: {
    level: 'info',             // log level: error, warn, info, debug
    enableAnalysisLogs: true,  // log analysis operations
    enablePerformanceLogs: false // log performance metrics
  },

  // Path Configuration
  paths: {
    // Temporary directory for analysis files
    tempDir: process.env.TMPDIR || process.env.TEMP || '/tmp',
    
    // Analysis output directories
    analysisOutputDir: null,    // null = use temp dir
    
    // Cache directory
    cacheDir: null,            // null = use temp dir/cache
    
    // Container paths
    containerTmpDir: '/tmp',
    containerOutputDir: '/tmp/analysis-output',
    
    // Tool-specific paths
    perfDataFile: 'perf.data',
    valgrindOutputFile: 'valgrind-output.xml',
    mypyReportDir: 'mypy-report',
    clangOutputDir: 'clang-analysis',
    cppcheckOutputDir: 'cppcheck-analysis'
  }
};

/**
 * Get configuration value with environment variable override support
 */
function getConfig(path, defaultValue) {
  const envKey = `TOPOLOP_${path.toUpperCase().replace(/\./g, '_')}`;
  const envValue = process.env[envKey];
  
  if (envValue !== undefined) {
    // Try to parse as number if it looks like one
    const numValue = Number(envValue);
    if (!isNaN(numValue)) {
      return numValue;
    }
    
    // Try to parse as boolean
    if (envValue.toLowerCase() === 'true') return true;
    if (envValue.toLowerCase() === 'false') return false;
    
    // Return as string
    return envValue;
  }
  
  return defaultValue;
}

/**
 * Get nested configuration value
 */
function getNestedConfig(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

/**
 * Get configuration with environment override support
 */
function resolveConfig(path) {
  const defaultValue = getNestedConfig(defaultConfig, path);
  return getConfig(path, defaultValue);
}

module.exports = {
  defaultConfig,
  getConfig,
  getNestedConfig,
  resolveConfig
};