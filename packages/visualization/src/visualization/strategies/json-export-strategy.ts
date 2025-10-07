/**
 * JSON Export Visualization Strategy
 *
 * Exports analysis results to JSON format for integration with
 * external tools, CI/CD pipelines, and custom dashboards.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  VisualizationStrategy,
  VisualizationConfig
} from '../visualization-interface';

import {
  UnifiedAnalysisResult,
  UnifiedIssue
} from '@topolop/shared-types';

interface JsonExportConfig extends VisualizationConfig {
  outputPath?: string;
  format?: 'compact' | 'pretty' | 'minimal';
  includeMetadata?: boolean;
  includeRawData?: boolean;
}

export class JsonExportVisualizationStrategy implements VisualizationStrategy {
  readonly name = 'json-export';
  readonly version = '1.0.0';
  readonly description = 'Export analysis results to JSON format';
  readonly dependencies = ['fs'];

  private config: JsonExportConfig = {};
  private outputPath: string = './topolop-results.json';

  async initialize(container: HTMLElement | string, config?: JsonExportConfig): Promise<void> {
    this.config = {
      format: 'pretty',
      includeMetadata: true,
      includeRawData: false,
      ...config
    };

    if (typeof container === 'string') {
      this.outputPath = container;
    } else if (this.config.outputPath) {
      this.outputPath = this.config.outputPath;
    }

    // Ensure output directory exists
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`📄 JSON Export initialized: ${this.outputPath}`);
  }

  async render(data: UnifiedAnalysisResult): Promise<void> {
    const exportData = this.transformData(data);
    const json = this.formatJson(exportData);

    fs.writeFileSync(this.outputPath, json, 'utf8');
    console.log(`✅ Analysis results exported to: ${this.outputPath}`);
    console.log(`📊 Summary: ${data.issues.length} issues, ${data.fileMetrics.size} files, ${data.hotspots.length} hotspots`);
  }

  async update(data: UnifiedAnalysisResult): Promise<void> {
    await this.render(data);
  }

  async dispose(): Promise<void> {
    console.log('📄 JSON Export visualization disposed');
  }

  isAvailable(): boolean {
    return typeof fs !== 'undefined' && typeof fs.writeFileSync === 'function';
  }

  private transformData(data: UnifiedAnalysisResult) {
    const baseExport = {
      metadata: this.config.includeMetadata ? {
        generatedAt: new Date().toISOString(),
        toolVersion: 'Topolop v0.1.0',
        analysisType: 'unified-multi-tool',
        totalIssues: data.issues.length,
        totalFiles: data.fileMetrics.size,
        totalHotspots: data.hotspots.length,
        totalCorrelationGroups: data.correlationGroups.length
      } : undefined,

      summary: {
        issueCount: data.issues.length,
        fileCount: data.fileMetrics.size,
        hotspotCount: data.hotspots.length,
        correlationGroupCount: data.correlationGroups.length,
        severityBreakdown: this.calculateSeverityBreakdown(data.issues),
        toolBreakdown: this.calculateToolBreakdown(data.issues)
      },

      issues: this.config.format === 'minimal'
        ? this.transformIssuesMinimal(data.issues)
        : this.transformIssuesComplete(data.issues),

      hotspots: data.hotspots.map(hotspot => ({
        id: hotspot.id,
        file: hotspot.canonicalPath,
        riskScore: hotspot.riskScore,
        issueCount: hotspot.issueCount,
        toolsCoverage: hotspot.toolCoverage,
        recommendedActions: hotspot.recommendedActions
      })),

      correlationGroups: data.correlationGroups.map(group => ({
        id: group.id,
        riskScore: group.riskScore,
        issueCount: group.issues.length,
        files: [...new Set(group.issues.map(i => i.entity.canonicalPath))],
        categories: [...new Set(group.issues.map(i => i.analysisType))]
      }))
    };

    if (this.config.includeRawData) {
      (baseExport as any).rawData = {
        fileMetrics: Array.from(data.fileMetrics.entries()).map(([path, metrics]) => ({
          path,
          issueCount: metrics.issueCount,
          hotspotScore: metrics.hotspotScore,
          toolCoverage: metrics.toolCoverage
        }))
      };
    }

    return baseExport;
  }

  private transformIssuesMinimal(issues: UnifiedIssue[]) {
    return issues.map(issue => ({
      file: issue.entity.canonicalPath,
      line: issue.line,
      severity: issue.severity,
      type: issue.analysisType,
      tool: issue.toolName,
      title: issue.title
    }));
  }

  private transformIssuesComplete(issues: UnifiedIssue[]) {
    return issues.map(issue => ({
      id: issue.id,
      file: issue.entity.canonicalPath,
      line: issue.line,
      column: issue.column,
      endLine: issue.endLine,
      endColumn: issue.endColumn,
      severity: issue.severity,
      analysisType: issue.analysisType,
      tool: issue.toolName,
      title: issue.title,
      description: issue.description,
      ruleId: issue.ruleId,
      createdAt: issue.createdAt,
      metadata: issue.metadata
    }));
  }

  private calculateSeverityBreakdown(issues: UnifiedIssue[]) {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    });
  }

  private calculateToolBreakdown(issues: UnifiedIssue[]) {
    return issues.reduce((acc, issue) => {
      acc[issue.toolName] = (acc[issue.toolName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private formatJson(data: any): string {
    switch (this.config.format) {
      case 'compact':
        return JSON.stringify(data);
      case 'minimal':
        return JSON.stringify(data, null, 1);
      case 'pretty':
      default:
        return JSON.stringify(data, null, 2);
    }
  }
}