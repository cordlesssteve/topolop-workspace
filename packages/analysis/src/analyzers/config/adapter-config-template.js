/**
 * Configuration Template for Topolop Adapters
 * 
 * This template shows how to integrate configuration system into adapters.
 * Copy this pattern to any adapter that needs configuration support.
 */

// 1. Import the configuration resolver
const { resolveConfig } = require('../config/default-config');

// 2. In constructor, replace hardcoded values with configurable ones:

class ExampleAdapter {
  constructor() {
    // Instead of: this.timeout = 30000;
    this.timeout = resolveConfig('formalMethods.tool.timeout') || 30000;
    
    // Instead of: this.maxFileSize = 10 * 1024 * 1024;
    this.maxFileSize = resolveConfig('formalMethods.javascript.maxFileSize') || 10 * 1024 * 1024;
    
    // Map common configurations:
    // Python tools -> 'formalMethods.python.*'
    // C++ tools -> 'formalMethods.cpp.*' 
    // JavaScript tools -> 'formalMethods.javascript.*'
    // TypeScript tools -> 'formalMethods.typescript.*'
    // Universal tools -> 'formalMethods.universal.*'
  }
}

// 3. Common configuration paths:
/*
formalMethods.python.timeout - Python container timeout
formalMethods.python.dockerTimeout - Docker command timeout
formalMethods.python.maxExecutionTime - Max execution time
formalMethods.python.analysisTimeout - Individual analysis timeout

formalMethods.cpp.timeout - C++ container timeout  
formalMethods.cpp.cppcheckTimeout - Cppcheck timeout
formalMethods.cpp.clangTimeout - Clang analyzer timeout
formalMethods.cpp.valgrindTimeout - Valgrind timeout

formalMethods.javascript.maxFileSize - Max file size for JS analysis
formalMethods.javascript.eslintTimeout - ESLint timeout
formalMethods.javascript.madgeTimeout - Madge timeout

formalMethods.typescript.compileTimeout - TypeScript compile timeout
formalMethods.typescript.strictByDefault - Use strict mode by default
formalMethods.typescript.checkUnusedByDefault - Check unused by default

formalMethods.universal.maxAnalysisTime - Universal max analysis time
*/

// 4. Environment variable override examples:
/*
TOPOLOP_FORMALMETHODS_PYTHON_TIMEOUT=180000
TOPOLOP_FORMALMETHODS_CPP_TIMEOUT=300000
TOPOLOP_FORMALMETHODS_JAVASCRIPT_MAXFILESIZE=5242880
*/

module.exports = ExampleAdapter;