const JavaScriptParser = require('./parsers/javascript-parser');
const TypeScriptParser = require('./parsers/typescript-parser');
const PythonParser = require('./parsers/python-parser');
const JavaParser = require('./parsers/java-parser');
const path = require('path');
const fs = require('fs').promises;

class ASTAnalyzer {
  constructor() {
    this.parsers = new Map();
    this.registerDefaultParsers();
  }

  registerDefaultParsers() {
    // Register JavaScript parser
    const jsParser = new JavaScriptParser();
    JavaScriptParser.getSupportedExtensions().forEach(ext => {
      this.parsers.set(ext, jsParser);
    });

    // Register TypeScript parser
    const tsParser = new TypeScriptParser();
    TypeScriptParser.getSupportedExtensions().forEach(ext => {
      this.parsers.set(ext, tsParser);
    });

    // Register Python parser
    const pyParser = new PythonParser();
    PythonParser.getSupportedExtensions().forEach(ext => {
      this.parsers.set(ext, pyParser);
    });

    // Register Java parser
    const javaParser = new JavaParser();
    JavaParser.getSupportedExtensions().forEach(ext => {
      this.parsers.set(ext, javaParser);
    });
  }

  registerParser(extensions, parser) {
    if (!Array.isArray(extensions)) {
      extensions = [extensions];
    }
    
    extensions.forEach(ext => {
      this.parsers.set(ext, parser);
    });
  }

  getSupportedExtensions() {
    return Array.from(this.parsers.keys());
  }

