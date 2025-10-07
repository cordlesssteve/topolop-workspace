const MockCanvasEngine = require('./mock-canvas');

/**
 * Canvas Engine Factory - Automatically selects the appropriate canvas engine
 * based on environment and requirements
 */
class CanvasEngineFactory {
  static create(options = {}) {
    const { 
      engine = 'auto', 
      format = 'canvas',
      ...engineOptions 
    } = options;

    // Force specific engine
    if (engine !== 'auto') {
      return this.createEngine(engine, engineOptions);
    }

    // Auto-detect environment and select best engine (3D by default)
    if (format === 'svg') {
      return this.createEngine('svg', engineOptions);
    }

    // Default to 3D city visualization
    return this.createEngine('threejs', engineOptions);
  }

  static createEngine(engineType, options = {}) {
    switch (engineType.toLowerCase()) {
      case 'browser':
        try {
          const BrowserCanvasEngine = require('./engines/archived/browser-canvas-engine');
          return new BrowserCanvasEngine(options);
        } catch (error) {
          console.error('Failed to create browser canvas engine:', error.message);
          return this.createEngine('threejs', options);
        }

      case 'node':
        try {
          const NodeCanvasEngine = require('./engines/archived/node-canvas-engine');
          return new NodeCanvasEngine(options);
        } catch (error) {
          console.error('Failed to create Node canvas engine:', error.message);
          console.error('Install with: npm install canvas');
          return this.createEngine('threejs', options);
        }

      case 'svg':
        try {
          const SVGCanvasEngine = require('./engines/archived/svg-canvas-engine');
          return new SVGCanvasEngine(options);
        } catch (error) {
          console.error('Failed to create SVG canvas engine:', error.message);
          return this.createEngine('threejs', options);
        }

      case 'threejs':
      case '3d':
        try {
          const ThreeJSCanvasEngine = require('./engines/threejs-canvas-engine');
          return new ThreeJSCanvasEngine(options);
        } catch (error) {
          console.error('Failed to create Three.js canvas engine:', error.message);
          console.error('Install with: npm install three');
          return this.createEngine('mock', options);
        }

      case 'mock':
        return new MockCanvasEngine(options);

      default:
        throw new Error(`Unknown canvas engine type: ${engineType}`);
    }
  }

  static getSupportedEngines() {
    const supported = ['mock', 'svg'];
    
    // Check browser support
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      supported.push('browser');
    }
    
    // Check Node canvas support
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        require('canvas');
        supported.push('node');
      } catch (error) {
        // Node canvas not available
      }
    }
    
    // Check Three.js support
    try {
      require('three');
      supported.push('threejs');
    } catch (error) {
      // Three.js not available
    }
    
    return supported;
  }

  static getRecommendedEngine(requirements = {}) {
    const { 
      format = 'canvas',
      interactive = false,
      highQuality = false,
      vectorOutput = false
    } = requirements;

    // Vector output specifically requested
    if (vectorOutput || format === 'svg') {
      return 'svg';
    }

    // Interactive requirements
    if (interactive && typeof window !== 'undefined') {
      return 'browser';
    }

    // High quality server-side rendering
    if (highQuality && typeof process !== 'undefined') {
      try {
        require('canvas');
        return 'node';
      } catch (error) {
        return 'svg'; // Fallback to vector for quality
      }
    }

    // Default auto-selection
    return 'auto';
  }

  static async createWithCapabilities(capabilities = [], options = {}) {
    const engines = ['browser', 'node', 'svg', 'mock'];
    
    for (const engineType of engines) {
      try {
        const engine = this.createEngine(engineType, options);
        
        // Check if engine supports required capabilities
        const supported = await this.checkCapabilities(engine, capabilities);
        if (supported) {
          return engine;
        }
      } catch (error) {
        continue; // Try next engine
      }
    }
    
    // Fallback to mock if nothing else works
    return this.createEngine('mock', options);
  }

  static async checkCapabilities(engine, capabilities) {
    for (const capability of capabilities) {
      switch (capability) {
        case 'export':
          if (typeof engine.toBuffer !== 'function') return false;
          break;
        case 'interactive':
          if (typeof engine.addEventListeners !== 'function') return false;
          break;
        case 'vector':
          if (!(engine.constructor.name.includes('SVG'))) return false;
          break;
        case 'highres':
          if (engine.constructor.name.includes('Mock')) return false;
          break;
        default:
          console.warn(`Unknown capability: ${capability}`);
      }
    }
    return true;
  }
}

module.exports = CanvasEngineFactory;