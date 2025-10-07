/**
 * Veracode Data Mapper
 * 
 * Maps Veracode enterprise security analysis data to Topolop's unified Layer 2 data model.
 * Handles application security findings, policy compliance, and enterprise security metrics.
 */

class VeracodeMapper {
  constructor(options = {}) {
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      includePolicyData: options.includePolicyData !== false,
      includeHistoricalData: options.includeHistoricalData !== false,
      ...options
    };
  }

  /**
   * Map Veracode application analysis to unified data model
   */
  mapApplicationAnalysis(analysisData, options = {}) {
    const { application, findings, scans, summary } = analysisData;
    
    return {
      // Layer 2 Unified Model Schema
      source: 'veracode',
      analysisType: 'enterprise-security',
      timestamp: new Date().toISOString(),
      
      // Project/Application Information
      project: {
        id: application.id,
        name: application.profile?.name || 'Unknown Application',
        description: application.profile?.description || '',
        type: 'application',
        language: this._extractLanguage(application),
        framework: this._extractFramework(application),
        version: application.profile?.version || '1.0.0',
        
        // Enterprise Security Metrics
        metrics: {
          securityScore: this._calculateSecurityScore(findings),
          policyCompliance: this._getPolicyCompliance(analysisData.policyData),
          riskRating: this._calculateRiskRating(application, findings),
          businessCriticality: application.profile?.business_criticality || 'MEDIUM',
          lastScanDate: scans[0]?.created_date,
          scanFrequency: this._calculateScanFrequency(scans),
          
          // Vulnerability Statistics
          totalFindings: summary?.totalFindings || 0,
          criticalFindings: this._countBySeverity(findings, 'VERY_HIGH'),
          highFindings: summary?.highSeverity || 0,
          mediumFindings: summary?.mediumSeverity || 0,
          lowFindings: summary?.lowSeverity || 0,
          
          // Enterprise Metrics
          policyViolations: this._countPolicyViolations(findings),
          remediationEffort: this._estimateRemediationEffort(findings),
          complianceStatus: this._getComplianceStatus(analysisData.policyData),
          
          // Trend Data
          findingsTrend: this._calculateFindingsTrend(scans),
          securityTrend: this._calculateSecurityTrend(scans)
        }
      },

      // Files with security findings
      files: this._mapFilesToUnifiedModel(findings, application),
      
      // Security Issues/Findings
      issues: this._mapFindingsToIssues(findings),
      
      // City Visualization Data
      cityVisualization: this._generateCityVisualization(application, findings, scans),
      
      // Enterprise-specific data
      enterprise: {
        applicationProfile: {
          businessUnit: application.profile?.business_unit,
          teams: application.profile?.teams || [],
          tags: application.profile?.tags || [],
          businessCriticality: application.profile?.business_criticality,
          industry: application.profile?.industry
        },
        scanHistory: this._mapScanHistory(scans),
        policyFramework: this._mapPolicyFramework(analysisData.policyData),
        complianceReporting: this._generateComplianceReport(findings, analysisData.policyData)
      },

      // Metadata
      metadata: this.options.includeMetadata ? {
        processingTime: Date.now(),
        dataVersion: '2.0',
        schemaVersion: 'unified-v2',
        source: 'veracode-enterprise',
        capabilities: ['security', 'policy-compliance', 'enterprise-reporting', 'vulnerability-management']
      } : null
    };
  }

  /**
   * Map findings to unified file model
   */
  _mapFilesToUnifiedModel(findings, application) {
    const fileMap = new Map();

    findings.forEach(finding => {
      const filePath = finding.finding_details?.file_path || 'unknown';
      const lineNumber = finding.finding_details?.file_line_number || 1;

      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          path: filePath,
          name: filePath.split('/').pop() || 'unknown',
          type: this._getFileType(filePath),
          language: this._detectLanguageFromPath(filePath),
          
          // Security metrics for this file
          metrics: {
            securityScore: 0,
            findingCount: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
            policyViolations: 0,
            remediationComplexity: 0
          },
          
          // Issues in this file
          issues: [],
          
          // City visualization attributes
          cityAttributes: {
            buildingHeight: 1,
            buildingCondition: 'good',
            securityZone: 'secure',
            riskLevel: 'low',
            complianceStatus: 'compliant'
          }
        });
      }

      const file = fileMap.get(filePath);
      file.issues.push({
        id: finding.issue_id,
        line: lineNumber,
        severity: this._normalizeSeverity(finding.finding_details?.severity),
        category: finding.finding_details?.cwe?.name || 'Security',
        description: finding.finding_details?.finding_category?.name || 'Security vulnerability'
      });

      // Update file metrics
      file.metrics.findingCount++;
      this._updateFileMetricsBySeverity(file.metrics, finding.finding_details?.severity);
    });

    // Convert map to array and finalize metrics
    return Array.from(fileMap.values()).map(file => {
      file.metrics.securityScore = this._calculateFileSecurityScore(file.metrics);
      file.cityAttributes = this._updateFileCityAttributes(file);
      return file;
    });
  }

  /**
   * Map Veracode findings to unified issues model
   */
  _mapFindingsToIssues(findings) {
    return findings.map(finding => ({
      id: finding.issue_id?.toString() || finding.guid,
      title: finding.finding_details?.finding_category?.name || 'Security Finding',
      description: this._buildIssueDescription(finding),
      
      // Severity and categorization
      severity: this._normalizeSeverity(finding.finding_details?.severity),
      category: 'security',
      type: finding.finding_details?.finding_category?.name || 'vulnerability',
      
      // Location information
      location: {
        file: finding.finding_details?.file_path,
        line: finding.finding_details?.file_line_number,
        column: finding.finding_details?.file_column_number,
        function: finding.finding_details?.procedure || null
      },
      
      // Security-specific data
      security: {
        cwe: {
          id: finding.finding_details?.cwe?.id,
          name: finding.finding_details?.cwe?.name,
          description: finding.finding_details?.cwe?.description
        },
        owasp: this._mapToOWASP(finding.finding_details?.cwe?.id),
        attackVector: this._determineAttackVector(finding),
        exploitability: this._assessExploitability(finding),
        businessImpact: this._assessBusinessImpact(finding)
      },
      
      // Policy and compliance
      policy: {
        violatesPolicy: finding.violates_policy || false,
        policyRule: finding.policy_rule_name,
        complianceFrameworks: this._getComplianceFrameworks(finding)
      },
      
      // Remediation information
      remediation: {
        effort: this._estimateRemediationEffort([finding]),
        priority: this._calculateRemediationPriority(finding),
        guidance: finding.finding_details?.remediation_guidance || 'Review security vulnerability',
        automatedFix: false // Veracode doesn't provide automated fixes
      },
      
      // Temporal data
      temporal: {
        firstFound: finding.first_found_date,
        lastSeen: finding.last_seen_date,
        scanId: finding.scan_id,
        status: finding.finding_status?.resolution_status || 'NEW'
      },

      // Enterprise tracking
      enterprise: {
        applicationId: finding.context?.application?.id,
        buildId: finding.context?.build?.id,
        scanType: finding.scan_type,
        analysisEngine: 'Veracode SAST',
        businessUnit: finding.context?.application?.profile?.business_unit,
        assignedTo: finding.assigned_to,
        dueDate: finding.due_date
      }
    }));
  }

  /**
   * Generate city visualization data for Veracode security analysis
   */
  _generateCityVisualization(application, findings, scans) {
    const fileFindings = this._groupFindingsByFile(findings);
    const securityMetrics = this._calculateSecurityMetrics(findings);

    return {
      // City Layout (Enterprise Security Focus)
      layout: {
        type: 'enterprise-security-city',
        theme: 'corporate-security',
        zoning: 'security-compliance'
      },

      // Buildings (Files with security context)
      buildings: Object.entries(fileFindings).map(([filePath, fileFindings]) => ({
        id: `file-${Buffer.from(filePath).toString('base64').substring(0, 12)}`,
        name: filePath.split('/').pop(),
        position: this._calculateBuildingPosition(filePath, fileFindings),
        
        // Security-based building attributes
        height: Math.max(1, fileFindings.length * 2), // Height based on finding count
        condition: this._getBuildingConditionFromFindings(fileFindings),
        securityLevel: this._getSecurityLevel(fileFindings),
        complianceStatus: this._getFileComplianceStatus(fileFindings),
        
        // Visual indicators
        color: this._getBuildingColorFromSecurity(fileFindings),
        highlights: this._getBuildingHighlights(fileFindings),
        alerts: this._getBuildingSecurityAlerts(fileFindings)
      })),

      // Districts (Application/Module grouping)
      districts: this._generateSecurityDistricts(application, fileFindings),

      // Security Infrastructure (Enterprise security view)
      infrastructure: {
        securityPerimeter: {
          strength: securityMetrics.overallSecurityScore,
          breaches: securityMetrics.criticalFindings,
          monitoring: scans.length > 0 ? 'active' : 'inactive'
        },
        complianceZones: this._generateComplianceZones(findings),
        riskAreas: this._identifyHighRiskAreas(fileFindings),
        securityServices: {
          sast: 'active',
          policyEnforcement: 'active',
          vulnerabilityManagement: 'active',
          complianceReporting: 'active'
        }
      },

      // Enterprise Security Overlays
      overlays: {
        securityHeatMap: this._generateSecurityHeatMap(fileFindings),
        policyComplianceMap: this._generatePolicyComplianceMap(findings),
        riskAssessmentMap: this._generateRiskAssessmentMap(fileFindings),
        remediationPriorityMap: this._generateRemediationPriorityMap(findings),
        businessImpactMap: this._generateBusinessImpactMap(application, findings)
      },

      // Interactive Elements
      interactions: {
        drillDownToFindings: true,
        policyViolationDetails: true,
        remediationWorkflow: true,
        complianceReporting: true,
        executiveDashboard: true
      }
    };
  }

  // Helper methods for city visualization
  _generateSecurityDistricts(application, fileFindings) {
    const districts = new Map();
    
    Object.keys(fileFindings).forEach(filePath => {
      const pathParts = filePath.split('/');
      const district = pathParts.slice(0, -1).join('/') || 'root';
      
      if (!districts.has(district)) {
        districts.set(district, {
          id: district,
          name: district.split('/').pop() || 'Root',
          type: 'security-district',
          securityLevel: 'pending',
          findingCount: 0,
          riskLevel: 'low'
        });
      }
      
      const districtData = districts.get(district);
      districtData.findingCount += fileFindings[filePath].length;
      districtData.securityLevel = this._calculateDistrictSecurityLevel(fileFindings[filePath]);
      districtData.riskLevel = this._calculateDistrictRiskLevel(fileFindings[filePath]);
    });

    return Array.from(districts.values());
  }

  // Utility methods for data processing
  _calculateSecurityScore(findings) {
    if (!findings || findings.length === 0) return 100;
    
    const totalFindings = findings.length;
    const criticalWeight = 25;
    const highWeight = 15;
    const mediumWeight = 5;
    const lowWeight = 1;

    const weightedScore = findings.reduce((score, finding) => {
      const severity = finding.finding_details?.severity;
      switch (severity) {
        case 'VERY_HIGH': return score - criticalWeight;
        case 'HIGH': return score - highWeight;
        case 'MEDIUM': return score - mediumWeight;
        case 'LOW': return score - lowWeight;
        default: return score - lowWeight;
      }
    }, 100);

    return Math.max(0, Math.min(100, weightedScore));
  }

  _normalizeSeverity(veracodeSeverity) {
    const severityMap = {
      'VERY_HIGH': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
      'INFORMATIONAL': 'info'
    };
    return severityMap[veracodeSeverity] || 'medium';
  }

  _buildIssueDescription(finding) {
    const category = finding.finding_details?.finding_category?.name || 'Security Issue';
    const cwe = finding.finding_details?.cwe?.name;
    const description = finding.finding_details?.description;
    
    let desc = `${category}`;
    if (cwe) desc += ` (${cwe})`;
    if (description) desc += `: ${description}`;
    
    return desc;
  }

  _extractLanguage(application) {
    // Extract from application metadata or scanning results
    return application.profile?.language || 'unknown';
  }

  _extractFramework(application) {
    return application.profile?.framework || 'unknown';
  }

  _countBySeverity(findings, severity) {
    return findings.filter(f => f.finding_details?.severity === severity).length;
  }

  _getPolicyCompliance(policyData) {
    if (!policyData) return null;
    return {
      compliant: policyData.compliant || false,
      policyName: policyData.policy_name,
      violatedRules: policyData.rules_violated || 0
    };
  }

  _calculateRiskRating(application, findings) {
    const criticalCount = this._countBySeverity(findings, 'VERY_HIGH');
    const highCount = this._countBySeverity(findings, 'HIGH');
    const businessCriticality = application.profile?.business_criticality;

    if (criticalCount > 0 || businessCriticality === 'VERY_HIGH') return 'very-high';
    if (highCount > 2 || businessCriticality === 'HIGH') return 'high';
    if (highCount > 0 || businessCriticality === 'MEDIUM') return 'medium';
    return 'low';
  }

  _groupFindingsByFile(findings) {
    const fileGroups = {};
    findings.forEach(finding => {
      const filePath = finding.finding_details?.file_path || 'unknown';
      if (!fileGroups[filePath]) fileGroups[filePath] = [];
      fileGroups[filePath].push(finding);
    });
    return fileGroups;
  }

  _calculateSecurityMetrics(findings) {
    return {
      overallSecurityScore: this._calculateSecurityScore(findings),
      totalFindings: findings.length,
      criticalFindings: this._countBySeverity(findings, 'VERY_HIGH'),
      highFindings: this._countBySeverity(findings, 'HIGH'),
      mediumFindings: this._countBySeverity(findings, 'MEDIUM'),
      lowFindings: this._countBySeverity(findings, 'LOW')
    };
  }

  _generateSecurityHeatMap(fileFindings) {
    return Object.entries(fileFindings).map(([filePath, findings]) => ({
      file: filePath,
      intensity: Math.min(100, findings.length * 10),
      riskLevel: this._calculateFileRiskLevel(findings)
    }));
  }

  _calculateFileRiskLevel(findings) {
    const criticalCount = findings.filter(f => f.finding_details?.severity === 'VERY_HIGH').length;
    const highCount = findings.filter(f => f.finding_details?.severity === 'HIGH').length;
    
    if (criticalCount > 0) return 'critical';
    if (highCount > 1) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }

  // Additional helper methods would continue here...
  // (Abbreviated for length - full implementation would include all referenced methods)
}

module.exports = VeracodeMapper;