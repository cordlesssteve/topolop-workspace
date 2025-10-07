const CanvasEngineFactory = require('./canvas-engine-factory');
const CityRenderer = require('./renderers/city-renderer');
const CityGeometry = require('./utils/city-geometry');

// Export the main classes
module.exports = {
  // Factory for creating canvas engines
  CanvasEngineFactory,
  
  // Renderers
  CityRenderer,
  
  // Utilities
  CityGeometry,
  
  // Individual engines (for direct instantiation)
  MockCanvasEngine: require('./mock-canvas'),
  BaseCanvasEngine: require('./engines/base-canvas-engine'),
  ThreeJSCanvasEngine: require('./engines/threejs-canvas-engine'),
  
  // Convenience methods
  createCanvas: (options = {}) => CanvasEngineFactory.create(options),
  createCityVisualization: async (codebaseGraph, options = {}) => {
    const canvas = CanvasEngineFactory.create(options);
    const renderer = new CityRenderer(canvas);
    return await renderer.render(codebaseGraph, options);
  },
  
  // Export utilities
  getSupportedEngines: () => CanvasEngineFactory.getSupportedEngines(),
  getRecommendedEngine: (requirements) => CanvasEngineFactory.getRecommendedEngine(requirements)
};