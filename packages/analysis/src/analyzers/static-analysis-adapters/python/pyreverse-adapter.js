/**
 * Pyreverse Adapter for Topolop
 * 
 * Transforms Pyreverse dependency analysis output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Module dependencies → Roads between building clusters
 * - Class inheritance → Elevated walkways/bridges
 * - Package structure → District organization
 * - Cyclic dependencies → Circular road patterns with warning signs
 * - Import complexity → Road network density
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PyreverseAdapter {
  constructor() {
    this.name = 'pyreverse';
    this.supportedLanguages = ['python'];
    this.description = 'Python package and class dependency analyzer';
  }

  /**
   * Check if Pyreverse is available (part of pylint)
   */
  async checkAvailability() {
    try {
      execSync('pyreverse --help', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Pyreverse analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Pyreverse not available. Run: pip install pylint');
    }

    const tempDir = path.join(codebasePath, '.topolop-pyreverse-temp');
    
    try {
      // Create temp directory for output
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Run Pyreverse to generate dependency information
      const packageCommand = `pyreverse -o json -p packages "${codebasePath}" --output-directory "${tempDir}" --ignore=test,tests,__pycache__ || true`;
      execSync(packageCommand, { cwd: codebasePath, stdio: 'pipe' });
      
      const classCommand = `pyreverse -o json -c classes "${codebasePath}" --output-directory "${tempDir}" --ignore=test,tests,__pycache__ || true`;
      execSync(classCommand, { cwd: codebasePath, stdio: 'pipe' });
      
      // Parse dependency data from generated files
      const packageData = this.parseJsonOutput(tempDir, 'packages');
      const classData = this.parseJsonOutput(tempDir, 'classes');
      
      // Analyze import structure manually since pyreverse JSON may be limited
      const importAnalysis = await this.analyzeImportStructure(codebasePath);
      
      // Clean up temp directory
      this.cleanupTempFiles(tempDir);
      
      return {
        tool: 'pyreverse',
        timestamp: new Date().toISOString(),
        codebasePath,
        results: {
          packages: packageData,
          classes: classData,
          imports: importAnalysis
        },
        summary: this.generateSummary(packageData, classData, importAnalysis)
      };
      
    } catch (error) {
      // Clean up temp files if they exist
      this.cleanupTempFiles(tempDir);
      throw new Error(`Pyreverse analysis failed: ${error.message}`);
    }
  }

  parseJsonOutput(tempDir, prefix) {
    try {
      const jsonFile = path.join(tempDir, `${prefix}.json`);
      if (fs.existsSync(jsonFile)) {
        const content = fs.readFileSync(jsonFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Could not parse ${prefix}.json, using fallback analysis`);
    }
    return {};
  }

  async analyzeImportStructure(codebasePath) {
    const imports = {};
    const moduleGraph = {};
    
    const analyzePythonFile = (filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const importPattern = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;
        const fileImports = [];
        
        let match;
        while ((match = importPattern.exec(content)) !== null) {
          const importedModule = match[1] || match[2];
          if (importedModule && !importedModule.startsWith('.')) {
            fileImports.push(importedModule.split('.')[0]); // Get top-level module
          }
        }
        
        const relativePath = path.relative(codebasePath, filePath);
        imports[relativePath] = fileImports;
        
        // Build module graph
        const moduleName = this.getModuleName(relativePath);
        if (!moduleGraph[moduleName]) {
          moduleGraph[moduleName] = { imports: new Set(), files: [] };
        }
        moduleGraph[moduleName].files.push(relativePath);
        fileImports.forEach(imp => moduleGraph[moduleName].imports.add(imp));
        
      } catch (error) {
        // Skip files that can't be read
      }
    };

    // Recursively analyze Python files
    const walkDirectory = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && !file.name.startsWith('.') && 
            !['__pycache__', 'node_modules', '.git'].includes(file.name)) {
          walkDirectory(fullPath);
        } else if (file.isFile() && file.name.endsWith('.py')) {
          analyzePythonFile(fullPath);
        }
      }
    };

    walkDirectory(codebasePath);

    // Convert Sets to Arrays for JSON serialization
    const processedGraph = {};
    for (const [module, data] of Object.entries(moduleGraph)) {
      processedGraph[module] = {
        imports: Array.from(data.imports),
        files: data.files,
        importCount: data.imports.size
      };
    }

    return {
      fileImports: imports,
      moduleGraph: processedGraph,
      cyclicDependencies: this.findCyclicDependencies(processedGraph)
    };
  }

  getModuleName(filePath) {
    const parts = filePath.split(path.sep);
    if (parts.length > 1) {
      return parts[0]; // First directory as module name
    }
    return 'root';
  }

  findCyclicDependencies(moduleGraph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const hasCycle = (module, path = []) => {
      if (recursionStack.has(module)) {
        const cycleStart = path.indexOf(module);
        cycles.push(path.slice(cycleStart).concat(module));
        return true;
      }
      
      if (visited.has(module)) return false;
      
      visited.add(module);
      recursionStack.add(module);
      path.push(module);
      
      const moduleData = moduleGraph[module];
      if (moduleData) {
        for (const importedModule of moduleData.imports) {
          if (moduleGraph[importedModule]) {
            hasCycle(importedModule, [...path]);
          }
        }
      }
      
      recursionStack.delete(module);
      return false;
    };

    for (const module of Object.keys(moduleGraph)) {
      if (!visited.has(module)) {
        hasCycle(module);
      }
    }

    return cycles;
  }

  cleanupTempFiles(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }
    } catch (error) {
      // Cleanup is best effort
    }
  }

  /**
   * Generate analysis summary
   */
  generateSummary(packageData, classData, importAnalysis) {
    const moduleGraph = importAnalysis.moduleGraph;
    const modules = Object.keys(moduleGraph);
    const totalFiles = Object.keys(importAnalysis.fileImports).length;
    
    // Calculate module statistics
    const moduleStats = this.calculateModuleStats(moduleGraph);
    const dependencyComplexity = this.calculateDependencyComplexity(moduleGraph);
    const cyclicDependencies = importAnalysis.cyclicDependencies;

    return {
      totalModules: modules.length,
      totalFiles,
      cyclicDependencyCount: cyclicDependencies.length,
      moduleStats,
      dependencyComplexity,
      topLevelModules: this.getTopLevelModules(moduleGraph),
      mostConnectedModules: this.getMostConnectedModules(moduleGraph),
      packageStructure: this.analyzePackageStructure(importAnalysis.fileImports)
    };
  }

  calculateModuleStats(moduleGraph) {
    const importCounts = Object.values(moduleGraph).map(module => module.importCount);
    const fileCounts = Object.values(moduleGraph).map(module => module.files.length);
    
    return {
      averageImportsPerModule: importCounts.length > 0 ? (importCounts.reduce((a, b) => a + b, 0) / importCounts.length).toFixed(2) : 0,
      averageFilesPerModule: fileCounts.length > 0 ? (fileCounts.reduce((a, b) => a + b, 0) / fileCounts.length).toFixed(2) : 0,
      maxImportsPerModule: Math.max(...importCounts, 0),
      maxFilesPerModule: Math.max(...fileCounts, 0)
    };
  }

  calculateDependencyComplexity(moduleGraph) {
    const modules = Object.keys(moduleGraph);
    const totalPossibleConnections = modules.length * (modules.length - 1);
    const actualConnections = Object.values(moduleGraph).reduce((sum, module) => sum + module.importCount, 0);
    
    return {
      complexityRatio: totalPossibleConnections > 0 ? (actualConnections / totalPossibleConnections).toFixed(3) : 0,
      fanOut: this.calculateAverageFanOut(moduleGraph),
      cohesion: this.calculateCohesion(moduleGraph)
    };
  }

  calculateAverageFanOut(moduleGraph) {
    const fanOuts = Object.values(moduleGraph).map(module => module.importCount);
    return fanOuts.length > 0 ? (fanOuts.reduce((a, b) => a + b, 0) / fanOuts.length).toFixed(2) : 0;
  }

  calculateCohesion(moduleGraph) {
    // Simplified cohesion: ratio of internal vs external imports
    let internalImports = 0;
    let totalImports = 0;
    
    const modules = Object.keys(moduleGraph);
    
    for (const [moduleName, moduleData] of Object.entries(moduleGraph)) {
      for (const importedModule of moduleData.imports) {
        totalImports++;
        if (modules.includes(importedModule)) {
          internalImports++;
        }
      }
    }
    
    return totalImports > 0 ? (internalImports / totalImports).toFixed(3) : 0;
  }

  getTopLevelModules(moduleGraph) {
    return Object.entries(moduleGraph)
      .sort(([,a], [,b]) => b.files.length - a.files.length)
      .slice(0, 5)
      .map(([module, data]) => ({ module, files: data.files.length, imports: data.importCount }));
  }

  getMostConnectedModules(moduleGraph) {
    return Object.entries(moduleGraph)
      .sort(([,a], [,b]) => b.importCount - a.importCount)
      .slice(0, 5)
      .map(([module, data]) => ({ module, imports: data.importCount, files: data.files.length }));
  }

  analyzePackageStructure(fileImports) {
    const packageDepth = {};
    const packageFiles = {};
    
    for (const filePath of Object.keys(fileImports)) {
      const depth = filePath.split(path.sep).length;
      const packageName = filePath.split(path.sep)[0];
      
      packageDepth[packageName] = Math.max(packageDepth[packageName] || 0, depth);
      packageFiles[packageName] = (packageFiles[packageName] || 0) + 1;
    }
    
    return {
      maxDepth: Math.max(...Object.values(packageDepth), 0),
      averageDepth: Object.values(packageDepth).length > 0 ? 
        (Object.values(packageDepth).reduce((a, b) => a + b, 0) / Object.values(packageDepth).length).toFixed(2) : 0,
      packagesAnalyzed: Object.keys(packageFiles).length,
      largestPackage: this.getLargestPackage(packageFiles)
    };
  }

  getLargestPackage(packageFiles) {
    const largest = Object.entries(packageFiles).sort(([,a], [,b]) => b - a)[0];
    return largest ? { name: largest[0], files: largest[1] } : null;
  }

  /**
   * Transform Pyreverse output into city visualization data
   */
  toCityData(pyreverseOutput) {
    const { results, summary } = pyreverseOutput;
    const { imports } = results;
    
    const cityData = {
      dependencies: [],
      cyclicDependencies: [],
      roadNetwork: {},
      districtConnections: {},
      moduleHierarchy: {}
    };

    // Process module dependencies as road networks
    for (const [module, moduleData] of Object.entries(imports.moduleGraph)) {
      for (const importedModule of moduleData.imports) {
        cityData.dependencies.push({
          from: module,
          to: importedModule,
          type: 'module-import',
          strength: this.calculateImportStrength(module, importedModule, imports.moduleGraph),
          roadType: this.classifyModuleRoadType(module, importedModule)
        });
      }
    }

    // Process cyclic dependencies as problematic roads
    for (const cycle of imports.cyclicDependencies) {
      cityData.cyclicDependencies.push({
        cycle: cycle,
        severity: cycle.length > 4 ? 'high' : 'medium',
        roadType: 'circular-hazard',
        warningLevel: 'dependency-cycle'
      });
    }

    // Generate road network metadata
    cityData.roadNetwork = this.generateModuleRoadNetwork(cityData.dependencies, summary);
    
    // Generate district connections (package-level)
    cityData.districtConnections = this.generatePackageConnections(cityData.dependencies);
    
    // Generate module hierarchy
    cityData.moduleHierarchy = this.generateModuleHierarchy(imports.moduleGraph, summary);

    return cityData;
  }

  calculateImportStrength(fromModule, toModule, moduleGraph) {
    // Calculate bidirectional import strength
    const fromToTo = moduleGraph[fromModule]?.imports.includes(toModule) ? 1 : 0;
    const toToFrom = moduleGraph[toModule]?.imports.includes(fromModule) ? 1 : 0;
    
    return fromToTo + toToFrom;
  }

  classifyModuleRoadType(fromModule, toModule) {
    if (fromModule === toModule) return 'self-reference';
    if (fromModule.includes('test') || toModule.includes('test')) return 'test-connection';
    if (fromModule.includes('util') || toModule.includes('util')) return 'utility-road';
    return 'module-highway';
  }

  generateModuleRoadNetwork(dependencies, summary) {
    return {
      totalRoads: dependencies.length,
      moduleConnections: summary.totalModules,
      roadDensity: summary.dependencyComplexity.complexityRatio,
      averageFanOut: summary.dependencyComplexity.fanOut,
      cohesionIndex: summary.dependencyComplexity.cohesion,
      criticalJunctions: this.findCriticalJunctions(dependencies)
    };
  }

  findCriticalJunctions(dependencies) {
    const junctionCounts = {};
    
    for (const dep of dependencies) {
      junctionCounts[dep.from] = (junctionCounts[dep.from] || 0) + 1;
      junctionCounts[dep.to] = (junctionCounts[dep.to] || 0) + 1;
    }
    
    return Object.entries(junctionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([module, connections]) => ({ module, connections }));
  }

  generatePackageConnections(dependencies) {
    const packageConnections = {};
    
    for (const dep of dependencies) {
      const fromPackage = this.inferPackage(dep.from);
      const toPackage = this.inferPackage(dep.to);
      
      if (fromPackage !== toPackage) {
        const connectionKey = `${fromPackage}->${toPackage}`;
        packageConnections[connectionKey] = (packageConnections[connectionKey] || 0) + 1;
      }
    }
    
    return packageConnections;
  }

  generateModuleHierarchy(moduleGraph, summary) {
    return {
      topLevelModules: summary.topLevelModules,
      mostConnectedModules: summary.mostConnectedModules,
      moduleComplexity: this.calculateModuleComplexity(moduleGraph),
      dependencyLayers: this.analyzeDependencyLayers(moduleGraph)
    };
  }

  calculateModuleComplexity(moduleGraph) {
    const complexityMap = {};
    
    for (const [module, data] of Object.entries(moduleGraph)) {
      complexityMap[module] = {
        importComplexity: data.importCount,
        fileComplexity: data.files.length,
        overallComplexity: data.importCount + data.files.length
      };
    }
    
    return complexityMap;
  }

  analyzeDependencyLayers(moduleGraph) {
    // Simplified layer analysis - modules with no imports are at bottom layer
    const layers = {};
    
    for (const [module, data] of Object.entries(moduleGraph)) {
      if (data.importCount === 0) {
        layers[module] = 0; // Bottom layer
      } else if (data.importCount <= 2) {
        layers[module] = 1; // Low dependency layer
      } else if (data.importCount <= 5) {
        layers[module] = 2; // Medium dependency layer
      } else {
        layers[module] = 3; // High dependency layer
      }
    }
    
    return layers;
  }

  inferPackage(moduleName) {
    // Simple package inference - first part before dot or entire name
    return moduleName.split('.')[0];
  }
}

module.exports = new PyreverseAdapter();