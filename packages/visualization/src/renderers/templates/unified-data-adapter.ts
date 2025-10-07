/**
 * Unified Data to Template Adapter
 * 
 * Bridges UnifiedAnalysisResult from Tier 1 tools with Topolop3DVisualizationTemplate
 * Preserves rich correlation data while maintaining template configurability
 */

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  UnifiedFileMetrics,
  IssueSeverity,
  AnalysisType,
  DetectedHotspot
} from '@topolop/shared-types';

/**
 * Template-compatible data formats
 */
interface TemplateBuildingData {
  id: string;
  name: string;
  shape: 'box' | 'pyramid' | 'cylinder' | 'cone';
  position?: { x: number; z: number };
  metadata: {
    canonicalPath: string;
    issueCount: number;
    riskScore: number;
    toolsDetected: string[];
    hotspot?: DetectedHotspot;
    fileMetrics?: UnifiedFileMetrics;
    topIssues: UnifiedIssue[];
    severityBreakdown: Record<string, number>;
    analysisTypeBreakdown: Record<string, number>;
  };
}

interface TemplateRoadData {
  start: string;
  end: string;
  type: 'imports' | 'correlation' | 'hotspot' | 'security' | 'quality';
  color?: string;
  width?: number;
  metadata: {
    correlationScore?: number;
    sharedTools?: string[];
    riskLevel?: string;
  };
}

interface TemplateDistrictData {
  name: string;
  centerX: number;
  centerZ: number;
  buildings: string[];
  metadata: {
    avgRiskScore: number;
    totalIssues: number;
    dominantTool: string;
    analysisTypes: AnalysisType[];
  };
}

interface TemplateCityVisualization {
  buildings: TemplateBuildingData[];
  roads: TemplateRoadData[];
  districts: TemplateDistrictData[];
  metadata: {
    totalIssues: number;
    filesAnalyzed: number;
    toolsCovered: string[];
    hotspots: number;
    correlationGroups: number;
    generatedAt: string;
  };
}

/**
 * Main adapter class converting unified analysis to template format
 */
export class UnifiedDataToTemplateAdapter {
  private unifiedData: UnifiedAnalysisResult;
  private buildingPositions: Map<string, { x: number; z: number }> = new Map();
  
  // Tool-specific colors for consistency with existing bridge
  private toolColors: Record<string, string> = {
    'sonarqube': '#2196F3',      // Blue - Quality
    'codeclimate': '#4CAF50',    // Green - Maintainability  
    'semgrep': '#FF9800',        // Orange - Security patterns
    'checkmarx': '#E91E63',      // Pink - SAST analysis
    'codeql': '#9C27B0',         // Purple - Semantic analysis
    'deepsource': '#00BCD4',     // Cyan - AI analysis
    'veracode': '#F44336',       // Red - Enterprise security
    'codacy': '#795548'          // Brown - Quality grading
  };

  constructor(unifiedData: UnifiedAnalysisResult) {
    this.unifiedData = unifiedData;
    this.buildingPositions = this.generateBuildingPositions();
  }

  /**
   * Convert unified analysis result to template-compatible city visualization data
   */
  public convertToTemplateFormat(): TemplateCityVisualization {
    const buildings = this.createBuildingsFromFileMetrics();
    const roads = this.createRoadsFromCorrelations();
    const districts = this.createDistrictsFromAnalysis();
    
    return {
      buildings,
      roads,
      districts,
      metadata: this.createMetadata()
    };
  }

