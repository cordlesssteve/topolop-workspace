const axios = require('axios');

/**
 * CodeClimate REST API Client
 * 
 * Handles authentication and data fetching from CodeClimate instances.
 * Supports CodeClimate Quality and transitions to Qlty Cloud.
 */
class CodeClimateClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://api.codeclimate.com';
    this.token = config.token || process.env.CODECLIMATE_TOKEN;
    
    if (!this.token) {
      throw new Error('CodeClimate token is required. Set CODECLIMATE_TOKEN environment variable or pass token in config.');
    }

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Token token=${this.token}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      }
    });

    // Add request/response interceptors for debugging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔍 CodeClimate API: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ CodeClimate API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ CodeClimate API: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ CodeClimate API Error: ${error.response?.status} ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to CodeClimate API
   */
  async testConnection() {
    try {
      const response = await this.client.get('/v1/user');
      return {
        success: true,
        user: response.data.data.attributes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's repositories
   */
  async getRepositories(options = {}) {
    try {
      const params = {
        'page[size]': options.pageSize || 30,
        'page[number]': options.page || 1
      };

      if (options.github_slug) {
        params['filter[github_slug]'] = options.github_slug;
      }

      const response = await this.client.get('/v1/repos', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  /**
   * Get specific repository by ID
   */
  async getRepository(repoId) {
    try {
      const response = await this.client.get(`/v1/repos/${repoId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get repository ${repoId}: ${error.message}`);
    }
  }

  /**
   * Get repository snapshot (latest analysis results)
   */
  async getRepositorySnapshot(repoId) {
    try {
      const response = await this.client.get(`/v1/repos/${repoId}/snapshots/latest`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get snapshot for repository ${repoId}: ${error.message}`);
    }
  }

  /**
   * Get repository issues
   */
  async getRepositoryIssues(repoId, options = {}) {
    try {
      const params = {
        'page[size]': options.pageSize || 100,
        'page[number]': options.page || 1
      };

      if (options.categories) {
        params['filter[categories]'] = Array.isArray(options.categories) 
          ? options.categories.join(',') 
          : options.categories;
      }

      if (options.severity) {
        params['filter[severity]'] = options.severity;
      }

      const response = await this.client.get(`/v1/repos/${repoId}/issues`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get issues for repository ${repoId}: ${error.message}`);
    }
  }

  /**
   * Get all issues for a repository (handles pagination)
   */
  async getAllRepositoryIssues(repoId, options = {}) {
    let allIssues = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await this.getRepositoryIssues(repoId, {
        ...options,
        page: currentPage,
        pageSize: 100
      });

      if (response.data) {
        allIssues = allIssues.concat(response.data);
      }

      // Check if there are more pages
      const meta = response.meta;
      hasMorePages = meta && meta.current_page < meta.total_pages;
      currentPage++;

      if (response.data.length > 0) {
        console.log(`📄 Fetched page ${currentPage - 1} (${response.data.length} issues)`);
      }
    }

    console.log(`✅ Total issues collected: ${allIssues.length}`);
    return allIssues;
  }

  /**
   * Get repository metrics (test coverage, maintainability, etc.)
   */
  async getRepositoryMetrics(repoId) {
    try {
      const response = await this.client.get(`/v1/repos/${repoId}/metrics`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get metrics for repository ${repoId}: ${error.message}`);
    }
  }

  /**
   * Get repository analysis history
   */
  async getRepositoryAnalysisHistory(repoId, options = {}) {
    try {
      const params = {
        'page[size]': options.pageSize || 30,
        'page[number]': options.page || 1
      };

      if (options.from) {
        params['filter[from]'] = options.from;
      }
      if (options.to) {
        params['filter[to]'] = options.to;
      }

      const response = await this.client.get(`/v1/repos/${repoId}/snapshots`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get analysis history for repository ${repoId}: ${error.message}`);
    }
  }

  /**
   * Get file-level analysis data
   */
  async getFileAnalysis(repoId, filePath, snapshotId = 'latest') {
    try {
      const response = await this.client.get(`/v1/repos/${repoId}/snapshots/${snapshotId}/files`, {
        params: {
          'filter[path]': filePath
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get file analysis for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Search repositories by GitHub slug
   */
  async searchRepositoriesBySlug(githubSlug, options = {}) {
    try {
      return await this.getRepositories({
        ...options,
        github_slug: githubSlug
      });
    } catch (error) {
      throw new Error(`Failed to search repositories by slug ${githubSlug}: ${error.message}`);
    }
  }

  /**
   * Comprehensive repository analysis - gets all data for a repository
   */
  async analyzeRepository(repoId, options = {}) {
    console.log(`🔍 Starting comprehensive analysis for CodeClimate repository: ${repoId}`);
    
    try {
      const [
        repository,
        snapshot,
        issues,
        metrics,
        analysisHistory
      ] = await Promise.all([
        this.getRepository(repoId),
        this.getRepositorySnapshot(repoId),
        this.getAllRepositoryIssues(repoId, options.issueOptions || {}),
        this.getRepositoryMetrics(repoId).catch(() => null), // Metrics might not be available
        this.getRepositoryAnalysisHistory(repoId, { pageSize: 10 })
      ]);

      const result = {
        repositoryId: repoId,
        repository,
        snapshot,
        issues,
        metrics,
        analysisHistory: analysisHistory.data || [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          codeClimateUrl: this.baseUrl,
          totalIssues: issues.length,
          totalSnapshots: analysisHistory.data?.length || 0
        }
      };

      console.log(`✅ Analysis complete for ${repoId}:`);
      console.log(`   📊 Repository: ${repository.data.attributes.human_name}`);
      console.log(`   🐛 ${result.issues.length} issues`);
      console.log(`   📈 ${result.analysisHistory.length} snapshots`);

      return result;
    } catch (error) {
      console.error(`❌ Failed to analyze repository ${repoId}:`, error.message);
      throw error;
    }
  }
}

module.exports = CodeClimateClient;