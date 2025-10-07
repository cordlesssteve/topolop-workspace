/**
 * DeepSource Data Mapper
 * 
 * Maps DeepSource GraphQL API analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor with focus on AI-powered insights,
 * automated fixes, and comprehensive code quality analysis.
 */

class DeepSourceMapper {
  constructor() {
    // DeepSource severity to unified severity mapping
    this.severityMapping = {
      'critical': 'critical',
      'major': 'high',
      'minor': 'medium',
      'info': 'low'
    };

    // DeepSource category to unified issue types mapping
    this.categoryMapping = {
      'security': 'security',
      'bug-risk': 'bug',
      'performance': 'performance',
      'antipattern': 'maintainability',
      'style': 'style',
      'documentation': 'documentation',
      'type-check': 'bug',
      'test': 'testing'
    };

    // DeepSource grade to numeric score mapping
    this.gradeToScore = {
      'A+': 100, 'A': 95, 'A-': 90,
      'B+': 85, 'B': 80, 'B-': 75,
      'C+': 70, 'C': 65, 'C-': 60,
      'D+': 55, 'D': 50, 'D-': 45,
      'F': 25
    };

    // Default mappings
    this.defaultSeverity = 'medium';
    this.defaultCategory = 'quality';
  }

  /**
   * Map complete DeepSource repository analysis to unified data model
   */
  mapRepositoryAnalysis(deepsourceData, metadata = {}) {
    const { analysisRuns, checks, name, fullName, id } = deepsourceData;
    
    // Get latest analysis run
    const latestAnalysis = analysisRuns?.edges?.[0]?.node;
    if (!latestAnalysis) {
      throw new Error('No analysis runs found for repository');
    }

    const issues = this._extractIssuesFromAnalysis(latestAnalysis);
    const metrics = this._extractMetricsFromAnalysis(latestAnalysis);

    return {
      // Layer 2 unified data model structure
      source: 'deepsource',
      sourceVersion: metadata.apiVersion || '1.0.0',
      analyzedAt: latestAnalysis.createdAt || new Date().toISOString(),
      
      // Project-level data
      project: {
        key: this._generateProjectKey(fullName || name),
        name: this._extractProjectName(fullName || name),
        path: metadata.localPath || fullName,
        repository: {
          id: id,
          fullName: fullName,
          defaultBranch: deepsourceData.defaultBranch
        },
        metrics: this._calculateProjectMetrics(latestAnalysis, issues),
        overallRating: this._calculateOverallRating(metrics)
      },

      // File-level data extracted from issues
      files: this._mapIssuesToFiles(issues, latestAnalysis),
      
      // Issue-level data
      issues: this._mapIssuesToUnifiedFormat(issues),
      
      // DeepSource-specific analysis data
      analysisRun: {
        id: latestAnalysis.id,
        branch: latestAnalysis.branch,
        commitOid: latestAnalysis.commitOid,
        status: latestAnalysis.status,
        summary: latestAnalysis.summary
      },
      
      // City visualization mapping
      cityVisualization: this._generateCityVisualization(deepsourceData, latestAnalysis, issues),
      
      // DeepSource-specific data for detailed analysis
      deepsourceData: {
        repositoryId: id,
        analysisRunId: latestAnalysis.id,
        checks: this._mapChecksData(checks),
        autofixCapabilities: this._analyzeAutofixCapabilities(issues),
        aiInsights: this._extractAIInsights(issues),
        qualityTrends: this._extractQualityTrends(latestAnalysis)
      }
    };
  }

