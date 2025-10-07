/**
 * New Relic APM Adapter for Phase 2 Workflow Integration
 *
 * Integrates New Relic Application Performance Monitoring data into
 * the Topolop unified analysis platform.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 * API: New Relic NerdGraph (GraphQL) and REST API v2
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
 * New Relic configuration interface
 */
export interface NewRelicConfig {
  apiKey: string;
  accountId: string;
  applicationId?: string;
  baseUrl?: string; // Default: https://api.newrelic.com
  nerdGraphUrl?: string; // Default: https://api.newrelic.com/graphql
  timeout?: number; // Default: 30000ms
}

/**
 * New Relic raw performance data structures
 */
interface NewRelicMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface NewRelicApplication {
  id: number;
  name: string;
  language: string;
  health_status: 'green' | 'yellow' | 'red' | 'gray';
  reporting: boolean;
  last_reported_at: string;
  application_summary: {
    response_time: number;
    throughput: number;
    error_rate: number;
    apdex_target: number;
    apdex_score: number;
  };
}

interface NewRelicError {
  error_class: string;
  message: string;
  file: string;
  line_number: number;
  occurrence_count: number;
  last_notice_at: string;
}

/**
 * New Relic APM Adapter Implementation
 */
export class NewRelicAdapter implements PerformanceAdapter {
  public readonly name = 'New Relic APM';
  public readonly version = '1.0.0';
  public readonly type = 'apm' as const;

  public readonly capabilities = {
    realTimeMonitoring: true,
    historicalData: true,
    alerting: true,
    customMetrics: true
  };

  private config: NewRelicConfig;
  private initialized = false;

  constructor(config?: NewRelicConfig) {
    this.config = {
      baseUrl: 'https://api.newrelic.com',
      nerdGraphUrl: 'https://api.newrelic.com/graphql',
      timeout: 30000,
      ...config
    } as NewRelicConfig;
  }

  /**
   * Initialize the New Relic adapter
   */
  public async initialize(config: NewRelicConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('New Relic API key is required');
    }
    if (!config.accountId) {
      throw new Error('New Relic account ID is required');
    }

    this.config = { ...this.config, ...config };

    // Test API connectivity
    await this.testConnection();
    this.initialized = true;

