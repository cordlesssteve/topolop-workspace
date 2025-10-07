/**
 * TypeScript declarations for Topolop 3D Visualization Template System
 */

export interface Theme {
  background?: string;
  panelBackground?: string;
  textColor?: string;
  accentColor?: string;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Lighting {
  ambient: {
    color: number;
    intensity: number;
  };
  directional: {
    color: number;
    intensity: number;
    position: Position;
  };
}

export interface Scene {
  cameraPosition?: Position;
  lighting?: Lighting;
  ground?: {
    size: number;
    color: number;
  };
  shadows?: boolean;
}

export interface BuildingShape {
  color: number;
  geometry: string;
  sides?: number;
}

export interface Buildings {
  shapes?: {
    box?: BuildingShape;
    pyramid?: BuildingShape;
    cylinder?: BuildingShape;
    cone?: BuildingShape;
  };
  positioning?: 'grid' | 'directory-clustered';
  heightRange?: {
    min: number;
    max: number;
  };
  spacing?: number;
}

export interface VisualizationConfig {
  port?: number;
  title?: string;
  subtitle?: string;
  theme?: Theme;
  scene?: Scene;
  buildings?: Buildings;
}

export interface CityVisualizationData {
  cityVisualization: {
    buildings: any[];
    roads: any[];
    districts?: any[];
  };
}

export declare class Topolop3DVisualizationTemplate {
  config: VisualizationConfig;

  constructor(config?: VisualizationConfig);

  start(): Promise<void>;
  generateHTML(data: CityVisualizationData): string;
  generateStyles(): string;
  generateScript(data: CityVisualizationData): string;
  generateUI(): string;
}

export { Topolop3DVisualizationTemplate };