  /**
   * Calculate comprehensive project metrics from DeepSource data
   */
  _calculateProjectMetrics(analysisRun, issues) {
    const metrics = analysisRun.metrics || {};
    const summary = analysisRun.summary || {};
    
    // Calculate scores from DeepSource grades
    const qualityScore = this._gradeToNumericScore(metrics.quality?.grade);
    const securityScore = this._gradeToNumericScore(metrics.security?.grade);
    const coverageScore = metrics.coverage?.percentage || 0;
    
    // Calculate issue distribution
    const issueBySeverity = this._groupIssuesBySeverity(issues);
    const issueByCategory = this._groupIssuesByCategory(issues);
    
    // Calculate AI-powered metrics
    const autofixableIssues = issues.filter(issue => issue.autofix?.available).length;
    const autofixPercentage = issues.length > 0 ? Math.round((autofixableIssues / issues.length) * 100) : 0;
    
    return {
      // Core metrics
      totalFindings: issues.length,
      criticalFindings: issueBySeverity.critical || 0,
      highFindings: issueBySeverity.high || 0,
      mediumFindings: issueBySeverity.medium || 0,
      lowFindings: issueBySeverity.low || 0,
      
      // DeepSource-specific metrics
      qualityScore: qualityScore,
      securityScore: securityScore,
      coverageScore: Math.round(coverageScore),
      overallScore: Math.round((qualityScore + securityScore + coverageScore) / 3),
      
      // AI-powered metrics
      autofixableIssues: autofixableIssues,
      autofixPercentage: autofixPercentage,
      aiRecommendations: this._countAIRecommendations(issues),
      
      // Analysis summary metrics
      issuesIntroduced: summary.issuesIntroduced || 0,
      issuesResolved: summary.issuesResolved || 0,
      occurrencesIntroduced: summary.occurrencesIntroduced || 0,
      occurrencesResolved: summary.occurrencesResolved || 0,
      
      // Category breakdown
      securityFindings: issueByCategory.security || 0,
      bugRiskFindings: issueByCategory.bug || 0,
      performanceFindings: issueByCategory.performance || 0,
      maintainabilityFindings: issueByCategory.maintainability || 0,
      styleFindings: issueByCategory.style || 0,
      
      // Coverage metrics (if available)
      coveragePercentage: coverageScore,
      linesTotal: metrics.coverage?.linesTotal || 0,
      linesCovered: metrics.coverage?.linesCovered || 0,
      linesUncovered: (metrics.coverage?.linesTotal || 0) - (metrics.coverage?.linesCovered || 0)
    };
  }

  /**
   * Map issues to file-level data for city visualization
   */
  _mapIssuesToFiles(issues, analysisRun) {
    const fileMap = new Map();
    
    issues.forEach(issue => {
      if (!issue.location?.path) return;
      
      const filePath = issue.location.path;
      
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          path: filePath,
          name: this._extractFileName(filePath),
          type: 'file',
          language: this._detectLanguageFromPath(filePath),
          size: 1, // Will be updated with actual metrics if available
          metrics: {
            issueCount: 0,
            criticalIssues: 0,
            autofixableIssues: 0,
            qualityScore: 100,
            securityScore: 100,
            aiRecommendations: 0
          },
          issues: []
        });
      }
      
      const file = fileMap.get(filePath);
      file.issues.push(issue);
      file.metrics.issueCount++;
      
      // Update metrics based on issue
      if (issue.severity === 'critical') file.metrics.criticalIssues++;
      if (issue.autofix?.available) file.metrics.autofixableIssues++;
      if (issue.autofix?.available) file.metrics.aiRecommendations++;
      
      // Update quality scores (inverse relationship with issues)
      const issueWeight = this._getIssueWeight(issue.severity);
      file.metrics.qualityScore = Math.max(0, file.metrics.qualityScore - issueWeight);
      