    console.log(`✅ New Relic APM Adapter initialized for account ${this.config.accountId}`);
  }

  /**
   * Get performance metrics for a project/application
   */
  public async getPerformanceMetrics(
    projectId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<PerformanceIssue[]> {
    this.ensureInitialized();

    const applicationId = this.config.applicationId || projectId;

    try {
      // Fetch application data
      const application = await this.getApplicationDetails(applicationId);
      const metrics = await this.getApplicationMetrics(applicationId, timeRange);
      const errors = await this.getApplicationErrors(applicationId, timeRange);

      // Convert to performance issues
      const performanceIssues: PerformanceIssue[] = [];

      // Analyze response time issues
      if (application.application_summary.response_time > 1000) { // > 1 second
        performanceIssues.push(this.createResponseTimeIssue(application, metrics));
      }

      // Analyze error rate issues
      if (application.application_summary.error_rate > 5) { // > 5%
        performanceIssues.push(this.createErrorRateIssue(application, metrics));
      }

      // Analyze throughput issues (low throughput)
      if (application.application_summary.throughput < 10) { // < 10 rpm
        performanceIssues.push(this.createThroughputIssue(application, metrics));
      }

      // Analyze Apdex score issues
      if (application.application_summary.apdex_score < 0.7) { // < 0.7 (poor user satisfaction)
        performanceIssues.push(this.createApdexIssue(application, metrics));
      }

      // Convert specific errors to performance issues
      for (const error of errors) {
        if (error.occurrence_count > 10) { // Frequent errors
          performanceIssues.push(this.createErrorPerformanceIssue(error, application));
        }
      }

      console.log(`📊 New Relic: Found ${performanceIssues.length} performance issues for ${application.name}`);
      return performanceIssues;

    } catch (error) {
      console.error('❌ New Relic APM analysis failed:', error);
      throw new Error(`New Relic APM analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze raw performance data from New Relic
   */
  public analyzePerformanceData(rawData: any): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (rawData.applications) {
      for (const app of rawData.applications) {
        issues.push(...this.analyzeApplicationData(app));
      }
    }

    if (rawData.metrics) {
      issues.push(...this.analyzeMetricsData(rawData.metrics));
    }

    return issues;
  }

  /**
   * Test API connection to New Relic
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.makeRequest('/v2/applications.json', 'GET');
      if (!response.applications) {
        throw new Error('Invalid New Relic API response');
      }
    } catch (error) {
      throw new Error(`New Relic API connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get application details from New Relic
   */
  private async getApplicationDetails(applicationId: string): Promise<NewRelicApplication> {
    const response = await this.makeRequest(`/v2/applications/${applicationId}.json`, 'GET');
    return response.application;
  }

  /**
   * Get application metrics from New Relic
   */
  private async getApplicationMetrics(
    applicationId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<NewRelicMetric[]> {
    const params = new URLSearchParams();
    params.append('names[]', 'HttpDispatcher');
    params.append('names[]', 'Errors/all');
    params.append('names[]', 'Memory/Physical');

    if (timeRange) {
      params.append('from', timeRange.start.toISOString());
      params.append('to', timeRange.end.toISOString());
    }

    const response = await this.makeRequest(
      `/v2/applications/${applicationId}/metrics/data.json?${params.toString()}`,
      'GET'
    );

    return response.metric_data?.metrics || [];
  }

  /**
   * Get application errors from New Relic
   */
  private async getApplicationErrors(
    applicationId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<NewRelicError[]> {
    const params = new URLSearchParams();

    if (timeRange) {
      params.append('from', timeRange.start.toISOString());
      params.append('to', timeRange.end.toISOString());
    }

    const response = await this.makeRequest(
      `/v2/applications/${applicationId}/errors.json?${params.toString()}`,
      'GET'
    );

    return response.errors || [];
  }

  /**
   * Create response time performance issue
   */
  private createResponseTimeIssue(
    application: NewRelicApplication,
    metrics: NewRelicMetric[]
  ): PerformanceIssue {
    const responseTime = application.application_summary.response_time;

    return this.createPerformanceIssue({
      id: `newrelic-response-time-${application.id}`,
      title: `High Response Time Detected`,
      description: `Application "${application.name}" has high response time of ${responseTime}ms (target: <1000ms)`,
      severity: responseTime > 3000 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'newrelic-response-time',
      entity: new UnifiedEntity({
        id: `app-${application.id}`,
        type: 'application',
        name: application.name,
        canonicalPath: `apps/${application.name}`
      }),
      performanceMetrics: {
        responseTime: responseTime,
        throughput: application.application_summary.throughput
      },
      performanceCategory: 'response_time',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Reduce response time by ${Math.round((responseTime - 1000) / responseTime * 100)}%`,
        effort: responseTime > 5000 ? 'high' : 'medium',
        priority: responseTime > 3000 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create error rate performance issue
   */
  private createErrorRateIssue(
    application: NewRelicApplication,
    metrics: NewRelicMetric[]
  ): PerformanceIssue {
    const errorRate = application.application_summary.error_rate;

    return this.createPerformanceIssue({
      id: `newrelic-error-rate-${application.id}`,
      title: `High Error Rate Detected`,
      description: `Application "${application.name}" has high error rate of ${errorRate}% (target: <1%)`,
      severity: errorRate > 10 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'newrelic-error-rate',
      entity: new UnifiedEntity({
        id: `app-${application.id}`,
        type: 'application',
        name: application.name,
        canonicalPath: `apps/${application.name}`
      }),
      performanceMetrics: {
        errorRate: errorRate,
        throughput: application.application_summary.throughput
      },
      performanceCategory: 'availability',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Reduce error rate to <1% (current: ${errorRate}%)`,
        effort: 'medium',
        priority: errorRate > 10 ? 'high' : 'medium'
      }
    });
  }

  /**
   * Create Apdex performance issue
   */
  private createApdexIssue(
    application: NewRelicApplication,
    metrics: NewRelicMetric[]
  ): PerformanceIssue {
    const apdexScore = application.application_summary.apdex_score;

    return this.createPerformanceIssue({
      id: `newrelic-apdex-${application.id}`,
      title: `Poor User Satisfaction (Apdex Score)`,
      description: `Application "${application.name}" has poor Apdex score of ${apdexScore} (target: >0.8)`,
      severity: apdexScore < 0.5 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'newrelic-apdex-score',
      entity: new UnifiedEntity({
        id: `app-${application.id}`,
        type: 'application',
        name: application.name,
        canonicalPath: `apps/${application.name}`
      }),
      performanceMetrics: {
        responseTime: application.application_summary.response_time,
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
    application: NewRelicApplication,
    metrics: NewRelicMetric[]
  ): PerformanceIssue {
    const throughput = application.application_summary.throughput;

    return this.createPerformanceIssue({
      id: `newrelic-throughput-${application.id}`,
      title: `Low Application Throughput`,
      description: `Application "${application.name}" has low throughput of ${throughput} rpm`,
      severity: IssueSeverity.LOW,
      ruleId: 'newrelic-low-throughput',
      entity: new UnifiedEntity({
        id: `app-${application.id}`,
        type: 'application',
        name: application.name,
        canonicalPath: `apps/${application.name}`
      }),
      performanceMetrics: {
        throughput: throughput,
        responseTime: application.application_summary.response_time
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
    error: NewRelicError,
    application: NewRelicApplication
  ): PerformanceIssue {
    return this.createPerformanceIssue({
      id: `newrelic-error-${application.id}-${error.error_class}`,
      title: `Frequent Application Error`,
      description: `${error.error_class}: ${error.message}`,
      severity: error.occurrence_count > 100 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      ruleId: 'newrelic-frequent-error',
      line: error.line_number || null,
      entity: new UnifiedEntity({
        id: error.file || `app-${application.id}`,
        type: 'file',
        name: error.file || application.name,
        canonicalPath: error.file || `apps/${application.name}`
      }),
      performanceMetrics: {
        errorRate: (error.occurrence_count / application.application_summary.throughput) * 100
      },
      performanceCategory: 'availability',
      impactLevel: 'user_facing',
      optimizationOpportunity: {
        potentialImprovement: `Fix recurring error (${error.occurrence_count} occurrences)`,
        effort: 'medium',
        priority: error.occurrence_count > 100 ? 'high' : 'medium'
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
        source: 'new_relic_apm',
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
   * Analyze application data for performance issues
   */
  private analyzeApplicationData(appData: NewRelicApplication): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Health status analysis
    if (appData.health_status === 'red') {
      issues.push(this.createPerformanceIssue({
        id: `newrelic-health-${appData.id}`,
        title: 'Application Health Critical',
        description: `Application "${appData.name}" health status is critical`,
        severity: IssueSeverity.CRITICAL,
        ruleId: 'newrelic-app-health',
        entity: new UnifiedEntity({
          id: `app-${appData.id}`,
          type: 'application',
          name: appData.name,
          canonicalPath: `apps/${appData.name}`
        }),
        performanceMetrics: {
          availabilityScore: 0,
          responseTime: appData.application_summary.response_time
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
  private analyzeMetricsData(metricsData: NewRelicMetric[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    for (const metric of metricsData) {
      if (metric.name.includes('Memory') && metric.value > 80) { // High memory usage
        issues.push(this.createPerformanceIssue({
          id: `newrelic-memory-${Date.now()}`,
          title: 'High Memory Usage',
          description: `Memory usage is at ${metric.value}%`,
          severity: metric.value > 90 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
          ruleId: 'newrelic-high-memory',
          entity: new UnifiedEntity({
            id: 'system-memory',
            type: 'system',
            name: 'Memory',
            canonicalPath: 'system/memory'
          }),
          performanceMetrics: {
            memoryUsage: metric.value
          },
          performanceCategory: 'memory',
          impactLevel: 'system_level'
        }));
      }
    }

    return issues;
  }

  /**
   * Make HTTP request to New Relic API
   */
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'X-Api-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`New Relic API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Ensure adapter is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('New Relic adapter not initialized. Call initialize() first.');
    }
  }
}