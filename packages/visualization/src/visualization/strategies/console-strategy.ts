/**
 * Console Visualization Strategy
 *
 * Simple text-based visualization for headless environments, testing,
 * and users who prefer command-line output.
 */

import {
  VisualizationStrategy,
  VisualizationConfig
} from '../visualization-interface';

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  IssueSeverity
} from '@topolop/shared-types';

export class ConsoleVisualizationStrategy implements VisualizationStrategy {
  readonly name = 'console';
  readonly version = '1.0.0';
  readonly description = 'Text-based console output visualization';
  readonly dependencies = ['none'];

  private config: VisualizationConfig = {};

  async initialize(container: HTMLElement | string, config?: VisualizationConfig): Promise<void> {
    this.config = { ...config };

    if (typeof container === 'string') {
      console.log(`📊 Console Visualization initialized for: ${container}`);
    } else {
      console.log('📊 Console Visualization initialized');
    }
  }

  async render(data: UnifiedAnalysisResult): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TOPOLOP ANALYSIS RESULTS');
    console.log('='.repeat(60));

    // Summary
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Issues: ${data.issues.length}`);
    console.log(`   Files Analyzed: ${data.fileMetrics.size}`);
    console.log(`   Hotspots Found: ${data.hotspots.length}`);
    console.log(`   Correlation Groups: ${data.correlationGroups.length}`);

    // Severity breakdown
    const severityBreakdown = this.calculateSeverityBreakdown(data.issues);
    console.log(`\n🚨 SEVERITY BREAKDOWN:`);
    console.log(`   Critical: ${severityBreakdown.critical}`);
    console.log(`   High:     ${severityBreakdown.high}`);
    console.log(`   Medium:   ${severityBreakdown.medium}`);
    console.log(`   Low:      ${severityBreakdown.low}`);
    console.log(`   Info:     ${severityBreakdown.info}`);

    // Top hotspots
    if (data.hotspots.length > 0) {
      console.log(`\n🔥 TOP HOTSPOTS:`);
      data.hotspots.slice(0, 5).forEach((hotspot, index) => {
        console.log(`   ${index + 1}. ${hotspot.canonicalPath}`);
        console.log(`      Issues: ${hotspot.issueCount}, Risk: ${hotspot.riskScore.toFixed(1)}`);
      });
    }

    // Recent issues (top 10)
    if (data.issues.length > 0) {
      console.log(`\n⚠️  RECENT ISSUES (Top 10):`);
      data.issues.slice(0, 10).forEach((issue, index) => {
        const severity = this.getSeverityIcon(issue.severity);
        console.log(`   ${index + 1}. ${severity} ${issue.title}`);
        console.log(`      File: ${issue.entity.canonicalPath}:${issue.line || 'N/A'}`);
        console.log(`      Tool: ${issue.toolName}`);
      });
    }

    // Correlation insights
    if (data.correlationGroups.length > 0) {
      console.log(`\n🔗 CORRELATION INSIGHTS:`);
      data.correlationGroups.slice(0, 3).forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.issues.length} related issues (Risk: ${group.riskScore.toFixed(1)})`);
        console.log(`      Files: ${group.issues.map(i => i.entity.canonicalPath).slice(0, 3).join(', ')}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Analysis complete - ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');
  }

  async update(data: UnifiedAnalysisResult): Promise<void> {
    console.log('\n🔄 Updating analysis results...');
    await this.render(data);
  }

  async dispose(): Promise<void> {
    console.log('📊 Console visualization disposed');
  }

  isAvailable(): boolean {
    return typeof console !== 'undefined';
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

  private getSeverityIcon(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.CRITICAL: return '🚨';
      case IssueSeverity.HIGH: return '⚠️';
      case IssueSeverity.MEDIUM: return '⚡';
      case IssueSeverity.LOW: return '💡';
      case IssueSeverity.INFO: return 'ℹ️';
      default: return '❓';
    }
  }
}