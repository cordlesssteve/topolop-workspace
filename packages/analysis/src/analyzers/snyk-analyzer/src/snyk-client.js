const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

/**
 * Snyk CLI Client
 * 
 * Handles communication with Snyk CLI for dependency vulnerability scanning.
 * Supports both open source and code analysis through Snyk's command line interface.
 */
class SnykClient {
  constructor(config = {}) {
    this.config = {
      snykPath: config.snykPath || 'snyk',
      timeout: config.timeout || 300000, // 5 minutes for dependency analysis
      maxBuffer: config.maxBuffer || 1024 * 1024 * 10, // 10MB buffer
      workingDirectory: config.workingDirectory || process.cwd(),
      ...config
    };

    // Track if authentication was tested
    this.authenticated = false;
  }

  /**
   * Test Snyk CLI availability and version
   */
  async testConnection() {
    try {
      const result = await this._executeSnykCommand(['--version'], {
        timeout: 10000
      });

      if (result.error) {
        return {
          success: false,
          error: `Snyk CLI not available: ${result.error}`
        };
      }

      const version = result.stdout.trim();
      
      return {
        success: true,
        version: version,
        binary: this.config.snykPath,
        authenticated: this.authenticated
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Snyk authentication status
   */
  async testAuthentication() {
    try {
      // Use snyk config get to test auth without making API calls
      const result = await this._executeSnykCommand(['config', 'get', 'api'], {
        timeout: 10000
      });

      if (result.error || !result.stdout.trim()) {
        this.authenticated = false;
        return {
          success: false,
          error: 'Snyk not authenticated. Run `snyk auth` to authenticate.',
          requiresAuth: true
        };
      }

      this.authenticated = true;
      return {
        success: true,
        authenticated: true
      };
    } catch (error) {
      this.authenticated = false;
      return {
        success: false,
        error: error.message,
        requiresAuth: true
      };
    }
  }

  /**
   * Validate target path for analysis
   */
  async validateTarget(targetPath) {
    try {
      const fullPath = path.resolve(targetPath);
      
      if (!await fs.pathExists(fullPath)) {
        return {
          valid: false,
          error: `Target path does not exist: ${fullPath}`
        };
      }

      const stat = await fs.lstat(fullPath);
      const isDirectory = stat.isDirectory();

      // For directories, check for supported manifest files
      if (isDirectory) {
        const manifestFiles = [
          'package.json', 'package-lock.json', 'yarn.lock', 
          'requirements.txt', 'Pipfile', 'poetry.lock',
          'Gemfile', 'Gemfile.lock',
          'pom.xml', 'build.gradle', 'build.sbt',
          'composer.json', 'composer.lock',
          'go.mod', 'go.sum',
          'Cargo.toml', 'Cargo.lock'
        ];

        const hasManifest = await Promise.all(
          manifestFiles.map(file => 
            fs.pathExists(path.join(fullPath, file))
          )
        );

        if (!hasManifest.some(exists => exists)) {
          return {
            valid: false,
            error: `No supported manifest files found in ${fullPath}. Snyk requires dependency manifests to scan.`
          };
        }
      }

      return {
        valid: true,
        path: fullPath,
        isDirectory,
        type: isDirectory ? 'directory' : 'file'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Run dependency vulnerability analysis
   */
  async analyze(targetPath, options = {}) {
    // Validate authentication first
    if (!this.authenticated) {
      const authTest = await this.testAuthentication();
      if (!authTest.success) {
        throw new Error(`Snyk authentication required: ${authTest.error}`);
      }
    }

    const validation = await this.validateTarget(targetPath);
    if (!validation.valid) {
      throw new Error(`Invalid target: ${validation.error}`);
    }

    console.log(`🔍 Running Snyk analysis on: ${targetPath}`);

    try {
      // Build command arguments
      const args = ['test', '--json'];
      
      // Add optional parameters
      if (options.severityThreshold) {
        args.push(`--severity-threshold=${options.severityThreshold}`);
      }
      
      if (options.failOn) {
        args.push(`--fail-on=${options.failOn}`);
      }

      if (options.file) {
        args.push(`--file=${options.file}`);
      }

      if (options.packageManager) {
        args.push(`--package-manager=${options.packageManager}`);
      }

      if (options.allProjects) {
        args.push('--all-projects');
      }

      if (options.dev !== false) {
        args.push('--dev'); // Include dev dependencies by default
      }

      // Execute analysis
      const result = await this._executeSnykCommand(args, {
        cwd: path.resolve(targetPath),
        timeout: this.config.timeout,
        maxBuffer: this.config.maxBuffer
      });

      // Snyk returns exit code 1 when vulnerabilities are found, which is expected
      if (result.error && !result.stdout) {
        throw new Error(`Snyk analysis failed: ${result.error}`);
      }

      // Parse JSON output
      let analysisData;
      try {
        analysisData = JSON.parse(result.stdout);
      } catch (parseError) {
        throw new Error(`Failed to parse Snyk JSON output: ${parseError.message}`);
      }

      // Add metadata
      analysisData.metadata = {
        analyzedAt: new Date().toISOString(),
        targetPath: path.resolve(targetPath),
        snykVersion: (await this.testConnection()).version,
        options: options
      };

      return analysisData;
    } catch (error) {
      console.error(`❌ Snyk analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run container vulnerability analysis
   */
  async analyzeContainer(imageName, options = {}) {
    if (!this.authenticated) {
      const authTest = await this.testAuthentication();
      if (!authTest.success) {
        throw new Error(`Snyk authentication required: ${authTest.error}`);
      }
    }

    console.log(`🐳 Running Snyk container analysis on: ${imageName}`);

    try {
      const args = ['container', 'test', imageName, '--json'];
      
      if (options.severityThreshold) {
        args.push(`--severity-threshold=${options.severityThreshold}`);
      }

      if (options.file) {
        args.push(`--file=${options.file}`);
      }

      const result = await this._executeSnykCommand(args, {
        timeout: this.config.timeout,
        maxBuffer: this.config.maxBuffer
      });

      if (result.error && !result.stdout) {
        throw new Error(`Snyk container analysis failed: ${result.error}`);
      }

      let analysisData;
      try {
        analysisData = JSON.parse(result.stdout);
      } catch (parseError) {
        throw new Error(`Failed to parse Snyk container JSON output: ${parseError.message}`);
      }

      analysisData.metadata = {
        analyzedAt: new Date().toISOString(),
        targetImage: imageName,
        snykVersion: (await this.testConnection()).version,
        options: options,
        analysisType: 'container'
      };

      return analysisData;
    } catch (error) {
      console.error(`❌ Snyk container analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run code analysis (SAST)
   */
  async analyzeCode(targetPath, options = {}) {
    if (!this.authenticated) {
      const authTest = await this.testAuthentication();
      if (!authTest.success) {
        throw new Error(`Snyk authentication required: ${authTest.error}`);
      }
    }

    const validation = await this.validateTarget(targetPath);
    if (!validation.valid) {
      throw new Error(`Invalid target: ${validation.error}`);
    }

    console.log(`💻 Running Snyk Code analysis on: ${targetPath}`);

    try {
      const args = ['code', 'test', '--json'];
      
      if (options.severityThreshold) {
        args.push(`--severity-threshold=${options.severityThreshold}`);
      }

      const result = await this._executeSnykCommand(args, {
        cwd: path.resolve(targetPath),
        timeout: this.config.timeout,
        maxBuffer: this.config.maxBuffer
      });

      if (result.error && !result.stdout) {
        throw new Error(`Snyk Code analysis failed: ${result.error}`);
      }

      let analysisData;
      try {
        // Snyk Code might return empty output if no issues found
        if (!result.stdout.trim()) {
          analysisData = {
            ok: true,
            vulnerabilities: [],
            summary: {
              high: 0,
              medium: 0,
              low: 0
            }
          };
        } else {
          analysisData = JSON.parse(result.stdout);
        }
      } catch (parseError) {
        throw new Error(`Failed to parse Snyk Code JSON output: ${parseError.message}`);
      }

      analysisData.metadata = {
        analyzedAt: new Date().toISOString(),
        targetPath: path.resolve(targetPath),
        snykVersion: (await this.testConnection()).version,
        options: options,
        analysisType: 'code'
      };

      return analysisData;
    } catch (error) {
      console.error(`❌ Snyk Code analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get project vulnerability summary
   */
  async getProjectSummary(targetPath, options = {}) {
    const analysisData = await this.analyze(targetPath, options);
    
    if (!analysisData) {
      return null;
    }

    const summary = {
      ok: analysisData.ok || false,
      totalVulnerabilities: 0,
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      totalDependencies: 0,
      vulnerableDependencies: 0,
      licenses: [],
      uniqueCount: 0
    };

    // Extract vulnerability counts
    if (analysisData.vulnerabilities && Array.isArray(analysisData.vulnerabilities)) {
      summary.totalVulnerabilities = analysisData.vulnerabilities.length;
      
      analysisData.vulnerabilities.forEach(vuln => {
        const severity = vuln.severity?.toLowerCase();
        if (summary.severityCounts[severity] !== undefined) {
          summary.severityCounts[severity]++;
        }
      });
    }

    // Extract dependency information
    if (analysisData.dependencyCount) {
      summary.totalDependencies = analysisData.dependencyCount;
    }

    if (analysisData.summary) {
      Object.assign(summary.severityCounts, analysisData.summary);
      summary.uniqueCount = analysisData.uniqueCount || 0;
    }

    return summary;
  }

  /**
   * Execute Snyk CLI command
   */
  _executeSnykCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const command = this.config.snykPath;
      const spawnOptions = {
        cwd: options.cwd || this.config.workingDirectory,
        maxBuffer: options.maxBuffer || this.config.maxBuffer,
        ...options
      };

      console.log(`🔍 Executing: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout if specified
      let timeoutId;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Snyk command timed out after ${options.timeout}ms`));
        }, options.timeout);
      }

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        resolve({
          code,
          stdout,
          stderr,
          error: stderr && code !== 0 ? stderr : null
        });
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}

module.exports = SnykClient;