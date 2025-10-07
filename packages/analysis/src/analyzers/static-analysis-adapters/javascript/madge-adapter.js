/**
 * Secure Madge Adapter for Topolop
 * 
 * Transforms dependency analysis into city road networks.
 * SECURITY: Uses direct dependency parsing only - no script execution
 * 
 * City Metaphor Mapping:
 * - Module dependencies → Roads between buildings
 * - Circular dependencies → Red warning roads with hazard signs
 * - Dependency depth → Road hierarchy (highways vs local streets)
 * - Import frequency → Road width/traffic density
 */

const fs = require('fs');
const path = require('path');

// Import madge safely for library usage
let madge;
try {
  madge = require('madge');
} catch (error) {
  // Madge not available - will be handled in checkAvailability
  madge = null;
}

class SecureMadgeAdapter {
  constructor() {
    this.name = 'madge';
    this.supportedLanguages = ['javascript'];
    this.description = 'Secure JavaScript/TypeScript dependency analysis (parsing only)';
    this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
    this.maxFiles = 5000; // Higher limit for dependency analysis
    this.allowedExtensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx'];
    this.secureConfig = this.createSecureConfig();
  }

  /**
   * Check if Madge is available (library mode only)
   */
  async checkAvailability() {
    return madge !== null;
  }

  /**
   * Create secure Madge configuration (no script execution)
   */
  createSecureConfig() {
    return {
      includeNpm: false,        // Don't analyze node_modules
      fileExtensions: ['js', 'mjs', 'jsx', 'ts', 'tsx']
    };
  }