  /**
   * Generate configuration optimized for unified data visualization
   */
  public generateOptimizedTemplateConfig(): any {
    const summary = this.unifiedData.getSummary();
    
    return {
      title: 'Unified Analysis City',
      subtitle: `${summary.toolsCovered.length} Tools • ${summary.totalIssues} Issues • ${summary.hotspots} Hotspots`,
      
      theme: {
        background: '#0a0a0a',              // Dark theme for professional analysis
        panelBackground: 'rgba(10,10,10,0.95)',
        textColor: '#e0e0e0',
        accentColor: '#00ff88'              // Bright green for highlights
      },
      
      buildings: {
        positioning: 'directory-clustered',  // Use unified model's spatial data
        heightRange: { min: 5, max: 50 },    // Larger range for risk differentiation
        spacing: 15,                         // More space for detailed inspection
        shapes: {
          // Map to issue severity and analysis type
          box: { color: 0x4488ff, geometry: 'BoxGeometry' },        // Standard files
          pyramid: { color: 0xff4444, geometry: 'ConeGeometry', sides: 4 },  // High-risk files
          cylinder: { color: 0xffaa00, geometry: 'CylinderGeometry', sides: 8 }, // Medium-risk files
          cone: { color: 0x44ff44, geometry: 'ConeGeometry', sides: 8 }       // Low-risk files
        }
      },
      
      roads: {
        types: {
          correlation: { color: '#FF6B35', style: 'solid', width: 3, label: 'Cross-tool Correlations' },
          hotspot: { color: '#FF0000', style: 'solid', width: 4, label: 'Hotspot Connections' },
          security: { color: '#E91E63', style: 'dashed', width: 2, label: 'Security Issues' },
          quality: { color: '#4CAF50', style: 'dotted', width: 2, label: 'Quality Issues' },
          imports: { color: '#9C27B0', style: 'dash-dot', width: 1, label: 'Code Dependencies' }
        },
        defaultType: 'correlation'
      },
      
      ui: {
        showInfoPanel: true,
        showControlPanel: true,
        showStatistics: true,
        showLegend: true,
        controls: [
          { type: 'tool-toggles', label: 'Analysis Tools' },
          { type: 'severity-filter', label: 'Issue Severity' },
          { type: 'analysis-type-filter', label: 'Analysis Types' },
          { type: 'hotspot-highlight', label: 'Highlight Hotspots' }
        ]
      }
    };
  }

  /**
   * Create buildings from unified file metrics
   */
  private createBuildingsFromFileMetrics(): TemplateBuildingData[] {
    const buildings: TemplateBuildingData[] = [];
    let buildingIndex = 0;

    for (const [canonicalPath, fileMetrics] of this.unifiedData.fileMetrics.entries()) {
      const fileIssues = this.unifiedData.issues.filter(
        issue => issue.entity.canonicalPath === canonicalPath
      );

      const building: TemplateBuildingData = {
        id: `unified-building-${buildingIndex++}`,
        name: this.getFileName(canonicalPath),
        shape: this.determineShapeFromRisk(fileMetrics.getRiskLevel()),
        position: this.buildingPositions.get(canonicalPath),
        metadata: {
          canonicalPath,
          issueCount: fileMetrics.issueCount,
          riskScore: fileMetrics.hotspotScore,
          toolsDetected: fileMetrics.toolCoverage,
          hotspot: this.findHotspotForFile(canonicalPath),
          fileMetrics,
          topIssues: this.getTopIssuesForFile(fileIssues, 5),
          severityBreakdown: this.createSeverityBreakdown(fileIssues),
          analysisTypeBreakdown: this.createAnalysisTypeBreakdown(fileIssues)
        }
      };

      buildings.push(building);
    }

    return buildings;
  }

  /**
   * Create roads from correlation groups and hotspots
   */
  private createRoadsFromCorrelations(): TemplateRoadData[] {
    const roads: TemplateRoadData[] = [];

    // Create roads from correlation groups (files with nearby issues)
    for (const group of this.unifiedData.correlationGroups) {
      const groupFiles = Array.from(new Set(group.issues.map(i => i.entity.canonicalPath)));
      
      // Create roads between correlated files
      for (let i = 0; i < groupFiles.length - 1; i++) {
        for (let j = i + 1; j < groupFiles.length; j++) {
          const startId = this.getBuildingIdForFile(groupFiles[i]!);
          const endId = this.getBuildingIdForFile(groupFiles[j]!);
          
          if (startId && endId) {
            roads.push({
              start: startId,
              end: endId,
              type: 'correlation',
              color: this.getCorrelationColor(group.riskScore),
              width: Math.min(5, Math.max(1, group.riskScore / 20)),
              metadata: {
                correlationScore: group.riskScore,
                sharedTools: group.toolCoverage,
                riskLevel: group.riskScore >= 80 ? 'critical' : 
                          group.riskScore >= 60 ? 'high' :
                          group.riskScore >= 30 ? 'medium' : 'low'
              }
            });
          }
        }
      }
    }

    // Create roads from hotspots (high-risk file connections)
    for (const hotspot of this.unifiedData.hotspots) {
      const hotspotId = this.getBuildingIdForFile(hotspot.canonicalPath);
      
      // Connect hotspots to files with similar analysis types
      const similarFiles = this.findFilesWithSimilarIssues(hotspot);
      for (const similarFile of similarFiles) {
        const similarId = this.getBuildingIdForFile(similarFile);
        
        if (hotspotId && similarId && hotspotId !== similarId) {
          roads.push({
            start: hotspotId,
            end: similarId,
            type: 'hotspot',
            color: '#FF0000',
            width: Math.min(4, hotspot.riskScore / 25),
            metadata: {
              correlationScore: hotspot.riskScore,
              sharedTools: hotspot.toolCoverage,
              riskLevel: 'critical'
            }
          });
        }
      }
    }

    return roads;
  }

