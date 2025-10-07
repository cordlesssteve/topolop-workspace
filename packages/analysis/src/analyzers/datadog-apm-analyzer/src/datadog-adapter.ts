/**
 * DataDog APM Adapter for Phase 2 Workflow Integration
 *
 * Integrates DataDog Application Performance Monitoring data into
 * the Topolop unified analysis platform.
 *
 * Created: 2025-09-25
 * Phase: 2.0 - Workflow Integration
 * API: DataDog API v1 and v2
 */

import {
  PerformanceAdapter,
  PerformanceIssue,
  PerformanceMetrics,
  WorkflowRecommendation
} from '@topolop/shared-types';

import {
  UnifiedEntity,
  IssueSeverity,
  AnalysisType,
  UnifiedIssueParams
} from '@topolop/shared-types';

/**
 * DataDog configuration interface
 */
export interface DataDogConfig {
  apiKey: string;
  appKey: string;
  site?: string; // Default: datadoghq.com (US), datadoghq.eu (EU), etc.
  baseUrl?: string; // Computed from site
  timeout?: number; // Default: 30000ms
}

/**
 * DataDog raw performance data structures
 */
interface DataDogMetric {
  metric: string;
  points: Array<[number, number]>; // [timestamp, value]
  tags: string[];
  host?: string;
  type?: string;
  interval?: number;
  unit?: string;
}

interface DataDogService {
  service: string;
  env: string;
  version?: string;
  last_seen: number;
  apm_stats: {
    errors: number;
    hits: number;
    duration: number;
    apdex?: number;
  };
}

interface DataDogError {
  error_id: string;
  message: string;
  stack_trace?: string;
  type: string;
  count: number;
  first_seen: number;
  last_seen: number;
  tags: string[];
  service: string;
  resource?: string;
}

interface DataDogTrace {
  trace_id: string;
  span_id: string;
  parent_id?: string;
  service: string;
  name: string;
  resource: string;
  duration: number;
  start: number;
  error: number;
  tags: Record<string, string>;
  meta: Record<string, string>;
}

/**
 * DataDog APM Adapter Implementation
 */
export class DataDogAdapter implements PerformanceAdapter {
  public readonly name = 'DataDog APM';
  public readonly version = '1.0.0';
  public readonly type = 'apm' as const;

  public readonly capabilities = {
    realTimeMonitoring: true,
    historicalData: true,
    alerting: true,
    customMetrics: true,
    distributedTracing: true,
    logCorrelation: true,
    infraMetrics: true
  };

  private config: DataDogConfig;
  private initialized = false;

  constructor(config?: DataDogConfig) {
    this.config = {
      site: 'datadoghq.com',
      timeout: 30000,
      ...config
    } as DataDogConfig;

    // Set baseUrl based on site
    if (!this.config.baseUrl && this.config.site) {
      this.config.baseUrl = `https://api.${this.config.site}`;
    }
  }

  /**
   * Initialize the DataDog adapter
   */
  public async initialize(config: DataDogConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('DataDog API key is required');
    }
    if (!config.appKey) {
      throw new Error('DataDog application key is required');
    }

    this.config = { ...this.config, ...config };

    // Set baseUrl if not provided
    if (!this.config.baseUrl) {
      this.config.baseUrl = `https://api.${this.config.site || 'datadoghq.com'}`;
    }

    // Test API connectivity
    await this.testConnection();
    this.initialized = true;

