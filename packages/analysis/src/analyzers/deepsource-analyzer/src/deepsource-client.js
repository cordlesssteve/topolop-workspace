const { GraphQLClient } = require('graphql-request');
const axios = require('axios');

/**
 * DeepSource GraphQL API Client
 * 
 * Handles communication with DeepSource's GraphQL API for AI-powered code analysis.
 * Supports comprehensive analysis data retrieval including issues, metrics, and automated fixes.
 */
class DeepSourceClient {
  constructor(config = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.deepsource.io/graphql/',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      rateLimit: config.rateLimit || 5000, // 5000 requests per hour
      ...config
    };

    this.client = null;
    this.authenticated = false;
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  /**
   * Initialize client with authentication
   */
  async initialize() {
    const token = this.config.token || process.env.DEEPSOURCE_TOKEN;
    
    if (!token) {
      throw new Error('DeepSource token required. Set DEEPSOURCE_TOKEN environment variable or pass token in config.');
    }

    this.client = new GraphQLClient(this.config.apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout
    });

    // Test authentication
    await this.testConnection();
    this.authenticated = true;
  }

  /**
   * Test API connection and authentication
   */
  async testConnection() {
    const query = `
      query {
        viewer {
          id
          username
        }
      }
    `;

    try {
      const response = await this.client.request(query);
      
      if (!response.viewer) {
        throw new Error('Authentication failed - invalid token');
      }

      return {
        success: true,
        user: response.viewer.username,
        userId: response.viewer.id
      };
    } catch (error) {
      throw new Error(`DeepSource connection test failed: ${error.message}`);
    }
  }

  /**
   * Get repositories accessible to the authenticated user
   */
  async getRepositories(filters = {}) {
    await this.ensureAuthenticated();
    
    const query = `
      query($first: Int, $after: String) {
        viewer {
          repositories(first: $first, after: $after) {
            edges {
              node {
                id
                name
                fullName
                description
                isPrivate
                defaultBranch
                language {
                  name
                }
                account {
                  id
                  name
                  type
                }
                createdAt
                updatedAt
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const variables = {
      first: filters.limit || 50,
      after: filters.cursor || null
    };

    try {
      const response = await this.executeWithRateLimit(() => 
        this.client.request(query, variables)
      );

      return {
        repositories: response.viewer.repositories.edges.map(edge => edge.node),
        pageInfo: response.viewer.repositories.pageInfo
      };
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Get repository analysis data including issues and metrics
   */
  async getRepositoryAnalysis(repositoryId, options = {}) {
    await this.ensureAuthenticated();

    const query = `
      query($repositoryId: ID!, $first: Int, $after: String, $branch: String) {
        node(id: $repositoryId) {
          ... on Repository {
            id
            name
            fullName
            defaultBranch
            
            analysisRuns(first: $first, after: $after, branch: $branch) {
              edges {
                node {
                  id
                  branch
                  commitOid
                  createdAt
                  status
                  summary {
                    issuesIntroduced
                    issuesResolved
                    occurrencesIntroduced
                    occurrencesResolved
                  }
                  
                  issues(first: 100) {
                    edges {
                      node {
                        id
                        title
                        description
                        category
                        severity
                        location {
                          path
                          position {
                            beginLine
                            beginColumn
                            endLine
                            endColumn
                          }
                        }
                        analyzer {
                          name
                          shortcode
                        }
                        autofix {
                          available
                          title
                          description
                        }
                        tags
                        createdAt
                      }
                    }
                  }
                  
                  metrics {
                    coverage {
                      percentage
                      linesTotal
                      linesCovered
                    }
                    quality {
                      grade
                      value
                    }
                    security {
                      grade  
                      value
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
            
            checks(first: 10) {
              edges {
                node {
                  id
                  name
                  status
                  analyzer {
                    name
                    shortcode
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      repositoryId,
      first: options.limit || 10,
      after: options.cursor || null,
      branch: options.branch || null
    };

    try {
      const response = await this.executeWithRateLimit(() => 
        this.client.request(query, variables)
      );

      if (!response.node) {
        throw new Error('Repository not found or access denied');
      }

      return response.node;
    } catch (error) {
      throw new Error(`Failed to fetch repository analysis: ${error.message}`);
    }
  }

  /**
   * Get specific analysis run details
   */
  async getAnalysisRun(analysisRunId) {
    await this.ensureAuthenticated();

    const query = `
      query($analysisRunId: ID!) {
        node(id: $analysisRunId) {
          ... on AnalysisRun {
            id
            branch
            commitOid
            createdAt
            status
            
            summary {
              issuesIntroduced
              issuesResolved
              occurrencesIntroduced
              occurrencesResolved
            }
            
            issues(first: 1000) {
              edges {
                node {
                  id
                  title
                  description
                  category
                  severity
                  location {
                    path
                    position {
                      beginLine
                      beginColumn
                      endLine
                      endColumn
                    }
                  }
                  analyzer {
                    name
                    shortcode
                  }
                  autofix {
                    available
                    title
                    description
                  }
                  tags
                  createdAt
                }
              }
            }
            
            metrics {
              coverage {
                percentage
                linesTotal
                linesCovered
              }
              quality {
                grade
                value
              }
              security {
                grade  
                value
              }
            }
            
            repository {
              id
              name
              fullName
            }
          }
        }
      }
    `;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.client.request(query, { analysisRunId })
      );

      if (!response.node) {
        throw new Error('Analysis run not found or access denied');
      }

      return response.node;
    } catch (error) {
      throw new Error(`Failed to fetch analysis run: ${error.message}`);
    }
  }

  /**
   * Get repository metrics history
   */
  async getRepositoryMetrics(repositoryId, options = {}) {
    await this.ensureAuthenticated();

    const query = `
      query($repositoryId: ID!, $from: DateTime, $to: DateTime, $branch: String) {
        node(id: $repositoryId) {
          ... on Repository {
            id
            name
            
            metricsHistory(from: $from, to: $to, branch: $branch) {
              timestamp
              coverage {
                percentage
                linesTotal
                linesCovered
              }
              quality {
                grade
                value
              }
              security {
                grade  
                value
              }
            }
            
            currentMetrics: analysisRuns(first: 1, branch: $branch) {
              edges {
                node {
                  metrics {
                    coverage {
                      percentage
                      linesTotal
                      linesCovered
                    }
                    quality {
                      grade
                      value
                    }
                    security {
                      grade  
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      repositoryId,
      from: options.from || null,
      to: options.to || null,
      branch: options.branch || null
    };

    try {
      const response = await this.executeWithRateLimit(() => 
        this.client.request(query, variables)
      );

      if (!response.node) {
        throw new Error('Repository not found or access denied');
      }

      return {
        repository: {
          id: response.node.id,
          name: response.node.name
        },
        metricsHistory: response.node.metricsHistory || [],
        currentMetrics: response.node.currentMetrics.edges[0]?.node?.metrics || null
      };
    } catch (error) {
      throw new Error(`Failed to fetch repository metrics: ${error.message}`);
    }
  }

  /**
   * Search repositories by name or organization
   */
  async searchRepositories(searchTerm, filters = {}) {
    const repositories = await this.getRepositories({ limit: 100 });
    
    // Client-side filtering since GraphQL API might not have search
    const filtered = repositories.repositories.filter(repo => {
      const matchesSearch = !searchTerm || 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesLanguage = !filters.language || 
        (repo.language && repo.language.name.toLowerCase() === filters.language.toLowerCase());
      
      const matchesPrivacy = filters.isPrivate === undefined || 
        repo.isPrivate === filters.isPrivate;
        
      return matchesSearch && matchesLanguage && matchesPrivacy;
    });

    return {
      repositories: filtered,
      totalCount: filtered.length
    };
  }

  /**
   * Get autofix suggestions for an issue
   */
  async getAutofixSuggestions(issueId) {
    await this.ensureAuthenticated();

    const query = `
      query($issueId: ID!) {
        node(id: $issueId) {
          ... on Issue {
            id
            title
            description
            autofix {
              available
              title
              description
              diff
              confidence
            }
          }
        }
      }
    `;

    try {
      const response = await this.executeWithRateLimit(() => 
        this.client.request(query, { issueId })
      );

      if (!response.node) {
        throw new Error('Issue not found or access denied');
      }

      return response.node.autofix;
    } catch (error) {
      throw new Error(`Failed to fetch autofix suggestions: ${error.message}`);
    }
  }

  /**
   * Execute query with rate limiting
   */
  async executeWithRateLimit(queryFunction) {
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
        return await queryFunction();
      } catch (error) {
        lastError = error;
        
        // Don't retry authentication errors
        if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
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
    if (!this.authenticated || !this.client) {
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
      rateLimitResetTime: new Date(this.lastReset + 3600000).toISOString()
    };
  }
}

module.exports = DeepSourceClient;