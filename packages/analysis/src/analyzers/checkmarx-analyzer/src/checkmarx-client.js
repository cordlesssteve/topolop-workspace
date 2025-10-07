const axios = require('axios');
const fs = require('fs-extra');

/**
 * Checkmarx CxSAST REST API Client
 * 
 * Handles communication with Checkmarx's comprehensive SAST platform via REST APIs.
 * Implements OAuth2 authentication, scan management, and comprehensive vulnerability analysis.
 */
class CheckmarxClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:80',
      apiPath: config.apiPath || '/cxrestapi',
      timeout: config.timeout || 120000, // SAST scans can be very slow
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 50, // Conservative for enterprise SAST
      clientId: config.clientId || 'resource_owner_client',
      clientSecret: config.clientSecret || '014DF517-39D1-4453-B7B3-9930C563627C',
      grantType: config.grantType || 'password',
      scope: config.scope || 'sast_rest_api',
      ...config
    };

    this.authenticated = false;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.httpClient = null;
  }

  /**
   * Initialize client with authentication
   */
  async initialize() {
    const username = this.config.username || process.env.CHECKMARX_USERNAME;
    const password = this.config.password || process.env.CHECKMARX_PASSWORD;
    
    if (!username || !password) {
      throw new Error('Checkmarx credentials required. Set CHECKMARX_USERNAME and CHECKMARX_PASSWORD environment variables or pass in config.');
    }

    this.username = username;
    this.password = password;

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl + this.config.apiPath,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add authentication interceptor
    this.httpClient.interceptors.request.use(
      async (config) => {
        await this.ensureValidToken();
        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Perform initial authentication
    await this.authenticate();
    this.authenticated = true;
  }

  /**
   * Authenticate with Checkmarx and get access token
   */
  async authenticate() {
    const tokenEndpoint = '/auth/identity/connect/token';
    
    const data = new URLSearchParams({
      username: this.username,
      password: this.password,
      grant_type: this.config.grantType,
      scope: this.config.scope,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    try {
      const response = await axios.post(
        this.config.baseUrl + this.config.apiPath + tokenEndpoint,
        data,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: this.config.timeout
        }
      );

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600; // Default 1 hour
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      return {
        success: true,
        tokenType: response.data.token_type,
        expiresIn: expiresIn
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error(`Checkmarx authentication failed: Invalid credentials`);
      }
      throw new Error(`Checkmarx authentication failed: ${error.message}`);
    }
  }

  /**
   * Test API connection and authentication
   */
  async testConnection() {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/sast/projects')
      );
      
      return {
        success: true,
        projectsCount: response.data?.length || 0,
        authenticated: true,
        version: response.headers['cx-version'] || 'unknown'
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error(`Checkmarx connection test failed: Authentication invalid`);
      }
      throw new Error(`Checkmarx connection test failed: ${error.message}`);
    }
  }

  /**
   * Get projects accessible to the authenticated user
   */
  async getProjects(options = {}) {
    await this.ensureAuthenticated();
    
    const params = {};
    if (options.teamId) params.teamId = options.teamId;
    if (options.projectName) params.projectName = options.projectName;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/sast/projects', { params })
      );

      return {
        projects: response.data || [],
        totalProjects: response.data?.length || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  /**
   * Get project details including scan history
   */
  async getProject(projectId) {
    await this.ensureAuthenticated();

    try {
      const [projectResponse, scansResponse] = await Promise.all([
        this.executeWithRateLimit(() => 
          this.httpClient.get(`/sast/projects/${projectId}`)
        ),
        this.executeWithRateLimit(() => 
          this.httpClient.get(`/sast/scans`, { params: { projectId, last: 10 } })
        )
      ]);

      return {
        project: projectResponse.data,
        scans: scansResponse.data || []
      };
    } catch (error) {
      throw new Error(`Failed to fetch project details: ${error.message}`);
    }
  }

  /**
   * Get comprehensive project analysis including latest scan results
   */
  async getProjectAnalysis(projectId, options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get project details and scans
      const projectData = await this.getProject(projectId);
      const project = projectData.project;
      const scans = projectData.scans;

      if (!scans || scans.length === 0) {
        return {
          project,
          scans: [],
          latestScan: null,
          scanResults: null,
          summary: {
            totalVulnerabilities: 0,
            highSeverity: 0,
            mediumSeverity: 0,
            lowSeverity: 0,
            infoSeverity: 0
          }
        };
      }

      // Get latest scan results
      const latestScan = scans[0];
      let scanResults = null;
      let summary = {
        totalVulnerabilities: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        infoSeverity: 0
      };

      if (latestScan && latestScan.status === 'Finished') {
        try {
          scanResults = await this.getScanResults(latestScan.id, options);
          summary = this._calculateResultsSummary(scanResults.results || []);
        } catch (resultsError) {
          console.warn(`Could not fetch scan results: ${resultsError.message}`);
        }
      }

      return {
        project,
        scans,
        latestScan,
        scanResults,
        summary
      };
    } catch (error) {
      throw new Error(`Failed to fetch project analysis: ${error.message}`);
    }
  }

  /**
   * Get scan results for a specific scan
   */
  async getScanResults(scanId, options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get scan statistics first
      const statsResponse = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/sast/scans/${scanId}/resultsStatistics`)
      );

      // Get detailed results
      const resultsResponse = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/sast/scans/${scanId}/results`, {
          params: {
            scanId: scanId
          }
        })
      );

      return {
        scanId,
        statistics: statsResponse.data,
        results: resultsResponse.data || [],
        totalCount: statsResponse.data?.totalVulnerabilities || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch scan results: ${error.message}`);
    }
  }

  /**
   * Get scan result details by result ID
   */
  async getScanResultDetails(scanId, pathId) {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/sast/scans/${scanId}/results/${pathId}/short`)
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch scan result details: ${error.message}`);
    }
  }

  /**
   * Create a new scan for a project
   */
  async createScan(projectId, options = {}) {
    await this.ensureAuthenticated();

    const scanSettings = {
      projectId: projectId,
      isIncremental: options.incremental || false,
      isPublic: options.isPublic || true,
      forceScan: options.forceScan || false,
      comment: options.comment || `Topolop analysis scan - ${new Date().toISOString()}`
    };

    if (options.preset) scanSettings.presetId = options.preset;
    if (options.engineConfiguration) scanSettings.engineConfigurationId = options.engineConfiguration;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.post('/sast/scans', scanSettings)
      );

      return {
        scanId: response.data.id,
        link: response.data.link,
        created: true
      };
    } catch (error) {
      throw new Error(`Failed to create scan: ${error.message}`);
    }
  }

  /**
   * Get scan status and progress
   */
  async getScanStatus(scanId) {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/sast/scans/${scanId}`)
      );

      return {
        scanId,
        status: response.data.status,
        progress: response.data.totalPercent || 0,
        stage: response.data.currentStage,
        startedOn: response.data.dateAndTime?.startedOn,
        finishedOn: response.data.dateAndTime?.finishedOn,
        queuedOn: response.data.dateAndTime?.queuedOn
      };
    } catch (error) {
      throw new Error(`Failed to get scan status: ${error.message}`);
    }
  }

  /**
   * Wait for scan completion with progress tracking
   */
  async waitForScanCompletion(scanId, options = {}) {
    const maxWaitTime = options.maxWaitTime || 3600000; // 1 hour default
    const pollInterval = options.pollInterval || 30000; // 30 seconds
    const startTime = Date.now();

    console.log(`🔄 Waiting for Checkmarx scan ${scanId} to complete...`);

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getScanStatus(scanId);
      
      console.log(`📊 Scan progress: ${status.progress}% - ${status.stage} (${status.status})`);

      if (status.status === 'Finished') {
        console.log(`✅ Scan ${scanId} completed successfully`);
        return status;
      }

      if (status.status === 'Failed' || status.status === 'Canceled') {
        throw new Error(`Scan ${scanId} failed with status: ${status.status}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Scan ${scanId} timed out after ${maxWaitTime}ms`);
  }

  /**
   * Search projects by name or criteria
   */
  async searchProjects(searchTerm, filters = {}) {
    const projects = await this.getProjects({ ...filters });
    
    // Client-side filtering
    const filtered = projects.projects.filter(project => {
      const matchesSearch = !searchTerm || 
        project.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTeam = !filters.teamId || 
        project.teamId === filters.teamId;
        
      return matchesSearch && matchesTeam;
    });

    return {
      projects: filtered,
      totalCount: filtered.length
    };
  }

  /**
   * Get presets available for scanning
   */
  async getPresets() {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/sast/presets')
      );

      return response.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch presets: ${error.message}`);
    }
  }

  /**
   * Get engine configurations
   */
  async getEngineConfigurations() {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/sast/engineConfigurations')
      );

      return response.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch engine configurations: ${error.message}`);
    }
  }

  // Helper methods
  _calculateResultsSummary(results) {
    const summary = {
      totalVulnerabilities: results.length,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      infoSeverity: 0
    };

    results.forEach(result => {
      const severity = result.severity?.toLowerCase();
      switch (severity) {
        case 'high':
          summary.highSeverity++;
          break;
        case 'medium':
          summary.mediumSeverity++;
          break;
        case 'low':
          summary.lowSeverity++;
          break;
        case 'info':
        case 'information':
          summary.infoSeverity++;
          break;
      }
    });

    return summary;
  }

  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 minute early
      await this.authenticate();
    }
  }

  async executeWithRateLimit(requestFunction) {
    // Reset counter every hour
    const now = Date.now();
    if (now - this.lastReset > 3600000) { // 1 hour
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= this.config.rateLimit) {
      const waitTime = 3600000 - (now - this.lastReset);
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
      apiPath: this.config.apiPath,
      authenticated: this.authenticated,
      tokenValid: this.accessToken && Date.now() < this.tokenExpiry,
      rateLimit: this.config.rateLimit,
      requestCount: this.requestCount,
      requestsRemaining: Math.max(0, this.config.rateLimit - this.requestCount),
      rateLimitResetTime: new Date(this.lastReset + 3600000).toISOString()
    };
  }
}

module.exports = CheckmarxClient;