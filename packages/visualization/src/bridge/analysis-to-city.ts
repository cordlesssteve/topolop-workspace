/**
 * Unified-to-City Bridge Component
 * 
 * Converts UnifiedAnalysisResult to CityLayout with:
 * - Tool-based color blending (muddy = multiple issues)
 * - File-type texture mapping (always visible)
 * - Interactive building details on click
 * - Toggle interface for tool filtering
 */

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  UnifiedEntity,
  IssueSeverity,
  AnalysisType
} from '@topolop/shared-types';

/**
 * City-specific interfaces extending the existing city renderer
 */
interface BuildingTexture {
  type: 'solid-brick' | 'concrete' | 'glass-steel' | 'modern-glass' | 'industrial' | 
        'residential' | 'scaffolding' | 'temporary' | 'underground-utility' | 
        'premium-finish' | 'standard-finish' | 'brick-pattern';
  pattern: 'solid' | 'striped' | 'dotted' | 'crosshatch' | 'waves';
  intensity: number; // 0-1, how prominent the texture is
}

interface EnhancedBuilding {
  // Original building properties
  id: string;
  name: string;
  x: number;
  y: number;
  height: number;
  width: number;
  depth: number;
  
  // Enhanced properties for unified model
  baseColor: string;        // Neutral base color
  toolColor: string;        // Blended tool colors (transparent when no tools active)
  finalColor: string;       // Computed final color
  texture: BuildingTexture; // File type texture (always visible)
  
  // Interactive properties
  issueCount: number;
  toolsDetected: string[];
  riskScore: number;
  clickable: boolean;
  details: BuildingDetails | null;
}

interface BuildingDetails {
  file: string;
  canonicalPath: string;
  totalIssues: number;
  toolBreakdown: ToolBreakdown[];
  riskScore: number;
  fileType: string;
  recommendedAction: string;
}

interface ToolBreakdown {
  toolName: string;
  displayName: string;
  color: string;
  issueCount: number;
  severityBreakdown: Record<string, number>;
  topIssues: IssueSnapshot[];
}

interface IssueSnapshot {
  type: string;
  severity: string;
  description: string;
  ruleId?: string;
  line?: number;
}

interface CityToolToggle {
  toolName: string;
  displayName: string;
  color: string;
  issueCount: number;
  active: boolean;
  category: 'security' | 'quality' | 'performance' | 'complexity';
}

/**
 * Main bridge component converting unified analysis to city visualization
 */
export class UnifiedToCityBridge {
  private unifiedData: UnifiedAnalysisResult;
  private activeTools: Set<string> = new Set();
  private showCorrelations: boolean = false;
  
  // Color definitions for each tool
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
  
  // File type to texture mapping
  private fileTypeTextures: Record<string, BuildingTexture> = {
    // Entry points and core files
    'index': { type: 'glass-steel', pattern: 'solid', intensity: 0.8 },
    'main': { type: 'glass-steel', pattern: 'solid', intensity: 0.8 },
    'app': { type: 'concrete', pattern: 'solid', intensity: 0.9 },
    
    // Configuration files
    'config': { type: 'underground-utility', pattern: 'crosshatch', intensity: 0.7 },
    '.env': { type: 'underground-utility', pattern: 'dotted', intensity: 0.6 },
    'package.json': { type: 'concrete', pattern: 'striped', intensity: 0.8 },
    
    // Component and service files
    'component': { type: 'modern-glass', pattern: 'solid', intensity: 0.7 },
    'service': { type: 'industrial', pattern: 'striped', intensity: 0.8 },
    'util': { type: 'residential', pattern: 'solid', intensity: 0.6 },
    'helper': { type: 'residential', pattern: 'dotted', intensity: 0.6 },
    
    // Test files
    'test': { type: 'scaffolding', pattern: 'crosshatch', intensity: 0.9 },
    'spec': { type: 'scaffolding', pattern: 'crosshatch', intensity: 0.9 },
    'mock': { type: 'temporary', pattern: 'waves', intensity: 0.8 },
    
    // By file extension
    '.ts': { type: 'premium-finish', pattern: 'solid', intensity: 0.7 },
    '.js': { type: 'standard-finish', pattern: 'solid', intensity: 0.6 },
    '.jsx': { type: 'modern-glass', pattern: 'solid', intensity: 0.7 },
    '.py': { type: 'brick-pattern', pattern: 'striped', intensity: 0.8 },
    '.java': { type: 'solid-brick', pattern: 'solid', intensity: 0.9 }
  };
  