  /**
   * Create districts from directory structure and analysis patterns
   */
  private createDistrictsFromAnalysis(): TemplateDistrictData[] {
    const districts: TemplateDistrictData[] = [];
    const directoryGroups = this.groupFilesByDirectory();

    for (const [directory, files] of directoryGroups.entries()) {
      const buildingIds = files.map(file => this.getBuildingIdForFile(file)).filter(Boolean);
      const directoryIssues = files.flatMap(file => 
        this.unifiedData.issues.filter(issue => issue.entity.canonicalPath === file)
      );
      
      const totalIssues = directoryIssues.length;
      const avgRiskScore = totalIssues > 0 ? 
        files.reduce((sum, file) => {
          const metrics = this.unifiedData.fileMetrics.get(file);
          return sum + (metrics?.hotspotScore || 0);
        }, 0) / files.length : 0;

      const toolCounts = new Map<string, number>();
      directoryIssues.forEach(issue => {
        toolCounts.set(issue.toolName, (toolCounts.get(issue.toolName) || 0) + 1);
      });
      
      const dominantTool = Array.from(toolCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      const analysisTypes = Array.from(new Set(directoryIssues.map(i => i.analysisType)));

      // Position districts based on directory depth and name
      const position = this.calculateDistrictPosition(directory, districts.length);

      districts.push({
        name: directory || 'root',
        centerX: position.x,
        centerZ: position.z,
        buildings: buildingIds as string[],
        metadata: {
          avgRiskScore: Math.round(avgRiskScore),
          totalIssues,
          dominantTool,
          analysisTypes
        }
      });
    }

    return districts;
  }

  /**
   * Create metadata summary for template
   */
  private createMetadata(): TemplateCityVisualization['metadata'] {
    const summary = this.unifiedData.getSummary();
    
    return {
      totalIssues: summary.totalIssues,
      filesAnalyzed: summary.filesAnalyzed,
      toolsCovered: summary.toolsCovered,
      hotspots: summary.hotspots,
      correlationGroups: summary.correlationGroups,
      generatedAt: new Date().toISOString()
    };
  }

  // Helper methods

  private generateBuildingPositions(): Map<string, { x: number; z: number }> {
    const positions = new Map<string, { x: number; z: number }>();
    const files = Array.from(this.unifiedData.fileMetrics.keys());
    
    // Use directory-based clustering
    const directoryGroups = this.groupFilesByDirectory();
    let districtIndex = 0;
    const districtSpacing = 100;

    for (const [directory, filesInDir] of directoryGroups.entries()) {
      const districtX = (districtIndex % 4) * districtSpacing - 150;
      const districtZ = Math.floor(districtIndex / 4) * districtSpacing - 150;
      
      filesInDir.forEach((file, fileIndex) => {
        const localX = (fileIndex % 8) * 20 - 70;
        const localZ = Math.floor(fileIndex / 8) * 20 - 70;
        
        positions.set(file, {
          x: districtX + localX,
          z: districtZ + localZ
        });
      });
      
      districtIndex++;
    }

    return positions;
  }

  private groupFilesByDirectory(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const canonicalPath of this.unifiedData.fileMetrics.keys()) {
      const directory = this.getDirectoryPath(canonicalPath);
      
      if (!groups.has(directory)) {
        groups.set(directory, []);
      }
      groups.get(directory)!.push(canonicalPath);
    }

    return groups;
  }

