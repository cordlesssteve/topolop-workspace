/**
 * 3D City Visualization Strategy (Optional)
 *
 * Wrapper around the existing 3D city visualization.
 * Only available when Three.js dependencies are present.
 */

import {
  VisualizationStrategy,
  VisualizationConfig
} from '../visualization-interface';

import {
  UnifiedAnalysisResult
} from '@topolop/shared-types';

interface City3DConfig extends VisualizationConfig {
  enablePhysics?: boolean;
  cameraMode?: 'orbit' | 'fly' | 'walk';
  qualityPreset?: 'low' | 'medium' | 'high' | 'ultra';
}

export class City3DVisualizationStrategy implements VisualizationStrategy {
  readonly name = 'city3d';
  readonly version = '1.0.0';
  readonly description = '3D immersive city visualization using Three.js';
  readonly dependencies = ['three.js', 'webgl'];

  private config: City3DConfig = {};
  private container: HTMLElement | null = null;
  private cityRenderer: any = null; // Will be dynamically imported

  async initialize(container: HTMLElement | string, config?: City3DConfig): Promise<void> {
    this.config = {
      enablePhysics: false,
      cameraMode: 'orbit',
      qualityPreset: 'medium',
      ...config
    };

    if (typeof container === 'string') {
      this.container = document.getElementById(container);
      if (!this.container) {
        throw new Error(`Container element '${container}' not found`);
      }
    } else {
      this.container = container;
    }

    if (!this.container) {
      throw new Error('Valid container element required for 3D visualization');
    }

    // Dynamically import the 3D city renderer only when needed
    try {
      const cityModule = await this.loadCityRenderer();
      const RendererClass = (cityModule as any).ImmersiveCityRenderer;
      this.cityRenderer = new RendererClass(this.container, this.config);
      await this.cityRenderer.initialize();

      console.log('🏙️ 3D City Visualization initialized');
    } catch (error) {
      throw new Error(`Failed to initialize 3D city visualization: ${error}`);
    }
  }

  async render(data: UnifiedAnalysisResult): Promise<void> {
    if (!this.cityRenderer) {
      throw new Error('3D City renderer not initialized');
    }

    // Transform unified data to city format
    const cityData = this.transformToCity3DFormat(data);

    await this.cityRenderer.render(cityData);
    console.log(`🏙️ 3D City rendered: ${data.issues.length} issues as buildings`);
  }

  async update(data: UnifiedAnalysisResult): Promise<void> {
    if (!this.cityRenderer) {
      throw new Error('3D City renderer not initialized');
    }

    const cityData = this.transformToCity3DFormat(data);
    await this.cityRenderer.update(cityData);
  }

  async dispose(): Promise<void> {
    if (this.cityRenderer) {
      await this.cityRenderer.dispose();
      this.cityRenderer = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    console.log('🏙️ 3D City visualization disposed');
  }

  isAvailable(): boolean {
    // Check for WebGL support
    if (typeof WebGLRenderingContext === 'undefined') {
      return false;
    }

    // Check if we can create a WebGL context
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  private async loadCityRenderer() {
    try {
      // Try to dynamically import the existing city renderer
      // This will only work if Three.js and the city renderer are available
      // Disabled temporarily due to type conflicts in template files
      // const cityModule = await import('../../renderers/templates/unified-data-adapter');

      // Use mock renderer for now
      throw new Error('3D renderer disabled - using mock renderer');

      // // Check if ImmersiveCityRenderer is available, if not use MockCityRenderer
      // if (!(cityModule as any).ImmersiveCityRenderer) {
      //   throw new Error('ImmersiveCityRenderer not found in module');
      // }
      // return cityModule;
    } catch (error) {
      // If the import fails, return a mock renderer
      console.warn('3D City renderer not available, using fallback');
      return {
        ImmersiveCityRenderer: class MockCityRenderer {
          constructor(container: HTMLElement, config: any) {
            container.innerHTML = `
              <div style="padding: 20px; text-align: center; background: #f0f0f0; border: 2px dashed #ccc;">
                <h3>🏙️ 3D City Visualization</h3>
                <p>3D visualization is not available in this environment.</p>
                <p>Please install Three.js dependencies to enable 3D city view.</p>
                <p>Using fallback visualization instead.</p>
              </div>
            `;
          }

          async initialize() {}
          async render(data: any) {
            console.log('Mock 3D renderer: would render', data);
          }
          async update(data: any) {
            console.log('Mock 3D renderer: would update', data);
          }
          async dispose() {}
        }
      };
    }
  }

  private transformToCity3DFormat(data: UnifiedAnalysisResult) {
    // Transform unified analysis result to the format expected by the 3D city renderer
    return {
      buildings: this.createBuildingsFromFiles(data),
      roads: this.createRoadsFromCorrelations(data),
      districts: this.createDistrictsFromAnalysis(data),
      metadata: {
        totalIssues: data.issues.length,
        totalFiles: data.fileMetrics.size,
        totalHotspots: data.hotspots.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  private createBuildingsFromFiles(data: UnifiedAnalysisResult) {
    const buildings: any[] = [];

    // Convert file metrics to buildings
    data.fileMetrics.forEach((metrics, filePath) => {
      const building = {
        id: `building-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: filePath.split('/').pop() || filePath,
        filePath: filePath,

        // Position (would need proper layout algorithm)
        x: Math.random() * 100,
        y: 0,
        z: Math.random() * 100,

        // Size based on issues
        height: Math.max(5, Math.min(50, metrics.issueCount * 3)),
        width: 10,
        depth: 10,

        // Color based on severity
        color: this.getColorForRiskScore(metrics.hotspotScore),

        // Metadata
        issueCount: metrics.issueCount,
        riskScore: metrics.hotspotScore,
        toolCoverage: metrics.toolCoverage
      };

      buildings.push(building);
    });

    return buildings;
  }

  private createRoadsFromCorrelations(data: UnifiedAnalysisResult) {
    // Create connections between correlated files
    return data.correlationGroups.map((group, index) => ({
      id: `road-${index}`,
      type: 'correlation',
      strength: group.riskScore,
      files: group.issues.map(issue => issue.entity.canonicalPath)
    }));
  }

  private createDistrictsFromAnalysis(data: UnifiedAnalysisResult) {
    // Group files by directory/analysis type
    const districts = new Map<string, any>();

    data.fileMetrics.forEach((metrics, filePath) => {
      const directory = filePath.split('/').slice(0, -1).join('/') || 'root';

      if (!districts.has(directory)) {
        districts.set(directory, {
          id: `district-${directory.replace(/[^a-zA-Z0-9]/g, '-')}`,
          name: directory,
          files: [],
          totalIssues: 0,
          averageRisk: 0
        });
      }

      const district = districts.get(directory)!;
      district.files.push(filePath);
      district.totalIssues += metrics.issueCount;
    });

    // Calculate average risk scores
    districts.forEach(district => {
      if (district.files.length > 0) {
        district.averageRisk = district.totalIssues / district.files.length;
      }
    });

    return Array.from(districts.values());
  }

  private getColorForRiskScore(riskScore: number): string {
    // Convert risk score to color
    if (riskScore >= 80) return '#dc3545'; // Critical - Red
    if (riskScore >= 60) return '#fd7e14'; // High - Orange
    if (riskScore >= 40) return '#ffc107'; // Medium - Yellow
    if (riskScore >= 20) return '#28a745'; // Low - Green
    return '#6c757d'; // Info - Gray
  }
}