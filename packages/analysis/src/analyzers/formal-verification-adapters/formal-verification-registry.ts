/**
 * Formal Verification Adapter Registry
 * Phase 5A: Blue Ocean Markets Integration System
 * 
 * Central registry for all formal verification adapters
 * Provides unified access to JavaScript, Python, and LLM-assisted verification
 * Platform evolution: From "analysis platform" to "verification platform"
 */

import {
  FormalVerificationAdapter,
  FormalVerificationResult,
  FormalVerificationOptions,
  VerificationCapabilities,
  AdapterStatus,
  GeneratedSpecification
} from './base-interfaces/formal-verification-types';

import { JavaScriptFormalVerifier } from './javascript-formal/javascript-formal-verifier';
import { PythonFormalVerifier } from './python-formal/python-formal-verifier';
import { LLMAssistedSpecGenerator } from './llm-assisted/llm-spec-generator';

// Phase 5B Foundation Tools
import { CBMCVerifier } from './cbmc-adapter/cbmc-verifier';
import { KLEEVerifier } from './klee-adapter/klee-verifier';
import { Z3SMTSolverVerifier } from './z3-adapter/z3-verifier';

/**
 * Registry configuration and management types
 */
interface RegistryConfiguration {
  enabledAdapters: string[];
  defaultTimeouts: Record<string, number>;
  parallelExecution: boolean;
  fallbackBehavior: 'fail' | 'skip' | 'retry';
  cacheResults: boolean;
  maxConcurrentVerifications: number;
}

interface VerificationPipeline {
  adapters: FormalVerificationAdapter[];
  executionOrder: 'parallel' | 'sequential' | 'priority';
  failureHandling: 'stop' | 'continue' | 'fallback';
}

interface LanguageDetectionResult {
  language: string;
  confidence: number;
  framework?: string;
  characteristics: string[];
}

/**
 * Formal Verification Adapter Registry
 * 
 * Central hub for all formal verification capabilities in Phase 5A
 * Provides unified access to blue ocean market tools
 */
export class FormalVerificationAdapterRegistry {
  private adapters: Map<string, FormalVerificationAdapter>;
  private configuration: RegistryConfiguration;
  private languageDetector: LanguageDetector;
  private resultCache: Map<string, FormalVerificationResult[]>;
  private performanceMonitor: PerformanceMonitor;

  constructor(configuration?: Partial<RegistryConfiguration>) {
    this.adapters = new Map();
    this.configuration = this.mergeConfiguration(configuration);
    this.languageDetector = new LanguageDetector();
    this.resultCache = new Map();
    this.performanceMonitor = new PerformanceMonitor();
    
    this.initializeAdapters();
  }

  /**
   * Initialize all Phase 5A and 5B adapters
   */
  private initializeAdapters(): void {
    // Phase 5A Blue Ocean Market adapters
    this.registerAdapter('javascript-formal', new JavaScriptFormalVerifier());
    this.registerAdapter('python-formal', new PythonFormalVerifier());
    this.registerAdapter('llm-assisted', new LLMAssistedSpecGenerator());
    
    // Phase 5B Foundation Tools
    this.registerAdapter('cbmc', new CBMCVerifier());
    this.registerAdapter('klee', new KLEEVerifier());
    this.registerAdapter('z3', new Z3SMTSolverVerifier());
    
    console.log(`Initialized ${this.adapters.size} formal verification adapters (Phase 5A + 5B)`);
  }