    console.log(`✅ DataDog APM Adapter initialized for site ${this.config.site}`);
  }

  /**
   * Get performance metrics for a project/service
   */
  public async getPerformanceMetrics(
    projectId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<PerformanceIssue[]> {
    this.ensureInitialized();

    const serviceName = projectId;
    const now = new Date();
    const defaultTimeRange = {
      start: timeRange?.start || new Date(now.getTime() - 3600000), // 1 hour ago
      end: timeRange?.end || now
    };

    try {
      // Fetch service data
      const services = await this.getServices();
      const targetService = services.find(s => s.service === serviceName) || services[0];

      if (!targetService) {
        console.log(`⚠️  No DataDog services found for project: ${projectId}`);
        return [];
      }

      // Fetch performance data
      const metrics = await this.getServiceMetrics(targetService.service, defaultTimeRange);
      const errors = await this.getServiceErrors(targetService.service, defaultTimeRange);
      const traces = await this.getServiceTraces(targetService.service, defaultTimeRange);

      // Convert to performance issues
      const performanceIssues: PerformanceIssue[] = [];

      // Analyze response time issues
      const avgDuration = targetService.apm_stats.duration / 1000000; // Convert nanoseconds to milliseconds
      if (avgDuration > 1000) { // > 1 second
        performanceIssues.push(this.createResponseTimeIssue(targetService, metrics, avgDuration));
      }

      // Analyze error rate issues
      const errorRate = (targetService.apm_stats.errors / targetService.apm_stats.hits) * 100;
      if (errorRate > 5) { // > 5%
        performanceIssues.push(this.createErrorRateIssue(targetService, metrics, errorRate));
      }

      // Analyze throughput issues (low throughput)
      const throughput = targetService.apm_stats.hits / 60; // hits per minute
      if (throughput < 10) { // < 10 requests per minute
        performanceIssues.push(this.createThroughputIssue(targetService, metrics, throughput));
      }

      // Analyze Apdex score issues (if available)
      if (targetService.apm_stats.apdex && targetService.apm_stats.apdex < 0.7) {
        performanceIssues.push(this.createApdexIssue(targetService, metrics));
      }

      // Convert specific errors to performance issues
      for (const error of errors) {
        if (error.count > 10) { // Frequent errors
          performanceIssues.push(this.createErrorPerformanceIssue(error, targetService));
        }
      }

      // Analyze distributed tracing issues
      const slowTraces = traces.filter(trace => trace.duration > 1000000000); // > 1 second in nanoseconds
      for (const trace of slowTraces.slice(0, 5)) { // Limit to top 5 slow traces
        performanceIssues.push(this.createSlowTraceIssue(trace, targetService));
      }

      console.log(`📊 DataDog: Found ${performanceIssues.length} performance issues for service ${targetService.service}`);
      return performanceIssues;

    } catch (error) {
      console.error('❌ DataDog APM analysis failed:', error);
      throw new Error(`DataDog APM analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze raw performance data from DataDog
   */
  public analyzePerformanceData(rawData: any): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (rawData.services) {
      for (const service of rawData.services) {
        issues.push(...this.analyzeServiceData(service));
      }
    }

    if (rawData.metrics) {
      issues.push(...this.analyzeMetricsData(rawData.metrics));
    }

    if (rawData.traces) {
      issues.push(...this.analyzeTracesData(rawData.traces));
    }

    return issues;
  }

  /**
   * Test API connection to DataDog
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.makeRequest('/api/v1/validate', 'GET');
      if (!response.valid) {
        throw new Error('Invalid DataDog API credentials');
      }
    } catch (error) {
      throw new Error(`DataDog API connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get services from DataDog APM
   */
  private async getServices(): Promise<DataDogService[]> {
    const response = await this.makeRequest('/api/v1/apm/services', 'GET');
    return response.data || [];
  }

  /**
   * Get service metrics from DataDog
   */
  private async getServiceMetrics(
    serviceName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<DataDogMetric[]> {
    const params = new URLSearchParams();
    params.append('query', `avg:trace.servlet.request.duration{service:${serviceName}}`);
    params.append('from', Math.floor(timeRange.start.getTime() / 1000).toString());
    params.append('to', Math.floor(timeRange.end.getTime() / 1000).toString());

    const response = await this.makeRequest(
      `/api/v1/query?${params.toString()}`,
      'GET'
    );

    return response.series || [];
  }

  /**
   * Get service errors from DataDog
   */
  private async getServiceErrors(
    serviceName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<DataDogError[]> {
    const params = new URLSearchParams();
    params.append('service', serviceName);
    params.append('from', Math.floor(timeRange.start.getTime() / 1000).toString());
    params.append('to', Math.floor(timeRange.end.getTime() / 1000).toString());

    const response = await this.makeRequest(
      `/api/v1/apm/errors?${params.toString()}`,
      'GET'
    );

    return response.errors || [];
  }

  /**
   * Get service traces from DataDog
   */
  private async getServiceTraces(
    serviceName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<DataDogTrace[]> {
    const params = new URLSearchParams();
    params.append('service', serviceName);
    params.append('from', Math.floor(timeRange.start.getTime() / 1000).toString());
    params.append('to', Math.floor(timeRange.end.getTime() / 1000).toString());
    params.append('limit', '100');

    const response = await this.makeRequest(
      `/api/v1/apm/traces/search?${params.toString()}`,
      'GET'
    );

    return response.traces || [];
  }

  /**
   * Create response time performance issue
   */
  private createResponseTimeIssue(
    service: DataDogService,
    metrics: DataDogMetric[],
    avgDuration: number
  ): PerformanceIssue {
    return this.createPerformanceIssue({
      id: `datadog-response-time-${service.service}`,
      title: `High Response Time Detected`,
      description: `Service "${service.service}" has high average response time of ${Math.round(avgDuration)}ms (target: <1000ms)`,
      severity: avgDuration > 3000 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'datadog-response-time',
      entity: new UnifiedEntity({
        id: `service-${service.service}`,
        type: 'service',
        name: service.service,
        canonicalPath: `services/${service.service}`
      }),
      performanceMetrics: {
        responseTime: avgDuration,
        throughput: service.apm_stats.hits
      },
      performanceCategory: 'response_time',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Reduce response time by ${Math.round((avgDuration - 1000) / avgDuration * 100)}%`,
        effort: avgDuration > 5000 ? 'high' : 'medium',
        priority: avgDuration > 3000 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create error rate performance issue
   */
  private createErrorRateIssue(
    service: DataDogService,
    metrics: DataDogMetric[],
    errorRate: number
  ): PerformanceIssue {
    return this.createPerformanceIssue({
      id: `datadog-error-rate-${service.service}`,
      title: `High Error Rate Detected`,
      description: `Service "${service.service}" has high error rate of ${errorRate.toFixed(2)}% (target: <1%)`,
      severity: errorRate > 10 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'datadog-error-rate',
      entity: new UnifiedEntity({
        id: `service-${service.service}`,
        type: 'service',
        name: service.service,
        canonicalPath: `services/${service.service}`
      }),
      performanceMetrics: {
        errorRate: errorRate,
        throughput: service.apm_stats.hits
      },
      performanceCategory: 'availability',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Reduce error rate to <1% (current: ${errorRate.toFixed(2)}%)`,
        effort: 'medium',
        priority: errorRate > 10 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create Apdex performance issue
   */
  private createApdexIssue(
    service: DataDogService,
    metrics: DataDogMetric[]
  ): PerformanceIssue {
    const apdexScore = service.apm_stats.apdex || 0;

    return this.createPerformanceIssue({
      id: `datadog-apdex-${service.service}`,
      title: `Poor User Satisfaction (Apdex Score)`,
      description: `Service "${service.service}" has poor Apdex score of ${apdexScore.toFixed(3)} (target: >0.8)`,
      severity: apdexScore < 0.5 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'datadog-apdex-score',
      entity: new UnifiedEntity({
        id: `service-${service.service}`,
        type: 'service',
        name: service.service,
        canonicalPath: `services/${service.service}`
      }),
      performanceMetrics: {
        responseTime: service.apm_stats.duration / 1000000,
        availabilityScore: apdexScore * 100
      },
      performanceCategory: 'loading',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Improve user satisfaction to >80% (current: ${Math.round(apdexScore * 100)}%)`,
        effort: 'high',
        priority: apdexScore < 0.5 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create throughput performance issue
   */
  private createThroughputIssue(
    service: DataDogService,
    metrics: DataDogMetric[],
    throughput: number
  ): PerformanceIssue {
    return this.createPerformanceIssue({
      id: `datadog-throughput-${service.service}`,
      title: `Low Service Throughput`,
      description: `Service "${service.service}" has low throughput of ${throughput.toFixed(1)} requests/min`,
      severity: IssueSeverity.LOW,
      ruleId: 'datadog-low-throughput',
      entity: new UnifiedEntity({
        id: `service-${service.service}`,
        type: 'service',
        name: service.service,
        canonicalPath: `services/${service.service}`
      }),
      performanceMetrics: {
        throughput: throughput,
        responseTime: service.apm_stats.duration / 1000000
      },
      performanceCategory: 'loading',
      impactLevel: 'system_level',
      optimizationOpportunity: {
        potentialImprovement: 'Investigate traffic patterns and scaling opportunities',
        effort: 'medium',
        priority: 'low'
      }
    });
  }

  /**
   * Create error-based performance issue
   */
  private createErrorPerformanceIssue(
    error: DataDogError,
    service: DataDogService
  ): PerformanceIssue {
    return this.createPerformanceIssue({
      id: `datadog-error-${service.service}-${error.error_id}`,
      title: `Frequent Service Error`,
      description: `${error.type}: ${error.message}`,
      severity: error.count > 100 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'datadog-frequent-error',
      entity: new UnifiedEntity({
        id: error.resource || `service-${service.service}`,
        type: error.resource ? 'endpoint' : 'service',
        name: error.resource || service.service,
        canonicalPath: error.resource || `services/${service.service}`
      }),
      performanceMetrics: {
        errorRate: (error.count / service.apm_stats.hits) * 100
      },
      performanceCategory: 'availability',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Fix recurring error (${error.count} occurrences)`,
        effort: 'medium',
        priority: error.count > 100 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create slow trace performance issue
   */
  private createSlowTraceIssue(
    trace: DataDogTrace,
    service: DataDogService
  ): PerformanceIssue {
    const durationMs = trace.duration / 1000000; // Convert nanoseconds to milliseconds

    return this.createPerformanceIssue({
      id: `datadog-slow-trace-${trace.trace_id}`,
      title: `Slow Distributed Trace`,
      description: `Trace "${trace.name}" on "${trace.resource}" took ${Math.round(durationMs)}ms`,
      severity: durationMs > 5000 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'datadog-slow-trace',
      entity: new UnifiedEntity({
        id: trace.resource,
        type: 'endpoint',
        name: trace.resource,
        canonicalPath: `services/${trace.service}/${trace.resource}`
      }),
      performanceMetrics: {
        responseTime: durationMs,
        traceId: trace.trace_id
      },
      performanceCategory: 'response_time',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Optimize trace performance (current: ${Math.round(durationMs)}ms)`,
        effort: 'high',
        priority: durationMs > 5000 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Helper to create performance issue with consistent structure
   */
  private createPerformanceIssue(params: {
    id: string;
    title: string;
    description: string;
    severity: IssueSeverity;
    ruleId: string;
    entity: UnifiedEntity;
    line?: number | null;
    performanceMetrics: PerformanceMetrics;
    performanceCategory: string;
    impactLevel: string;
    optimizationOpportunity?: any;
  }): PerformanceIssue {
    const baseParams: UnifiedIssueParams = {
      id: params.id,
      entity: params.entity,
      severity: params.severity,
      analysisType: AnalysisType.APM_PERFORMANCE,
      title: params.title,
      description: params.description,
      ruleId: params.ruleId,
      line: params.line || null,
      toolName: this.name,
      metadata: {
        source: 'datadog_apm',
        performanceCategory: params.performanceCategory,
        impactLevel: params.impactLevel
      }
    };

    return {
      ...baseParams,
      performanceMetrics: params.performanceMetrics,
      performanceCategory: params.performanceCategory as any,
      impactLevel: params.impactLevel as any,
      optimizationOpportunity: params.optimizationOpportunity,
      createdAt: new Date().toISOString()
    } as PerformanceIssue;
  }

  /**
   * Analyze service data for performance issues
   */
  private analyzeServiceData(serviceData: DataDogService): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Service availability analysis
    const currentTime = Date.now() / 1000;
    const lastSeenHours = (currentTime - serviceData.last_seen) / 3600;

    if (lastSeenHours > 1) { // Service not seen for over 1 hour
      issues.push(this.createPerformanceIssue({
        id: `datadog-service-down-${serviceData.service}`,
        title: 'Service Unavailable',
        description: `Service "${serviceData.service}" has not reported data for ${Math.round(lastSeenHours)} hours`,
        severity: lastSeenHours > 24 ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
        ruleId: 'datadog-service-availability',
        entity: new UnifiedEntity({
          id: `service-${serviceData.service}`,
          type: 'service',
          name: serviceData.service,
          canonicalPath: `services/${serviceData.service}`
        }),
        performanceMetrics: {
          availabilityScore: 0,
          lastSeen: String(serviceData.last_seen)
        },
        performanceCategory: 'availability',
        impactLevel: 'system_level'
      }));
    }

    return issues;
  }

  /**
   * Analyze metrics data for performance issues
   */
  private analyzeMetricsData(metricsData: DataDogMetric[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    for (const metric of metricsData) {
      if (metric.metric.includes('cpu') && metric.points.length > 0) {
        const latestValue = metric.points[metric.points.length - 1]?.[1] || 0;

        if (latestValue > 80) { // High CPU usage
          issues.push(this.createPerformanceIssue({
            id: `datadog-cpu-${metric.host || 'unknown'}-${Date.now()}`,
            title: 'High CPU Usage',
            description: `CPU usage is at ${latestValue.toFixed(1)}% on ${metric.host || 'unknown host'}`,
            severity: latestValue > 90 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
            ruleId: 'datadog-high-cpu',
            entity: new UnifiedEntity({
              id: metric.host || 'system-cpu',
              type: 'host',
              name: metric.host || 'CPU',
              canonicalPath: `hosts/${metric.host || 'unknown'}/cpu`
            }),
            performanceMetrics: {
              cpuUsage: latestValue
            },
            performanceCategory: 'cpu',
            impactLevel: 'system_level'
          }));
        }
      }

      if (metric.metric.includes('memory') && metric.points.length > 0) {
        const latestValue = metric.points[metric.points.length - 1]?.[1] || 0;

        if (latestValue > 80) { // High memory usage
          issues.push(this.createPerformanceIssue({
            id: `datadog-memory-${metric.host || 'unknown'}-${Date.now()}`,
            title: 'High Memory Usage',
            description: `Memory usage is at ${latestValue.toFixed(1)}% on ${metric.host || 'unknown host'}`,
            severity: latestValue > 90 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
            ruleId: 'datadog-high-memory',
            entity: new UnifiedEntity({
              id: metric.host || 'system-memory',
              type: 'host',
              name: metric.host || 'Memory',
              canonicalPath: `hosts/${metric.host || 'unknown'}/memory`
            }),
            performanceMetrics: {
              memoryUsage: latestValue
            },
            performanceCategory: 'memory',
            impactLevel: 'system_level'
          }));
        }
      }
    }

    return issues;
  }

  /**
   * Analyze traces data for performance issues
   */
  private analyzeTracesData(tracesData: DataDogTrace[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Analyze for error patterns
    const errorTraces = tracesData.filter(trace => trace.error === 1);
    const errorsByService = new Map<string, number>();

    for (const trace of errorTraces) {
      errorsByService.set(trace.service, (errorsByService.get(trace.service) || 0) + 1);
    }

    // Create issues for services with high error counts in traces
    for (const [service, errorCount] of errorsByService) {
      if (errorCount > 5) {
        issues.push(this.createPerformanceIssue({
          id: `datadog-trace-errors-${service}`,
          title: 'High Error Rate in Traces',
          description: `Service "${service}" has ${errorCount} error traces in the sample`,
          severity: errorCount > 20 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
          ruleId: 'datadog-trace-error-rate',
          entity: new UnifiedEntity({
            id: `service-${service}`,
            type: 'service',
            name: service,
            canonicalPath: `services/${service}`
          }),
          performanceMetrics: {
            errorRate: (errorCount / tracesData.length) * 100
          },
          performanceCategory: 'availability',
          impactLevel: 'user_facing'
        }));
      }
    }

    return issues;
  }

  /**
   * Make HTTP request to DataDog API
   */
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'DD-API-KEY': this.config.apiKey,
        'DD-APPLICATION-KEY': this.config.appKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`DataDog API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Ensure adapter is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DataDog adapter not initialized. Call initialize() first.');
    }
  }
}