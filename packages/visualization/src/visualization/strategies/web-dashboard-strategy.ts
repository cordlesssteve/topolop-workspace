/**
 * Web Dashboard Visualization Strategy
 *
 * Lightweight HTML/CSS/JS dashboard that works without heavy 3D dependencies.
 * Perfect for web environments, CI/CD reports, and users who prefer
 * traditional web interfaces.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  VisualizationStrategy,
  VisualizationConfig
} from '../visualization-interface';

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  IssueSeverity
} from '@topolop/shared-types';

interface WebDashboardConfig extends VisualizationConfig {
  outputPath?: string;
  templateStyle?: 'modern' | 'classic' | 'minimal';
  includeCharts?: boolean;
  generateHtml?: boolean;
}

export class WebDashboardVisualizationStrategy implements VisualizationStrategy {
  readonly name = 'web-dashboard';
  readonly version = '1.0.0';
  readonly description = 'Lightweight HTML/CSS/JS dashboard visualization';
  readonly dependencies = ['html', 'css', 'javascript'];

  private config: WebDashboardConfig = {};
  private container: HTMLElement | null = null;
  private outputPath: string = './topolop-dashboard.html';

  async initialize(container: HTMLElement | string, config?: WebDashboardConfig): Promise<void> {
    this.config = {
      templateStyle: 'modern',
      includeCharts: true,
      generateHtml: true,
      ...config
    };

    if (typeof container === 'string') {
      this.outputPath = container;
    } else {
      this.container = container;
      if (this.config.outputPath) {
        this.outputPath = this.config.outputPath;
      }
    }

    console.log(`🌐 Web Dashboard initialized: ${this.container ? 'DOM container' : this.outputPath}`);
  }

  async render(data: UnifiedAnalysisResult): Promise<void> {
    const dashboardHtml = this.generateDashboard(data);

    if (this.container) {
      // Render to existing DOM element
      this.container.innerHTML = dashboardHtml;
    }

    if (this.config.generateHtml) {
      // Generate standalone HTML file
      const fullHtml = this.generateFullHtml(dashboardHtml, data);
      fs.writeFileSync(this.outputPath, fullHtml, 'utf8');
      console.log(`✅ Web Dashboard generated: ${this.outputPath}`);
    }

    console.log(`📊 Dashboard rendered: ${data.issues.length} issues, ${data.fileMetrics.size} files`);
  }

  async update(data: UnifiedAnalysisResult): Promise<void> {
    await this.render(data);
  }

  async dispose(): Promise<void> {
    if (this.container) {
      this.container.innerHTML = '';
    }
    console.log('🌐 Web Dashboard visualization disposed');
  }

  isAvailable(): boolean {
    return typeof document !== 'undefined' || typeof fs !== 'undefined';
  }

  private generateDashboard(data: UnifiedAnalysisResult): string {
    const severityBreakdown = this.calculateSeverityBreakdown(data.issues);
    const toolBreakdown = this.calculateToolBreakdown(data.issues);

    return `
      <div class="topolop-dashboard ${this.config.templateStyle}">
        ${this.generateHeader(data)}
        ${this.generateSummaryCards(data, severityBreakdown)}
        ${this.generateSeverityChart(severityBreakdown)}
        ${this.generateToolsChart(toolBreakdown)}
        ${this.generateHotspotsTable(data.hotspots)}
        ${this.generateIssuesTable(data.issues)}
        ${this.generateCorrelationsTable(data.correlationGroups)}
      </div>
    `;
  }

  private generateHeader(data: UnifiedAnalysisResult): string {
    return `
      <header class="dashboard-header">
        <h1>🏗️ Topolop Analysis Dashboard</h1>
        <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
        <div class="quick-stats">
          <span class="stat">${data.issues.length} Issues</span>
          <span class="stat">${data.fileMetrics.size} Files</span>
          <span class="stat">${data.hotspots.length} Hotspots</span>
        </div>
      </header>
    `;
  }

  private generateSummaryCards(data: UnifiedAnalysisResult, severityBreakdown: any): string {
    return `
      <section class="summary-cards">
        <div class="card critical">
          <h3>🚨 Critical</h3>
          <div class="number">${severityBreakdown.critical}</div>
        </div>
        <div class="card high">
          <h3>⚠️ High</h3>
          <div class="number">${severityBreakdown.high}</div>
        </div>
        <div class="card medium">
          <h3>⚡ Medium</h3>
          <div class="number">${severityBreakdown.medium}</div>
        </div>
        <div class="card low">
          <h3>💡 Low</h3>
          <div class="number">${severityBreakdown.low}</div>
        </div>
      </section>
    `;
  }

  private generateSeverityChart(severityBreakdown: Record<string, number>): string {
    const total = Object.values(severityBreakdown).reduce((a: number, b: number) => a + b, 0);

    return `
      <section class="chart-section">
        <h2>📊 Issues by Severity</h2>
        <div class="severity-chart">
          ${Object.entries(severityBreakdown).map(([severity, count]) => {
            const percentage = total > 0 ? ((count as number) / (total as number) * 100).toFixed(1) : '0';
            return `
              <div class="severity-bar ${severity}">
                <label>${severity.charAt(0).toUpperCase() + severity.slice(1)}</label>
                <div class="bar">
                  <div class="fill" style="width: ${percentage}%"></div>
                  <span class="count">${count} (${percentage}%)</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  private generateToolsChart(toolBreakdown: Record<string, number>): string {
    return `
      <section class="chart-section">
        <h2>🔧 Issues by Tool</h2>
        <div class="tools-chart">
          ${Object.entries(toolBreakdown).map(([tool, count]) => `
            <div class="tool-item">
              <span class="tool-name">${tool}</span>
              <span class="tool-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  private generateHotspotsTable(hotspots: any[]): string {
    return `
      <section class="table-section">
        <h2>🔥 Top Hotspots</h2>
        <table class="hotspots-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Risk Score</th>
              <th>Issues</th>
              <th>Tools</th>
            </tr>
          </thead>
          <tbody>
            ${hotspots.slice(0, 10).map(hotspot => `
              <tr>
                <td class="file-path">${this.truncatePath(hotspot.canonicalPath)}</td>
                <td class="risk-score ${this.getRiskClass(hotspot.riskScore)}">${hotspot.riskScore.toFixed(1)}</td>
                <td class="issue-count">${hotspot.issueCount}</td>
                <td class="tool-list">${hotspot.toolCoverage.join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  private generateIssuesTable(issues: UnifiedIssue[]): string {
    return `
      <section class="table-section">
        <h2>⚠️ Recent Issues</h2>
        <table class="issues-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>File</th>
              <th>Line</th>
              <th>Title</th>
              <th>Tool</th>
            </tr>
          </thead>
          <tbody>
            ${issues.slice(0, 20).map(issue => `
              <tr class="severity-${issue.severity}">
                <td class="severity">${this.getSeverityIcon(issue.severity)}</td>
                <td class="file-path">${this.truncatePath(issue.entity.canonicalPath)}</td>
                <td class="line-number">${issue.line || 'N/A'}</td>
                <td class="issue-title">${this.escapeHtml(issue.title)}</td>
                <td class="tool-name">${issue.toolName}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  private generateCorrelationsTable(correlationGroups: any[]): string {
    return `
      <section class="table-section">
        <h2>🔗 Correlation Groups</h2>
        <table class="correlations-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Risk Score</th>
              <th>Issues</th>
              <th>Files Affected</th>
            </tr>
          </thead>
          <tbody>
            ${correlationGroups.slice(0, 10).map((group, index) => `
              <tr>
                <td class="group-id">Group ${index + 1}</td>
                <td class="risk-score ${this.getRiskClass(group.riskScore)}">${group.riskScore.toFixed(1)}</td>
                <td class="issue-count">${group.issues.length}</td>
                <td class="file-count">${new Set(group.issues.map((i: any) => i.entity.canonicalPath)).size}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  private generateFullHtml(dashboardContent: string, data: UnifiedAnalysisResult): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Topolop Analysis Dashboard</title>
    ${this.generateCSS()}
</head>
<body>
    ${dashboardContent}
    ${this.generateJavaScript(data)}
</body>
</html>
    `;
  }

  private generateCSS(): string {
    return `
<style>
    ${this.config.templateStyle === 'modern' ? this.getModernCSS() : this.getClassicCSS()}
</style>
    `;
  }

  private generateJavaScript(data: UnifiedAnalysisResult): string {
    return `
<script>
    // Basic interactivity
    document.addEventListener('DOMContentLoaded', function() {
        // Add click handlers for table rows
        const tables = document.querySelectorAll('table tbody tr');
        tables.forEach(row => {
            row.addEventListener('click', function() {
                this.classList.toggle('selected');
            });
        });

        // Add filter functionality
        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter results...';
        filterInput.className = 'dashboard-filter';

        const header = document.querySelector('.dashboard-header');
        if (header) {
            header.appendChild(filterInput);
        }

        filterInput.addEventListener('input', function() {
            const filter = this.value.toLowerCase();
            tables.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        });

        console.log('Topolop Dashboard initialized with ${data.issues.length} issues');
    });
</script>
    `;
  }

  private getModernCSS(): string {
    return `
        .topolop-dashboard { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }
        .dashboard-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .dashboard-header h1 { margin: 0; font-size: 2em; }
        .quick-stats { margin-top: 10px; }
        .quick-stats .stat { background: rgba(255,255,255,0.2); padding: 5px 10px; margin-right: 10px; border-radius: 4px; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .card.critical { border-left: 4px solid #dc3545; }
        .card.high { border-left: 4px solid #fd7e14; }
        .card.medium { border-left: 4px solid #ffc107; }
        .card.low { border-left: 4px solid #28a745; }
        .card .number { font-size: 2em; font-weight: bold; margin-top: 10px; }
        .chart-section, .table-section { background: white; margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .severity-bar { margin: 10px 0; }
        .severity-bar .bar { background: #e9ecef; border-radius: 4px; position: relative; height: 30px; }
        .severity-bar .fill { height: 100%; border-radius: 4px; }
        .severity-bar.critical .fill { background: #dc3545; }
        .severity-bar.high .fill { background: #fd7e14; }
        .severity-bar.medium .fill { background: #ffc107; }
        .severity-bar.low .fill { background: #28a745; }
        .severity-bar .count { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background: #f8f9fa; font-weight: bold; }
        tr:hover { background: #f8f9fa; }
        .file-path { font-family: monospace; font-size: 0.9em; }
        .risk-score.high { color: #dc3545; font-weight: bold; }
        .risk-score.medium { color: #fd7e14; font-weight: bold; }
        .risk-score.low { color: #28a745; }
        .severity-critical { background: rgba(220, 53, 69, 0.1); }
        .severity-high { background: rgba(253, 126, 20, 0.1); }
        .dashboard-filter { margin-top: 10px; padding: 8px; border: none; border-radius: 4px; width: 200px; }
    `;
  }

  private getClassicCSS(): string {
    return `
        .topolop-dashboard { font-family: Arial, sans-serif; margin: 20px; }
        .dashboard-header { background: #333; color: white; padding: 20px; }
        .summary-cards { display: flex; gap: 15px; margin: 20px 0; }
        .card { border: 1px solid #ccc; padding: 15px; flex: 1; }
        table { width: 100%; border: 1px solid #ccc; }
        th, td { padding: 8px; border: 1px solid #ccc; }
        th { background: #f0f0f0; }
    `;
  }

  // Utility methods
  private calculateSeverityBreakdown(issues: UnifiedIssue[]) {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  }

  private calculateToolBreakdown(issues: UnifiedIssue[]) {
    return issues.reduce((acc, issue) => {
      acc[issue.toolName] = (acc[issue.toolName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getSeverityIcon(severity: IssueSeverity): string {
    const icons = {
      [IssueSeverity.CRITICAL]: '🚨',
      [IssueSeverity.HIGH]: '⚠️',
      [IssueSeverity.MEDIUM]: '⚡',
      [IssueSeverity.LOW]: '💡',
      [IssueSeverity.INFO]: 'ℹ️'
    };
    return icons[severity] || '❓';
  }

  private getRiskClass(riskScore: number): string {
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  private truncatePath(path: string, maxLength: number = 50): string {
    if (path.length <= maxLength) return path;
    return '...' + path.slice(-(maxLength - 3));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}