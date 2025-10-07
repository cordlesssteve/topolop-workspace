const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { tmpdir } = require('os');

/**
 * OSV-Scanner Client - Topolop Dependency Analyzer
 *
 * Handles communication with OSV-Scanner for multi-ecosystem vulnerability scanning.
 * OSV-Scanner supports npm, PyPI, Go, Rust, Maven, and many other package ecosystems.
 * Ported from security-scanner MCP to match Topolop's architecture patterns.
 */
class OSVClient {
  constructor(config = {}) {
    this.config = {
      osvPath: config.osvPath || this._getDefaultOSVPath(),
      timeout: config.timeout || 300000, // 5 minutes for comprehensive scanning
      maxBuffer: config.maxBuffer || 1024 * 1024 * 10, // 10MB buffer
      workingDirectory: config.workingDirectory || process.cwd(),
      ...config
    };

    // Track OSV-Scanner availability
    this.available = null;
  }

  /**
   * Get default OSV-Scanner path based on common installation locations
   */
  _getDefaultOSVPath() {
    const commonPaths = [
      'osv-scanner',
      path.join(process.env.HOME || '', 'scripts', 'osv-scanner'),
      path.join(process.env.HOME || '', 'bin', 'osv-scanner'),
      '/usr/local/bin/osv-scanner',
      './osv-scanner'
    ];

    // Return the first path that exists, or default to 'osv-scanner'
    for (const osvPath of commonPaths) {
      try {
        if (fs.existsSync(osvPath)) {
          return osvPath;
        }
      } catch (error) {
        // Continue checking other paths
      }
    }

    return 'osv-scanner'; // Default, assume it's in PATH
  }

