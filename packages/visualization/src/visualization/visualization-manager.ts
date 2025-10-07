/**
 * Visualization Manager
 *
 * Central manager for all visualization strategies. Handles strategy registration,
 * selection, and provides a unified interface for rendering analysis results.
 */

import {
  VisualizationRegistry,
  VisualizationStrategy,
  VisualizationConfig
} from './visualization-interface';

import { UnifiedAnalysisResult } from '@topolop/shared-types';

// Import available strategies
import { ConsoleVisualizationStrategy } from './strategies/console-strategy';
import { JsonExportVisualizationStrategy } from './strategies/json-export-strategy';
import { WebDashboardVisualizationStrategy } from './strategies/web-dashboard-strategy';
import { City3DVisualizationStrategy } from './strategies/city3d-strategy';

export interface VisualizationManagerConfig {
  defaultStrategy?: string;
  enabledStrategies?: string[];
  fallbackStrategy?: string;
  autoDetect?: boolean;
}

export class VisualizationManager {
  private registry: VisualizationRegistry;
  private config: VisualizationManagerConfig;

  constructor(config: VisualizationManagerConfig = {}) {
    this.config = {
      defaultStrategy: 'console',
      enabledStrategies: ['console', 'json-export', 'web-dashboard', 'city3d'],
      fallbackStrategy: 'console',
      autoDetect: true,
      ...config
    };

    this.registry = new VisualizationRegistry();
    this.registerDefaultStrategies();
  }

  /**
   * Register all default visualization strategies
   */
  private registerDefaultStrategies(): void {
    const strategies = [
      new ConsoleVisualizationStrategy(),
      new JsonExportVisualizationStrategy(),
      new WebDashboardVisualizationStrategy(),
      new City3DVisualizationStrategy()
    ];

    strategies.forEach(strategy => {
      if (this.config.enabledStrategies?.includes(strategy.name)) {
        this.registry.register(strategy);
        console.log(`📊 Registered visualization strategy: ${strategy.name}`);
      }
    });
  }

  /**
   * Register a custom visualization strategy
   */
  registerStrategy(strategy: VisualizationStrategy): void {
    this.registry.register(strategy);
    console.log(`📊 Registered custom visualization strategy: ${strategy.name}`);
  }

  /**
   * List all available visualization strategies
   */
  listAvailableStrategies(): string[] {
    return this.registry.listAvailable();
  }

  /**
   * Get information about available strategies
   */
  getStrategyInfo(): Array<{name: string, description: string, dependencies: string[], available: boolean}> {
    const allStrategies = [
      this.registry.getStrategy('console'),
      this.registry.getStrategy('json-export'),
      this.registry.getStrategy('web-dashboard'),
      this.registry.getStrategy('city3d')
    ].filter(Boolean) as VisualizationStrategy[];

    return allStrategies.map(strategy => ({
      name: strategy.name,
      description: strategy.description,
      dependencies: strategy.dependencies,
      available: strategy.isAvailable()
    }));
  }

  /**
   * Automatically detect the best available strategy
   */
  detectBestStrategy(): string {
    const available = this.listAvailableStrategies();

    // Priority order: web-dashboard > city3d > json-export > console
    const priorities = ['web-dashboard', 'city3d', 'json-export', 'console'];

    for (const preferred of priorities) {
      if (available.includes(preferred)) {
        return preferred;
      }
    }

    return this.config.fallbackStrategy || 'console';
  }

  /**
   * Set the active visualization strategy
   */
  async setStrategy(strategyName: string, container: HTMLElement | string, config?: VisualizationConfig): Promise<void> {
    try {
      await this.registry.setActive(strategyName, container, config);
      console.log(`✅ Activated visualization strategy: ${strategyName}`);
    } catch (error) {
      console.warn(`❌ Failed to activate strategy '${strategyName}':`, error);

      // Try fallback strategy
      if (strategyName !== this.config.fallbackStrategy) {
        console.log(`🔄 Trying fallback strategy: ${this.config.fallbackStrategy}`);
        await this.registry.setActive(this.config.fallbackStrategy!, container, config);
      } else {
        throw error;
      }
    }
  }

