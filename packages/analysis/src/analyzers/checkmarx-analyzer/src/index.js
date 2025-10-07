const CheckmarxClient = require('./checkmarx-client');
const CheckmarxMapper = require('./checkmarx-mapper');
const fs = require('fs-extra');
const path = require('path');

/**
 * Checkmarx Comprehensive SAST Analyzer
 * 
 * Enterprise-grade static analysis security testing integration for Topolop.
 * Handles comprehensive vulnerability analysis, data flow tracking, and security assessment.
 * 
 * Tier 1 Tool - High Complexity Integration (5.0% market share)
 * Layer 1 Data Source providing unified SAST analysis data
 */
class CheckmarxAnalyzer {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:80',
      apiPath: config.apiPath || '/cxrestapi',
      clientId: config.clientId || 'resource_owner_client',
      clientSecret: config.clientSecret || '014DF517-39D1-4453-B7B3-9930C563627C',
      grantType: config.grantType || 'password',
      scope: config.scope || 'sast_rest_api',
      timeout: config.timeout || 120000,
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 50,
      maxScanWaitTime: config.maxScanWaitTime || 3600000, // 1 hour
      scanPollInterval: config.scanPollInterval || 30000, // 30 seconds
      includeDataFlow: config.includeDataFlow !== false,
      maxVulnerabilities: config.maxVulnerabilities || 1000,
      ...config
    };

    this.client = null;
    this.mapper = null;
  }

  /**
   * Initialize Checkmarx analyzer with authentication
   */
  async initialize() {
    this.client = new CheckmarxClient(this.config);
    await this.client.initialize();
    
    this.mapper = new CheckmarxMapper(this.config);
    
    console.log('✅ Checkmarx analyzer initialized successfully');
    
    return {
      status: 'initialized',
      authenticated: this.client.authenticated,
      configuration: this.client.getConfigurationStatus()
    };
  }

  /**
   * Test connection and authentication
   */
  async testConnection() {
    if (!this.client) await this.initialize();
    
    try {
      const connectionResult = await this.client.testConnection();
      
      return {
        success: true,
        service: 'checkmarx',
        version: connectionResult.version,
        projectsCount: connectionResult.projectsCount,
        authenticated: connectionResult.authenticated,
        configuration: this.client.getConfigurationStatus()
      };
    } catch (error) {
      return {
        success: false,
        service: 'checkmarx',
        error: error.message,
        authenticated: false
      };
    }
  }

  /**
   * Analyze existing project with comprehensive SAST analysis
   */
  async analyzeProject(projectId, options = {}) {
    if (!this.client) await this.initialize();
    
    console.log(`🔍 Starting Checkmarx analysis for project ${projectId}...`);
    
    try {
      // Get comprehensive project analysis
      const projectAnalysis = await this.client.getProjectAnalysis(projectId, {
        includeDataFlow: options.includeDataFlow !== false,
        ...options
      });

      if (!projectAnalysis.latestScan) {
        console.log('📊 No completed scans found for project');
        return {
          source: 'checkmarx',
          analysisType: 'comprehensive-sast',
          projectId: projectId,
          status: 'no-scans',
          project: projectAnalysis.project,
          summary: projectAnalysis.summary,
          cityData: this.mapper.mapToLayer2({
            project: projectAnalysis.project,
            scans: projectAnalysis.scans,
            scanResults: null,
            summary: projectAnalysis.summary
          })
        };
      }

      // Map to Layer 2 unified data model
      const layer2Data = this.mapper.mapToLayer2(projectAnalysis);
      
      console.log(`✅ Checkmarx analysis completed for project ${projectId}`);
      console.log(`📊 Found ${projectAnalysis.summary.totalVulnerabilities} vulnerabilities`);
      console.log(`🔴 High: ${projectAnalysis.summary.highSeverity}, 🟡 Medium: ${projectAnalysis.summary.mediumSeverity}, 🔵 Low: ${projectAnalysis.summary.lowSeverity}`);
      
      return {
        source: 'checkmarx',
        analysisType: 'comprehensive-sast',
        projectId: projectId,
        status: 'completed',
        project: projectAnalysis.project,
        latestScan: projectAnalysis.latestScan,
        summary: projectAnalysis.summary,
        vulnerabilityDetails: projectAnalysis.scanResults?.results || [],
        cityData: layer2Data
      };
    } catch (error) {
      throw new Error(`Checkmarx project analysis failed: ${error.message}`);
    }
  }

  /**
   * Create new scan for project and wait for completion
   */
  async createAndRunScan(projectId, options = {}) {
    if (!this.client) await this.initialize();
    
    console.log(`🚀 Creating new Checkmarx scan for project ${projectId}...`);
    
    try {
      // Create the scan
      const scanResult = await this.client.createScan(projectId, {
        incremental: options.incremental || false,
        preset: options.preset,
        engineConfiguration: options.engineConfiguration,
        comment: options.comment || `Topolop comprehensive SAST analysis - ${new Date().toISOString()}`,
        ...options
      });

      console.log(`✅ Scan created with ID: ${scanResult.scanId}`);

      // Wait for scan completion if requested
      if (options.waitForCompletion !== false) {
        console.log('⏳ Waiting for scan to complete...');
        
        const completionStatus = await this.client.waitForScanCompletion(scanResult.scanId, {
          maxWaitTime: options.maxWaitTime || this.config.maxScanWaitTime,
          pollInterval: options.pollInterval || this.config.scanPollInterval
        });

        console.log(`✅ Scan completed with status: ${completionStatus.status}`);

        // Get scan results
        const scanResults = await this.client.getScanResults(scanResult.scanId);
        
        // Map to Layer 2 model
        const layer2Data = this.mapper.mapToLayer2({
          scanId: scanResult.scanId,
          scanResults: scanResults,
          summary: this.client._calculateResultsSummary(scanResults.results || [])
        });

        return {
          source: 'checkmarx',
          analysisType: 'comprehensive-sast',
          scanId: scanResult.scanId,
          status: 'completed',
          scanResults: scanResults,
          summary: this.client._calculateResultsSummary(scanResults.results || []),
          cityData: layer2Data
        };
      } else {
        return {
          source: 'checkmarx',
          analysisType: 'comprehensive-sast',
          scanId: scanResult.scanId,
          status: 'running',
          message: 'Scan created and running. Use getScanStatus() to check progress.'
        };
      }
    } catch (error) {
      throw new Error(`Checkmarx scan creation failed: ${error.message}`);
    }
  }

  /**
   * Get scan status and progress
   */
  async getScanStatus(scanId) {
    if (!this.client) await this.initialize();
    
    try {
      const status = await this.client.getScanStatus(scanId);
      
      return {
        source: 'checkmarx',
        scanId: scanId,
        ...status
      };
    } catch (error) {
      throw new Error(`Failed to get scan status: ${error.message}`);
    }
  }

  /**
   * Search projects by name or criteria
   */
  async searchProjects(searchTerm, filters = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const searchResults = await this.client.searchProjects(searchTerm, filters);
      
      return {
        source: 'checkmarx',
        searchTerm: searchTerm,
        filters: filters,
        projects: searchResults.projects,
        totalCount: searchResults.totalCount
      };
    } catch (error) {
      throw new Error(`Project search failed: ${error.message}`);
    }
  }

  /**
   * Get all available projects
   */
  async getProjects(options = {}) {
    if (!this.client) await this.initialize();
    
    try {
      const projectsData = await this.client.getProjects(options);
      
      return {
        source: 'checkmarx',
        projects: projectsData.projects,
        totalProjects: projectsData.totalProjects
      };
    } catch (error) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  }

  /**
   * Get scan presets available for analysis
   */
  async getPresets() {
    if (!this.client) await this.initialize();
    
    try {
      const presets = await this.client.getPresets();
      
      return {
        source: 'checkmarx',
        presets: presets
      };
    } catch (error) {
      throw new Error(`Failed to get presets: ${error.message}`);
    }
  }

  /**
   * Get engine configurations
   */
  async getEngineConfigurations() {
    if (!this.client) await this.initialize();
    
    try {
      const configurations = await this.client.getEngineConfigurations();
      
      return {
        source: 'checkmarx',
        engineConfigurations: configurations
      };
    } catch (error) {
      throw new Error(`Failed to get engine configurations: ${error.message}`);
    }
  }

  /**
   * Export analysis results to file
   */
  async exportResults(analysisResult, outputPath, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `checkmarx-analysis-${timestamp}.${format}`;
    const fullPath = path.join(outputPath, filename);

    try {
      if (format === 'json') {
        await fs.writeJson(fullPath, analysisResult, { spaces: 2 });
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        file: fullPath,
        format: format,
        size: (await fs.stat(fullPath)).size
      };
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Get analyzer status and configuration
   */
  getStatus() {
    return {
      analyzer: 'checkmarx',
      version: '1.0.0',
      initialized: !!this.client,
      authenticated: this.client?.authenticated || false,
      configuration: this.client?.getConfigurationStatus() || {},
      capabilities: {
        projectAnalysis: true,
        scanCreation: true,
        scanMonitoring: true,
        vulnerabilityAnalysis: true,
        dataFlowAnalysis: this.config.includeDataFlow,
        enterpriseSAST: true,
        taintTracking: true,
        proprietaryFormatParsing: true
      }
    };
  }
}

module.exports = CheckmarxAnalyzer;