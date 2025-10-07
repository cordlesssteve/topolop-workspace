const axios = require('axios');
const crypto = require('crypto');

/**
 * Veracode REST API Client
 * 
 * Handles communication with Veracode's enterprise REST APIs for static application 
 * security testing (SAST). Implements HMAC authentication and comprehensive security analysis.
 */
class VeracodeClient {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.veracode.com/appsec/v1',
      timeout: config.timeout || 60000, // Enterprise scans can be slow
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 100, // Conservative for enterprise API
      ...config
    };

    this.authenticated = false;
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.httpClient = null;
  }

  /**
   * Initialize client with enterprise authentication
   */
  async initialize() {
    const apiId = this.config.apiId || process.env.VERACODE_API_ID;
    const apiKey = this.config.apiKey || process.env.VERACODE_API_KEY;
    
    if (!apiId || !apiKey) {
      throw new Error('Veracode API credentials required. Set VERACODE_API_ID and VERACODE_API_KEY environment variables or pass in config.');
    }

    this.apiId = apiId;
    this.apiKey = apiKey;

    // Create HTTP client with HMAC interceptor
    this.httpClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add HMAC authentication interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        config.headers['Authorization'] = this._generateHmacAuthHeader(config);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Test authentication
    await this.testConnection();
    this.authenticated = true;
  }

  /**
   * Generate HMAC authentication header for Veracode API
   */
  _generateHmacAuthHeader(requestConfig) {
    const method = requestConfig.method.toUpperCase();
    const url = new URL(requestConfig.url, requestConfig.baseURL);
    const urlPath = url.pathname + url.search;
    
    // Generate nonce and timestamp
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    
    // Create data string for HMAC
    const dataString = `id=${this.apiId}&host=${url.host}&url=${urlPath}&method=${method}`;
    const dataWithNonce = `${dataString}&timestamp=${timestamp}&nonce=${nonce}`;
    
    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', Buffer.from(this.apiKey, 'hex'))
      .update(dataWithNonce)
      .digest('hex');
    
    return `VERACODE-HMAC-SHA-256 id=${this.apiId},timestamp=${timestamp},nonce=${nonce},signature=${signature}`;
  }

  /**
   * Test API connection and authentication
   */
  async testConnection() {
    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/applications')
      );
      
      if (!response.data) {
        throw new Error('Authentication failed - invalid credentials');
      }

      return {
        success: true,
        applicationsCount: response.data._embedded?.applications?.length || 0,
        authenticated: true
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error(`Veracode authentication failed: Invalid API credentials`);
      }
      throw new Error(`Veracode connection test failed: ${error.message}`);
    }
  }

  /**
   * Get applications accessible to the authenticated user
   */
  async getApplications(filters = {}) {
    await this.ensureAuthenticated();
    
    const params = {
      size: filters.limit || 100,
      page: filters.page || 0
    };

    if (filters.name) params.name = filters.name;
    if (filters.business_criticality) params.business_criticality = filters.business_criticality;
    if (filters.tags) params.tags = filters.tags;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get('/applications', { params })
      );

      return {
        applications: response.data._embedded?.applications || [],
        page: response.data.page,
        totalApplications: response.data.page?.total_elements || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }
  }

  /**
   * Get application security analysis data
   */
  async getApplicationAnalysis(applicationId, options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get application details
      const appResponse = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/applications/${applicationId}`)
      );

      // Get latest scan results
      const scansResponse = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/applications/${applicationId}/scans`, {
          params: { 
            size: options.scanLimit || 10,
            scan_type: options.scanType || 'STATIC'
          }
        })
      );

      // Get findings for the latest scan if available
      const scans = scansResponse.data._embedded?.scans || [];
      let findings = [];
      let scanDetails = null;

      if (scans.length > 0) {
        const latestScan = scans[0];
        scanDetails = latestScan;

        try {
          const findingsResponse = await this.executeWithRateLimit(() => 
            this.httpClient.get(`/applications/${applicationId}/findings`, {
              params: {
                size: options.findingsLimit || 500,
                scan_type: 'STATIC'
              }
            })
          );
          findings = findingsResponse.data._embedded?.findings || [];
        } catch (findingsError) {
          console.warn(`Could not fetch findings: ${findingsError.message}`);
        }
      }

      return {
        application: appResponse.data,
        scans: scans,
        latestScan: scanDetails,
        findings: findings,
        summary: {
          totalFindings: findings.length,
          highSeverity: findings.filter(f => f.finding_details?.severity === 'HIGH').length,
          mediumSeverity: findings.filter(f => f.finding_details?.severity === 'MEDIUM').length,
          lowSeverity: findings.filter(f => f.finding_details?.severity === 'LOW').length
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch application analysis: ${error.message}`);
    }
  }

  /**
   * Get detailed findings for a specific scan
   */
  async getScanFindings(applicationId, scanId, options = {}) {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/applications/${applicationId}/findings`, {
          params: {
            scan_id: scanId,
            size: options.limit || 1000,
            page: options.page || 0,
            violates_policy: options.violatesPolicy,
            finding_status: options.findingStatus
          }
        })
      );

      return {
        findings: response.data._embedded?.findings || [],
        page: response.data.page,
        totalFindings: response.data.page?.total_elements || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch scan findings: ${error.message}`);
    }
  }

  /**
   * Get application policy compliance information
   */
  async getApplicationPolicy(applicationId) {
    await this.ensureAuthenticated();

    try {
      const response = await this.executeWithRateLimit(() => 
        this.httpClient.get(`/applications/${applicationId}/policy`)
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch application policy: ${error.message}`);
    }
  }

  /**
   * Get application security metrics and trends
   */
  async getApplicationMetrics(applicationId, options = {}) {
    await this.ensureAuthenticated();

    try {
      // Get current security metrics
      const analysisData = await this.getApplicationAnalysis(applicationId, options);
      const findings = analysisData.findings || [];

      // Calculate security metrics
      const totalFindings = findings.length;
      const criticalFindings = findings.filter(f => f.finding_details?.severity === 'VERY_HIGH').length;
      const highFindings = findings.filter(f => f.finding_details?.severity === 'HIGH').length;
      const mediumFindings = findings.filter(f => f.finding_details?.severity === 'MEDIUM').length;
      const lowFindings = findings.filter(f => f.finding_details?.severity === 'LOW').length;

      // Calculate security score (0-100, higher is better)
      const securityScore = totalFindings === 0 ? 100 : 
        Math.max(0, 100 - (criticalFindings * 25 + highFindings * 15 + mediumFindings * 5 + lowFindings * 1));

      // Policy compliance
      let policyCompliance = null;
      try {
        const policyData = await this.getApplicationPolicy(applicationId);
        policyCompliance = {
          compliant: policyData.compliant || false,
          policyName: policyData.policy_name,
          rulesViolated: policyData.rules_violated || 0
        };
      } catch (policyError) {
        console.warn(`Could not fetch policy compliance: ${policyError.message}`);
      }

      return {
        applicationId,
        metrics: {
          securityScore,
          totalFindings,
          criticalFindings,
          highFindings,
          mediumFindings,
          lowFindings,
          policyCompliance
        },
        scans: analysisData.scans,
        lastScanDate: analysisData.latestScan?.created_date,
        application: analysisData.application
      };
    } catch (error) {
      throw new Error(`Failed to fetch application metrics: ${error.message}`);
    }
  }

  /**
   * Search applications by name or criteria
   */
  async searchApplications(searchTerm, filters = {}) {
    const applications = await this.getApplications({ limit: 500, ...filters });
    
    // Client-side filtering
    const filtered = applications.applications.filter(app => {
      const matchesSearch = !searchTerm || 
        app.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.profile?.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCriticality = !filters.business_criticality || 
        app.profile?.business_criticality === filters.business_criticality;
        
      return matchesSearch && matchesCriticality;
    });

    return {
      applications: filtered,
      totalCount: filtered.length
    };
  }

  /**
   * Execute request with rate limiting and retry logic
   */
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

  /**
   * Ensure client is authenticated
   */
  async ensureAuthenticated() {
    if (!this.authenticated || !this.httpClient) {
      await this.initialize();
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get client configuration status
   */
  getConfigurationStatus() {
    return {
      apiUrl: this.config.apiUrl,
      authenticated: this.authenticated,
      rateLimit: this.config.rateLimit,
      requestCount: this.requestCount,
      requestsRemaining: Math.max(0, this.config.rateLimit - this.requestCount),
      rateLimitResetTime: new Date(this.lastReset + 3600000).toISOString(),
      apiId: this.apiId ? `${this.apiId.substring(0, 8)}...` : null
    };
  }
}

module.exports = VeracodeClient;