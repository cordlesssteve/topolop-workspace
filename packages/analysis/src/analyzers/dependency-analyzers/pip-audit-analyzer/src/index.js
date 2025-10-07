const { spawn } = require('child_process');

/**
 * Pip-Audit Analyzer - Python Dependency Vulnerability Scanner for Topolop
 */
class PipAuditAnalyzer {
  constructor(config = {}) {
    this.config = {
      pipAuditPath: config.pipAuditPath || 'pip-audit',
      timeout: config.timeout || 180000,
      ...config
    };
    console.log('🔍 Pip-Audit Analyzer initialized');
  }

  async initialize() {
    try {
      const result = await this._executeCommand([this.config.pipAuditPath, '--version']);
      console.log(`✅ Pip-Audit ready: ${result.stdout.trim()}`);
      return { success: true, tool: 'pip-audit' };
    } catch (error) {
      throw new Error(`Pip-Audit not available: ${error.message}`);
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    try {
      console.log(`🔍 Analyzing Python project: ${projectPath}`);

      const args = [this.config.pipAuditPath, '--format=json'];
      const result = await this._executeCommand(args, { cwd: projectPath });

      let data = {};
      try {
        data = JSON.parse(result.stdout);
      } catch (parseError) {
        data = { raw_output: result.stdout };
      }

      return {
        success: true,
        tool: 'pip-audit',
        data: data,
        projectPath: projectPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'pip-audit'
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
      name: 'pip-audit',
      displayName: 'Pip-Audit',
      description: 'Python dependency vulnerability scanner',
      analysisType: 'dependency_security'
    };
  }
}

module.exports = PipAuditAnalyzer;