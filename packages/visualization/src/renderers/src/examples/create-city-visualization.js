const { CanvasEngineFactory, CityRenderer } = require('../index');
const { Codebase } = require('../../../graph-model/src');

/**
 * Example: Create City Visualization
 * 
 * This example demonstrates how to use the topolop canvas rendering system
 * to create beautiful city metaphor visualizations of codebases.
 */

/**
 * Create a city visualization with automatic engine selection
 */
async function createCityVisualization(codebase, options = {}) {
  const {
    format = 'auto',
    width = 1200,
    height = 800,
    interactive = false,
    exportPath = null,
    ...renderOptions
  } = options;

  console.log('🏙️  Creating city visualization...');
  
  // Automatically select the best canvas engine
  const requirements = {
    format,
    interactive,
    highQuality: !!exportPath,
    vectorOutput: format === 'svg'
  };
  
  const engineType = CanvasEngineFactory.getRecommendedEngine(requirements);
  console.log(`📐 Using ${engineType} canvas engine`);
  
  // Create canvas with optimal settings
  const canvas = CanvasEngineFactory.create({
    engine: engineType,
    width,
    height,
    backgroundColor: options.backgroundColor || '#87CEEB'
  });
  
  // Add interactivity if requested and supported
  if (interactive && typeof canvas.addEventListeners === 'function') {
    canvas.addEventListeners();
    console.log('🎮 Interactive controls enabled');
  }
  
  // Create and configure city renderer
  const cityRenderer = new CityRenderer(canvas);
  
  // Render the city
  const cityLayout = await cityRenderer.render(codebase, renderOptions);
  
  console.log('✅ City rendered successfully:');
  console.log(`   Districts: ${cityLayout.districts.length}`);
  console.log(`   Buildings: ${cityLayout.buildings.length}`);
  console.log(`   Roads: ${cityLayout.roads.length}`);
  console.log(`   Traffic flows: ${cityLayout.traffic.length}`);
  console.log(`   Construction sites: ${cityLayout.construction.length}`);
  
  // Export if requested
  if (exportPath) {
    await exportVisualization(canvas, exportPath, format);
  }
  
  return {
    canvas,
    cityRenderer,
    cityLayout,
    engineType
  };
}

/**
 * Export visualization to file
 */
async function exportVisualization(canvas, filePath, format = 'auto') {
  console.log(`💾 Exporting to ${filePath}...`);
  
  try {
    // Determine format from file extension if auto
    if (format === 'auto') {
      const ext = filePath.split('.').pop().toLowerCase();
      format = ext === 'svg' ? 'svg' : 'png';
    }
    
    // Use appropriate export method
    if (format === 'svg' && typeof canvas.saveToFile === 'function') {
      await canvas.saveToFile(filePath);
    } else if (typeof canvas.writeToFile === 'function') {
      await canvas.writeToFile(filePath, format);
    } else if (typeof canvas.toBuffer === 'function') {
      // Fallback: save buffer to file
      const fs = require('fs').promises;
      const buffer = canvas.toBuffer(format);
      await fs.writeFile(filePath, buffer);
    } else {
      throw new Error('Canvas engine does not support file export');
    }
    
    console.log(`✅ Exported to ${filePath}`);
  } catch (error) {
    console.error(`❌ Export failed: ${error.message}`);
  }
}

/**
 * Create browser-based interactive visualization
 */
function createInteractiveVisualization(containerId, codebase, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('Interactive visualization requires browser environment');
  }
  
  const container = typeof containerId === 'string' 
    ? document.getElementById(containerId)
    : containerId;
    
  if (!container) {
    throw new Error('Container element not found');
  }
  
  // Create browser canvas
  const canvas = CanvasEngineFactory.create({
    engine: 'browser',
    container: container,
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
    ...options
  });
  
  // Add interactive controls
  canvas.addEventListeners();
  
  // Create city renderer
  const cityRenderer = new CityRenderer(canvas);
  
  // Render city
  const cityLayoutPromise = cityRenderer.render(codebase, options);
  
  // Handle window resize
  const handleResize = () => {
    canvas.canvas.width = container.clientWidth;
    canvas.canvas.height = container.clientHeight;
    cityRenderer.render(codebase, options);
  };
  
  window.addEventListener('resize', handleResize);
  
  return {
    canvas,
    cityRenderer,
    cityLayoutPromise,
    cleanup: () => window.removeEventListener('resize', handleResize)
  };
}

/**
 * Batch export multiple formats
 */
async function exportMultipleFormats(codebase, basePath, options = {}) {
  const formats = ['svg', 'png'];
  const results = {};
  
  console.log('📁 Batch exporting multiple formats...');
  
  for (const format of formats) {
    try {
      const filePath = `${basePath}.${format}`;
      const result = await createCityVisualization(codebase, {
        format,
        exportPath: filePath,
        ...options
      });
      
      results[format] = {
        success: true,
        filePath,
        engineType: result.engineType
      };
    } catch (error) {
      results[format] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Compare rendering performance across engines
 */
async function benchmarkEngines(codebase, options = {}) {
  const supportedEngines = CanvasEngineFactory.getSupportedEngines();
  const results = {};
  
  console.log('⚡ Benchmarking rendering performance...');
  
  for (const engineType of supportedEngines) {
    console.log(`Testing ${engineType}...`);
    
    try {
      const startTime = Date.now();
      
      const result = await createCityVisualization(codebase, {
        engine: engineType,
        ...options
      });
      
      const endTime = Date.now();
      
      results[engineType] = {
        success: true,
        duration: endTime - startTime,
        cityLayout: result.cityLayout
      };
      
      console.log(`  ${engineType}: ${results[engineType].duration}ms`);
    } catch (error) {
      results[engineType] = {
        success: false,
        error: error.message
      };
      console.log(`  ${engineType}: Failed - ${error.message}`);
    }
  }
  
  // Find fastest engine
  const successful = Object.entries(results).filter(([,r]) => r.success);
  if (successful.length > 0) {
    const fastest = successful.sort(([,a], [,b]) => a.duration - b.duration)[0];
    console.log(`🏆 Fastest engine: ${fastest[0]} (${fastest[1].duration}ms)`);
  }
  
  return results;
}

// Example usage
if (require.main === module) {
  // This would normally be called with a real codebase
  console.log('📖 City Visualization Examples');
  console.log('');
  console.log('// Basic usage:');
  console.log('const result = await createCityVisualization(codebase);');
  console.log('');
  console.log('// With export:');
  console.log('await createCityVisualization(codebase, {');
  console.log('  exportPath: "my-codebase-city.svg",');
  console.log('  showTraffic: true,');
  console.log('  showConstruction: true');
  console.log('});');
  console.log('');
  console.log('// Interactive in browser:');
  console.log('createInteractiveVisualization("canvas-container", codebase);');
  console.log('');
  console.log('// Multiple formats:');
  console.log('await exportMultipleFormats(codebase, "city-visualization");');
}

module.exports = {
  createCityVisualization,
  createInteractiveVisualization,
  exportVisualization,
  exportMultipleFormats,
  benchmarkEngines
};