  /**
   * Register a new formal verification adapter
   */
  registerAdapter(name: string, adapter: FormalVerificationAdapter): void {
    this.adapters.set(name, adapter);
    console.log(`Registered formal verification adapter: ${name}`);
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Get all registered adapters
   */
  getRegisteredAdapters(): Map<string, FormalVerificationAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): FormalVerificationAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Verify file with appropriate adapters
   * Innovation: Intelligent adapter selection based on language detection
   */
  async verifyFile(
    filePath: string,
    specification?: string,
    options: FormalVerificationOptions = {}
  ): Promise<FormalVerificationResult[]> {
    const startTime = Date.now();
    
    try {
      // 1. Detect language and select appropriate adapters
      const languageInfo = await this.languageDetector.detectLanguage(filePath);
      const selectedAdapters = this.selectAdaptersForLanguage(languageInfo);
      
      if (selectedAdapters.length === 0) {
        console.warn(`No formal verification adapters available for ${languageInfo.language}`);
        return [];
      }

      // 2. Check cache if enabled
      const cacheKey = this.generateCacheKey(filePath, specification, options);
      if (this.configuration.cacheResults && this.resultCache.has(cacheKey)) {
        console.log(`Using cached results for ${filePath}`);
        return this.resultCache.get(cacheKey)!;
      }

      // 3. Execute verification pipeline
      const pipeline = this.buildVerificationPipeline(selectedAdapters);
      const results = await this.executePipeline(pipeline, filePath, specification, options);

      // 4. Cache results if enabled
      if (this.configuration.cacheResults) {
        this.resultCache.set(cacheKey, results);
      }

      // 5. Record performance metrics
      const executionTime = Date.now() - startTime;
      this.performanceMonitor.recordVerification(filePath, languageInfo.language, executionTime, results.length);

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Formal verification failed for ${filePath}:`, errorMessage);
      
      // Return error result
      return [{
        id: `registry-error-${Date.now()}`,
        toolName: 'FormalVerificationRegistry',
        version: '1.0.0',
        filePath,
        projectRoot: process.cwd(),
        canonicalPath: filePath.replace(process.cwd(), '').replace(/^\//, ''),
        status: 'error',
        method: 'ai_assisted',
        confidence: 'low_confidence',
        properties: [],
        proofs: [],
        analysisTime: Date.now() - startTime,
        resourceUsage: { memory: 0, cpu: 0 },
        assumptions: [],
        limitations: [`Registry execution failed: ${errorMessage}`],
        correlationKey: `registry-${filePath}`,
        timestamp: new Date().toISOString(),
        metadata: { registryError: errorMessage }
      }];
    }
  }

  /**
   * Verify multiple files in batch
   */
  async verifyFiles(
    filePaths: string[],
    specifications?: Map<string, string>,
    options: FormalVerificationOptions = {}
  ): Promise<Map<string, FormalVerificationResult[]>> {
    const results = new Map<string, FormalVerificationResult[]>();
    
    if (this.configuration.parallelExecution) {
      // Parallel execution with concurrency limit
      const semaphore = new Semaphore(this.configuration.maxConcurrentVerifications);
      
      const promises = filePaths.map(async (filePath) => {
        await semaphore.acquire();
        try {
          const spec = specifications?.get(filePath);
          const fileResults = await this.verifyFile(filePath, spec, options);
          results.set(filePath, fileResults);
        } finally {
          semaphore.release();
        }
      });
      
      await Promise.all(promises);
    } else {
      // Sequential execution
      for (const filePath of filePaths) {
        const spec = specifications?.get(filePath);
        const fileResults = await this.verifyFile(filePath, spec, options);
        results.set(filePath, fileResults);
      }
    }
    
    return results;
  }

  /**
   * Generate specification for file using LLM
   */
  async generateSpecification(
    filePath: string,
    targetFormat?: string
  ): Promise<GeneratedSpecification | null> {
    const llmAdapter = this.adapters.get('llm-assisted') as LLMAssistedSpecGenerator;
    if (!llmAdapter) {
      console.warn('LLM-assisted adapter not available for specification generation');
      return null;
    }

    try {
      const code = await this.readFile(filePath);
      const languageInfo = await this.languageDetector.detectLanguage(filePath);
      
      // Use appropriate format for language
      const format = targetFormat || this.selectSpecificationFormat(languageInfo.language);
      
      // Generate specification from code
      if (!llmAdapter.generateSpecification) {
        throw new Error('LLM adapter does not support specification generation');
      }
      
      return await llmAdapter.generateSpecification(code, languageInfo.language);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Specification generation failed for ${filePath}:`, errorMessage);
      return null;
    }
  }

  /**
   * Get combined capabilities of all adapters
   */
  getCombinedCapabilities(): VerificationCapabilities {
    const allCapabilities = Array.from(this.adapters.values()).map(adapter => adapter.getCapabilities());
    
    return {
      supportsSymbolicExecution: allCapabilities.some(c => c.supportsSymbolicExecution),
      supportsBoundedModelChecking: allCapabilities.some(c => c.supportsBoundedModelChecking),
      supportsContractVerification: allCapabilities.some(c => c.supportsContractVerification),
      supportsTheoremProving: allCapabilities.some(c => c.supportsTheoremProving),
      
      supportedLanguages: [...new Set(allCapabilities.flatMap(c => c.supportedLanguages))],
      languageFeatures: this.mergeLanguageFeatures(allCapabilities),
      
      supportedSpecFormats: [...new Set(allCapabilities.flatMap(c => c.supportedSpecFormats))],
      
      typicalAnalysisTime: 'Varies by adapter and language',
      scalabilityLimits: this.mergeScalabilityLimits(allCapabilities),
      
      supportsIncrementalVerification: allCapabilities.every(c => c.supportsIncrementalVerification),
      supportsParallelization: allCapabilities.every(c => c.supportsParallelization),
      requiresExternalDependencies: allCapabilities.some(c => c.requiresExternalDependencies)
    };
  }

  /**
   * Get status of all adapters
   */
  async getRegistryStatus(): Promise<Map<string, AdapterStatus>> {
    const statuses = new Map<string, AdapterStatus>();
    
    for (const [name, adapter] of this.adapters) {
      try {
        const status = await adapter.getStatus();
        statuses.set(name, status);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        statuses.set(name, {
          available: false,
          version: 'unknown',
          lastCheck: new Date().toISOString(),
          dependencies: [],
          performance: { averageVerificationTime: 0, successRate: 0, recentAnalyses: 0 },
          errors: [errorMessage]
        });
      }
    }
    
    return statuses;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Get list of available adapter names
   */
  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  // Private helper methods

  private selectAdaptersForLanguage(languageInfo: LanguageDetectionResult): FormalVerificationAdapter[] {
    const adapters: FormalVerificationAdapter[] = [];
    
    // Select language-specific adapters
    switch (languageInfo.language) {
      case 'javascript':
      case 'typescript':
        const jsAdapter = this.adapters.get('javascript-formal');
        if (jsAdapter) adapters.push(jsAdapter);
        break;
        
      case 'python':
        const pyAdapter = this.adapters.get('python-formal');
        if (pyAdapter) adapters.push(pyAdapter);
        break;
        
      case 'c':
      case 'cpp':
      case 'c++':
        // Phase 5B Foundation Tools for C/C++
        const cbmcAdapter = this.adapters.get('cbmc');
        const kleeAdapter = this.adapters.get('klee');
        if (cbmcAdapter) adapters.push(cbmcAdapter);
        if (kleeAdapter) adapters.push(kleeAdapter);
        break;
        
      case 'smt2':
      case 'smt':
        // Z3 for SMT-LIB format
        const z3Adapter = this.adapters.get('z3');
        if (z3Adapter) adapters.push(z3Adapter);
        break;
    }
    
    // Include Z3 for constraint solving across languages
    const z3Adapter = this.adapters.get('z3');
    if (z3Adapter && !adapters.includes(z3Adapter)) {
      adapters.push(z3Adapter);
    }
    
    // Always include LLM-assisted for specification generation
    const llmAdapter = this.adapters.get('llm-assisted');
    if (llmAdapter) adapters.push(llmAdapter);
    
    // Filter by enabled adapters
    return adapters.filter(adapter => 
      this.configuration.enabledAdapters.includes(adapter.name) ||
      this.configuration.enabledAdapters.length === 0
    );
  }

  private buildVerificationPipeline(adapters: FormalVerificationAdapter[]): VerificationPipeline {
    return {
      adapters,
      executionOrder: this.configuration.parallelExecution ? 'parallel' : 'sequential',
      failureHandling: this.configuration.fallbackBehavior === 'fail' ? 'stop' : 'continue'
    };
  }

  private async executePipeline(
    pipeline: VerificationPipeline,
    filePath: string,
    specification?: string,
    options: FormalVerificationOptions = {}
  ): Promise<FormalVerificationResult[]> {
    const results: FormalVerificationResult[] = [];
    
    if (pipeline.executionOrder === 'parallel') {
      // Execute all adapters in parallel
      const promises = pipeline.adapters.map(adapter => 
        this.executeAdapter(adapter, filePath, options, specification)
      );
      
      const adapterResults = await Promise.allSettled(promises);
      
      for (const result of adapterResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          console.warn('Adapter execution failed:', result.reason);
          if (pipeline.failureHandling === 'stop') {
            throw new Error(`Pipeline failed: ${result.reason}`);
          }
        }
      }
    } else {
      // Execute adapters sequentially
      for (const adapter of pipeline.adapters) {
        try {
          const adapterResults = await this.executeAdapter(adapter, filePath, options, specification);
          results.push(...adapterResults);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Adapter ${adapter.name} failed:`, errorMessage);
          if (pipeline.failureHandling === 'stop') {
            throw error;
          }
        }
      }
    }
    
    return results;
  }

  private async executeAdapter(
    adapter: FormalVerificationAdapter,
    filePath: string,
    options: FormalVerificationOptions,
    specification?: string
  ): Promise<FormalVerificationResult[]> {
    const timeout = this.configuration.defaultTimeouts[adapter.name] || 60000; // 60 seconds default
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Adapter ${adapter.name} timed out after ${timeout}ms`));
      }, timeout);
      
      adapter.verify(filePath, specification, options)
        .then(results => {
          clearTimeout(timer);
          resolve(results);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private selectSpecificationFormat(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'jsdoc';
      case 'python':
        return 'python_contracts';
      case 'java':
        return 'contracts';
      default:
        return 'contracts';
    }
  }

  private generateCacheKey(
    filePath: string,
    specification?: string,
    options: FormalVerificationOptions = {}
  ): string {
    const key = JSON.stringify({ filePath, specification, options });
    return Buffer.from(key).toString('base64');
  }

  private mergeConfiguration(config?: Partial<RegistryConfiguration>): RegistryConfiguration {
    return {
      enabledAdapters: config?.enabledAdapters || [],
      defaultTimeouts: config?.defaultTimeouts || {
        'javascript-formal': 30000,
        'python-formal': 30000,
        'llm-assisted': 60000,
        'cbmc': 120000,     // CBMC can take longer for bounded model checking
        'klee': 180000,     // KLEE symbolic execution can be time-intensive
        'z3': 60000         // Z3 SMT solving timeout
      },
      parallelExecution: config?.parallelExecution ?? true,
      fallbackBehavior: config?.fallbackBehavior || 'skip',
      cacheResults: config?.cacheResults ?? true,
      maxConcurrentVerifications: config?.maxConcurrentVerifications || 3
    };
  }

  private mergeLanguageFeatures(capabilities: VerificationCapabilities[]): Record<string, string[]> {
    const merged: Record<string, string[]> = {};
    
    for (const cap of capabilities) {
      for (const [lang, features] of Object.entries(cap.languageFeatures)) {
        if (!merged[lang]) {
          merged[lang] = [];
        }
        merged[lang].push(...features);
      }
    }
    
    // Remove duplicates
    for (const lang of Object.keys(merged)) {
      merged[lang] = [...new Set(merged[lang])];
    }
    
    return merged;
  }

  private mergeScalabilityLimits(capabilities: VerificationCapabilities[]): any {
    return {
      maxFileSize: Math.min(...capabilities.map(c => c.scalabilityLimits.maxFileSize || Infinity)),
      maxFunctionComplexity: Math.min(...capabilities.map(c => c.scalabilityLimits.maxFunctionComplexity || Infinity)),
      maxLoopDepth: Math.min(...capabilities.map(c => c.scalabilityLimits.maxLoopDepth || Infinity))
    };
  }

  private async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  }
}

