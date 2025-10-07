/**
 * topolop-visualization
 *
 * 3D visualization engine rendering code analysis as interactive city metaphors
 */

// Re-export shared types for convenience
export * from '@topolop/shared-types';

// Bridge (analysis → visualization transform)
export { UnifiedToCityBridge } from './bridge/analysis-to-city';

// Visualization components
export { VisualizationManager } from './visualization/visualization-manager';
export * from './visualization/visualization-interface';

// Rendering strategies
export { City3DVisualizationStrategy } from './visualization/strategies/city3d-strategy';
export { ConsoleVisualizationStrategy } from './visualization/strategies/console-strategy';
export { JsonExportVisualizationStrategy } from './visualization/strategies/json-export-strategy';
export { WebDashboardVisualizationStrategy } from './visualization/strategies/web-dashboard-strategy';

// Canvas renderers (JavaScript modules - no type safety)
// export { CityRenderer } from './renderers/src/renderers/city-renderer';
// export { CanvasEngine } from './renderers/src/canvas-engine';
// export { CanvasEngineFactory } from './renderers/src/canvas-engine-factory';
// export { ThreeJSCanvasEngine } from './renderers/src/engines/threejs-canvas-engine';

// Configuration types
export interface VisualizationConfig {
  metaphor?: 'city' | 'ecosystem' | 'molecular';
  camera?: CameraConfig;
  rendering?: RenderingConfig;
  colors?: ColorScheme;
}

export interface CameraConfig {
  initialPosition?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
}

export interface RenderingConfig {
  antialias?: boolean;
  shadows?: boolean;
  levelOfDetail?: boolean;
}

export interface ColorScheme {
  critical?: string;
  high?: string;
  medium?: string;
  low?: string;
  info?: string;
}

export const VERSION = '0.1.0';