  constructor(unifiedData: UnifiedAnalysisResult) {
    this.unifiedData = unifiedData;
  }
  
  /**
   * Get available tool toggles with issue counts
   */
  getAvailableTools(): CityToolToggle[] {
    const toolCounts = new Map<string, number>();
    
    // Count issues per tool
    for (const issue of this.unifiedData.issues) {
      const count = toolCounts.get(issue.toolName) || 0;
      toolCounts.set(issue.toolName, count + 1);
    }
    
    const toggles: CityToolToggle[] = [];
    for (const [toolName, count] of toolCounts.entries()) {
      toggles.push({
        toolName,
        displayName: this.getToolDisplayName(toolName),
        color: this.toolColors[toolName] || '#757575',
        issueCount: count,
        active: this.activeTools.has(toolName),
        category: this.getToolCategory(toolName)
      });
    }
    
    // Sort by category then by issue count
    return toggles.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return b.issueCount - a.issueCount;
    });
  }
  
  /**
   * Set which tools are active for visualization
   */
  setActiveTools(toolNames: string[]): void {
    this.activeTools = new Set(toolNames);
  }
  
  /**
   * Toggle correlation display
   */
  setShowCorrelations(show: boolean): void {
    this.showCorrelations = show;
  }
  
  /**
   * Generate city layout from unified data with current tool filters
   */
  generateCityLayout(): { buildings: EnhancedBuilding[], toolToggles: CityToolToggle[] } {
    const buildings: EnhancedBuilding[] = [];
    const fileMap = new Map<string, UnifiedEntity>();
    const fileIssues = new Map<string, UnifiedIssue[]>();
    
    // Group issues by file
    for (const issue of this.unifiedData.issues) {
      const path = issue.entity.canonicalPath;
      fileMap.set(path, issue.entity);
      
      if (!fileIssues.has(path)) {
        fileIssues.set(path, []);
      }
      fileIssues.get(path)!.push(issue);
    }
    
    // Create buildings for each file with issues
    let buildingIndex = 0;
    for (const [path, entity] of fileMap.entries()) {
      const allIssues = fileIssues.get(path) || [];
      const filteredIssues = this.filterIssuesByActiveTools(allIssues);
      
      const building = this.createEnhancedBuilding(
        entity, 
        allIssues, 
        filteredIssues, 
        buildingIndex++
      );
      
      buildings.push(building);
    }
    
    // Position buildings in a grid layout (simple for now)
    this.positionBuildings(buildings);
    
    return {
      buildings,
      toolToggles: this.getAvailableTools()
    };
  }
  
  /**
   * Get building details for interactive click
   */
  getBuildingDetails(buildingId: string): BuildingDetails | null {
    const building = this.findBuildingById(buildingId);
    if (!building || !building.details) return null;
    
    return building.details;
  }
  
  /**
   * Create enhanced building from unified entity and issues
   */
  private createEnhancedBuilding(
    entity: UnifiedEntity, 
    allIssues: UnifiedIssue[], 
    filteredIssues: UnifiedIssue[],
    index: number
  ): EnhancedBuilding {
    
    const fileName = this.getFileName(entity.canonicalPath);
    const fileType = this.determineFileType(fileName, entity.canonicalPath);
    const texture = this.getTextureForFile(fileName, entity.canonicalPath);
    
    // Base building properties from complexity/size
    const complexity = this.calculateComplexity(allIssues);
    const height = Math.min(100, Math.max(10, complexity * 3));
    const width = Math.min(40, Math.max(10, fileName.length + 10));
    const depth = Math.min(30, Math.max(8, allIssues.length * 2));
    
    // Color calculations
    const baseColor = '#E0E0E0'; // Neutral gray base
    const toolColor = this.blendToolColors(filteredIssues);
    const finalColor = this.activeTools.size > 0 ? toolColor : baseColor;
    
    // Risk scoring and interactivity
    const riskScore = this.calculateRiskScore(allIssues);
    const toolsDetected = [...new Set(allIssues.map(i => i.toolName))];
    
    const building: EnhancedBuilding = {
      id: `building-${index}`,
      name: fileName,
      x: 0, y: 0, // Will be positioned later
      height, width, depth,
      baseColor,
      toolColor,
      finalColor,
      texture,
      issueCount: allIssues.length,
      toolsDetected,
      riskScore,
      clickable: allIssues.length > 0,
      details: allIssues.length > 0 ? this.createBuildingDetails(entity, allIssues) : null
    };
    
    return building;
  }
  
  /**
   * Blend colors from multiple tools (additive blending for muddy effect)
   */
  private blendToolColors(issues: UnifiedIssue[]): string {
    if (issues.length === 0) return 'transparent';
    
    const toolsInvolved = [...new Set(issues.map(i => i.toolName))];
    if (toolsInvolved.length === 1) {
      // Single tool - clean color
      return this.toolColors[toolsInvolved[0]!] || '#757575';
    }
    
    // Multiple tools - blend colors additively for muddy effect
    return this.additiveColorBlend(toolsInvolved.map(tool => this.toolColors[tool!] || '#757575'));
  }
  
  /**
   * Additive color blending to create muddy colors
   */
  private additiveColorBlend(colors: string[]): string {
    if (colors.length === 0) return '#757575';
    if (colors.length === 1) return colors[0] || '#757575';
    
    let totalR = 0, totalG = 0, totalB = 0;
    
    for (const color of colors) {
      const rgb = this.hexToRgb(color);
      if (rgb && rgb.r !== undefined && rgb.g !== undefined && rgb.b !== undefined) {
        totalR += rgb.r;
        totalG += rgb.g;  
        totalB += rgb.b;
      }
    }
    
    // Average and clamp to create muddy effect
    const avgR = Math.min(255, Math.floor(totalR / colors.length));
    const avgG = Math.min(255, Math.floor(totalG / colors.length));
    const avgB = Math.min(255, Math.floor(totalB / colors.length));
    
    // Reduce brightness for muddy effect when many tools involved
    const muddyFactor = Math.max(0.4, 1 - (colors.length - 1) * 0.15);
    const muddyR = Math.floor(avgR * muddyFactor);
    const muddyG = Math.floor(avgG * muddyFactor);
    const muddyB = Math.floor(avgB * muddyFactor);
    
    return this.rgbToHex(muddyR, muddyG, muddyB);
  }
  
  /**
   * Get texture based on file name and path patterns
   */
  private getTextureForFile(fileName: string, filePath: string): BuildingTexture {
    const lowerName = fileName.toLowerCase();
    const lowerPath = filePath.toLowerCase();
    
    // Check specific patterns first
    for (const [pattern, texture] of Object.entries(this.fileTypeTextures)) {
      if (lowerName.includes(pattern) || lowerPath.includes(pattern)) {
        return texture;
      }
    }
    
    // Default texture based on extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension && this.fileTypeTextures[`.${extension}`]) {
      return this.fileTypeTextures[`.${extension}`]!;
    }
    
    // Fallback
    return { type: 'standard-finish', pattern: 'solid', intensity: 0.6 };
  }
  
  /**
   * Create detailed building information for click interactions
   */
  private createBuildingDetails(entity: UnifiedEntity, issues: UnifiedIssue[]): BuildingDetails {
    const toolBreakdowns = new Map<string, ToolBreakdown>();
    
    // Group issues by tool
    for (const issue of issues) {
      if (!toolBreakdowns.has(issue.toolName)) {
        toolBreakdowns.set(issue.toolName, {
          toolName: issue.toolName,
          displayName: this.getToolDisplayName(issue.toolName),
          color: this.toolColors[issue.toolName] || '#757575',
          issueCount: 0,
          severityBreakdown: {},
          topIssues: []
        });
      }
      
      const breakdown = toolBreakdowns.get(issue.toolName)!;
      breakdown.issueCount++;
      
      // Count severities
      const severity = issue.severity;
      breakdown.severityBreakdown[severity] = (breakdown.severityBreakdown[severity] || 0) + 1;
      
      // Add to top issues (limit to 3 per tool)
      if (breakdown.topIssues.length < 3) {
        breakdown.topIssues.push({
          type: issue.title.replace(/^.*?: /, ''), // Remove prefix
          severity: issue.severity,
          description: issue.description,
          ruleId: issue.ruleId,
          line: issue.line ?? undefined
        });
      }
    }
    
    return {
      file: entity.originalIdentifier,
      canonicalPath: entity.canonicalPath,
      totalIssues: issues.length,
      toolBreakdown: Array.from(toolBreakdowns.values()),
      riskScore: this.calculateRiskScore(issues),
      fileType: this.determineFileType(this.getFileName(entity.canonicalPath), entity.canonicalPath),
      recommendedAction: this.generateRecommendedAction(issues)
    };
  }
  
  /**
   * Filter issues to only those from active tools
   */
  private filterIssuesByActiveTools(issues: UnifiedIssue[]): UnifiedIssue[] {
    if (this.activeTools.size === 0) return []; // No tools active = no color
    return issues.filter(issue => this.activeTools.has(issue.toolName));
  }
  
  /**
   * Simple grid positioning for buildings
   */
  private positionBuildings(buildings: EnhancedBuilding[]): void {
    const gridSize = Math.ceil(Math.sqrt(buildings.length));
    const spacing = 100;
    
    buildings.forEach((building, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      building.x = col * spacing + 50;
      building.y = row * spacing + 50;
    });
  }
  
  // Utility methods
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
  
  private determineFileType(fileName: string, filePath: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (fileName.includes('test') || fileName.includes('spec')) return 'test';
    if (fileName.includes('config')) return 'configuration';
    if (fileName.includes('index') || fileName.includes('main')) return 'entry-point';
    if (extension === 'ts' || extension === 'tsx') return 'typescript';
    if (extension === 'js' || extension === 'jsx') return 'javascript';
    return 'source-file';
  }
  
  private calculateComplexity(issues: UnifiedIssue[]): number {
    return issues.reduce((sum, issue) => {
      const severityWeight = {
        [IssueSeverity.CRITICAL]: 5,
        [IssueSeverity.HIGH]: 4,
        [IssueSeverity.MEDIUM]: 3,
        [IssueSeverity.LOW]: 2,
        [IssueSeverity.INFO]: 1
      }[issue.severity] || 1;
      
      return sum + severityWeight;
    }, 0);
  }
  
  private calculateRiskScore(issues: UnifiedIssue[]): number {
    const baseScore = this.calculateComplexity(issues);
    const toolCount = new Set(issues.map(i => i.toolName)).size;
    const toolMultiplier = 1 + (toolCount - 1) * 0.2; // Increase score for multiple tools
    
    return Math.min(100, Math.floor(baseScore * toolMultiplier));
  }
  
  private generateRecommendedAction(issues: UnifiedIssue[]): string {
    const securityIssues = issues.filter(i => i.analysisType === AnalysisType.SECURITY).length;
    const qualityIssues = issues.filter(i => i.analysisType === AnalysisType.QUALITY).length;
    const criticalIssues = issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
    
    if (criticalIssues > 0) return 'Immediate Security Review Required';
    if (securityIssues > qualityIssues) return 'Security Audit Recommended';
    if (qualityIssues > 3) return 'Code Refactoring Needed';
    return 'Code Review Suggested';
  }
  
  private getToolDisplayName(toolName: string): string {
    const names: Record<string, string> = {
      'sonarqube': 'SonarQube',
      'codeclimate': 'CodeClimate', 
      'semgrep': 'Semgrep',
      'checkmarx': 'Checkmarx',
      'codeql': 'CodeQL',
      'deepsource': 'DeepSource',
      'veracode': 'Veracode',
      'codacy': 'Codacy'
    };
    return names[toolName] || toolName;
  }
  
  private getToolCategory(toolName: string): 'security' | 'quality' | 'performance' | 'complexity' {
    const categories: Record<string, 'security' | 'quality' | 'performance' | 'complexity'> = {
      'veracode': 'security',
      'checkmarx': 'security',
      'semgrep': 'security',
      'sonarqube': 'quality',
      'codeclimate': 'quality',
      'codacy': 'quality',
      'deepsource': 'quality',
      'codeql': 'complexity'
    };
    return categories[toolName] || 'quality';
  }
  
  private findBuildingById(id: string): EnhancedBuilding | null {
    // This would need to be implemented with cached buildings
    return null; // Placeholder
  }
  
  private hexToRgb(hex: string): {r: number, g: number, b: number} | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result && result[1] && result[2] && result[3] ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  private rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

export type { EnhancedBuilding, BuildingDetails, CityToolToggle };