/**
 * Language Detection for Formal Verification
 */
class LanguageDetector {
  async detectLanguage(filePath: string): Promise<LanguageDetectionResult> {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const code = await this.readFile(filePath);
    
    switch (extension) {
      case 'js':
        return {
          language: 'javascript',
          confidence: 0.95,
          framework: this.detectJSFramework(code),
          characteristics: this.analyzeJSCharacteristics(code)
        };
        
      case 'ts':
      case 'tsx':
        return {
          language: 'typescript',
          confidence: 0.95,
          framework: this.detectJSFramework(code),
          characteristics: this.analyzeJSCharacteristics(code)
        };
        
      case 'py':
        return {
          language: 'python',
          confidence: 0.95,
          framework: this.detectPythonFramework(code),
          characteristics: this.analyzePythonCharacteristics(code)
        };
        
      case 'c':
        return {
          language: 'c',
          confidence: 0.95,
          characteristics: this.analyzeCCharacteristics(code)
        };
        
      case 'cpp':
      case 'cc':
      case 'cxx':
        return {
          language: 'cpp',
          confidence: 0.95,
          characteristics: this.analyzeCppCharacteristics(code)
        };
        
      case 'smt2':
      case 'smt':
        return {
          language: 'smt2',
          confidence: 0.95,
          characteristics: this.analyzeSMTCharacteristics(code)
        };
        
      default:
        return {
          language: 'unknown',
          confidence: 0.0,
          characteristics: []
        };
    }
  }

