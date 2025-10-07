const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const execAsync = promisify(exec);

/**
 * GitHub CodeQL CLI Client
 * 
 * Handles execution of CodeQL CLI commands for semantic code analysis.
 * Manages database creation, query execution, and SARIF output parsing.
 */
class CodeQLClient {
  constructor(config = {}) {
    this.codeqlPath = config.codeqlPath || 'codeql';
    this.timeout = config.timeout || 600000; // 10 minutes default for DB creation
    this.maxBuffer = config.maxBuffer || 1024 * 1024 * 50; // 50MB buffer
    this.workingDirectory = config.workingDirectory || process.cwd();
    this.databasesDirectory = config.databasesDirectory || path.join(this.workingDirectory, '.topolop', 'codeql-databases');
    
    console.log('🔍 CodeQL Client initialized');
    console.log(`   📍 CodeQL path: ${this.codeqlPath}`);
    console.log(`   🗄️  Databases: ${this.databasesDirectory}`);
  }

  /**
   * Test if CodeQL CLI is available and get version info
   */
  async testConnection() {
    try {
      const { stdout } = await execAsync(`${this.codeqlPath} version`, {
        timeout: 10000,
        maxBuffer: this.maxBuffer
      });
      
      const version = stdout.trim();
      console.log(`✅ CodeQL available: ${version}`);
      
      return {
        success: true,
        version: version,
        codeqlPath: this.codeqlPath
      };
    } catch (error) {
      console.error('❌ CodeQL not available:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create CodeQL database from source code
   */
  async createDatabase(sourcePath, language, options = {}) {
    console.log(`🏗️  Creating CodeQL database for ${language}...`);
    console.log(`   📁 Source: ${sourcePath}`);
    
    const databaseName = this._generateDatabaseName(sourcePath, language);
    const databasePath = path.join(this.databasesDirectory, databaseName);
    
    // Check if database already exists
    if (await this._databaseExists(databasePath) && !options.overwrite) {
      console.log(`✅ Database already exists: ${databasePath}`);
      return {
        databasePath,
        created: false,
        reused: true
      };
    }

    // Ensure databases directory exists
    await this._ensureDirectoryExists(this.databasesDirectory);
    
    const args = this._buildDatabaseCreateArgs(sourcePath, databasePath, language, options);
    
    try {
      console.log(`🔨 Running: codeql ${args.join(' ')}`);
      
      const { stdout, stderr } = await execAsync(`${this.codeqlPath} ${args.join(' ')}`, {
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        cwd: this.workingDirectory
      });

      if (stderr && !stderr.includes('Successfully created database')) {
        console.warn('⚠️  Database creation warnings:', stderr);
      }

      console.log(`✅ Database created: ${databasePath}`);
      
      return {
        databasePath,
        created: true,
        reused: false,
        stdout,
        stderr
      };
    } catch (error) {
      console.error(`❌ Database creation failed: ${error.message}`);
      throw new Error(`CodeQL database creation failed: ${error.message}`);
    }
  }

  /**
   * Run analysis queries against a CodeQL database
   */
  async analyzeDatabase(databasePath, options = {}) {
    console.log(`🔍 Analyzing CodeQL database: ${databasePath}`);
    
    const outputFile = options.outputFile || path.join(path.dirname(databasePath), `${path.basename(databasePath)}_results.sarif`);
    const queries = options.queries || this._getDefaultQueries(options.language);
    
    const args = this._buildAnalyzeArgs(databasePath, outputFile, queries, options);
    
    try {
      console.log(`🔨 Running: codeql ${args.join(' ')}`);
      
      const { stdout, stderr } = await execAsync(`${this.codeqlPath} ${args.join(' ')}`, {
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        cwd: this.workingDirectory
      });

      if (stderr && !stderr.includes('Successfully finished running queries')) {
        console.warn('⚠️  Analysis warnings:', stderr);
      }

      // Read and parse SARIF output
      const sarifContent = await fs.readFile(outputFile, 'utf8');
      const sarifData = JSON.parse(sarifContent);

      console.log(`✅ Analysis complete: ${sarifData.runs?.[0]?.results?.length || 0} results`);

      return {
        databasePath,
        outputFile,
        sarifData,
        results: sarifData.runs?.[0]?.results || [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          queries: queries,
          toolVersion: sarifData.runs?.[0]?.tool?.driver?.version,
          executionTime: this._extractExecutionTime(stdout, stderr)
        }
      };
    } catch (error) {
      console.error(`❌ CodeQL analysis failed: ${error.message}`);
      throw new Error(`CodeQL analysis failed: ${error.message}`);
    }
  }

  /**
   * Full analysis workflow: create database + run analysis
   */
  async analyze(sourcePath, language, options = {}) {
    console.log(`🔍 Starting full CodeQL analysis: ${sourcePath}`);
    console.log(`   🎯 Language: ${language}`);

    try {
      // Step 1: Create database
      const dbResult = await this.createDatabase(sourcePath, language, {
        overwrite: options.overwriteDatabase,
        threads: options.threads,
        buildMode: options.buildMode
      });

      // Step 2: Run analysis
      const analysisResult = await this.analyzeDatabase(dbResult.databasePath, {
        language: language,
        queries: options.queries,
        outputFile: options.outputFile,
        format: options.format || 'sarif'
      });

      return {
        sourcePath,
        language,
        database: dbResult,
        analysis: analysisResult,
        metadata: {
          analyzedAt: new Date().toISOString(),
          fullWorkflow: true,
          databaseReused: dbResult.reused
        }
      };
    } catch (error) {
      console.error(`❌ Full CodeQL analysis failed for ${sourcePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get available languages supported by CodeQL
   */
  async getSupportedLanguages() {
    try {
      const { stdout } = await execAsync(`${this.codeqlPath} resolve languages`, {
        timeout: 10000,
        maxBuffer: this.maxBuffer
      });

      const languages = stdout.trim().split('\n').filter(line => line.trim());
      console.log(`📋 Supported languages: ${languages.join(', ')}`);
      
      return languages;
    } catch (error) {
      console.error('❌ Failed to get supported languages:', error.message);
      return ['cpp', 'csharp', 'go', 'java', 'javascript', 'python', 'ruby']; // Default fallback
    }
  }

  /**
   * List available query suites
   */
  async getAvailableQueries(language) {
    try {
      const { stdout } = await execAsync(`${this.codeqlPath} resolve queries ${language}-queries`, {
        timeout: 15000,
        maxBuffer: this.maxBuffer
      });

      const queries = stdout.trim().split('\n').filter(line => line.includes('.ql'));
      console.log(`📋 Available ${language} queries: ${queries.length} found`);
      
      return {
        language,
        queries: queries.slice(0, 20), // Limit output
        total: queries.length
      };
    } catch (error) {
      console.warn(`⚠️  Could not resolve queries for ${language}:`, error.message);
      return {
        language,
        queries: [],
        total: 0
      };
    }
  }

  /**
   * List existing CodeQL databases
   */
  async listDatabases() {
    try {
      if (!(await this._directoryExists(this.databasesDirectory))) {
        return [];
      }

      const entries = await fs.readdir(this.databasesDirectory, { withFileTypes: true });
      const databases = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dbPath = path.join(this.databasesDirectory, entry.name);
          const info = await this._getDatabaseInfo(dbPath);
          databases.push({
            name: entry.name,
            path: dbPath,
            ...info
          });
        }
      }

      console.log(`📊 Found ${databases.length} CodeQL databases`);
      return databases;
    } catch (error) {
      console.error('❌ Failed to list databases:', error.message);
      return [];
    }
  }

  /**
   * Clean up old databases
   */
  async cleanupDatabases(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const databases = await this.listDatabases();
      const cutoffTime = Date.now() - maxAge;
      let cleanedCount = 0;

      for (const db of databases) {
        if (db.created && new Date(db.created).getTime() < cutoffTime) {
          console.log(`🗑️  Cleaning up old database: ${db.name}`);
          await fs.rm(db.path, { recursive: true, force: true });
          cleanedCount++;
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} old databases`);
      return { cleanedCount, totalDatabases: databases.length };
    } catch (error) {
      console.error('❌ Database cleanup failed:', error.message);
      return { cleanedCount: 0, totalDatabases: 0 };
    }
  }

  /**
   * Get configuration status
   */
  getConfigurationStatus() {
    return {
      configured: true, // CodeQL doesn't require tokens, just CLI availability
      codeqlPath: this.codeqlPath,
      databasesDirectory: this.databasesDirectory,
      requirements: [
        {
          type: 'binary',
          name: 'codeql',
          description: 'CodeQL CLI tool must be installed and available in PATH',
          required: true,
          installInstructions: 'Download from: https://github.com/github/codeql-cli-binaries/releases'
        },
        {
          type: 'disk_space',
          name: 'storage',
          description: 'Adequate disk space for database creation (can be several GB per project)',
          required: true
        }
      ]
    };
  }

  // Helper methods

  _generateDatabaseName(sourcePath, language) {
    const basename = path.basename(sourcePath);
    const hash = crypto.createHash('md5').update(sourcePath).digest('hex').substring(0, 8);
    return `${basename}_${language}_${hash}`;
  }

  async _databaseExists(databasePath) {
    try {
      const stat = await fs.stat(databasePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async _directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async _ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async _getDatabaseInfo(databasePath) {
    try {
      const stat = await fs.stat(databasePath);
      const dbYamlPath = path.join(databasePath, 'codeql-database.yml');
      
      let language = 'unknown';
      let created = stat.birthtime.toISOString();
      
      try {
        const dbYaml = await fs.readFile(dbYamlPath, 'utf8');
        const langMatch = dbYaml.match(/primaryLanguage:\s*(.+)/);
        if (langMatch) {
          language = langMatch[1].trim();
        }
      } catch {
        // Database YAML not readable, use defaults
      }

      return {
        language,
        created,
        size: stat.size
      };
    } catch (error) {
      return {
        language: 'unknown',
        created: null,
        size: 0,
        error: error.message
      };
    }
  }

  _buildDatabaseCreateArgs(sourcePath, databasePath, language, options = {}) {
    const args = ['database', 'create'];
    
    args.push(databasePath);
    args.push('--language', language);
    args.push('--source-root', sourcePath);
    
    if (options.threads) {
      args.push('--threads', options.threads.toString());
    }
    
    if (options.buildMode) {
      args.push('--build-mode', options.buildMode);
    }
    
    // Quiet output for cleaner logs
    args.push('--quiet');
    
    return args;
  }

  _buildAnalyzeArgs(databasePath, outputFile, queries, options = {}) {
    const args = ['database', 'analyze'];
    
    args.push(databasePath);
    args.push('--format', options.format || 'sarif-latest');
    args.push('--output', outputFile);
    
    if (Array.isArray(queries)) {
      queries.forEach(query => args.push('--query', query));
    } else if (queries) {
      args.push('--query', queries);
    }
    
    if (options.threads) {
      args.push('--threads', options.threads.toString());
    }
    
    args.push('--quiet');
    
    return args;
  }

  _getDefaultQueries(language) {
    // Default security-focused query suites
    const queryMap = {
      'javascript': 'javascript-queries:Security/CWE',
      'python': 'python-queries:Security/CWE',
      'java': 'java-queries:Security/CWE',
      'cpp': 'cpp-queries:Security/CWE',
      'csharp': 'csharp-queries:Security/CWE',
      'go': 'go-queries:Security/CWE',
      'ruby': 'ruby-queries:Security/CWE'
    };
    
    return queryMap[language] || `${language}-queries`;
  }

  /**
   * Validate that target path exists and is accessible
   */
  async validateTarget(targetPath) {
    try {
      const stats = await fs.stat(targetPath);
      return {
        valid: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        path: targetPath
      };
    } catch (error) {
      return {
        valid: false,
        error: `Path does not exist or is not accessible: ${error.message}`
      };
    }
  }

  _extractExecutionTime(stdout, stderr) {
    // Try to extract execution time from CodeQL output
    const output = `${stdout}\n${stderr}`;
    const timeMatch = output.match(/Finished running queries in (\d+(?:\.\d+)?)\s*(\w+)/);
    
    if (timeMatch) {
      return `${timeMatch[1]} ${timeMatch[2]}`;
    }
    
    return 'unknown';
  }
}

module.exports = CodeQLClient;