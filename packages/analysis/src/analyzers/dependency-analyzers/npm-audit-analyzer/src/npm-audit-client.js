const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { tmpdir } = require('os');

/**
 * NPM Audit Client - Topolop Dependency Analyzer
 *
 * Handles communication with npm audit for dependency vulnerability scanning.
 * Ported from security-scanner MCP to match Topolop's architecture patterns.
 */
class NPMAuditClient {
  constructor(config = {}) {
    this.config = {
      npmPath: config.npmPath || 'npm',
      timeout: config.timeout || 120000, // 2 minutes for npm operations
      maxBuffer: config.maxBuffer || 1024 * 1024 * 5, // 5MB buffer
      workingDirectory: config.workingDirectory || process.cwd(),
      ...config
    };

    // Track npm availability
    this.available = null;
  }

  /**
   * Test npm CLI availability and version
   */
  async testConnection() {
    try {
      const result = await this._executeNpmCommand(['--version'], {
        timeout: 10000
      });

      if (result.error) {
        return {
          success: false,
          error: `npm CLI not available: ${result.error}`
        };
      }

      const version = result.stdout.trim();
      this.available = true;

      return {
        success: true,
        version: version,
        binary: this.config.npmPath,
        available: true
      };
    } catch (error) {
      this.available = false;
      return {
        success: false,
        error: `npm connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze package dependencies for vulnerabilities
   *
   * @param {string} target - Package name to analyze
   * @param {string} version - Optional specific version
   * @param {Object} options - Analysis options
   * @returns {Object} NPM audit results
   */
  async analyzePackage(target, version = 'latest', options = {}) {
    try {
      if (this.available === null) {
        const connectionTest = await this.testConnection();
        if (!connectionTest.success) {
          throw new Error(connectionTest.error);
        }
      }

      // Create temporary directory for package analysis
      const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'npm-audit-'));

      try {
        // Create package.json for the target package
        const packageJson = {
          name: 'temp-audit-analysis',
          version: '1.0.0',
          dependencies: {
            [target]: version === 'latest' ? '*' : version
          }
        };

        const packageJsonPath = path.join(tempDir, 'package.json');
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

        // Change to temp directory for npm operations
        const oldCwd = process.cwd();
        process.chdir(tempDir);

        try {
          // Generate package-lock.json first
          const installResult = await this._executeNpmCommand([
            'install', '--package-lock-only', '--no-audit'
          ], {
            timeout: 60000
          });

          if (installResult.returncode !== 0) {
            console.warn(`npm install warning: ${installResult.stderr}`);
            // Continue anyway - audit might still work with package.json only
          }

          // Run npm audit
          const auditResult = await this._executeNpmCommand([
            'audit', '--json'
          ], {
            timeout: this.config.timeout
          });

          // npm audit returns non-zero when vulnerabilities found, but still outputs JSON
          let auditData = {};
          if (auditResult.stdout && auditResult.stdout.trim()) {
            try {
              auditData = JSON.parse(auditResult.stdout);
            } catch (parseError) {
              console.error('Failed to parse npm audit JSON:', parseError);
              auditData = {
                error: 'Invalid JSON output',
                raw_output: auditResult.stdout
              };
            }
          }

          return {
            success: true,
            tool: 'npm-audit',
            data: auditData,
            package: target,
            version: version,
            metadata: {
              tempDir: tempDir,
              installSuccess: installResult.returncode === 0,
              auditExitCode: auditResult.returncode
            }
          };

        } finally {
          process.chdir(oldCwd);
        }

      } finally {
        // Cleanup temp directory
        try {
          await fs.remove(tempDir);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp directory:', cleanupError);
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'npm-audit',
        package: target,
        version: version
      };
    }
  }

  /**
   * Analyze existing project directory for vulnerabilities
   *
   * @param {string} projectPath - Path to project with package.json
   * @param {Object} options - Analysis options
   * @returns {Object} NPM audit results
   */
  async analyzeProject(projectPath = process.cwd(), options = {}) {
    try {
      if (this.available === null) {
        const connectionTest = await this.testConnection();
        if (!connectionTest.success) {
          throw new Error(connectionTest.error);
        }
      }

      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonExists = await fs.pathExists(packageJsonPath);

      if (!packageJsonExists) {
        return {
          success: false,
          error: 'No package.json found in project directory',
          tool: 'npm-audit',
          projectPath: projectPath
        };
      }

      // Change to project directory
      const oldCwd = process.cwd();
      process.chdir(projectPath);

      try {
        // Run npm audit
        const auditResult = await this._executeNpmCommand([
          'audit', '--json'
        ], {
          timeout: this.config.timeout
        });

        // Parse audit results
        let auditData = {};
        if (auditResult.stdout && auditResult.stdout.trim()) {
          try {
            auditData = JSON.parse(auditResult.stdout);
          } catch (parseError) {
            console.error('Failed to parse npm audit JSON:', parseError);
            auditData = {
              error: 'Invalid JSON output',
              raw_output: auditResult.stdout
            };
          }
        }

        return {
          success: true,
          tool: 'npm-audit',
          data: auditData,
          projectPath: projectPath,
          metadata: {
            auditExitCode: auditResult.returncode,
            hasLockFile: await fs.pathExists(path.join(projectPath, 'package-lock.json'))
          }
        };

      } finally {
        process.chdir(oldCwd);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'npm-audit',
        projectPath: projectPath
      };
    }
  }

  /**
   * Execute npm command with proper error handling
   *
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Object} Command result
   */
  async _executeNpmCommand(args, options = {}) {
    return new Promise((resolve) => {
      const timeout = options.timeout || this.config.timeout;
      const fullCommand = [this.config.npmPath, ...args];

      console.log(`🔧 Executing: ${fullCommand.join(' ')}`);

      const child = spawn(this.config.npmPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: this.config.maxBuffer
      });

      let stdout = '';
      let stderr = '';
      let timeoutId;

      // Set timeout
      if (timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({
            error: 'Command timed out',
            timeout: true,
            returncode: -1,
            stdout: stdout,
            stderr: stderr
          });
        }, timeout);
      }

      // Collect output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      child.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          returncode: code,
          stdout: stdout,
          stderr: stderr,
          command: fullCommand.join(' '),
          timestamp: new Date().toISOString()
        });
      });

      // Handle errors
      child.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          error: error.message,
          returncode: -1,
          stdout: stdout,
          stderr: stderr,
          command: fullCommand.join(' ')
        });
      });
    });
  }
}

module.exports = NPMAuditClient;