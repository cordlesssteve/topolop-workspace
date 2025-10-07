/**
 * Modular Visualization Interface
 *
 * Defines a plugin-based architecture for multiple visualization strategies.
 * Allows users to choose their preferred visualization method without coupling
 * the core analysis engine to any specific rendering technology.
 */

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  DetectedHotspot,
  CorrelationGroup
} from '@topolop/shared-types';

/**
 * Base interface for all visualization strategies
 */
export interface VisualizationStrategy {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly dependencies: string[]; // e.g., ['three.js', 'canvas'] or ['d3', 'svg'] or ['none']

  /**
   * Initialize the visualization with container and configuration
   */
  initialize(container: HTMLElement | string, config?: VisualizationConfig): Promise<void>;

  /**
   * Render the analysis results
   */
  render(data: UnifiedAnalysisResult): Promise<void>;

  /**
   * Update visualization with new data (incremental updates)
   */
  update(data: UnifiedAnalysisResult): Promise<void>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;

  /**
   * Check if this strategy is available in current environment
   */
  isAvailable(): boolean;
}

/**
 * Configuration for visualization strategies
 */
export interface VisualizationConfig {
  width?: number;
  height?: number;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  performance?: 'high' | 'medium' | 'low';

  // Strategy-specific config
  [key: string]: any;
}

/**
 * Registry for managing multiple visualization strategies
 */
export class VisualizationRegistry {
  private strategies = new Map<string, VisualizationStrategy>();
  private activeStrategy: VisualizationStrategy | null = null;

  /**
   * Register a visualization strategy
   */
  register(strategy: VisualizationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * List all available strategies
   */
  listAvailable(): string[] {
    return Array.from(this.strategies.keys()).filter(name =>
      this.strategies.get(name)?.isAvailable() ?? false
    );
  }

  /**
   * Get a specific strategy
   */
  getStrategy(name: string): VisualizationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Set the active visualization strategy
   */
  async setActive(name: string, container: HTMLElement | string, config?: VisualizationConfig): Promise<void> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Visualization strategy '${name}' not found`);
    }

    if (!strategy.isAvailable()) {
      throw new Error(`Visualization strategy '${name}' is not available in current environment`);
    }

    // Dispose previous strategy
    if (this.activeStrategy) {
      await this.activeStrategy.dispose();
    }

    // Initialize new strategy
    await strategy.initialize(container, config);
    this.activeStrategy = strategy;
  }

  /**
   * Render using active strategy
   */
  async render(data: UnifiedAnalysisResult): Promise<void> {
    if (!this.activeStrategy) {
      throw new Error('No active visualization strategy set');
    }

    await this.activeStrategy.render(data);
  }

  /**
   * Update using active strategy
   */
  async update(data: UnifiedAnalysisResult): Promise<void> {
    if (!this.activeStrategy) {
      throw new Error('No active visualization strategy set');
    }

    await this.activeStrategy.update(data);
  }
}

/**
 * Factory for creating visualization strategies
 */
export interface VisualizationFactory {
  createStrategy(type: string, config?: any): VisualizationStrategy;
  getSupportedTypes(): string[];
}

/**
 * Event interface for visualization interactions
 */
export interface VisualizationEvent {
  type: 'click' | 'hover' | 'zoom' | 'filter' | 'select';
  target: 'issue' | 'file' | 'hotspot' | 'correlation';
  data: any;
}

export type VisualizationEventHandler = (event: VisualizationEvent) => void;