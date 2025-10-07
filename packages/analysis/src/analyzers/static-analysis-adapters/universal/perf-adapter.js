/**
 * Perf Adapter for Topolop
 * 
 * Transforms Linux perf performance analysis output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - CPU hotspots → High-energy industrial zones with heat indicators
 * - Memory bandwidth issues → Traffic congestion on major highways
 * - Cache misses → Inefficient transportation networks
 * - Branch mispredictions → Confusing road signage and wrong turns
 * - Function call frequency → Building activity levels and foot traffic
 * - Performance bottlenecks → Construction zones causing slowdowns
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { globalPathManager } = require('../../utils/path-utils');

class PerfAdapter {
  constructor() {
    this.name = 'perf';
    this.supportedLanguages = ['universal'];
    this.description = 'Linux performance analysis tool for CPU profiling and bottleneck detection';
  }

  /**
   * Check if perf is available
   */
  async checkAvailability() {
    try {
      execSync('perf --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run perf analysis on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('perf not available. Install with: sudo apt-get install linux-tools-generic');
    }

    const results = {
      stat: [],
      record: [],
      top: []
    };
    
    try {
      // Find executable files or build targets
      const targets = await this.findAnalysisTargets(codebasePath, options);
      
      if (targets.length === 0) {
        return {
          tool: 'perf',
          timestamp: new Date().toISOString(),
          codebasePath,
          results,
          summary: this.generateSummary(results)
        };
      }

      // Run different perf analyses
      for (const target of targets.slice(0, 3)) { // Limit to first 3 targets
        try {
          // Performance statistics
          const statResults = await this.runPerfStat(target, codebasePath, options);
          results.stat.push(...statResults);
          
          // Performance recording and report (if enabled)
          if (options.enableRecord) {
            const recordResults = await this.runPerfRecord(target, codebasePath, options);
            results.record.push(...recordResults);
          }
          
          // System-wide performance sampling
          if (options.enableTop) {
            const topResults = await this.runPerfTop(codebasePath, options);
            results.top.push(...topResults);
          }
          
        } catch (error) {
          console.warn(`Perf analysis failed for ${target}: ${error.message}`);
          results.stat.push({
            target: path.relative(codebasePath, target),
            type: 'analysis-error',
            message: error.message,
            severity: 'info'
          });
        }
      }
      
      return {
        tool: 'perf',
        timestamp: new Date().toISOString(),
        codebasePath,
        results,
        summary: this.generateSummary(results)
      };
      
    } catch (error) {
      throw new Error(`Perf analysis failed: ${error.message}`);
    }
  }

  async findAnalysisTargets(codebasePath, options) {
    const targets = [];
    
    // Check for explicit command in options
    if (options.command) {
      targets.push(options.command);
      return targets;
    }
    
    // Find executable files
    const executables = this.findExecutables(codebasePath);
    targets.push(...executables);
    
    // Find common build/test commands
    const buildCommands = this.detectBuildCommands(codebasePath);
    targets.push(...buildCommands);
    
    return targets;
  }

  findExecutables(codebasePath) {
    const executables = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.') && 
              !['node_modules', 'build', 'obj'].includes(file.name)) {
            walkDirectory(fullPath);
          } else if (file.isFile() && this.isExecutable(fullPath)) {
            executables.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return executables;
  }

  isExecutable(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return (stats.mode & parseInt('111', 8)) && !path.extname(filePath);
    } catch (error) {
      return false;
    }
  }

  detectBuildCommands(codebasePath) {
    const commands = [];
    
    // Check for common build files
    if (fs.existsSync(path.join(codebasePath, 'Makefile'))) {
      commands.push('make');
    }
    if (fs.existsSync(path.join(codebasePath, 'package.json'))) {
      commands.push('npm test', 'npm run build');
    }
    if (fs.existsSync(path.join(codebasePath, 'CMakeLists.txt'))) {
      commands.push('cmake . && make');
    }
    if (fs.existsSync(path.join(codebasePath, 'Cargo.toml'))) {
      commands.push('cargo build', 'cargo test');
    }
    
    return commands;
  }

  async runPerfStat(target, basePath, options) {
    const results = [];
    const timeout = options.timeout || 30000; // 30 seconds default
    
    try {
      const perfCommand = `perf stat -e cycles,instructions,cache-references,cache-misses,branches,branch-misses,page-faults,context-switches ${target}`;
      
      const output = execSync(perfCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: timeout,
        stdio: 'pipe'
      });
      
      const parsedResults = this.parsePerfStatOutput(output, target, basePath);
      results.push(...parsedResults);
      
    } catch (error) {
      // perf stat writes to stderr, check error output
      if (error.stderr) {
        const parsedResults = this.parsePerfStatOutput(error.stderr, target, basePath);
        results.push(...parsedResults);
      } else {
        results.push({
          target: path.relative(basePath, target),
          type: 'perf-stat-error',
          message: error.message,
          severity: 'info'
        });
      }
    }
    
    return results;
  }

  parsePerfStatOutput(output, target, basePath) {
    const results = [];
    const relativePath = path.relative(basePath, target);
    const lines = output.split('\n');
    
    const metrics = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse perf stat output format: "value unit event"
      const statMatch = trimmed.match(/^\s*([0-9,\.]+)\s+([a-zA-Z-]+)\s*$/);
      if (statMatch) {
        const value = parseFloat(statMatch[1].replace(/,/g, ''));
        const event = statMatch[2];
        metrics[event] = value;
      }
      
      // Parse percentage values
      const percentMatch = trimmed.match(/^\s*([0-9,\.]+)\s+([a-zA-Z-]+)\s+.*\(\s*([0-9\.]+)%\s*\)/);
      if (percentMatch) {
        const value = parseFloat(percentMatch[1].replace(/,/g, ''));
        const event = percentMatch[2];
        const percentage = parseFloat(percentMatch[3]);
        metrics[event] = value;
        metrics[`${event}-rate`] = percentage;
      }
    }
    
    if (Object.keys(metrics).length > 0) {
      results.push({
        target: relativePath,
        type: 'performance-metrics',
        metrics: metrics,
        performance: this.calculatePerformanceIndicators(metrics),
        severity: 'info'
      });
    }
    
    return results;
  }

  calculatePerformanceIndicators(metrics) {
    const indicators = {};
    
    // Instructions per cycle (IPC)
    if (metrics.cycles && metrics.instructions) {
      indicators.ipc = (metrics.instructions / metrics.cycles).toFixed(2);
      indicators.ipcLevel = this.classifyIPC(indicators.ipc);
    }
    
    // Cache miss rate
    if (metrics['cache-references'] && metrics['cache-misses']) {
      indicators.cacheMissRate = ((metrics['cache-misses'] / metrics['cache-references']) * 100).toFixed(2);
      indicators.cacheLevel = this.classifyCachePerformance(indicators.cacheMissRate);
    }
    
    // Branch miss rate
    if (metrics.branches && metrics['branch-misses']) {
      indicators.branchMissRate = ((metrics['branch-misses'] / metrics.branches) * 100).toFixed(2);
      indicators.branchLevel = this.classifyBranchPerformance(indicators.branchMissRate);
    }
    
    // Overall performance score
    indicators.performanceScore = this.calculatePerformanceScore(metrics);
    
    return indicators;
  }

  classifyIPC(ipc) {
    const ipcValue = parseFloat(ipc);
    if (ipcValue >= 2.0) return 'excellent';
    if (ipcValue >= 1.5) return 'good';
    if (ipcValue >= 1.0) return 'fair';
    return 'poor';
  }

  classifyCachePerformance(missRate) {
    const rate = parseFloat(missRate);
    if (rate <= 3) return 'excellent';
    if (rate <= 10) return 'good';
    if (rate <= 20) return 'fair';
    return 'poor';
  }

  classifyBranchPerformance(missRate) {
    const rate = parseFloat(missRate);
    if (rate <= 5) return 'excellent';
    if (rate <= 15) return 'good';
    if (rate <= 25) return 'fair';
    return 'poor';
  }

  calculatePerformanceScore(metrics) {
    let score = 100;
    
    // Penalize high cache miss rates
    if (metrics['cache-misses'] && metrics['cache-references']) {
      const cacheMissRate = (metrics['cache-misses'] / metrics['cache-references']) * 100;
      score -= Math.min(cacheMissRate * 2, 40);
    }
    
    // Penalize high branch miss rates
    if (metrics['branch-misses'] && metrics.branches) {
      const branchMissRate = (metrics['branch-misses'] / metrics.branches) * 100;
      score -= Math.min(branchMissRate, 30);
    }
    
    // Penalize excessive page faults
    if (metrics['page-faults']) {
      score -= Math.min(metrics['page-faults'] / 100, 20);
    }
    
    return Math.max(0, score).toFixed(1);
  }

  async runPerfRecord(target, basePath, options) {
    const results = [];
    let perfDataFile = null;
    
    try {
      // Create temporary file for perf data
      const perfPaths = globalPathManager.getToolPaths('perf', basePath);
      perfDataFile = perfPaths.dataFile;
      
      // Record performance data
      const recordCommand = `perf record -g -o "${perfDataFile}" ${target}`;
      execSync(recordCommand, { 
        cwd: basePath,
        timeout: options.timeout || 30000,
        stdio: 'pipe'
      });
      
      // Generate report
      const reportCommand = `perf report -i "${perfDataFile}" --stdio`;
      const reportOutput = execSync(reportCommand, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const parsedResults = this.parsePerfReport(reportOutput, target, basePath);
      results.push(...parsedResults);
      
    } catch (error) {
      results.push({
        target: path.relative(basePath, target),
        type: 'perf-record-error',
        message: error.message,
        severity: 'info'
      });
    } finally {
      // Clean up
      if (perfDataFile && fs.existsSync(perfDataFile)) {
        try {
          fs.unlinkSync(perfDataFile);
        } catch (cleanupError) {
          console.warn(`Warning: Could not cleanup perf data file: ${cleanupError.message}`);
        }
      }
    }
    
    return results;
  }

  parsePerfReport(reportOutput, target, basePath) {
    const results = [];
    const relativePath = path.relative(basePath, target);
    const lines = reportOutput.split('\n');
    
    const hotspots = [];
    
    for (const line of lines) {
      // Parse perf report format: "percentage command function"
      const reportMatch = line.match(/^\s*([0-9\.]+)%\s+(\S+)\s+(.+)$/);
      if (reportMatch) {
        const percentage = parseFloat(reportMatch[1]);
        const command = reportMatch[2];
        const functionName = reportMatch[3].trim();
        
        if (percentage >= 1.0) { // Only include functions with >= 1% CPU usage
          hotspots.push({
            function: functionName,
            percentage: percentage,
            command: command
          });
        }
      }
    }
    
    if (hotspots.length > 0) {
      results.push({
        target: relativePath,
        type: 'cpu-hotspots',
        hotspots: hotspots.slice(0, 10), // Top 10 hotspots
        severity: 'info'
      });
    }
    
    return results;
  }

  async runPerfTop(basePath, options) {
    const results = [];
    
    try {
      // Run perf top for a short duration
      const topCommand = 'perf top -n -d 1 --stdio | head -20';
      const output = execSync(topCommand, { 
        cwd: basePath,
        encoding: 'utf8',
        timeout: 5000, // 5 seconds
        stdio: 'pipe'
      });
      
      const parsedResults = this.parsePerfTop(output, basePath);
      results.push(...parsedResults);
      
    } catch (error) {
      results.push({
        type: 'perf-top-error',
        message: error.message,
        severity: 'info'
      });
    }
    
    return results;
  }

  parsePerfTop(output, basePath) {
    const results = [];
    const lines = output.split('\n');
    const systemHotspots = [];
    
    for (const line of lines) {
      // Parse perf top format
      const topMatch = line.match(/^\s*([0-9\.]+)%\s+(\S+)\s+(.+)$/);
      if (topMatch) {
        const percentage = parseFloat(topMatch[1]);
        const binary = topMatch[2];
        const symbol = topMatch[3].trim();
        
        systemHotspots.push({
          symbol: symbol,
          percentage: percentage,
          binary: binary
        });
      }
    }
    
    if (systemHotspots.length > 0) {
      results.push({
        type: 'system-hotspots',
        hotspots: systemHotspots.slice(0, 10),
        severity: 'info'
      });
    }
    
    return results;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(results) {
    const allResults = [
      ...results.stat,
      ...results.record,
      ...results.top
    ];
    
    const performanceMetrics = {};
    const hotspots = [];
    const targetStats = {};

    for (const result of allResults) {
      if (result.type === 'performance-metrics') {
        Object.assign(performanceMetrics, result.performance);
        
        const target = result.target;
        if (!targetStats[target]) {
          targetStats[target] = {
            metrics: result.metrics,
            performance: result.performance
          };
        }
      } else if (result.type === 'cpu-hotspots') {
        hotspots.push(...result.hotspots);
      }
    }

    return {
      totalTargets: Object.keys(targetStats).length,
      overallPerformance: this.calculateOverallPerformance(performanceMetrics),
      performanceMetrics,
      targetStats,
      topHotspots: this.getTopHotspots(hotspots, 10),
      performanceBottlenecks: this.identifyBottlenecks(targetStats)
    };
  }

  calculateOverallPerformance(metrics) {
    const scores = [];
    
    if (metrics.performanceScore) {
      scores.push(parseFloat(metrics.performanceScore));
    }
    
    // Additional scoring based on individual metrics
    if (metrics.ipcLevel) {
      const ipcScore = { excellent: 100, good: 80, fair: 60, poor: 40 }[metrics.ipcLevel] || 50;
      scores.push(ipcScore);
    }
    
    if (metrics.cacheLevel) {
      const cacheScore = { excellent: 100, good: 80, fair: 60, poor: 40 }[metrics.cacheLevel] || 50;
      scores.push(cacheScore);
    }
    
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
    
    if (averageScore >= 85) return 'excellent';
    if (averageScore >= 70) return 'good';
    if (averageScore >= 55) return 'fair';
    return 'poor';
  }

  getTopHotspots(hotspots, limit = 10) {
    return hotspots
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, limit);
  }

  identifyBottlenecks(targetStats) {
    const bottlenecks = [];
    
    for (const [target, stats] of Object.entries(targetStats)) {
      const perf = stats.performance;
      
      if (perf.cacheMissRate && parseFloat(perf.cacheMissRate) > 15) {
        bottlenecks.push({
          target,
          type: 'cache-bottleneck',
          severity: 'medium',
          details: `High cache miss rate: ${perf.cacheMissRate}%`
        });
      }
      
      if (perf.branchMissRate && parseFloat(perf.branchMissRate) > 20) {
        bottlenecks.push({
          target,
          type: 'branch-bottleneck',
          severity: 'medium',
          details: `High branch miss rate: ${perf.branchMissRate}%`
        });
      }
      
      if (perf.ipc && parseFloat(perf.ipc) < 1.0) {
        bottlenecks.push({
          target,
          type: 'cpu-bottleneck',
          severity: 'high',
          details: `Low IPC: ${perf.ipc}`
        });
      }
    }
    
    return bottlenecks;
  }

  /**
   * Transform perf output into city visualization data
   */
  toCityData(perfOutput) {
    const { results, summary } = perfOutput;
    
    const cityData = {
      performanceHotspots: [],
      buildingEnhancements: {},
      trafficPatterns: {},
      industrialZones: {}
    };

    // Process performance hotspots
    if (summary.topHotspots && summary.topHotspots.length > 0) {
      for (const hotspot of summary.topHotspots) {
        cityData.performanceHotspots.push({
          function: hotspot.function || hotspot.symbol,
          type: 'cpu-hotspot',
          intensity: hotspot.percentage,
          severity: this.classifyHotspotSeverity(hotspot.percentage),
          location: hotspot.binary || 'system'
        });
      }
    }

    // Process each target's performance data
    for (const [target, stats] of Object.entries(summary.targetStats)) {
      // Building enhancement data
      cityData.buildingEnhancements[target] = {
        energyEfficiency: this.calculateEnergyEfficiency(stats.performance),
        processingPower: this.calculateProcessingPower(stats.performance),
        industrialActivity: this.calculateIndustrialActivity(stats.metrics),
        visualEffects: {
          heatIndicators: this.hasHighCPUUsage(stats.performance),
          trafficCongestion: this.hasMemoryBottlenecks(stats.performance),
          inefficientNetworks: this.hasCacheIssues(stats.performance),
          confusingSignage: this.hasBranchIssues(stats.performance),
          constructionZones: this.hasPerformanceBottlenecks(stats.performance)
        }
      };

      // Traffic patterns data
      cityData.trafficPatterns[target] = {
        memoryBandwidth: this.assessMemoryBandwidth(stats.metrics),
        cacheEfficiency: this.assessCacheEfficiency(stats.performance),
        branchPrediction: this.assessBranchPrediction(stats.performance),
        overallFlow: this.assessTrafficFlow(stats.performance)
      };

      // Industrial zones data
      cityData.industrialZones[target] = {
        cpuIntensity: this.calculateCPUIntensity(stats.metrics),
        thermalOutput: this.calculateThermalOutput(stats.performance),
        productionEfficiency: this.calculateProductionEfficiency(stats.performance),
        zoneClassification: this.classifyIndustrialZone(stats.performance)
      };
    }

    return cityData;
  }

  classifyHotspotSeverity(percentage) {
    if (percentage >= 20) return 'critical';
    if (percentage >= 10) return 'high';
    if (percentage >= 5) return 'medium';
    return 'low';
  }

  calculateEnergyEfficiency(performance) {
    const score = parseFloat(performance.performanceScore) || 50;
    
    if (score >= 85) return 'high-efficiency';
    if (score >= 70) return 'moderate-efficiency';
    if (score >= 55) return 'low-efficiency';
    return 'inefficient';
  }

  calculateProcessingPower(performance) {
    const ipc = parseFloat(performance.ipc) || 1.0;
    
    if (ipc >= 2.0) return 'supercomputer';
    if (ipc >= 1.5) return 'high-performance';
    if (ipc >= 1.0) return 'standard';
    return 'limited';
  }

  calculateIndustrialActivity(metrics) {
    const instructions = metrics.instructions || 0;
    const cycles = metrics.cycles || 1;
    const activity = instructions / cycles;
    
    if (activity >= 2.0) return 'very-high';
    if (activity >= 1.5) return 'high';
    if (activity >= 1.0) return 'moderate';
    return 'low';
  }

  hasHighCPUUsage(performance) {
    const ipc = parseFloat(performance.ipc) || 0;
    return ipc >= 1.5;
  }

  hasMemoryBottlenecks(performance) {
    const cacheMissRate = parseFloat(performance.cacheMissRate) || 0;
    return cacheMissRate > 15;
  }

  hasCacheIssues(performance) {
    const cacheLevel = performance.cacheLevel;
    return cacheLevel === 'fair' || cacheLevel === 'poor';
  }

  hasBranchIssues(performance) {
    const branchLevel = performance.branchLevel;
    return branchLevel === 'fair' || branchLevel === 'poor';
  }

  hasPerformanceBottlenecks(performance) {
    const score = parseFloat(performance.performanceScore) || 50;
    return score < 60;
  }

  assessMemoryBandwidth(metrics) {
    const pageFaults = metrics['page-faults'] || 0;
    
    if (pageFaults === 0) return 'optimal';
    if (pageFaults <= 10) return 'good';
    if (pageFaults <= 50) return 'congested';
    return 'severely-congested';
  }

  assessCacheEfficiency(performance) {
    const cacheLevel = performance.cacheLevel;
    const efficiencyMap = {
      excellent: 'optimal',
      good: 'efficient',
      fair: 'suboptimal',
      poor: 'inefficient'
    };
    
    return efficiencyMap[cacheLevel] || 'unknown';
  }

  assessBranchPrediction(performance) {
    const branchLevel = performance.branchLevel;
    const predictionMap = {
      excellent: 'accurate',
      good: 'mostly-accurate',
      fair: 'inaccurate',
      poor: 'very-inaccurate'
    };
    
    return predictionMap[branchLevel] || 'unknown';
  }

  assessTrafficFlow(performance) {
    const score = parseFloat(performance.performanceScore) || 50;
    
    if (score >= 85) return 'smooth';
    if (score >= 70) return 'minor-delays';
    if (score >= 55) return 'congested';
    return 'gridlock';
  }

  calculateCPUIntensity(metrics) {
    const cycles = metrics.cycles || 0;
    
    // Normalize based on typical values
    if (cycles > 1000000000) return 'extreme';
    if (cycles > 100000000) return 'high';
    if (cycles > 10000000) return 'moderate';
    return 'low';
  }

  calculateThermalOutput(performance) {
    const ipc = parseFloat(performance.ipc) || 1.0;
    const score = parseFloat(performance.performanceScore) || 50;
    
    // Higher IPC and lower efficiency = more heat
    const heatIndex = (ipc * 50) + (100 - score);
    
    if (heatIndex >= 150) return 'very-high';
    if (heatIndex >= 100) return 'high';
    if (heatIndex >= 75) return 'moderate';
    return 'low';
  }

  calculateProductionEfficiency(performance) {
    const score = parseFloat(performance.performanceScore) || 50;
    
    if (score >= 85) return 'optimal';
    if (score >= 70) return 'efficient';
    if (score >= 55) return 'suboptimal';
    return 'inefficient';
  }

  classifyIndustrialZone(performance) {
    const ipc = parseFloat(performance.ipc) || 1.0;
    const cacheLevel = performance.cacheLevel;
    
    if (ipc >= 2.0 && cacheLevel === 'excellent') return 'high-tech-manufacturing';
    if (ipc >= 1.5) return 'advanced-manufacturing';
    if (ipc >= 1.0) return 'standard-manufacturing';
    return 'light-industrial';
  }
}

module.exports = new PerfAdapter();