  private detectJSFramework(code: string): string | undefined {
    if (code.includes('React') || code.includes('useState')) return 'react';
    if (code.includes('Vue') || code.includes('vue')) return 'vue';
    if (code.includes('@angular')) return 'angular';
    if (code.includes('require(') || code.includes('module.exports')) return 'node';
    return undefined;
  }

  private detectPythonFramework(code: string): string | undefined {
    if (code.includes('django') || code.includes('from django')) return 'django';
    if (code.includes('flask') || code.includes('from flask')) return 'flask';
    if (code.includes('fastapi') || code.includes('from fastapi')) return 'fastapi';
    return undefined;
  }

  private analyzeJSCharacteristics(code: string): string[] {
    const characteristics: string[] = [];
    
    if (code.includes('async') || code.includes('await')) characteristics.push('async');
    if (code.includes('Promise')) characteristics.push('promises');
    if (code.includes('class ')) characteristics.push('classes');
    if (code.includes('=>')) characteristics.push('arrow_functions');
    
    return characteristics;
  }

  private analyzePythonCharacteristics(code: string): string[] {
    const characteristics: string[] = [];
    
    if (code.includes('@dataclass')) characteristics.push('dataclasses');
    if (code.includes('async def')) characteristics.push('async');
    if (code.includes('typing') || code.includes('Type[')) characteristics.push('typing');
    if (code.includes('class ')) characteristics.push('classes');
    
    return characteristics;
  }

