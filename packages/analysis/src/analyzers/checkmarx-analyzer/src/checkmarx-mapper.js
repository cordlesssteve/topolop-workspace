/**
 * Checkmarx Data Mapper
 * 
 * Maps Checkmarx comprehensive SAST analysis data to Topolop's unified Layer 2 data model.
 * Handles complex vulnerability analysis, proprietary format parsing, and enterprise SAST metrics.
 */

class CheckmarxMapper {
  constructor(options = {}) {
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      includeScanHistory: options.includeScanHistory !== false,
      includeFlowAnalysis: options.includeFlowAnalysis !== false,
      ...options
    };
  }

  /**
   * Map Checkmarx project analysis to unified data model
   */
  mapProjectAnalysis(analysisData, options = {}) {
    const { project, scans, latestScan, scanResults, summary } = analysisData;
    
    return {
      // Layer 2 Unified Model Schema
      source: 'checkmarx',
      analysisType: 'comprehensive-sast',
      timestamp: new Date().toISOString(),
      
      // Project Information
      project: {
        id: project.id,
        name: project.name,
        description: project.description || '',
        type: 'codebase',
        language: this._extractPrimaryLanguage(scanResults),
        framework: this._extractFramework(project, scanResults),
        version: '1.0.0',
        
        // Comprehensive SAST Metrics
        metrics: {
          sastScore: this._calculateSastScore(summary),
          vulnerabilityDensity: this._calculateVulnerabilityDensity(summary, scanResults),
          codeQualityScore: this._calculateCodeQualityScore(summary),
          securityPosture: this._assessSecurityPosture(summary),
          riskRating: this._calculateRiskRating(summary, project),
          
          // Vulnerability Statistics
          totalVulnerabilities: summary?.totalVulnerabilities || 0,
          highSeverity: summary?.highSeverity || 0,
          mediumSeverity: summary?.mediumSeverity || 0,
          lowSeverity: summary?.lowSeverity || 0,
          infoSeverity: summary?.infoSeverity || 0,
          
          // Scan Metrics
          lastScanDate: latestScan?.dateAndTime?.finishedOn,
          scanDuration: this._calculateScanDuration(latestScan),
          linesOfCode: latestScan?.scanStatistics?.linesOfCode || 0,
          filesScanned: latestScan?.scanStatistics?.filesCount || 0,
          
          // SAST-specific Metrics
          cweCategories: this._extractCweCategories(scanResults),
          owaspTop10: this._mapToOwaspTop10(scanResults),
          complexityIndicators: this._analyzeComplexity(scanResults),
          dataFlowIssues: this._countDataFlowIssues(scanResults),
          
          // Historical Trends
          vulnerabilityTrend: this._calculateVulnerabilityTrend(scans),
          remedationEffort: this._estimateRemediationEffort(summary, scanResults)
        }
      },

      // Files with SAST findings
      files: this._mapFilesToUnifiedModel(scanResults, project),
      
      // Security Vulnerabilities
      issues: this._mapVulnerabilitiesToIssues(scanResults),
      
      // City Visualization Data
      cityVisualization: this._generateCityVisualization(project, scanResults, scans),
      
      // Checkmarx-specific data
      checkmarx: {
        scanDetails: {
          scanId: latestScan?.id,
          presetName: latestScan?.preset,
          engineConfiguration: latestScan?.engineConfiguration,
          scanType: latestScan?.isIncremental ? 'incremental' : 'full',
          scanStatistics: latestScan?.scanStatistics
        },
        projectConfiguration: {
          teamId: project.teamId,
          teamName: project.teamName,
          isPublic: project.isPublic,
          customFields: project.customFields || {}
        },
        scanHistory: this._mapScanHistory(scans),
        queryLanguageAnalysis: this._analyzeQueryLanguageResults(scanResults)
      },

      // Metadata
      metadata: this.options.includeMetadata ? {
        processingTime: Date.now(),
        dataVersion: '2.0',
        schemaVersion: 'unified-v2',
        source: 'checkmarx-sast',
        capabilities: ['comprehensive-sast', 'data-flow', 'control-flow', 'taint-analysis', 'query-language']
      } : null
    };
  }

  /**
   * Map scan results to unified file model
   */
  _mapFilesToUnifiedModel(scanResults, project) {
    const fileMap = new Map();
    const results = scanResults?.results || [];

    results.forEach(vulnerability => {
      const sourceNode = vulnerability.path?.nodes?.[0] || {};
      const filePath = sourceNode.fileName || 'unknown';
      const line = sourceNode.line || 1;

      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          path: filePath,
          name: filePath.split(/[/\\]/).pop() || 'unknown',
          type: this._getFileType(filePath),
          language: this._detectLanguageFromPath(filePath),
          
          // SAST metrics for this file
          metrics: {
            sastScore: 0,
            vulnerabilityCount: 0,
            highVulnerabilities: 0,
            mediumVulnerabilities: 0,
            lowVulnerabilities: 0,
            cweCategories: new Set(),
            complexityScore: 0,
            dataFlowIssues: 0,
            controlFlowIssues: 0
          },
          
          // Vulnerabilities in this file
          issues: [],
          
          // City visualization attributes
          cityAttributes: {
            buildingHeight: 1,
            buildingCondition: 'good',
            securityLevel: 'secure',
            sastRating: 'A',
            riskIndicator: 'low'
          }
        });
      }

      const file = fileMap.get(filePath);
      file.issues.push({
        id: vulnerability.vulnerabilityId,
        line: line,
        severity: this._normalizeSeverity(vulnerability.severity),
        category: vulnerability.queryName,
        description: vulnerability.resultDescription || vulnerability.queryName,
        cwe: vulnerability.cweId
      });

      // Update file metrics
      file.metrics.vulnerabilityCount++;
      this._updateFileMetricsBySeverity(file.metrics, vulnerability.severity);
      if (vulnerability.cweId) {
        file.metrics.cweCategories.add(vulnerability.cweId);
      }
      
      // Analyze data flow complexity
      if (vulnerability.path?.nodes?.length > 2) {
        file.metrics.dataFlowIssues++;
      }
    });

    // Convert map to array and finalize metrics
    return Array.from(fileMap.values()).map(file => {
      file.metrics.sastScore = this._calculateFileSastScore(file.metrics);
      file.metrics.cweCategories = Array.from(file.metrics.cweCategories);
      file.cityAttributes = this._updateFileCityAttributes(file);
      return file;
    });
  }

  /**
   * Map Checkmarx vulnerabilities to unified issues model
   */
  _mapVulnerabilitiesToIssues(scanResults) {
    const results = scanResults?.results || [];
    
    return results.map(vulnerability => ({
      id: vulnerability.vulnerabilityId?.toString() || vulnerability.pathId,
      title: vulnerability.queryName || 'Security Vulnerability',
      description: this._buildVulnerabilityDescription(vulnerability),
      
      // Severity and categorization
      severity: this._normalizeSeverity(vulnerability.severity),
      category: 'security',
      type: this._categorizeVulnerabilityType(vulnerability),
      
      // Location information (source node)
      location: this._extractSourceLocation(vulnerability.path),
      
      // SAST-specific data
      sast: {
        queryName: vulnerability.queryName,
        queryId: vulnerability.queryId,
        queryVersionCode: vulnerability.queryVersionCode,
        language: vulnerability.detectionDetails?.language,
        group: vulnerability.group,
        status: vulnerability.state,
        assignedUser: vulnerability.assignedUser,
        comment: vulnerability.comment
      },
      
      // Security standards mapping
      security: {
        cwe: {
          id: vulnerability.cweId,
          name: this._getCweName(vulnerability.cweId),
          description: this._getCweDescription(vulnerability.cweId)
        },
        owasp: this._mapToOwaspCategory(vulnerability.cweId, vulnerability.queryName),
        sans25: this._mapToSans25(vulnerability.cweId),
        severity: vulnerability.severity,
        confidenceLevel: this._assessConfidenceLevel(vulnerability)
      },
      
      // Data flow analysis
      dataFlow: {
        hasDataFlow: !!(vulnerability.path?.nodes?.length > 1),
        pathLength: vulnerability.path?.nodes?.length || 0,
        sourceNode: this._mapPathNode(vulnerability.path?.nodes?.[0]),
        sinkNode: this._mapPathNode(vulnerability.path?.nodes?.[vulnerability.path?.nodes?.length - 1]),
        dataFlowPath: this._mapDataFlowPath(vulnerability.path),
        taintAnalysis: this._analyzeTaintFlow(vulnerability.path)
      },
      
      // Remediation information
      remediation: {
        effort: this._estimateRemediationEffort([vulnerability]),
        priority: this._calculateRemediationPriority(vulnerability),
        guidance: this._generateRemediationGuidance(vulnerability),
        automatedFix: false, // Checkmarx doesn't provide automated fixes
        similarityId: vulnerability.similarityId
      },
      
      // Temporal and tracking data
      temporal: {
        firstDetectionDate: vulnerability.firstDetectionDate,
        status: vulnerability.state,
        statusDetails: vulnerability.statusDetails,
        lastModified: vulnerability.lastModified
      },

      // Enterprise tracking
      enterprise: {
        projectId: vulnerability.projectId,
        scanId: vulnerability.scanId,
        resultId: vulnerability.resultId,
        pathId: vulnerability.pathId,
        assignedTo: vulnerability.assignedUser,
        falsePositive: vulnerability.state === 'Not Exploitable',
        riskAccepted: vulnerability.state === 'Confirmed',
        auditSession: vulnerability.auditSessionId
      }
    }));
  }

  /**
   * Generate city visualization data for Checkmarx SAST analysis
   */
  _generateCityVisualization(project, scanResults, scans) {
    const results = scanResults?.results || [];
    const fileVulnerabilities = this._groupVulnerabilitiesByFile(results);
    const sastMetrics = this._calculateSastMetrics(results);

    return {
      // City Layout (Comprehensive SAST Focus)
      layout: {
        type: 'comprehensive-sast-city',
        theme: 'enterprise-security',
        zoning: 'vulnerability-analysis'
      },

      // Buildings (Files with SAST context)
      buildings: Object.entries(fileVulnerabilities).map(([filePath, vulnerabilities]) => ({
        id: `file-${Buffer.from(filePath).toString('base64').substring(0, 12)}`,
        name: filePath.split(/[/\\]/).pop(),
        position: this._calculateBuildingPosition(filePath, vulnerabilities),
        
        // SAST-based building attributes
        height: Math.max(1, vulnerabilities.length * 1.5), // Height based on vulnerability count
        condition: this._getBuildingConditionFromVulnerabilities(vulnerabilities),
        sastRating: this._getSastRating(vulnerabilities),
        securityLevel: this._getSecurityLevel(vulnerabilities),
        
        // Visual indicators
        color: this._getBuildingColorFromSast(vulnerabilities),
        highlights: this._getBuildingHighlights(vulnerabilities),
        alerts: this._getBuildingSastAlerts(vulnerabilities),
        dataFlowIndicators: this._getDataFlowIndicators(vulnerabilities)
      })),

      // Districts (Module/Package grouping with SAST focus)
      districts: this._generateSastDistricts(project, fileVulnerabilities),

      // SAST Infrastructure
      infrastructure: {
        sastEngine: {
          version: 'CxSAST',
          queriesCount: this._getUniqueQueriesCount(results),
          languagesAnalyzed: this._getLanguagesAnalyzed(results),
          analysisDepth: 'comprehensive'
        },
        securityFramework: {
          cweSupport: true,
          owaspMapping: true,
          sans25Mapping: true,
          customQueries: this._hasCustomQueries(results)
        },
        dataFlowAnalysis: {
          enabled: true,
          pathAnalysis: 'multi-hop',
          taintTracking: 'advanced',
          controlFlowAnalysis: 'comprehensive'
        }
      },

      // SAST-specific Overlays
      overlays: {
        vulnerabilityHeatMap: this._generateVulnerabilityHeatMap(fileVulnerabilities),
        dataFlowMap: this._generateDataFlowMap(results),
        cweDistributionMap: this._generateCweDistributionMap(results),
        owaspTop10Map: this._generateOwaspTop10Map(results),
        complexityMap: this._generateComplexityMap(fileVulnerabilities),
        remedationPriorityMap: this._generateRemediationPriorityMap(results)
      },

      // Interactive Elements
      interactions: {
        drillDownToVulnerabilities: true,
        dataFlowVisualization: true,
        cweExplorer: true,
        remediationWorkflow: true,
        similarityAnalysis: true,
        auditWorkflow: true
      }
    };
  }

  // Helper methods for comprehensive SAST analysis
  _calculateSastScore(summary) {
    if (!summary || summary.totalVulnerabilities === 0) return 100;
    
    const totalVulns = summary.totalVulnerabilities;
    const highWeight = 20;
    const mediumWeight = 10;
    const lowWeight = 2;
    const infoWeight = 0.5;

    const weightedScore = 100 - (
      (summary.highSeverity * highWeight) +
      (summary.mediumSeverity * mediumWeight) +
      (summary.lowSeverity * lowWeight) +
      (summary.infoSeverity * infoWeight)
    );

    return Math.max(0, Math.min(100, Math.round(weightedScore)));
  }

  _normalizeSeverity(checkmarxSeverity) {
    const severityMap = {
      'High': 'high',
      'Medium': 'medium', 
      'Low': 'low',
      'Info': 'info',
      'Information': 'info'
    };
    return severityMap[checkmarxSeverity] || 'medium';
  }

  _buildVulnerabilityDescription(vulnerability) {
    let desc = vulnerability.queryName || 'Security Vulnerability';
    
    if (vulnerability.cweId) {
      desc += ` (CWE-${vulnerability.cweId})`;
    }
    
    if (vulnerability.resultDescription) {
      desc += `: ${vulnerability.resultDescription}`;
    }

    return desc;
  }

  _extractSourceLocation(path) {
    const sourceNode = path?.nodes?.[0];
    if (!sourceNode) return null;

    return {
      file: sourceNode.fileName,
      line: sourceNode.line,
      column: sourceNode.column,
      method: sourceNode.method,
      object: sourceNode.domType
    };
  }

  _mapDataFlowPath(path) {
    if (!path?.nodes) return [];

    return path.nodes.map((node, index) => ({
      step: index + 1,
      file: node.fileName,
      line: node.line,
      column: node.column,
      method: node.method,
      type: node.domType,
      name: node.name,
      length: node.length
    }));
  }

  _analyzeTaintFlow(path) {
    if (!path?.nodes || path.nodes.length < 2) return null;

    const sourceNode = path.nodes[0];
    const sinkNode = path.nodes[path.nodes.length - 1];

    return {
      source: {
        type: sourceNode.domType,
        method: sourceNode.method,
        isUserControlled: this._isUserControlledSource(sourceNode)
      },
      sink: {
        type: sinkNode.domType,
        method: sinkNode.method,
        isSensitive: this._isSensitiveSink(sinkNode)
      },
      pathComplexity: path.nodes.length,
      sanitizationPoints: this._identifySanitizationPoints(path.nodes)
    };
  }

  _categorizeVulnerabilityType(vulnerability) {
    const queryName = vulnerability.queryName?.toLowerCase() || '';
    
    if (queryName.includes('injection')) return 'injection';
    if (queryName.includes('xss') || queryName.includes('cross-site')) return 'xss';
    if (queryName.includes('path') || queryName.includes('traversal')) return 'path-traversal';
    if (queryName.includes('buffer') || queryName.includes('overflow')) return 'buffer-overflow';
    if (queryName.includes('authentication') || queryName.includes('authorization')) return 'access-control';
    if (queryName.includes('crypto') || queryName.includes('encryption')) return 'cryptographic';
    if (queryName.includes('race') || queryName.includes('condition')) return 'concurrency';
    
    return 'security-vulnerability';
  }

  _extractPrimaryLanguage(scanResults) {
    const languages = new Map();
    const results = scanResults?.results || [];
    
    results.forEach(vuln => {
      const lang = vuln.detectionDetails?.language;
      if (lang) {
        languages.set(lang, (languages.get(lang) || 0) + 1);
      }
    });

    if (languages.size === 0) return 'unknown';
    
    return Array.from(languages.entries())
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  _groupVulnerabilitiesByFile(results) {
    const fileGroups = {};
    results.forEach(vulnerability => {
      const filePath = vulnerability.path?.nodes?.[0]?.fileName || 'unknown';
      if (!fileGroups[filePath]) fileGroups[filePath] = [];
      fileGroups[filePath].push(vulnerability);
    });
    return fileGroups;
  }

  _calculateSastMetrics(results) {
    return {
      totalVulnerabilities: results.length,
      highSeverity: results.filter(r => r.severity === 'High').length,
      mediumSeverity: results.filter(r => r.severity === 'Medium').length,
      lowSeverity: results.filter(r => r.severity === 'Low').length,
      infoSeverity: results.filter(r => r.severity === 'Info' || r.severity === 'Information').length,
      uniqueQueries: new Set(results.map(r => r.queryId)).size,
      dataFlowVulnerabilities: results.filter(r => r.path?.nodes?.length > 1).length
    };
  }

  _generateVulnerabilityHeatMap(fileVulnerabilities) {
    return Object.entries(fileVulnerabilities).map(([filePath, vulnerabilities]) => ({
      file: filePath,
      intensity: Math.min(100, vulnerabilities.length * 5),
      riskLevel: this._calculateFileRiskLevel(vulnerabilities),
      vulnerabilityDensity: vulnerabilities.length
    }));
  }

  _calculateFileRiskLevel(vulnerabilities) {
    const highCount = vulnerabilities.filter(v => v.severity === 'High').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'Medium').length;
    
    if (highCount > 2) return 'critical';
    if (highCount > 0) return 'high';
    if (mediumCount > 2) return 'medium';
    return 'low';
  }

  // Additional helper methods would continue here...
  // (Abbreviated for length - full implementation would include all referenced methods)

  _updateFileMetricsBySeverity(metrics, severity) {
    switch (severity) {
      case 'High':
        metrics.highVulnerabilities++;
        break;
      case 'Medium':
        metrics.mediumVulnerabilities++;
        break;
      case 'Low':
        metrics.lowVulnerabilities++;
        break;
    }
  }

  _getFileType(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'java': 'java',
      'py': 'python',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go'
    };
    return typeMap[extension] || 'source';
  }

  _detectLanguageFromPath(filePath) {
    return this._getFileType(filePath);
  }

  _calculateFileSastScore(metrics) {
    if (metrics.vulnerabilityCount === 0) return 100;
    
    const score = 100 - (
      metrics.highVulnerabilities * 15 +
      metrics.mediumVulnerabilities * 8 +
      metrics.lowVulnerabilities * 3
    );
    
    return Math.max(0, Math.min(100, score));
  }

  _updateFileCityAttributes(file) {
    const score = file.metrics.sastScore;
    const vulnCount = file.metrics.vulnerabilityCount;
    
    return {
      buildingHeight: Math.max(1, vulnCount),
      buildingCondition: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
      securityLevel: vulnCount === 0 ? 'secure' : vulnCount < 3 ? 'moderate' : 'vulnerable',
      sastRating: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      riskIndicator: file.metrics.highVulnerabilities > 0 ? 'high' : 
                     file.metrics.mediumVulnerabilities > 2 ? 'medium' : 'low'
    };
  }
}

module.exports = CheckmarxMapper;