      if (issue.category === 'security') {
        file.metrics.securityScore = Math.max(0, file.metrics.securityScore - issueWeight * 2);
      }
    });
    
    return Array.from(fileMap.values());
  }

  /**
   * Map DeepSource issues to unified issue format
   */
  _mapIssuesToUnifiedFormat(issues) {
    return issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      severity: this._mapSeverity(issue.severity),
      type: this._mapCategory(issue.category),
      component: issue.location?.path || 'unknown',
      file: issue.location?.path,
      line: issue.location?.position?.beginLine || 0,
      column: issue.location?.position?.beginColumn || 0,
      endLine: issue.location?.position?.endLine || 0,
      endColumn: issue.location?.position?.endColumn || 0,
      
      // DeepSource-specific issue data
      deepsourceData: {
        id: issue.id,
        category: issue.category,
        severity: issue.severity,
        analyzer: issue.analyzer ? {
          name: issue.analyzer.name,
          shortcode: issue.analyzer.shortcode
        } : null,
        autofix: issue.autofix ? {
          available: issue.autofix.available,
          title: issue.autofix.title,
          description: issue.autofix.description,
          confidence: issue.autofix.confidence
        } : null,
        tags: issue.tags || [],
        createdAt: issue.createdAt,
        location: issue.location
      }
    }));
  }

  /**
   * Generate city visualization data with AI-powered insights
   */
  _generateCityVisualization(repositoryData, analysisRun, issues) {
    // Group issues by analyzer/category for districts
    const analyzerGroups = this._groupIssuesByAnalyzer(issues);
    
    const districts = Object.keys(analyzerGroups).map(analyzerName => {
      const analyzerIssues = analyzerGroups[analyzerName];
      const autofixableCount = analyzerIssues.filter(i => i.autofix?.available).length;
      
      return {
        id: analyzerName.toLowerCase().replace(/\s+/g, '-'),
        name: analyzerName,
        type: 'analyzer',
        
        // District metrics
        metrics: {
          issueCount: analyzerIssues.length,
          autofixableIssues: autofixableCount,
          autofixPercentage: analyzerIssues.length > 0 ? Math.round((autofixableCount / analyzerIssues.length) * 100) : 0,
          aiCapability: autofixableCount > 0 ? 'high' : 'medium'
        },
        
        // Visual properties for city
        size: Math.max(analyzerIssues.length, 3),
        condition: this._calculateDistrictCondition(analyzerIssues),
        zoning: this._calculateDistrictZoning(analyzerIssues)
      };
    });
    
    // Infrastructure represents AI and automation capabilities
    const infrastructure = {
      ai: {
        autofixCapability: this._calculateAutofixCapability(issues),
        recommendationEngine: this._calculateRecommendationEngine(issues),
        overallAIHealth: this._calculateOverallAIHealth(analysisRun, issues)
      },
      
      quality: {
        overallGrade: analysisRun.metrics?.quality?.grade || 'C',
        overallScore: this._gradeToNumericScore(analysisRun.metrics?.quality?.grade),
        trendDirection: this._calculateQualityTrend(analysisRun)
      },
      
      security: {
        overallGrade: analysisRun.metrics?.security?.grade || 'C',
        overallScore: this._gradeToNumericScore(analysisRun.metrics?.security?.grade),
        criticalIssues: issues.filter(i => i.severity === 'critical' && i.category === 'security').length
      },
      
      coverage: {
        percentage: analysisRun.metrics?.coverage?.percentage || 0,
        linesTotal: analysisRun.metrics?.coverage?.linesTotal || 0,
        linesCovered: analysisRun.metrics?.coverage?.linesCovered || 0
      },
      
      // City infrastructure zoning based on issue types and AI capabilities
      zoning: {
        aiPowered: [], // Areas with high autofix capability
        traditional: [], // Areas with manual fix requirements
        secure: [], // Low security risk areas
        monitoring: [] // Areas needing attention
      }
    };
    
    return {
      districts,
      infrastructure,
      
      // Overall city metrics
      cityMetrics: {
        totalBuildings: this._countUniqueFiles(issues),
        aiEnhancedBuildings: this._countFilesWithAutofix(issues),
        traditionalBuildings: this._countUniqueFiles(issues) - this._countFilesWithAutofix(issues),
        
        overallRating: this._calculateOverallRating(analysisRun.metrics),
        aiCapabilityRating: this._calculateAICapabilityRating(issues),
        automationLevel: this._calculateAutomationLevel(issues)
      }
    };
  }

  /**
   * Helper methods for calculations and mappings
   */

  _extractIssuesFromAnalysis(analysisRun) {
    return analysisRun.issues?.edges?.map(edge => edge.node) || [];
  }

  _extractMetricsFromAnalysis(analysisRun) {
    return analysisRun.metrics || {};
  }

  _generateProjectKey(fullName) {
    if (!fullName) return 'unknown-project';
    return fullName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  _extractProjectName(fullName) {
    if (!fullName) return 'Unknown Project';
    return fullName.split('/').pop() || fullName;
  }

  _mapSeverity(deepsourceSeverity) {
    return this.severityMapping[deepsourceSeverity?.toLowerCase()] || this.defaultSeverity;
  }

  _mapCategory(deepsourceCategory) {
    return this.categoryMapping[deepsourceCategory?.toLowerCase()] || this.defaultCategory;
  }

  _gradeToNumericScore(grade) {
    if (!grade) return 65; // Default C grade
    return this.gradeToScore[grade] || 65;
  }

  _calculateOverallRating(metrics) {
    if (!metrics) return 'C';
    
    // Use quality grade as primary indicator, fallback to calculated average
    if (metrics.quality?.grade) {
      return metrics.quality.grade;
    }
    
    // Calculate from numeric scores
    const qualityScore = this._gradeToNumericScore(metrics.quality?.grade);
    const securityScore = this._gradeToNumericScore(metrics.security?.grade);
    const avgScore = (qualityScore + securityScore) / 2;
    
    if (avgScore >= 95) return 'A+';
    if (avgScore >= 90) return 'A';
    if (avgScore >= 85) return 'A-';
    if (avgScore >= 80) return 'B+';
    if (avgScore >= 75) return 'B';
    if (avgScore >= 70) return 'B-';
    if (avgScore >= 65) return 'C+';
    if (avgScore >= 60) return 'C';
    if (avgScore >= 55) return 'C-';
    return 'D';
  }

  _groupIssuesBySeverity(issues) {
    return issues.reduce((groups, issue) => {
      const severity = this._mapSeverity(issue.severity);
      groups[severity] = (groups[severity] || 0) + 1;
      return groups;
    }, {});
  }

  _groupIssuesByCategory(issues) {
    return issues.reduce((groups, issue) => {
      const category = this._mapCategory(issue.category);
      groups[category] = (groups[category] || 0) + 1;
      return groups;
    }, {});
  }

  _groupIssuesByAnalyzer(issues) {
    return issues.reduce((groups, issue) => {
      const analyzerName = issue.analyzer?.name || 'Unknown Analyzer';
      if (!groups[analyzerName]) groups[analyzerName] = [];
      groups[analyzerName].push(issue);
      return groups;
    }, {});
  }

  _countAIRecommendations(issues) {
    return issues.filter(issue => issue.autofix?.available).length;
  }

  _extractFileName(filePath) {
    return filePath.split('/').pop() || filePath;
  }

  _detectLanguageFromPath(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python', 'pyi': 'python',
      'java': 'java', 'kt': 'kotlin', 'scala': 'scala',
      'go': 'go', 'rs': 'rust', 'rb': 'ruby',
      'php': 'php', 'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'c': 'c', 'h': 'c', 'cs': 'csharp',
      'swift': 'swift', 'sh': 'shell', 'bash': 'shell',
      'yml': 'yaml', 'yaml': 'yaml', 'json': 'json',
      'html': 'html', 'css': 'css', 'scss': 'scss',
      'sql': 'sql', 'r': 'r', 'dart': 'dart'
    };
    
    return languageMap[extension] || 'unknown';
  }

  _getIssueWeight(severity) {
    const weights = {
      'critical': 20,
      'high': 10,
      'medium': 5,
      'low': 2
    };
    return weights[severity] || 5;
  }

  _mapChecksData(checks) {
    return checks?.edges?.map(edge => ({
      id: edge.node.id,
      name: edge.node.name,
      status: edge.node.status,
      analyzer: edge.node.analyzer ? {
        name: edge.node.analyzer.name,
        shortcode: edge.node.analyzer.shortcode
      } : null
    })) || [];
  }

  _analyzeAutofixCapabilities(issues) {
    const totalIssues = issues.length;
    const autofixableIssues = issues.filter(i => i.autofix?.available).length;
    
    return {
      totalIssues: totalIssues,
      autofixableIssues: autofixableIssues,
      autofixPercentage: totalIssues > 0 ? Math.round((autofixableIssues / totalIssues) * 100) : 0,
      highConfidenceAutofixes: issues.filter(i => i.autofix?.confidence === 'high').length,
      categories: this._groupAutofixesByCategory(issues)
    };
  }

  _groupAutofixesByCategory(issues) {
    const autofixableIssues = issues.filter(i => i.autofix?.available);
    return this._groupIssuesByCategory(autofixableIssues);
  }

  _extractAIInsights(issues) {
    return {
      aiGeneratedRecommendations: issues.filter(i => i.autofix?.available).length,
      intelligentPatternDetection: this._countIntelligentPatterns(issues),
      automatedFixSuggestions: this._categorizeFixSuggestions(issues),
      aiConfidenceDistribution: this._analyzeAIConfidence(issues)
    };
  }

  _countIntelligentPatterns(issues) {
    // Count issues that show intelligent pattern detection (multiple related issues)
    const patternMap = new Map();
    issues.forEach(issue => {
      const pattern = `${issue.analyzer?.shortcode || 'unknown'}-${issue.category}`;
      patternMap.set(pattern, (patternMap.get(pattern) || 0) + 1);
    });
    
    return Array.from(patternMap.entries()).filter(([pattern, count]) => count > 1).length;
  }

  _categorizeFixSuggestions(issues) {
    const autofixableIssues = issues.filter(i => i.autofix?.available);
    return {
      automated: autofixableIssues.filter(i => i.autofix?.confidence === 'high').length,
      assisted: autofixableIssues.filter(i => i.autofix?.confidence === 'medium').length,
      suggested: autofixableIssues.filter(i => i.autofix?.confidence === 'low').length
    };
  }

  _analyzeAIConfidence(issues) {
    const autofixableIssues = issues.filter(i => i.autofix?.available);
    const confidenceGroups = autofixableIssues.reduce((groups, issue) => {
      const confidence = issue.autofix?.confidence || 'unknown';
      groups[confidence] = (groups[confidence] || 0) + 1;
      return groups;
    }, {});
    
    return confidenceGroups;
  }

  _extractQualityTrends(analysisRun) {
    const summary = analysisRun.summary || {};
    return {
      issuesIntroduced: summary.issuesIntroduced || 0,
      issuesResolved: summary.issuesResolved || 0,
      netChange: (summary.issuesResolved || 0) - (summary.issuesIntroduced || 0),
      trend: this._calculateTrendDirection(summary)
    };
  }

  _calculateTrendDirection(summary) {
    const netChange = (summary.issuesResolved || 0) - (summary.issuesIntroduced || 0);
    if (netChange > 0) return 'improving';
    if (netChange < 0) return 'declining';
    return 'stable';
  }

  _calculateDistrictCondition(issues) {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const autofixableCount = issues.filter(i => i.autofix?.available).length;
    const autofixPercentage = issues.length > 0 ? (autofixableCount / issues.length) : 0;
    
    if (criticalCount === 0 && autofixPercentage > 0.8) return 'excellent';
    if (criticalCount === 0 && autofixPercentage > 0.5) return 'good';
    if (criticalCount === 0 && autofixPercentage > 0.2) return 'fair';
    if (criticalCount > 0 && autofixPercentage > 0.5) return 'poor';
    return 'critical';
  }

  _calculateDistrictZoning(issues) {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const securityCount = issues.filter(i => i.category === 'security').length;
    const autofixableCount = issues.filter(i => i.autofix?.available).length;
    
    if (autofixableCount > issues.length * 0.8) return 'aiPowered';
    if (criticalCount > 0 || securityCount > 0) return 'monitoring';
    if (autofixableCount > 0) return 'traditional';
    return 'secure';
  }

  _calculateAutofixCapability(issues) {
    const autofixableCount = issues.filter(i => i.autofix?.available).length;
    const totalCount = issues.length;
    
    if (totalCount === 0) return 'unknown';
    
    const percentage = (autofixableCount / totalCount) * 100;
    if (percentage >= 80) return 'excellent';
    if (percentage >= 60) return 'good';
    if (percentage >= 40) return 'fair';
    if (percentage >= 20) return 'poor';
    return 'minimal';
  }

  _calculateRecommendationEngine(issues) {
    const recommendationCount = issues.filter(i => 
      i.autofix?.available || (i.tags && i.tags.length > 0)
    ).length;
    
    return {
      totalRecommendations: recommendationCount,
      aiPoweredRecommendations: issues.filter(i => i.autofix?.available).length,
      capability: recommendationCount > issues.length * 0.5 ? 'high' : 'medium'
    };
  }

  _calculateOverallAIHealth(analysisRun, issues) {
    const qualityScore = this._gradeToNumericScore(analysisRun.metrics?.quality?.grade);
    const autofixPercentage = issues.length > 0 ? 
      (issues.filter(i => i.autofix?.available).length / issues.length * 100) : 0;
    
    const aiHealth = (qualityScore + autofixPercentage) / 2;
    
    if (aiHealth >= 85) return 'excellent';
    if (aiHealth >= 70) return 'good';
    if (aiHealth >= 55) return 'fair';
    return 'needs-improvement';
  }

  _calculateQualityTrend(analysisRun) {
    return this._calculateTrendDirection(analysisRun.summary || {});
  }

  _countUniqueFiles(issues) {
    const filePaths = new Set(issues.map(i => i.location?.path).filter(Boolean));
    return filePaths.size;
  }

  _countFilesWithAutofix(issues) {
    const autofixFiles = new Set(
      issues.filter(i => i.autofix?.available)
        .map(i => i.location?.path)
        .filter(Boolean)
    );
    return autofixFiles.size;
  }

  _calculateAICapabilityRating(issues) {
    const autofixPercentage = issues.length > 0 ? 
      (issues.filter(i => i.autofix?.available).length / issues.length * 100) : 0;
    
    if (autofixPercentage >= 90) return 'A+';
    if (autofixPercentage >= 80) return 'A';
    if (autofixPercentage >= 70) return 'B+';
    if (autofixPercentage >= 60) return 'B';
    if (autofixPercentage >= 50) return 'C+';
    if (autofixPercentage >= 40) return 'C';
    return 'D';
  }

  _calculateAutomationLevel(issues) {
    const totalIssues = issues.length;
    const highConfidenceAutofixes = issues.filter(i => 
      i.autofix?.available && i.autofix?.confidence === 'high'
    ).length;
    
    if (totalIssues === 0) return 0;
    return Math.round((highConfidenceAutofixes / totalIssues) * 100);
  }
}

module.exports = DeepSourceMapper;