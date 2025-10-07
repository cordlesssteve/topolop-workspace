const { spawn } = require('child_process');

/**
 * RetireJS Analyzer - JavaScript Library Vulnerability Scanner for Topolop
 */
class RetireJSAnalyzer {
  constructor(config = {}) {
    this.config = {
      retirePath: config.retirePath || 'retire',
      timeout: config.timeout || 120000,
      ...config
    };
    console.log('🔍 RetireJS Analyzer initialized');
  }

  async initialize() {
    try {
      const result = await this._executeCommand([this.config.retirePath, '--version']);
      console.log(`✅ RetireJS ready: ${result.stdout.trim()}`);
      return { success: true, tool: 'retirejs' };
    } catch (error) {
      throw new Error(`RetireJS not available: ${error.message}`);
    }
  }

  async analyzeProject(projectPath = process.cwd()) {
    try {
      console.log(`🔍 Analyzing JavaScript libraries with RetireJS: ${projectPath}`);

      const args = [this.config.retirePath, '--outputformat', 'json', '--outputpath', '/tmp/retire-results.json', projectPath];
      const result = await this._executeCommand(args);

      // RetireJS writes to file, read it
      const fs = require('fs-extra');
      let data = {};
      try {
        if (await fs.pathExists('/tmp/retire-results.json')) {
          data = await fs.readJson('/tmp/retire-results.json');
          await fs.remove('/tmp/retire-results.json'); // Cleanup
        }
      } catch (parseError) {
        data = { raw_output: result.stdout };
      }

      return {
        success: true,
        tool: 'retirejs',
        data: data,
        projectPath: projectPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: 'retirejs'
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
      name: 'retirejs',
      displayName: 'RetireJS',
      description: 'JavaScript library vulnerability scanner',
      analysisType: 'dependency_security'
    };
  }
}

module.exports = RetireJSAnalyzer;