  private analyzeCCharacteristics(code: string): string[] {
    const characteristics: string[] = [];
    
    if (code.includes('#include')) characteristics.push('includes');
    if (code.includes('malloc') || code.includes('free')) characteristics.push('memory_management');
    if (code.includes('assert(')) characteristics.push('assertions');
    if (code.includes('struct ')) characteristics.push('structures');
    if (code.includes('goto ')) characteristics.push('goto');
    
    return characteristics;
  }

  private analyzeCppCharacteristics(code: string): string[] {
    const characteristics: string[] = [];
    
    if (code.includes('class ')) characteristics.push('classes');
    if (code.includes('template')) characteristics.push('templates');
    if (code.includes('namespace')) characteristics.push('namespaces');
    if (code.includes('std::')) characteristics.push('stl');
    if (code.includes('new ') || code.includes('delete ')) characteristics.push('memory_management');
    if (code.includes('assert(')) characteristics.push('assertions');
    
    return characteristics;
  }

  private analyzeSMTCharacteristics(code: string): string[] {
    const characteristics: string[] = [];
    
    if (code.includes('(set-logic')) characteristics.push('logic_declaration');
    if (code.includes('(declare-fun')) characteristics.push('function_declarations');
    if (code.includes('(assert')) characteristics.push('assertions');
    if (code.includes('(check-sat)')) characteristics.push('satisfiability_check');
    if (code.includes('(get-model)')) characteristics.push('model_generation');
    if (code.includes('BitVec')) characteristics.push('bitvectors');
    if (code.includes('Array')) characteristics.push('arrays');
    
    return characteristics;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }
}

/**
 * Performance monitoring for formal verification
 */
class PerformanceMonitor {
  private metrics: {
    totalVerifications: number;
    successfulVerifications: number;
    averageExecutionTime: number;
    languageStats: Map<string, { count: number; avgTime: number }>;
    recentActivity: Array<{ timestamp: string; file: string; language: string; time: number; results: number }>;
  };

  constructor() {
    this.metrics = {
      totalVerifications: 0,
      successfulVerifications: 0,
      averageExecutionTime: 0,
      languageStats: new Map(),
      recentActivity: []
    };
  }

  recordVerification(filePath: string, language: string, executionTime: number, resultCount: number): void {
    this.metrics.totalVerifications++;
    
    if (resultCount > 0) {
      this.metrics.successfulVerifications++;
    }
    
    // Update average execution time
    this.metrics.averageExecutionTime = 
      (this.metrics.averageExecutionTime * (this.metrics.totalVerifications - 1) + executionTime) / 
      this.metrics.totalVerifications;
    
    // Update language stats
    const langStats = this.metrics.languageStats.get(language) || { count: 0, avgTime: 0 };
    langStats.avgTime = (langStats.avgTime * langStats.count + executionTime) / (langStats.count + 1);
    langStats.count++;
    this.metrics.languageStats.set(language, langStats);
    
    // Record recent activity
    this.metrics.recentActivity.push({
      timestamp: new Date().toISOString(),
      file: filePath,
      language,
      time: executionTime,
      results: resultCount
    });
    
    // Keep only last 100 activities
    if (this.metrics.recentActivity.length > 100) {
      this.metrics.recentActivity = this.metrics.recentActivity.slice(-100);
    }
  }

  getMetrics(): any {
    return {
      ...this.metrics,
      successRate: this.metrics.totalVerifications > 0 ? 
        this.metrics.successfulVerifications / this.metrics.totalVerifications : 0,
      languageStats: Object.fromEntries(this.metrics.languageStats)
    };
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}