  canParse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.parsers.has(ext);
  }

  getParserForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.parsers.get(ext);
  }

  async analyzeFile(filePath, sourceCode = null) {
    if (!sourceCode) {
      try {
        sourceCode = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
    }

    const parser = this.getParserForFile(filePath);
    if (!parser) {
      throw new Error(`No parser available for file: ${filePath}`);
    }

    try {
      const analysis = parser.parse(sourceCode, filePath);
      analysis.filePath = filePath;
      analysis.fileSize = sourceCode.length;
      analysis.parseTimestamp = new Date();
      
      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze ${filePath}: ${error.message}`);
    }
  }

  async analyzeFiles(filePaths, options = {}) {
    const defaultOptions = {
      parallel: true,
      maxConcurrent: 10,
      skipErrors: true,
      includeSource: false
    };

    const opts = { ...defaultOptions, ...options };
    const results = [];
    const errors = [];

    if (opts.parallel) {
      // Process files in batches to avoid overwhelming the system
      const batches = this._createBatches(filePaths, opts.maxConcurrent);
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (filePath) => {
          try {
            const result = await this.analyzeFile(filePath);
            if (!opts.includeSource) {
              delete result.sourceCode;
            }
            return result;
          } catch (error) {
            if (opts.skipErrors) {
              errors.push({ filePath, error: error.message });
              return null;
            } else {
              throw error;
            }
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null));
      }
    } else {
      // Sequential processing
      for (const filePath of filePaths) {
        try {
          const result = await this.analyzeFile(filePath);
          if (!opts.includeSource) {
            delete result.sourceCode;
          }
          results.push(result);
        } catch (error) {
          if (opts.skipErrors) {
            errors.push({ filePath, error: error.message });
          } else {
            throw error;
          }
        }
      }
    }

    return {
      results,
      errors,
      summary: this.generateSummary(results),
      timestamp: new Date()
    };
  }

  async analyzeDirectory(directoryPath, options = {}) {
    const defaultOptions = {
      recursive: true,
      extensions: this.getSupportedExtensions(),
      exclude: ['node_modules', '.git', 'dist', 'build', 'coverage'],
      maxFiles: 1000
    };

    const opts = { ...defaultOptions, ...options };
    
    const files = await this._findSourceFiles(directoryPath, opts);
    
    if (files.length === 0) {
      return {
        results: [],
        errors: [],
        summary: { totalFiles: 0, languages: {}, totalFunctions: 0, totalClasses: 0 },
        timestamp: new Date()
      };
    }

    console.log(`🔍 Found ${files.length} files to analyze in ${directoryPath}`);
    
    return await this.analyzeFiles(files, {
      parallel: opts.parallel !== false,
      maxConcurrent: opts.maxConcurrent || 10,
      skipErrors: opts.skipErrors !== false
    });
  }

  generateSummary(results) {
    const summary = {
      totalFiles: results.length,
      languages: {},
      totalFunctions: 0,
      totalClasses: 0,
      totalLines: 0,
      averageComplexity: 0,
      filesByComplexity: {
        low: 0,
        medium: 0,
        high: 0
      },
      mostComplexFiles: [],
      languageDistribution: {},
      errorFiles: []
    };

    let totalComplexity = 0;

    results.forEach(result => {
      // Language statistics
      const lang = result.language || 'unknown';
      if (!summary.languages[lang]) {
        summary.languages[lang] = {
          files: 0,
          functions: 0,
          classes: 0,
          lines: 0,
          avgComplexity: 0
        };
      }

      const langStats = summary.languages[lang];
      langStats.files++;
      langStats.functions += result.functions?.length || 0;
      langStats.classes += result.classes?.length || 0;
      langStats.lines += result.complexity?.linesOfCode || 0;

      // Overall statistics
      summary.totalFunctions += result.functions?.length || 0;
      summary.totalClasses += result.classes?.length || 0;
      summary.totalLines += result.complexity?.linesOfCode || 0;

      const fileComplexity = result.complexity?.cyclomaticComplexity || 0;
      totalComplexity += fileComplexity;

      // Complexity categorization
      if (fileComplexity < 10) {
        summary.filesByComplexity.low++;
      } else if (fileComplexity < 25) {
        summary.filesByComplexity.medium++;
      } else {
        summary.filesByComplexity.high++;
      }

      // Track most complex files
      if (fileComplexity > 0) {
        summary.mostComplexFiles.push({
          filePath: result.filePath,
          complexity: fileComplexity,
          functions: result.functions?.length || 0,
          classes: result.classes?.length || 0
        });
      }

      // Track files with errors
      if (result.errors && result.errors.length > 0) {
        summary.errorFiles.push({
          filePath: result.filePath,
          errors: result.errors
        });
      }
    });

    // Calculate averages
    summary.averageComplexity = results.length > 0 ? totalComplexity / results.length : 0;
    
    // Sort most complex files
    summary.mostComplexFiles = summary.mostComplexFiles
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10);

    // Calculate language averages
    Object.values(summary.languages).forEach(langStats => {
      langStats.avgComplexity = langStats.files > 0 ? 
        (langStats.lines / langStats.files) : 0;
    });

    return summary;
  }

  async _findSourceFiles(directoryPath, options) {
    const files = [];
    const extensions = new Set(options.extensions.map(ext => ext.toLowerCase()));
    const excludeDirs = new Set(options.exclude);

    async function walkDir(currentPath, depth = 0) {
      if (depth > 20) return; // Prevent infinite recursion

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            if (options.recursive && !excludeDirs.has(entry.name)) {
              await walkDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.has(ext)) {
              files.push(fullPath);
              
              if (files.length >= options.maxFiles) {
                console.warn(`⚠️  Reached maximum file limit (${options.maxFiles}). Stopping search.`);
                return;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Cannot read directory ${currentPath}: ${error.message}`);
      }
    }

    await walkDir(directoryPath);
    return files;
  }

  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // Utility methods for integration
  async analyzeForGraph(filePaths, options = {}) {
    const analysis = await this.analyzeFiles(filePaths, options);
    
    // Transform results for graph integration
    const graphData = analysis.results.map(result => ({
      filePath: result.filePath,
      language: result.language,
      functions: result.functions.map(func => ({
        name: func.name,
        complexity: func.complexity,
        location: func.location,
        parameters: func.parameters
      })),
      classes: result.classes.map(cls => ({
        name: cls.name,
        methods: cls.methods,
        inheritance: cls.inheritance,
        location: cls.location
      })),
      imports: result.imports,
      exports: result.exports,
      complexity: result.complexity,
      dependencies: this._extractDependencies(result)
    }));

    return {
      files: graphData,
      summary: analysis.summary,
      errors: analysis.errors
    };
  }

  _extractDependencies(astResult) {
    const dependencies = [];
    
    // Extract from imports
    astResult.imports.forEach(imp => {
      dependencies.push({
        type: 'import',
        module: imp.module,
        items: imp.imports,
        location: imp.location
      });
    });

    // Extract function calls (simple heuristic)
    astResult.functions.forEach(func => {
      // This would need more sophisticated analysis
      // For now, we'll just track the function existence
      dependencies.push({
        type: 'function',
        name: func.name,
        file: astResult.filePath
      });
    });

    return dependencies;
  }
}

module.exports = ASTAnalyzer;