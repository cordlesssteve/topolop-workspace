const axios = require('axios');
const fs = require('fs-extra');

/**
 * Codacy API v3 REST Client
 * 
 * Handles communication with Codacy's code quality platform via REST APIs.
 * Implements account API token authentication and comprehensive quality analysis.
 */
class CodacyClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://app.codacy.com/api/v3',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 2500, // 2500 requests per 5 minutes
      rateLimitWindow: config.rateLimitWindow || 300000, // 5 minutes
      ...config
    };

    this.authenticated = false;
    this.apiToken = null;
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.httpClient = null;
  }

  /**
   * Initialize client with authentication
   */
  async initialize() {
    const apiToken = this.config.apiToken || process.env.CODACY_API_TOKEN;
    
    if (!apiToken) {
      throw new Error('Codacy API token required. Set CODACY_API_TOKEN environment variable or pass in config.');
    }

    this.apiToken = apiToken;

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'api-token': this.apiToken,
        'Content-Type': 'application/json'
      }
    });

    // Perform initial authentication test
    await this.testConnection();
    this.authenticated = true;
  }

  /**
   * Test API connection and authentication
   */
  async testConnection() {
    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/user')
      );
      
      return {
        success: true,
        user: response.data,
        authenticated: true
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error(`Codacy authentication failed: Invalid API token`);
      }
      throw new Error(`Codacy connection test failed: ${error.message}`);
    }
  }

  /**
   * Get user organizations
   */
  async getOrganizations(provider = 'gh') {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/user/organizations/${provider}`)
      );

      return {
        organizations: response.data || [],
        totalOrganizations: response.data?.length || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch organizations: ${error.message}`);
    }
  }

  /**
   * Get repositories for an organization
   */
  async getRepositories(provider, organization, options = {}) {
    await this.ensureAuthenticated();
    
    const params = {
      cursor: options.cursor,
      limit: options.limit || 100
    };

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/organizations/${provider}/${organization}/repositories`, { params })
      );

      return {
        repositories: response.data?.data || [],
        pagination: response.data?.pagination || {}
      };
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Get repository analysis with quality metrics
   */
  async getRepositoryAnalysis(provider, organization, repository, options = {}) {
    await this.ensureAuthenticated();
    
    const params = {};
    if (options.branch) params.branch = options.branch;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/analysis/organizations/${provider}/${organization}/repositories/${repository}`, { params })
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Repository not found or not analyzed: ${provider}/${organization}/${repository}`);
      }
      throw new Error(`Failed to fetch repository analysis: ${error.message}`);
    }
  }

  /**
   * Search repository issues with filtering
   */
  async searchRepositoryIssues(provider, organization, repository, filters = {}) {
    await this.ensureAuthenticated();
    
    const searchBody = {
      pagination: {
        cursor: filters.cursor,
        limit: filters.limit || 100
      },
      filters: {}
    };

    // Add severity filter
    if (filters.severities && filters.severities.length > 0) {
      searchBody.filters.levels = filters.severities;
    }

    // Add category filter (e.g., Security, CodeStyle, Performance)
    if (filters.categories && filters.categories.length > 0) {
      searchBody.filters.categories = filters.categories;
    }

    // Add pattern filter
    if (filters.patterns && filters.patterns.length > 0) {
      searchBody.filters.patterns = filters.patterns;
    }

    // Add file filter
    if (filters.filePath) {
      searchBody.filters.filePath = filters.filePath;
    }

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.post(`/analysis/organizations/${provider}/${organization}/repositories/${repository}/issues/search`, searchBody)
      );

      return {
        issues: response.data?.data || [],
        pagination: response.data?.pagination || {}
      };
    } catch (error) {
      throw new Error(`Failed to search repository issues: ${error.message}`);
    }
  }

  /**
   * Get file-level quality metrics
   */
  async getFileMetrics(provider, organization, repository, options = {}) {
    await this.ensureAuthenticated();
    
    const params = {
      cursor: options.cursor,
      limit: options.limit || 100
    };

    // Add directory filter
    if (options.directory) {
      params.path = options.directory;
    }

    // Add branch filter
    if (options.branch) {
      params.branch = options.branch;
    }

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/organizations/${provider}/${organization}/repositories/${repository}/files`, { params })
      );

      return {
        files: response.data?.data || [],
        pagination: response.data?.pagination || {}
      };
    } catch (error) {
      throw new Error(`Failed to fetch file metrics: ${error.message}`);
    }
  }

  /**
   * Get comprehensive repository quality data
   */
  async getRepositoryQuality(provider, organization, repository, options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get repository analysis (overall metrics)
      const analysis = await this.getRepositoryAnalysis(provider, organization, repository, options);
      
      // Get all issues (with pagination support)
      let allIssues = [];
      let cursor = null;
      let hasMore = true;
      
      while (hasMore && allIssues.length < (options.maxIssues || 1000)) {
        const issuesData = await this.searchRepositoryIssues(provider, organization, repository, {
          cursor: cursor,
          limit: options.issuesPerPage || 100,
          severities: options.severities,
          categories: options.categories
        });
        
        allIssues = allIssues.concat(issuesData.issues);
        cursor = issuesData.pagination?.cursor;
        hasMore = !!cursor;
      }

      // Get file metrics (with pagination support)
      let allFiles = [];
      cursor = null;
      hasMore = true;
      
      while (hasMore && allFiles.length < (options.maxFiles || 1000)) {
        const filesData = await this.getFileMetrics(provider, organization, repository, {
          cursor: cursor,
          limit: options.filesPerPage || 100,
          directory: options.directory,
          branch: options.branch
        });
        
        allFiles = allFiles.concat(filesData.files);
        cursor = filesData.pagination?.cursor;
        hasMore = !!cursor;
      }

      return {
        analysis: analysis,
        issues: allIssues,
        files: allFiles,
        summary: {
          totalIssues: allIssues.length,
          totalFiles: allFiles.length,
          grade: analysis?.grade || 'unknown',
          qualityMetrics: analysis?.quality || {}
        }
      };
    } catch (error) {
      throw new Error(`Failed to get repository quality data: ${error.message}`);
    }
  }

  /**
   * Search repositories across organizations
   */
  async searchRepositories(searchTerm, provider = 'gh', options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get user organizations first
      const orgsData = await this.getOrganizations(provider);
      const organizations = orgsData.organizations;

      let allRepositories = [];
      
      // Search across all organizations
      for (const org of organizations) {
        try {
          const reposData = await this.getRepositories(provider, org.name, {
            limit: options.limitPerOrg || 100
          });
          
          // Filter repositories by search term
          const filteredRepos = reposData.repositories.filter(repo => {
            if (!searchTerm) return true;
            return repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
          });
          
          allRepositories = allRepositories.concat(filteredRepos.map(repo => ({
            ...repo,
            organization: org.name,
            provider: provider
          })));
          
        } catch (orgError) {
          console.warn(`Could not fetch repositories for organization ${org.name}: ${orgError.message}`);
        }
      }

      return {
        repositories: allRepositories,
        totalCount: allRepositories.length
      };
    } catch (error) {
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }

  // Helper methods
  async executeWithRateLimit(requestFunction) {
    // Reset counter every rate limit window
    const now = Date.now();
    if (now - this.lastReset > this.config.rateLimitWindow) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= this.config.rateLimit) {
      const waitTime = this.config.rateLimitWindow - (now - this.lastReset);
      throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 60000)} minutes.`);
    }

    this.requestCount++;
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await requestFunction();
      } catch (error) {
        lastError = error;
        
        // Don't retry authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError;
  }

  async ensureAuthenticated() {
    if (!this.authenticated || !this.httpClient) {
      await this.initialize();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConfigurationStatus() {
    return {
      baseUrl: this.config.baseUrl,
      authenticated: this.authenticated,
      rateLimit: this.config.rateLimit,
      requestCount: this.requestCount,
      requestsRemaining: Math.max(0, this.config.rateLimit - this.requestCount),
      rateLimitResetTime: new Date(this.lastReset + this.config.rateLimitWindow).toISOString()
    };
  }
}

module.exports = CodacyClient;