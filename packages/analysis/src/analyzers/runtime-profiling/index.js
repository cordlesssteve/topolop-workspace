/**
 * Runtime Profiling Integration Hub
 * 
 * Provides unified access to runtime profiling tools and integrates
 * their output with Layer 2 unified data model.
 */

const PerfRuntimeIntegration = require('./perf-integration');
const NodeJSProfilerIntegration = require('./nodejs-profiler-integration');

class RuntimeProfilingHub {
  constructor() {
    this.integrations = {
      perf: new PerfRuntimeIntegration(),
      nodejs: new NodeJSProfilerIntegration()
    };
    this.supportedPlatforms = ['linux', 'win32', 'darwin'];
    this.supportedTools = ['perf', 'nodejs'];
  }

  /**
   * Get available runtime profiling tools
   */
  async getAvailableTools() {
    const available = {};
    
    for (const [name, integration] of Object.entries(this.integrations)) {
      try {
        available[name] = await integration.checkAvailability();
      } catch (error) {
        available[name] = false;
      }
    }

    return available;
  }

  /**
   * Get the best available profiling tool based on current environment
   */
  async getBestAvailableTool() {
    const available = await this.getAvailableTools();
    
    // Preference order: perf (most detailed) > nodejs (widely available)
    if (available.perf) return 'perf';
    if (available.nodejs) return 'nodejs';
    
    throw new Error('No runtime profiling tools available');
  }

  /**
   * Collect runtime data using the best available tool
   */
  async collectRuntimeData(codebasePath, options = {}) {
    const toolPreference = options.tool || await this.getBestAvailableTool();
    
    if (!this.integrations[toolPreference]) {
      throw new Error(`Runtime profiling tool '${toolPreference}' is not supported`);
    }

    const integration = this.integrations[toolPreference];
    
    if (!await integration.checkAvailability()) {
      throw new Error(`Runtime profiling tool '${toolPreference}' is not available`);
    }

    // Delegate to the specific integration method
    if (toolPreference === 'nodejs') {
      return await integration.profileProject(codebasePath, options);
    } else {
      return await integration.collectRuntimeData(codebasePath, options);
    }
  }

  /**
   * Generate visualization summary for Layer 3
   */
  generateVisualizationSummary(runtimeData, toolName = 'perf') {
    const integration = this.integrations[toolName];
    if (!integration) {
      throw new Error(`No integration found for tool: ${toolName}`);
    }

    return integration.generateVisualizationSummary(runtimeData);
  }

  /**
   * Get supported runtime profiling capabilities
   */
  getCapabilities() {
    return {
      platforms: this.supportedPlatforms,
      tools: this.supportedTools,
      features: [
        'CPU hotspot detection',
        'Call graph analysis', 
        'Performance metrics collection',
        'Memory usage tracking',
        'Context switch monitoring',
        'Cache performance analysis',
        'Branch prediction analysis'
      ]
    };
  }
}

module.exports = {
  RuntimeProfilingHub,
  PerfRuntimeIntegration
};