  /**
   * Run secure Madge analysis using direct API (no external execution)
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Madge not available. Run: npm install madge');
    }

    try {
      // Validate and secure the codebase path
      const securePath = this.validatePath(codebasePath);
      
      // Create secure configuration for this analysis
      const config = {
        ...this.secureConfig
      };
      
      // Run dependency analysis using Madge API
      const madgeInstance = await madge(securePath, config);
      
      const results = {};
      
      // Get dependency tree
      const dependencyObj = madgeInstance.obj();
      results.dependencies = this.sanitizeDependencies(dependencyObj);
      
      // Check for circular dependencies
      const circularDeps = madgeInstance.circular();
      results.circular = this.sanitizeCircular(circularDeps);
      
      // Generate dependency tree if entry point provided
      results.tree = await this.analyzeDependencyTree(madgeInstance, options.entryPoint, securePath);
      
      // Generate summary statistics
      results.summary = this.generateSummary(results);
      
      return {
        tool: 'madge',
        timestamp: new Date().toISOString(),
        codebasePath: securePath,
        results,
        summary: results.summary
      };
      
    } catch (error) {
      throw new Error(`Secure Madge analysis failed: ${error.message}`);
    }
  }

  /**
   * Validate and secure the analysis path
   */
  validatePath(codebasePath) {
    const resolvedPath = path.resolve(codebasePath);
    
    // Security: ensure path doesn't contain suspicious patterns
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /\/proc\//,       // System paths
      /\/sys\//,        // System paths
      /\/dev\//,        // Device paths
      /\/etc\//,        // Config paths
      /\/tmp\//,        // Temp paths
      /\/var\//         // Variable paths
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(resolvedPath)) {
        throw new Error(`Suspicious path detected: ${codebasePath}`);
      }
    }
    
    // Ensure path exists and is a directory
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Path does not exist: ${codebasePath}`);
    }
    
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${codebasePath}`);
    }
    
    return resolvedPath;
  }

  /**
   * Sanitize dependency data to prevent injection
   */
  sanitizeDependencies(dependencies) {
    const sanitized = {};
    
    for (const [file, deps] of Object.entries(dependencies || {})) {
      const sanitizedFile = this.sanitizePath(file);
      const sanitizedDeps = deps
        .map(dep => this.sanitizePath(dep))
        .filter(dep => dep.length > 0)
        .slice(0, 1000); // Limit number of dependencies
      
      sanitized[sanitizedFile] = sanitizedDeps;
    }
    
    return sanitized;
  }

  /**
   * Sanitize circular dependency data
   */
  sanitizeCircular(circular) {
    if (!Array.isArray(circular)) return [];
    
    return circular
      .slice(0, 100) // Limit number of circular deps
      .map(cycle => {
        if (!Array.isArray(cycle)) return [];
        return cycle
          .map(file => this.sanitizePath(file))
          .filter(file => file.length > 0)
          .slice(0, 50); // Limit cycle length
      })
      .filter(cycle => cycle.length > 0);
  }

  /**
   * Sanitize file paths to prevent injection
   */
  sanitizePath(filePath) {
    if (typeof filePath !== 'string') {
      // Invalid file path type
      return '';
    }
    
    return filePath
      .replace(/[<>"'&]/g, '')  // Remove HTML/JS injection chars
      .replace(/\x00/g, '')     // Remove null bytes
      .replace(/\.\.\//g, '')   // Remove directory traversal
      .trim()
      .substring(0, 500);       // Limit path length
  }

  /**
   * Analyze dependency tree with secure entry point detection
   */
  async analyzeDependencyTree(madgeInstance, entryPoint, basePath) {
    if (!entryPoint) {
      // Try to find a reasonable entry point securely
      entryPoint = await this.findSecureEntryPoint(basePath);
    }

    if (!entryPoint) {
      console.warn('No entry point found for dependency tree analysis');
      return {};
    }

    try {
      // Use madge instance to get tree from specific entry point
      const tree = madgeInstance.depends(entryPoint);
      return this.sanitizeDependencies(tree || {});
    } catch (error) {
      console.warn('Dependency tree analysis failed:', error.message);
      return {};
    }
  }

  /**
   * Find secure entry point without executing external commands
   */
  async findSecureEntryPoint(basePath) {
    const possibleEntries = [
      'src/index.js',
      'src/main.js', 
      'src/app.js',
      'index.js',
      'main.js',
      'app.js',
      'src/index.ts',
      'src/main.ts',
      'index.ts',
      'main.ts'
    ];
    
    for (const entry of possibleEntries) {
      const entryPath = path.join(basePath, entry);
      try {
        // Security: validate the entry point path
        if (this.isSecureEntryPoint(entryPath, basePath)) {
          const stats = await fs.promises.stat(entryPath);
          if (stats.isFile() && stats.size <= this.maxFileSize) {
            return entry;
          }
        }
      } catch (error) {
        // File doesn't exist, continue
        continue;
      }
    }
    
    return null;
  }

  /**
   * Validate that entry point is secure
   */
  isSecureEntryPoint(entryPath, basePath) {
    const resolvedEntry = path.resolve(entryPath);
    const resolvedBase = path.resolve(basePath);
    
    // Ensure entry point is within base directory
    if (!resolvedEntry.startsWith(resolvedBase)) {
      return false;
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,
      /node_modules/,
      /\.git/,
      /test/,
      /spec/
    ];
    
    return !suspiciousPatterns.some(pattern => pattern.test(entryPath));
  }

  generateSummary(results) {
    const { dependencies, circular, tree } = results;
    
    const totalFiles = Object.keys(dependencies).length;
    const totalDependencies = Object.values(dependencies).reduce((sum, deps) => sum + deps.length, 0);
    const circularCount = circular.length;
    
    // Calculate dependency statistics
    const dependencyStats = this.calculateDependencyStats(dependencies);
    const complexityMetrics = this.calculateComplexityMetrics(dependencies);
    
    return {
      totalFiles,
      totalDependencies,
      averageDependencies: totalFiles > 0 ? (totalDependencies / totalFiles).toFixed(2) : 0,
      circularDependencies: circularCount,
      dependencyStats,
      complexityMetrics,
      healthScore: this.calculateHealthScore(dependencyStats, circularCount, totalFiles)
    };
  }

  calculateDependencyStats(dependencies) {
    const dependencyCounts = Object.values(dependencies).map(deps => deps.length);
    const incomingDeps = {};
    
    // Calculate incoming dependencies
    for (const [file, deps] of Object.entries(dependencies)) {
      for (const dep of deps) {
        incomingDeps[dep] = (incomingDeps[dep] || 0) + 1;
      }
    }

    return {
      maxOutgoing: Math.max(...dependencyCounts, 0),
      maxIncoming: Math.max(...Object.values(incomingDeps), 0),
      averageOutgoing: dependencyCounts.length > 0 ? (dependencyCounts.reduce((a, b) => a + b, 0) / dependencyCounts.length).toFixed(2) : 0,
      filesWithNoDependencies: dependencyCounts.filter(count => count === 0).length,
      mostDependent: this.findMostDependent(dependencies),
      mostDependedUpon: this.findMostDependedUpon(incomingDeps)
    };
  }

  calculateComplexityMetrics(dependencies) {
    const graph = this.buildDependencyGraph(dependencies);
    
    return {
      connectedComponents: this.countConnectedComponents(graph),
      depth: this.calculateMaxDepth(graph),
      fanOut: this.calculateAverageFanOut(dependencies),
      coupling: this.calculateCouplingMetrics(dependencies)
    };
  }

  findMostDependent(dependencies) {
    let maxDeps = 0;
    let mostDependent = null;
    
    for (const [file, deps] of Object.entries(dependencies)) {
      if (deps.length > maxDeps) {
        maxDeps = deps.length;
        mostDependent = file;
      }
    }
    
    return { file: mostDependent, count: maxDeps };
  }

  findMostDependedUpon(incomingDeps) {
    let maxIncoming = 0;
    let mostDependedUpon = null;
    
    for (const [file, count] of Object.entries(incomingDeps)) {
      if (count > maxIncoming) {
        maxIncoming = count;
        mostDependedUpon = file;
      }
    }
    
    return { file: mostDependedUpon, count: maxIncoming };
  }

  buildDependencyGraph(dependencies) {
    const graph = {};
    
    for (const [file, deps] of Object.entries(dependencies)) {
      graph[file] = deps;
    }
    
    return graph;
  }

  countConnectedComponents(graph) {
    // Simplified connected components calculation
    const visited = new Set();
    let components = 0;
    
    const dfs = (node) => {
      if (visited.has(node)) return;
      visited.add(node);
      
      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
    };
    
    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        components++;
        dfs(node);
      }
    }
    
    return components;
  }

  calculateMaxDepth(graph) {
    // Simplified max depth calculation
    const memo = {};
    
    const getDepth = (node, visited = new Set()) => {
      if (visited.has(node)) return 0; // Circular dependency
      if (memo[node] !== undefined) return memo[node];
      
      visited.add(node);
      const neighbors = graph[node] || [];
      const maxChildDepth = neighbors.length > 0 
        ? Math.max(...neighbors.map(neighbor => getDepth(neighbor, new Set(visited))))
        : 0;
      
      memo[node] = maxChildDepth + 1;
      return memo[node];
    };
    
    return Math.max(...Object.keys(graph).map(node => getDepth(node)), 0);
  }

  calculateAverageFanOut(dependencies) {
    const fanOuts = Object.values(dependencies).map(deps => deps.length);
    return fanOuts.length > 0 ? (fanOuts.reduce((a, b) => a + b, 0) / fanOuts.length).toFixed(2) : 0;
  }

  calculateCouplingMetrics(dependencies) {
    const totalFiles = Object.keys(dependencies).length;
    const totalPossibleConnections = totalFiles * (totalFiles - 1);
    const actualConnections = Object.values(dependencies).reduce((sum, deps) => sum + deps.length, 0);
    
    return {
      coupling: totalPossibleConnections > 0 ? (actualConnections / totalPossibleConnections).toFixed(3) : 0,
      cohesion: this.calculateCohesion(dependencies)
    };
  }

  calculateCohesion(dependencies) {
    // Simplified cohesion metric based on local vs external dependencies
    let totalDeps = 0;
    let localDeps = 0;
    
    for (const [file, deps] of Object.entries(dependencies)) {
      totalDeps += deps.length;
      
      const fileDir = path.dirname(file);
      localDeps += deps.filter(dep => path.dirname(dep) === fileDir).length;
    }
    
    return totalDeps > 0 ? (localDeps / totalDeps).toFixed(3) : 0;
  }

  calculateHealthScore(dependencyStats, circularCount, totalFiles) {
    let score = 100;
    
    // Penalize circular dependencies heavily
    score -= circularCount * 15;
    
    // Penalize high coupling
    if (dependencyStats.maxOutgoing > 10) score -= 10;
    if (dependencyStats.maxIncoming > 15) score -= 10;
    
    // Penalize excessive average dependencies
    const avgDeps = parseFloat(dependencyStats.averageOutgoing);
    if (avgDeps > 8) score -= (avgDeps - 8) * 2;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Transform Madge output into city visualization data
   */
  toCityData(madgeOutput) {
    const { results, summary } = madgeOutput;
    const { dependencies, circular } = results;
    
    const cityData = {
      dependencies: [],
      circularDependencies: [],
      roadNetwork: {},
      trafficPatterns: {},
      districtConnections: {}
    };

    // Process regular dependencies as roads
    for (const [sourceFile, dependentFiles] of Object.entries(dependencies)) {
      for (const targetFile of dependentFiles) {
        cityData.dependencies.push({
          from: this.normalizeFilePath(sourceFile, madgeOutput.codebasePath),
          to: this.normalizeFilePath(targetFile, madgeOutput.codebasePath),
          type: 'dependency',
          strength: this.calculateDependencyStrength(sourceFile, targetFile, dependencies),
          roadType: this.classifyRoadType(sourceFile, targetFile)
        });
      }
    }

    // Process circular dependencies as hazardous roads
    for (const circularChain of circular) {
      cityData.circularDependencies.push({
        chain: circularChain.map(file => this.normalizeFilePath(file, madgeOutput.codebasePath)),
        severity: 'high',
        roadType: 'hazardous',
        warningLevel: circularChain.length > 3 ? 'critical' : 'warning'
      });
    }

    // Generate road network metadata
    cityData.roadNetwork = this.generateRoadNetwork(cityData.dependencies);
    
    // Generate traffic patterns
    cityData.trafficPatterns = this.generateTrafficPatterns(dependencies, summary);
    
    // Generate district connections
    cityData.districtConnections = this.generateDistrictConnections(cityData.dependencies);

    return cityData;
  }

  normalizeFilePath(fullPath, basePath) {
    return path.relative(basePath, fullPath);
  }

  calculateDependencyStrength(source, target, allDependencies) {
    // Simple strength calculation based on mutual dependencies
    const sourceToTarget = (allDependencies[source] || []).includes(target) ? 1 : 0;
    const targetToSource = (allDependencies[target] || []).includes(source) ? 1 : 0;
    
    return sourceToTarget + targetToSource;
  }

  classifyRoadType(source, target) {
    const sourceDir = path.dirname(source);
    const targetDir = path.dirname(target);
    
    if (sourceDir === targetDir) return 'local'; // Same directory
    if (source.includes('test') || target.includes('test')) return 'test';
    if (source.includes('src') && target.includes('src')) return 'main';
    return 'cross-district';
  }

  generateRoadNetwork(dependencies) {
    const network = {
      totalRoads: dependencies.length,
      roadTypes: {},
      connectionHubs: {},
      isolatedBuildings: []
    };

    // Count road types
    for (const dep of dependencies) {
      network.roadTypes[dep.roadType] = (network.roadTypes[dep.roadType] || 0) + 1;
    }

    // Find connection hubs (files with many incoming/outgoing connections)
    const connections = {};
    for (const dep of dependencies) {
      connections[dep.from] = (connections[dep.from] || 0) + 1;
      connections[dep.to] = (connections[dep.to] || 0) + 1;
    }

    // Identify hubs (top 10% most connected)
    const sortedConnections = Object.entries(connections).sort(([,a], [,b]) => b - a);
    const hubThreshold = Math.ceil(sortedConnections.length * 0.1);
    
    for (let i = 0; i < Math.min(hubThreshold, sortedConnections.length); i++) {
      const [file, connectionCount] = sortedConnections[i];
      network.connectionHubs[file] = {
        connections: connectionCount,
        hubType: connectionCount > 10 ? 'major' : 'minor'
      };
    }

    return network;
  }

  generateTrafficPatterns(dependencies, summary) {
    return {
      heavyTrafficRoutes: this.findHeavyTrafficRoutes(dependencies),
      bottlenecks: this.findBottlenecks(dependencies),
      trafficFlow: {
        totalVolume: summary.totalDependencies,
        averageLoad: parseFloat(summary.dependencyStats.averageOutgoing),
        peakConnections: summary.dependencyStats.maxOutgoing
      }
    };
  }

  findHeavyTrafficRoutes(dependencies) {
    // Find files that are dependencies for many other files
    const incomingTraffic = {};
    
    for (const [file, deps] of Object.entries(dependencies)) {
      for (const dep of deps) {
        incomingTraffic[dep] = (incomingTraffic[dep] || 0) + 1;
      }
    }

    return Object.entries(incomingTraffic)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([file, traffic]) => ({ file, traffic, level: traffic > 5 ? 'heavy' : 'moderate' }));
  }

  findBottlenecks(dependencies) {
    // Files that have both high incoming and outgoing dependencies
    const outgoing = {};
    const incoming = {};
    
    for (const [file, deps] of Object.entries(dependencies)) {
      outgoing[file] = deps.length;
      for (const dep of deps) {
        incoming[dep] = (incoming[dep] || 0) + 1;
      }
    }

    const bottlenecks = [];
    for (const file of Object.keys(dependencies)) {
      const out = outgoing[file] || 0;
      const inc = incoming[file] || 0;
      
      if (out > 5 && inc > 3) {
        bottlenecks.push({
          file,
          outgoing: out,
          incoming: inc,
          bottleneckScore: out + inc
        });
      }
    }

    return bottlenecks.sort((a, b) => b.bottleneckScore - a.bottleneckScore);
  }

  generateDistrictConnections(dependencies) {
    const districtConnections = {};
    
    for (const dep of dependencies) {
      const sourceDistrict = this.inferDistrict(dep.from);
      const targetDistrict = this.inferDistrict(dep.to);
      
      if (sourceDistrict !== targetDistrict) {
        const connectionKey = `${sourceDistrict}->${targetDistrict}`;
        districtConnections[connectionKey] = (districtConnections[connectionKey] || 0) + 1;
      }
    }

    return districtConnections;
  }

  inferDistrict(filePath) {
    const pathParts = filePath.split(path.sep);
    
    if (pathParts.includes('test') || pathParts.includes('tests') || filePath.includes('.test.')) {
      return 'testing';
    }
    if (pathParts.includes('src') || pathParts.includes('lib')) {
      return 'core';
    }
    if (pathParts.includes('components') || pathParts.includes('ui')) {
      return 'frontend';
    }
    if (pathParts.includes('api') || pathParts.includes('server')) {
      return 'backend';
    }
    if (pathParts.includes('config') || pathParts.includes('scripts')) {
      return 'infrastructure';
    }
    
    return 'misc';
  }
}

module.exports = new SecureMadgeAdapter();