  private getDirectoryPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop(); // Remove filename
    return parts.join('/') || 'root';
  }

  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private determineShapeFromRisk(riskLevel: 'low' | 'medium' | 'high' | 'critical'): 'box' | 'pyramid' | 'cylinder' | 'cone' {
    switch (riskLevel) {
      case 'critical': return 'pyramid';  // Sharp, dangerous shape
      case 'high': return 'cylinder';     // Prominent but stable
      case 'medium': return 'cone';       // Noticeable
      case 'low': 
      default: return 'box';              // Standard building
    }
  }

  private findHotspotForFile(canonicalPath: string): DetectedHotspot | undefined {
    return this.unifiedData.hotspots.find(h => h.canonicalPath === canonicalPath);
  }

  private getTopIssuesForFile(issues: UnifiedIssue[], limit: number): UnifiedIssue[] {
    return issues
      .sort((a, b) => {
        // Sort by severity first, then by analysis type priority
        const severityPriority = {
          [IssueSeverity.CRITICAL]: 5,
          [IssueSeverity.HIGH]: 4,
          [IssueSeverity.MEDIUM]: 3,
          [IssueSeverity.LOW]: 2,
          [IssueSeverity.INFO]: 1
        };
        return severityPriority[b.severity] - severityPriority[a.severity];
      })
      .slice(0, limit);
  }

  private createSeverityBreakdown(issues: UnifiedIssue[]): Record<string, number> {
    const breakdown = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0
    };
    
    issues.forEach(issue => {
      const severity = issue.severity;
      if (severity) {
        switch (severity) {
          case 'critical':
            breakdown.critical++;
            break;
          case 'high':
            breakdown.high++;
            break;
          case 'medium':
            breakdown.medium++;
            break;
          case 'low':
            breakdown.low++;
            break;
          case 'info':
            breakdown.info++;
            break;
        }
      }
    });

    return breakdown;
  }

  private createAnalysisTypeBreakdown(issues: UnifiedIssue[]): Record<string, number> {
    const breakdown = {
      quality: 0, security: 0, performance: 0, style: 0,
      complexity: 0, semantic: 0, ai_powered: 0
    };
    
    issues.forEach(issue => {
      const analysisType = issue.analysisType;
      if (analysisType) {
        switch (analysisType) {
          case 'quality':
            breakdown.quality++;
            break;
          case 'security':
            breakdown.security++;
            break;
          case 'performance':
            breakdown.performance++;
            break;
          case 'style':
            breakdown.style++;
            break;
          case 'complexity':
            breakdown.complexity++;
            break;
          case 'semantic':
            breakdown.semantic++;
            break;
          case 'ai_powered':
            breakdown.ai_powered++;
            break;
        }
      }
    });

    return breakdown;
  }

  private getBuildingIdForFile(canonicalPath: string): string | null {
    // This would need to map to actual building IDs created earlier
    // For now, create consistent ID based on path
    return `unified-building-${canonicalPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  private getCorrelationColor(riskScore: number): string {
    if (riskScore >= 80) return '#FF0000';      // Critical - Red
    if (riskScore >= 60) return '#FF6600';      // High - Orange-Red  
    if (riskScore >= 30) return '#FF9900';      // Medium - Orange
    return '#FFCC00';                           // Low - Yellow
  }

  private findFilesWithSimilarIssues(hotspot: DetectedHotspot): string[] {
    const similarFiles: string[] = [];
    const hotspotTypes = Object.keys(hotspot.analysisTypeDistribution)
      .filter(type => hotspot.analysisTypeDistribution[type as keyof typeof hotspot.analysisTypeDistribution] > 0);

    for (const [filePath, fileMetrics] of this.unifiedData.fileMetrics.entries()) {
      if (filePath === hotspot.canonicalPath) continue;
      
      // Check if file has similar analysis types
      const fileTypes = Object.keys(fileMetrics.analysisTypeDistribution)
        .filter(type => fileMetrics.analysisTypeDistribution[type as keyof typeof fileMetrics.analysisTypeDistribution] > 0);
      
      const commonTypes = hotspotTypes.filter(type => fileTypes.includes(type));
      
      if (commonTypes.length >= 2 && fileMetrics.hotspotScore >= 30) {
        similarFiles.push(filePath);
      }
    }

    return similarFiles.slice(0, 5); // Limit connections for performance
  }

  private calculateDistrictPosition(directory: string, index: number): { x: number; z: number } {
    const gridSize = Math.ceil(Math.sqrt(index + 1));
    const spacing = 200;
    
    const col = index % gridSize;
    const row = Math.floor(index / gridSize);
    
    return {
      x: col * spacing - (gridSize * spacing / 2),
      z: row * spacing - (gridSize * spacing / 2)
    };
  }
}

export type { TemplateBuildingData, TemplateRoadData, TemplateDistrictData, TemplateCityVisualization };