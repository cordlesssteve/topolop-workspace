const axios = require('axios');

/**
 * SonarQube REST API Client
 * 
 * Handles authentication and data fetching from SonarQube instances.
 * Supports both SonarCloud and on-premise SonarQube servers.
 */
class SonarQubeClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://sonarcloud.io';
    this.token = config.token || process.env.SONARQUBE_TOKEN;
    this.organization = config.organization || process.env.SONARQUBE_ORG;
    
    if (!this.token) {
      throw new Error('SonarQube token is required. Set SONARQUBE_TOKEN environment variable or pass token in config.');
    }

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors for debugging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔍 SonarQube API: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ SonarQube API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ SonarQube API: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ SonarQube API Error: ${error.response?.status} ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to SonarQube instance
   */
  async testConnection() {
    try {
      const response = await this.client.get('/api/system/status');
      return {
        success: true,
        status: response.data.status,
        version: response.data.version
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search for projects in the organization
   */
  async searchProjects(projectKey = null, options = {}) {
    const params = {
      organization: this.organization,
      ps: options.pageSize || 100,
      p: options.page || 1
    };

    if (projectKey) {
      params.projects = projectKey;
    }

    try {
      const response = await this.client.get('/api/projects/search', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search projects: ${error.message}`);
    }
  }

  /**
   * Get project analysis/quality gate status
   */
  async getProjectQualityGate(projectKey) {
    try {
      const params = {
        projectKey,
        organization: this.organization
      };

      const response = await this.client.get('/api/qualitygates/project_status', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get quality gate for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Get project measures (metrics)
   */
  async getProjectMeasures(projectKey, metricKeys = []) {
    const defaultMetrics = [
      'ncloc',                    // Lines of code
      'complexity',               // Cyclomatic complexity
      'cognitive_complexity',     // Cognitive complexity
      'duplicated_lines_density', // Code duplication
      'coverage',                 // Test coverage
      'bugs',                     // Bug count
      'vulnerabilities',          // Security vulnerabilities
      'code_smells',              // Code smells
      'security_hotspots',        // Security hotspots
      'sqale_index',              // Technical debt
      'reliability_rating',       // Reliability rating
      'security_rating',          // Security rating
      'sqale_rating'              // Maintainability rating
    ];

    const metrics = metricKeys.length > 0 ? metricKeys : defaultMetrics;
    
    try {
      const params = {
        component: projectKey,
        metricKeys: metrics.join(','),
        organization: this.organization
      };

      const response = await this.client.get('/api/measures/component', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get measures for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Get issues (bugs, vulnerabilities, code smells) for a project
   */
  async getProjectIssues(projectKey, options = {}) {
    try {
      const params = {
        componentKeys: projectKey,
        organization: this.organization,
        ps: options.pageSize || 500,
        p: options.page || 1,
        resolved: options.resolved || 'false',
        statuses: options.statuses || 'OPEN,CONFIRMED,REOPENED',
        types: options.types || 'BUG,VULNERABILITY,CODE_SMELL,SECURITY_HOTSPOT'
      };

      // Add severity filter if specified
      if (options.severities) {
        params.severities = Array.isArray(options.severities) 
          ? options.severities.join(',') 
          : options.severities;
      }

      const response = await this.client.get('/api/issues/search', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get issues for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Get all issues for a project (handles pagination)
   */
  async getAllProjectIssues(projectKey, options = {}) {
    let allIssues = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const response = await this.getProjectIssues(projectKey, {
        ...options,
        page: currentPage,
        pageSize: 500
      });

      allIssues = allIssues.concat(response.issues);
      totalPages = Math.ceil(response.total / 500);
      currentPage++;

      console.log(`📄 Fetched page ${currentPage - 1}/${totalPages} (${response.issues.length} issues)`);
    } while (currentPage <= totalPages);

    console.log(`✅ Total issues collected: ${allIssues.length}`);
    return allIssues;
  }

  /**
   * Get components (files) for a project
   */
  async getProjectComponents(projectKey, options = {}) {
    try {
      const params = {
        component: projectKey,
        organization: this.organization,
        ps: options.pageSize || 500,
        p: options.page || 1,
        qualifiers: options.qualifiers || 'FIL' // Files only
      };

      const response = await this.client.get('/api/measures/component_tree', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get components for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Get file-level measures for components
   */
  async getComponentMeasures(componentKey, metricKeys = []) {
    const defaultMetrics = [
      'ncloc', 'complexity', 'cognitive_complexity', 'duplicated_lines_density',
      'coverage', 'bugs', 'vulnerabilities', 'code_smells'
    ];

    const metrics = metricKeys.length > 0 ? metricKeys : defaultMetrics;
    
    try {
      const params = {
        component: componentKey,
        metricKeys: metrics.join(','),
        organization: this.organization
      };

      const response = await this.client.get('/api/measures/component', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get measures for component ${componentKey}: ${error.message}`);
    }
  }

  /**
   * Get hotspots for a project
   */
  async getProjectHotspots(projectKey, options = {}) {
    try {
      const params = {
        projectKey,
        organization: this.organization,
        ps: options.pageSize || 500,
        p: options.page || 1,
        status: options.status || 'TO_REVIEW,IN_REVIEW'
      };

      const response = await this.client.get('/api/hotspots/search', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get hotspots for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Get analysis history for a project
   */
  async getProjectAnalysisHistory(projectKey, options = {}) {
    try {
      const params = {
        project: projectKey,
        organization: this.organization,
        ps: options.pageSize || 100,
        p: options.page || 1
      };

      if (options.from) {
        params.from = options.from;
      }
      if (options.to) {
        params.to = options.to;
      }

      const response = await this.client.get('/api/project_analyses/search', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get analysis history for ${projectKey}: ${error.message}`);
    }
  }

  /**
   * Comprehensive project analysis - gets all data for a project
   */
  async analyzeProject(projectKey, options = {}) {
    console.log(`🔍 Starting comprehensive analysis for project: ${projectKey}`);
    
    try {
      const [
        qualityGate,
        measures,
        issues,
        components,
        hotspots,
        analysisHistory
      ] = await Promise.all([
        this.getProjectQualityGate(projectKey),
        this.getProjectMeasures(projectKey, options.metricKeys),
        this.getAllProjectIssues(projectKey, options.issueOptions || {}),
        this.getProjectComponents(projectKey, options.componentOptions || {}),
        this.getProjectHotspots(projectKey, options.hotspotOptions || {}),
        this.getProjectAnalysisHistory(projectKey, { pageSize: 10 })
      ]);

      const result = {
        projectKey,
        qualityGate,
        measures: measures.component,
        issues,
        components: components.components || [],
        hotspots: hotspots.hotspots || [],
        analysisHistory: analysisHistory.analyses || [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          sonarQubeUrl: this.baseUrl,
          organization: this.organization,
          totalIssues: issues.length,
          totalComponents: components.components?.length || 0,
          totalHotspots: hotspots.hotspots?.length || 0
        }
      };

      console.log(`✅ Analysis complete for ${projectKey}:`);
      console.log(`   📊 ${result.measures?.measures?.length || 0} metrics`);
      console.log(`   🐛 ${result.issues.length} issues`);
      console.log(`   📁 ${result.components.length} components`);
      console.log(`   🔥 ${result.hotspots.length} security hotspots`);

      return result;
    } catch (error) {
      console.error(`❌ Failed to analyze project ${projectKey}:`, error.message);
      throw error;
    }
  }
}

module.exports = SonarQubeClient;