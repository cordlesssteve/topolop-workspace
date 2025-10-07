/**
 * Perf Runtime Profiling Integration for Topolop Layer 1 → Layer 2
 * 
 * Converts perf-adapter output into Layer 2 unified data model format
 * for runtime performance visualization in Layer 3 metaphors.
 */

const perfAdapter = require('../formal-methods-adapters/universal/perf-adapter');
const { resolveConfig } = require('../config/default-config');

class PerfRuntimeIntegration {
  constructor() {
    this.perfAdapter = perfAdapter;
    this.name = 'perf-runtime-integration';
    this.description = 'Integrates Linux perf runtime data with Layer 2 unified data model';
  }

  /**
   * Check if runtime profiling is available
   */
  async checkAvailability() {
    return await this.perfAdapter.checkAvailability();
  }

  /**
   * Collect runtime data and transform it for Layer 2
   */
  async collectRuntimeData(codebasePath, options = {}) {
    const defaultOptions = {
      duration: resolveConfig('runtime.perf.defaultDuration'),
      frequency: resolveConfig('runtime.perf.defaultFrequency'),
      enableCallGraph: true,
      enableHotspots: true,
      maxDuration: resolveConfig('runtime.perf.maxDuration'),
      timeout: resolveConfig('runtime.perf.timeout'),
      ...options
    };

    // Enforce maximum duration limit
    if (defaultOptions.duration > defaultOptions.maxDuration) {
      defaultOptions.duration = defaultOptions.maxDuration;
    }

    try {
      // Get raw perf data
      console.log('🔥 Collecting runtime profiling data...');
      const rawPerfData = await this.perfAdapter.analyze(codebasePath, {
        recordDuration: defaultOptions.duration,
        frequency: defaultOptions.frequency,
        enableCallGraph: defaultOptions.enableCallGraph
      });

      // Transform to Layer 2 format
      console.log('🔄 Converting perf data to Layer 2 format...');
      const runtimeData = this._transformToLayer2Format(rawPerfData, defaultOptions);

      console.log(`✅ Runtime data collected: ${runtimeData.hotspots?.length || 0} hotspots, ${runtimeData.callGraph?.length || 0} call relationships`);
      return runtimeData;

    } catch (error) {
      throw new Error(`Runtime profiling failed: ${error.message}`);
    }
  }

  /**
   * Transform raw perf data into Layer 2 unified data model format
   */
  _transformToLayer2Format(rawPerfData, options) {
    const runtimeData = {
      timestamp: new Date().toISOString(),
      profilingDuration: options.duration,
      samplingFrequency: options.frequency,
      hotspots: [],
      callGraph: [],
      performanceMetrics: {},
      metadata: {
        tool: 'perf',
        version: rawPerfData.metadata?.version || 'unknown',
        platform: 'linux'
      }
    };

    // Transform hotspot data from perf adapter format
    if (rawPerfData.results && rawPerfData.results.record && Array.isArray(rawPerfData.results.record)) {
      runtimeData.hotspots = this._extractHotspots(rawPerfData.results.record);
    }

    // Transform call graph data from summary hotspots
    if (rawPerfData.summary && rawPerfData.summary.topHotspots) {
      runtimeData.callGraph = this._extractCallGraphFromHotspots(rawPerfData.summary.topHotspots);
    }

    // Transform performance statistics
    if (rawPerfData.results && rawPerfData.results.stat) {
      runtimeData.performanceMetrics = this._extractPerformanceMetrics(rawPerfData.results.stat);
    }

    return runtimeData;
  }

  /**
   * Extract hotspot data in Layer 2 format
   */
  _extractHotspots(recordData) {
    const hotspots = [];

    recordData.forEach(record => {
      if (record.type === 'cpu-hotspots' && record.hotspots) {
        record.hotspots.forEach(hotspot => {
          hotspots.push({
            function: hotspot.function,
            file: record.target || 'unknown',
            cpuUsage: hotspot.percentage || 0,
            samples: 0, // Not available in current perf adapter format
            selfTime: 0, // Not available in current perf adapter format
            totalTime: 0, // Not available in current perf adapter format
            callCount: 0, // Not available in current perf adapter format
            location: {
              line: null,
              address: null
            },
            metadata: {
              module: hotspot.command || null,
              pid: null,
              tid: null
            }
          });
        });
      }
    });

    // Sort by CPU usage (most intensive first)
    return hotspots.sort((a, b) => b.cpuUsage - a.cpuUsage);
  }

