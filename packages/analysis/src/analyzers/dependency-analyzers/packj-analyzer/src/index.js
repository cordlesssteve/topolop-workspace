const { spawn } = require('child_process');
const fs = require('fs-extra');

/**
 * Packj Analyzer - Python Package Security Analysis for Topolop
 *
 * Integrates Packj for comprehensive Python package security analysis.
 * Packj provides risk assessment and vulnerability detection for PyPI packages.
 */
class PackjAnalyzer {
  constructor(config = {}) {
    this.config = {
      packjPath: config.packjPath || 'packj',
      timeout: config.timeout || 180000, // 3 minutes
      workingDirectory: config.workingDirectory || process.cwd(),
      ...config
    };
    
    console.log('🔍 Packj Analyzer initialized');
  }

  async initialize() {
    // Test packj availability
    try {
      const result = await this._executeCommand([this.config.packjPath, '--version']);
      console.log(`✅ Packj ready: ${result.stdout.trim()}`);
      return { success: true, tool: 'packj' };
    } catch (error) {
      throw new Error(`Packj not available: ${error.message}`);
    }
  }

  async analyzePackage(packageName, version = 'latest', options = {}) {
    try {
      console.log(`🔍 Analyzing Python package: ${packageName}@${version}`);
      
      const args = [this.config.packjPath, 'audit', packageName];
      if (version !== 'latest') {
        args.push(`==${version}`);
      }
      
      const result = await this._executeCommand(args);
      
      // Parse packj output (typically JSON)
      let data = {};
      try {
        data = JSON.parse(result.stdout);
      } catch (parseError) {
        data = { raw_output: result.stdout, error: 'Parse failed' };
      }

      return {
        success: true,
        tool: 'packj',
        data: data,
        package: packageName,
        version: version
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'packj',
        package: packageName
      };
    }
  }

  async _executeCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(args[0], args.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ returncode: code, stdout, stderr });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  getInfo() {
    return {
      name: 'packj',
      displayName: 'Packj',
      description: 'Python package security and risk assessment',
      analysisType: 'dependency_security'
    };
  }
}

module.exports = PackjAnalyzer;