  /**
   * Render analysis results using the active strategy
   */
  async render(data: UnifiedAnalysisResult): Promise<void> {
    try {
      await this.registry.render(data);
    } catch (error) {
      console.error('❌ Visualization render failed:', error);
      throw error;
    }
  }

  /**
   * Update visualization with new data
   */
  async update(data: UnifiedAnalysisResult): Promise<void> {
    try {
      await this.registry.update(data);
    } catch (error) {
      console.error('❌ Visualization update failed:', error);
      throw error;
    }
  }

  /**
   * Render with automatic strategy selection
   */
  async renderWithAutoStrategy(
    data: UnifiedAnalysisResult,
    container?: HTMLElement | string,
    config?: VisualizationConfig
  ): Promise<void> {
    const strategyName = this.config.autoDetect ? this.detectBestStrategy() : this.config.defaultStrategy!;

    if (container) {
      await this.setStrategy(strategyName, container, config);
    }

    await this.render(data);
  }

  /**
   * Render with multiple strategies simultaneously
   */
  async renderMultiple(
    data: UnifiedAnalysisResult,
    strategies: Array<{name: string, container?: HTMLElement | string, config?: VisualizationConfig}>
  ): Promise<void> {
    const renderPromises = strategies.map(async (strategySpec) => {
      try {
        const strategy = this.registry.getStrategy(strategySpec.name);
        if (!strategy || !strategy.isAvailable()) {
          console.warn(`⚠️ Strategy '${strategySpec.name}' not available, skipping`);
          return;
        }

        if (strategySpec.container) {
          await strategy.initialize(strategySpec.container, strategySpec.config);
        }

        await strategy.render(data);
        console.log(`✅ Rendered with strategy: ${strategySpec.name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to render with strategy '${strategySpec.name}':`, error);
      }
    });

    await Promise.allSettled(renderPromises);
  }

  /**
   * Export analysis results in multiple formats
   */
  async exportResults(
    data: UnifiedAnalysisResult,
    formats: Array<{format: string, outputPath: string, config?: any}>
  ): Promise<void> {
    const exportPromises = formats.map(async (formatSpec) => {
      try {
        const strategyName = this.getExportStrategy(formatSpec.format);
        const strategy = this.registry.getStrategy(strategyName);

        if (!strategy || !strategy.isAvailable()) {
          console.warn(`⚠️ Export strategy '${strategyName}' not available for format '${formatSpec.format}'`);
          return;
        }

        await strategy.initialize(formatSpec.outputPath, formatSpec.config);
        await strategy.render(data);
        console.log(`✅ Exported to ${formatSpec.format}: ${formatSpec.outputPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to export to format '${formatSpec.format}':`, error);
      }
    });

    await Promise.allSettled(exportPromises);
  }

  private getExportStrategy(format: string): string {
    const formatMap: Record<string, string> = {
      'json': 'json-export',
      'html': 'web-dashboard',
      'console': 'console',
      'text': 'console'
    };

    return formatMap[format] || 'json-export';
  }

  /**
   * Get usage examples for each strategy
   */
  getUsageExamples(): Record<string, string> {
    return {
      console: `
// Simple console output
const manager = new VisualizationManager();
await manager.setStrategy('console', 'console');
await manager.render(analysisResult);
      `,

      'json-export': `
// Export to JSON file
const manager = new VisualizationManager();
await manager.setStrategy('json-export', './results.json');
await manager.render(analysisResult);
      `,

      'web-dashboard': `
// Generate HTML dashboard
const manager = new VisualizationManager();
await manager.setStrategy('web-dashboard', './dashboard.html');
await manager.render(analysisResult);
      `,

      'city3d': `
// 3D city visualization (requires Three.js)
const manager = new VisualizationManager();
const container = document.getElementById('visualization');
await manager.setStrategy('city3d', container, { qualityPreset: 'high' });
await manager.render(analysisResult);
      `,

      multiple: `
// Multiple simultaneous outputs
const manager = new VisualizationManager();
await manager.renderMultiple(analysisResult, [
  { name: 'console', container: 'console' },
  { name: 'json-export', container: './results.json' },
  { name: 'web-dashboard', container: './dashboard.html' }
]);
      `,

      auto: `
// Automatic strategy detection
const manager = new VisualizationManager({ autoDetect: true });
await manager.renderWithAutoStrategy(analysisResult);
      `
    };
  }
}