  /**
   * Extract call graph data from hotspots (simplified format)
   */
  _extractCallGraphFromHotspots(topHotspots) {
    const callGraph = [];

    topHotspots.forEach((hotspot, index) => {
      callGraph.push({
        caller: 'main',
        callee: hotspot.function || hotspot.symbol,
        callCount: Math.ceil(hotspot.percentage * 10), // Estimated calls based on percentage
        avgExecutionTime: hotspot.percentage,
        totalExecutionTime: hotspot.percentage,
        relationship: {
          strength: hotspot.percentage > 10 ? 'strong' : hotspot.percentage > 5 ? 'medium' : 'weak',
          type: 'performance-critical'
        },
        metadata: {
          hotspotRank: index + 1,
          cpuPercentage: hotspot.percentage,
          binary: hotspot.binary || 'unknown'
        }
      });
    });

    return callGraph;
  }

  /**
   * Extract call graph data in Layer 2 format (legacy method)
   */
  _extractCallGraph(callGraphData) {
    const callGraph = [];

    callGraphData.forEach(call => {
      if (call.caller && call.callee) {
        callGraph.push({
          caller: {
            function: call.caller.function || 'unknown',
            file: call.caller.file || 'unknown',
            line: call.caller.line || null
          },
          callee: {
            function: call.callee.function || 'unknown',
            file: call.callee.file || 'unknown',
            line: call.callee.line || null
          },
          count: call.count || 1,
          percentage: call.percentage || 0,
          selfTime: call.selfTime || 0,
          cumulativeTime: call.cumulativeTime || 0
        });
      }
    });

    return callGraph;
  }

  /**
   * Extract performance metrics in Layer 2 format
   */
  _extractPerformanceMetrics(statData) {
    const metrics = {
      totalSamples: 0,
      totalCpuTime: 0,
      averageCpuUsage: 0,
      peakMemoryUsage: 0,
      contextSwitches: 0,
      pageFaults: 0,
      cacheMisses: 0,
      branchMisses: 0
    };

    if (Array.isArray(statData)) {
      statData.forEach(stat => {
        if (stat.type === 'performance-metrics' && stat.metrics) {
          const perfMetrics = stat.metrics;
          
          // Map perf adapter metrics to Layer 2 format
          metrics.totalSamples += perfMetrics.instructions || 0;
          metrics.contextSwitches += perfMetrics['context-switches'] || 0;
          metrics.pageFaults += perfMetrics['page-faults'] || 0;
          metrics.cacheMisses += perfMetrics['cache-misses'] || 0;
          metrics.branchMisses += perfMetrics['branch-misses'] || 0;
          
          // Calculate derived metrics
          if (perfMetrics.cycles && perfMetrics.instructions) {
            metrics.averageCpuUsage = (perfMetrics.instructions / perfMetrics.cycles) * 100;
          }
        }
      });
    }

    return metrics;
  }

  /**
   * Generate summary for Layer 3 visualization
   */
  generateVisualizationSummary(runtimeData) {
    const summary = {
      totalHotspots: runtimeData.hotspots?.length || 0,
      totalCallRelationships: runtimeData.callGraph?.length || 0,
      topHotspots: runtimeData.hotspots?.slice(0, 10) || [],
      performanceDistribution: this._calculatePerformanceDistribution(runtimeData.hotspots || []),
      callFrequencyDistribution: this._calculateCallFrequencyDistribution(runtimeData.callGraph || [])
    };

    return summary;
  }

  _calculatePerformanceDistribution(hotspots) {
    if (hotspots.length === 0) return { high: 0, medium: 0, low: 0 };

    const distribution = { high: 0, medium: 0, low: 0 };
    
    hotspots.forEach(hotspot => {
      if (hotspot.cpuUsage > 10) {
        distribution.high++;
      } else if (hotspot.cpuUsage > 1) {
        distribution.medium++;
      } else {
        distribution.low++;
      }
    });

    return distribution;
  }

  _calculateCallFrequencyDistribution(callGraph) {
    if (callGraph.length === 0) return { frequent: 0, moderate: 0, infrequent: 0 };

    const distribution = { frequent: 0, moderate: 0, infrequent: 0 };
    const callCounts = callGraph.map(call => call.count);
    const maxCount = Math.max(...callCounts);
    const threshold1 = maxCount * 0.1;
    const threshold2 = maxCount * 0.01;

    callGraph.forEach(call => {
      if (call.count > threshold1) {
        distribution.frequent++;
      } else if (call.count > threshold2) {
        distribution.moderate++;
      } else {
        distribution.infrequent++;
      }
    });

    return distribution;
  }
}

module.exports = PerfRuntimeIntegration;