  /**
   * Test OSV-Scanner CLI availability and version
   */
  async testConnection() {
    try {
      const result = await this._executeOSVCommand(['--version'], {
        timeout: 10000
      });

      if (result.error) {
        return {
          success: false,
          error: `OSV-Scanner not available: ${result.error}`
        };
      }

      // OSV-Scanner version output format: "osv-scanner version: vX.X.X"
      const versionMatch = result.stdout.match(/version:\s*v?([^\s\n]+)/i);
      const version = versionMatch ? versionMatch[1] : result.stdout.trim();
      this.available = true;

      return {
        success: true,
        version: version,
        binary: this.config.osvPath,
        available: true
      };
    } catch (error) {
      this.available = false;
      return {
        success: false,
        error: `OSV-Scanner connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze package using lockfile generation
   *
   * @param {string} target - Package name to analyze
   * @param {string} packageManager - Package manager (npm, pypi, cargo, etc.)
   * @param {string} version - Optional specific version
   * @param {Object} options - Analysis options
   * @returns {Object} OSV scan results
   */
  async analyzePackage(target, packageManager = 'npm', version = 'latest', options = {}) {
    try {
      if (this.available === null) {
        const connectionTest = await this.testConnection();
        if (!connectionTest.success) {
          throw new Error(connectionTest.error);
        }
      }

      // Create temporary directory for package analysis
      const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'osv-scan-'));

      try {
        // Generate appropriate lockfile based on package manager
        await this._generateLockfile(tempDir, target, packageManager, version);

        // Run OSV-Scanner on the generated lockfile
        const scanResult = await this._scanDirectory(tempDir, options);

        return {
          success: true,
          tool: 'osv-scanner',
          data: scanResult.data,
          package: target,
          packageManager: packageManager,
          version: version,
          metadata: {
            tempDir: tempDir,
            scanExitCode: scanResult.returncode,
            lockfileGenerated: true
          }
        };

      } finally {
        // Cleanup temp directory
        try {
          await fs.remove(tempDir);
        } catch (cleanupError) {
          console.warn('Failed to cleanup OSV temp directory:', cleanupError);
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'osv-scanner',
        package: target,
        packageManager: packageManager,
        version: version
      };
    }
  }

  /**
   * Analyze existing project directory for vulnerabilities
   *
   * @param {string} projectPath - Path to project directory
   * @param {Object} options - Analysis options
   * @returns {Object} OSV scan results
   */
  async analyzeProject(projectPath = process.cwd(), options = {}) {
    try {
      if (this.available === null) {
        const connectionTest = await this.testConnection();
        if (!connectionTest.success) {
          throw new Error(connectionTest.error);
        }
      }

      // Detect lockfiles in the project
      const lockfiles = await this._detectLockfiles(projectPath);

      if (lockfiles.length === 0) {
        return {
          success: false,
          error: 'No supported lockfiles found in project directory',
          tool: 'osv-scanner',
          projectPath: projectPath,
          supportedFiles: [
            'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
            'Pipfile.lock', 'poetry.lock', 'requirements.txt',
            'Cargo.lock', 'go.mod', 'go.sum',
            'composer.lock', 'Gemfile.lock'
          ]
        };
      }

      console.log(`📁 Found lockfiles: ${lockfiles.join(', ')}`);

      // Run OSV-Scanner on the project directory
      const scanResult = await this._scanDirectory(projectPath, options);

      return {
        success: true,
        tool: 'osv-scanner',
        data: scanResult.data,
        projectPath: projectPath,
        metadata: {
          lockfilesFound: lockfiles,
          scanExitCode: scanResult.returncode
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'osv-scanner',
        projectPath: projectPath
      };
    }
  }

  /**
   * Generate lockfile for specific package and ecosystem
   *
   * @param {string} tempDir - Temporary directory
   * @param {string} target - Package name
   * @param {string} packageManager - Package manager
   * @param {string} version - Package version
   */
  async _generateLockfile(tempDir, target, packageManager, version) {
    switch (packageManager.toLowerCase()) {
      case 'npm':
        await this._generateNPMLockfile(tempDir, target, version);
        break;
      case 'pypi':
      case 'pip':
        await this._generatePythonLockfile(tempDir, target, version);
        break;
      case 'cargo':
      case 'rust':
        await this._generateCargoLockfile(tempDir, target, version);
        break;
      default:
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }

  /**
   * Generate npm lockfile for package analysis
   */
  async _generateNPMLockfile(tempDir, target, version) {
    const packageJson = {
      name: 'temp-osv-scan',
      version: '1.0.0',
      dependencies: {
        [target]: version === 'latest' ? '*' : version
      }
    };

    const packageJsonPath = path.join(tempDir, 'package.json');
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    // Generate package-lock.json using npm
    const installResult = await this._executeCommand('npm', [
      'install', '--package-lock-only', '--no-audit'
    ], { cwd: tempDir, timeout: 60000 });

    if (installResult.returncode !== 0) {
      console.warn(`npm install warning: ${installResult.stderr}`);
    }
  }

  /**
   * Generate Python requirements for package analysis
   */
  async _generatePythonLockfile(tempDir, target, version) {
    const requirements = version === 'latest'
      ? `${target}\n`
      : `${target}==${version}\n`;

    const requirementsPath = path.join(tempDir, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements);
  }

  /**
   * Generate Cargo.toml for Rust package analysis
   */
  async _generateCargoLockfile(tempDir, target, version) {
    const cargoToml = `[package]
name = "temp-osv-scan"
version = "0.1.0"
edition = "2021"

[dependencies]
${target} = "${version === 'latest' ? '*' : version}"
`;

    const cargoTomlPath = path.join(tempDir, 'Cargo.toml');
    await fs.writeFile(cargoTomlPath, cargoToml);
  }

  /**
   * Detect supported lockfiles in project directory
   */
  async _detectLockfiles(projectPath) {
    const supportedFiles = [
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'Pipfile.lock', 'poetry.lock', 'requirements.txt',
      'Cargo.lock', 'go.mod', 'go.sum',
      'composer.lock', 'Gemfile.lock'
    ];

    const foundFiles = [];

    for (const file of supportedFiles) {
      const filePath = path.join(projectPath, file);
      if (await fs.pathExists(filePath)) {
        foundFiles.push(file);
      }
    }

    return foundFiles;
  }

  /**
   * Run OSV-Scanner on directory
   */
  async _scanDirectory(dirPath, options = {}) {
    const args = [
      '--json',
      '--format', 'json'
    ];

    // Add recursive flag for project scanning
    if (options.recursive !== false) {
      args.push('-r');
    }

    // Add directory path
    args.push(dirPath);

    const result = await this._executeOSVCommand(args, {
      timeout: this.config.timeout
    });

    // OSV-Scanner returns non-zero when vulnerabilities found
    let data = {};
    if (result.stdout && result.stdout.trim()) {
      try {
        data = JSON.parse(result.stdout);
      } catch (parseError) {
        console.error('Failed to parse OSV-Scanner JSON:', parseError);
        data = {
          error: 'Invalid JSON output',
          raw_output: result.stdout
        };
      }
    }

    return {
      data: data,
      returncode: result.returncode
    };
  }

  /**
   * Execute OSV-Scanner command with proper error handling
   */
  async _executeOSVCommand(args, options = {}) {
    return this._executeCommand(this.config.osvPath, args, options);
  }

  /**
   * Execute command with proper error handling
   *
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Object} Command result
   */
  async _executeCommand(command, args, options = {}) {
    return new Promise((resolve) => {
      const timeout = options.timeout || this.config.timeout;
      const cwd = options.cwd || this.config.workingDirectory;
      const fullCommand = [command, ...args];

      console.log(`🔧 Executing: ${fullCommand.join(' ')}`);

      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: this.config.maxBuffer,
        cwd: cwd
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

module.exports = OSVClient;