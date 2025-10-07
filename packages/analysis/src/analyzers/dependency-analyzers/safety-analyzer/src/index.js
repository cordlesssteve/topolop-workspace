const { spawn } = require('child_process');

/**
 * Safety Analyzer - Python Package Safety Scanner for Topolop
 */
class SafetyAnalyzer {
  constructor(config = {}) {
    this.config = {
      safetyPath: config.safetyPath || 'safety',
      timeout: config.timeout || 120000,
      ...config
    };
    console.log('🔍 Safety Analyzer initialized');
  }

  async initialize() {
    try {
      const result = await this._executeCommand([this.config.safetyPath, '--version']);
      console.log(`✅ Safety ready: ${result.stdout.trim()}`);
      return { success: true, tool: 'safety' };
    } catch (error) {
      throw new Error(`Safety not available: ${error.message}`);
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    try {
      console.log(`🔍 Analyzing Python packages with Safety: ${projectPath}`);

      const args = [this.config.safetyPath, 'check', '--json'];
      const result = await this._executeCommand(args, { cwd: projectPath });

      let data = {};
      try {
        data = JSON.parse(result.stdout);
      } catch (parseError) {
        data = { raw_output: result.stdout };
      }

      return {
        success: true,
        tool: 'safety',
        data: data,
        projectPath: projectPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'safety'
      };
    }
  }

  async _executeCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(args[0], args.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || process.cwd()
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data.toString());
      child.stderr.on('data', (data) => stderr += data.toString());
      child.on('close', (code) => resolve({ returncode: code, stdout, stderr }));
      child.on('error', reject);
    });
  }

  getInfo() {
    return {
      name: 'safety',
      displayName: 'Safety',
      description: 'Python package vulnerability database scanner',
      analysisType: 'dependency_security'
    };
  }
}

module.exports = SafetyAnalyzer;