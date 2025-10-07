/**
 * GitHub CodeQL Data Mapper
 * 
 * Maps CodeQL SARIF analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor defined in STRATEGY.md
 * Handles SARIF (Static Analysis Results Interchange Format) parsing.
 */

class CodeQLMapper {
  constructor() {
    // SARIF level to unified severity mapping
    this.severityMapping = {
      'error': 'critical',
      'warning': 'high',
      'note': 'medium',
      'info': 'low'
    };

    // CodeQL query categories to unified issue types
    this.categoryMapping = {
      'security': 'security',
      'correctness': 'bug', 
      'maintainability': 'maintainability',
      'performance': 'performance',
      'style': 'style',
      'reliability': 'bug',
      'external': 'security' // External dependencies/supply chain
    };

    // Default mappings
    this.defaultCategory = 'security'; // CodeQL is primarily security-focused
    this.defaultSeverity = 'medium';
  }

  /**
   * Map complete CodeQL analysis results to unified data model
   */
  mapAnalysisResults(codeqlData) {
    const { sourcePath, language, database, analysis, metadata } = codeqlData;
    const sarifData = analysis.sarifData;
    const results = analysis.results || [];

    return {
      // Layer 2 unified data model structure
      source: 'github-codeql',
      sourceVersion: sarifData.runs?.[0]?.tool?.driver?.version || '1.0.0',
      analyzedAt: metadata.analyzedAt,
      
      // Project-level data
      project: {
        key: this._generateProjectKey(sourcePath),
        name: this._extractProjectName(sourcePath),
        path: sourcePath,
        language: language,
        metrics: this._calculateProjectMetrics(results, sarifData),
        overallRating: this._calculateOverallRating(results)
      },

      // File-level data (buildings in city metaphor)
      files: this._mapFiles(results, sarifData),
      
      // Issues mapped to city attributes  
      issues: this._mapIssues(results, sarifData),
      
      // City visualization mapping
      cityVisualization: this._generateCityMapping(results, sarifData, language),
      
      // Temporal data for 4D visualization
      temporal: {
        analysisHistory: [], // CodeQL doesn't provide history in single run
        lastAnalysis: metadata.analyzedAt,
        databaseInfo: {
          created: database.created,
          reused: database.reused,
          language: language
        }
      },

      // Raw metadata and analysis info
      metadata: {
        ...metadata,
        databasePath: analysis.databasePath,
        outputFile: analysis.outputFile,
        toolInfo: sarifData.runs?.[0]?.tool?.driver || {},
        totalFindings: results.length,
        queries: metadata.queries || [],
        executionTime: metadata.executionTime,
        processingTime: new Date().toISOString()
      }
    };
  }

  /**
   * Map CodeQL SARIF results to unified issues format
   */
  _mapIssues(results, sarifData) {
    if (!results || results.length === 0) {
      return [];
    }

    const driver = sarifData.runs?.[0]?.tool?.driver || {};
    const rules = this._buildRulesMap(driver.rules || []);

    return results.map((result, index) => {
      const rule = rules[result.ruleId] || {};
      const location = this._extractPrimaryLocation(result.locations);

      return {
        id: `codeql-${result.ruleId}-${index}`,
        type: this._mapCategory(result, rule),
        severity: this._mapSeverity(result, rule),
        component: location.file,
        rule: {
          key: result.ruleId,
          name: rule.name || result.ruleId,
          description: rule.fullDescription?.text || rule.shortDescription?.text
        },
        message: result.message?.text || 'CodeQL finding',
        location: {
          file: location.file,
          line: location.startLine,
          column: location.startColumn,
          endLine: location.endLine,
          endColumn: location.endColumn
        },
        effort: this._calculateEffort(result, rule),
        categories: this._extractCategories(result, rule),
        fingerprint: this._generateFingerprint(result),
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // CodeQL-specific data
        codeqlData: {
          ruleId: result.ruleId,
          queryPath: rule.properties?.queryPath,
          precision: rule.properties?.precision || 'medium',
          queryURI: rule.properties?.queryURI,
          kind: rule.properties?.kind,
          cwe: this._extractCWE(result, rule),
          tags: rule.properties?.tags || [],
          semanticModel: true, // CodeQL uses semantic analysis
          dataFlow: this._hasDataFlowAnalysis(result),
          controlFlow: this._hasControlFlowAnalysis(result)
        }
      };
    });
  }

  /**
   * Map files with CodeQL semantic analysis data
   */
  _mapFiles(results, sarifData) {
    const fileMap = new Map();
    
    // Extract unique files from results
    results.forEach(result => {
      const location = this._extractPrimaryLocation(result.locations);
      const filePath = location.file;
      
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          id: filePath,
          name: filePath.split('/').pop(),
          path: filePath,
          type: this._getFileType(filePath),
          metrics: {
            linesOfCode: 0, // Not provided by CodeQL
            semanticFindings: 0,
            securityFindings: 0,
            qualityFindings: 0
          },
          issues: [],
          cityAttributes: {
            buildingHeight: 10, // Default small building
            buildingCondition: 'excellent',
            securityLevel: 'secure',
            constructionAge: 'recent',
            trafficLevel: 'low',
            semanticComplexity: 'low' // CodeQL-specific: semantic complexity
          }
        });
      }
      
      const file = fileMap.get(filePath);
      const issue = {
        id: result.ruleId,
        type: this._mapCategory(result),
        severity: this._mapSeverity(result),
        message: result.message?.text || 'CodeQL finding',
        line: location.startLine
      };
      
      file.issues.push(issue);
      file.metrics.semanticFindings++;
      
      if (issue.type === 'security') file.metrics.securityFindings++;
      if (['maintainability', 'style'].includes(issue.type)) file.metrics.qualityFindings++;
    });

    // Calculate city attributes for each file
    const files = Array.from(fileMap.values());
    files.forEach(file => {
      file.cityAttributes = this._calculateFileAttributes(file);
    });

    return files;
  }

  /**
   * Generate city visualization mapping with semantic analysis focus
   */
  _generateCityMapping(results, sarifData, language) {
    const files = this._mapFiles(results, sarifData);
    const districts = this._groupFilesIntoDistricts(files);
    
    return {
      metaphor: 'city',
      districts: districts.map(district => ({
        id: district.name,
        name: district.name,
        files: district.files,
        overallCondition: this._calculateDistrictCondition(district.files),
        securityLevel: this._calculateDistrictSecurity(district.files),
        semanticComplexity: this._calculateDistrictComplexity(district.files)
      })),
      
      infrastructure: {
        roads: this._generateRoadNetwork(files, results),
        utilities: this._generateUtilities(results, language),
        zoning: this._generateZoning(files, results),
        dataFlows: this._generateDataFlowVisualization(results) // CodeQL-specific
      },
      
      overlays: {
        security: this._generateSecurityOverlay(files, results),
        semantic: this._generateSemanticOverlay(results), // CodeQL-specific
        dataFlow: this._generateDataFlowOverlay(results), // CodeQL-specific
        vulnerability: this._generateVulnerabilityOverlay(results),
        complexity: this._generateComplexityOverlay(files)
      }
    };
  }

  /**
   * Calculate project-level metrics from CodeQL results
   */
  _calculateProjectMetrics(results, sarifData) {
    const totalFindings = results.length;
    const securityFindings = results.filter(r => this._mapCategory(r) === 'security').length;
    const criticalFindings = results.filter(r => this._mapSeverity(r) === 'critical').length;
    const rules = sarifData.runs?.[0]?.tool?.driver?.rules || [];
    
    return {
      totalFindings: totalFindings,
      securityFindings: securityFindings,
      criticalFindings: criticalFindings,
      rulesExecuted: rules.length,
      semanticAnalysis: true, // CodeQL always does semantic analysis
      semanticScore: this._calculateSemanticScore(results),
      securityScore: this._calculateSecurityScore(results),
      findingsDensity: 0, // Cannot calculate without LOC
      dataFlowFindings: results.filter(r => this._hasDataFlowAnalysis(r)).length,
      controlFlowFindings: results.filter(r => this._hasControlFlowAnalysis(r)).length
    };
  }

  /**
   * Calculate overall project rating based on CodeQL findings
   */
  _calculateOverallRating(results) {
    const totalFindings = results.length;
    const criticalFindings = results.filter(r => this._mapSeverity(r) === 'critical').length;
    const highFindings = results.filter(r => this._mapSeverity(r) === 'high').length;
    const securityFindings = results.filter(r => this._mapCategory(r) === 'security').length;

    // CodeQL is primarily security-focused, weight security findings more
    if (criticalFindings > 5 || securityFindings > 15) return 'F';
    if (criticalFindings > 2 || securityFindings > 10 || highFindings > 15) return 'D';
    if (criticalFindings > 0 || securityFindings > 5 || highFindings > 8) return 'C';
    if (securityFindings > 2 || highFindings > 3) return 'B';
    return 'A';
  }

  // Helper methods for mapping and calculation

  _mapCategory(result, rule = {}) {
    // Try rule properties first
    if (rule.properties?.kind) {
      const kind = rule.properties.kind.toLowerCase();
      if (kind.includes('security')) return 'security';
      if (kind.includes('correctness')) return 'bug';
      if (kind.includes('maintainability')) return 'maintainability';
      if (kind.includes('performance')) return 'performance';
    }
    
    // Try tags
    const tags = rule.properties?.tags || [];
    if (tags.some(tag => tag.includes('security'))) return 'security';
    if (tags.some(tag => tag.includes('correctness'))) return 'bug';
    if (tags.some(tag => tag.includes('maintainability'))) return 'maintainability';
    
    // Fallback: analyze rule ID
    const ruleId = result.ruleId?.toLowerCase() || '';
    if (ruleId.includes('security') || ruleId.includes('cwe') || ruleId.includes('injection')) {
      return 'security';
    }
    
    return this.defaultCategory;
  }

  _mapSeverity(result, rule = {}) {
    // Check SARIF level first
    if (result.level && this.severityMapping[result.level]) {
      return this.severityMapping[result.level];
    }
    
    // Check rule properties
    if (rule.defaultConfiguration?.level) {
      return this.severityMapping[rule.defaultConfiguration.level] || this.defaultSeverity;
    }
    
    // Check precision - high precision usually means higher confidence/severity
    const precision = rule.properties?.precision;
    if (precision === 'high') return 'high';
    if (precision === 'medium') return 'medium';
    if (precision === 'low') return 'low';
    
    return this.defaultSeverity;
  }

  _extractCategories(result, rule) {
    const categories = [this._mapCategory(result, rule)];
    
    // Add CWE categories if available
    const cwe = this._extractCWE(result, rule);
    if (cwe.length > 0) {
      categories.push(`CWE-${cwe.join(',CWE-')}`);
    }
    
    // Add tags
    const tags = rule.properties?.tags || [];
    tags.forEach(tag => categories.push(`tag-${tag}`));
    
    return categories;
  }

  _extractCWE(result, rule) {
    const cwePattern = /CWE-(\d+)/gi;
    const sources = [
      rule.help?.text || '',
      rule.fullDescription?.text || '',
      result.message?.text || '',
      ...(rule.properties?.tags || [])
    ];
    
    const cwes = new Set();
    sources.forEach(source => {
      const matches = source.match(cwePattern);
      if (matches) {
        matches.forEach(match => {
          const cweNum = match.replace('CWE-', '');
          cwes.add(cweNum);
        });
      }
    });
    
    return Array.from(cwes);
  }

  _calculateEffort(result, rule) {
    // Estimate remediation effort based on issue type and complexity
    const category = this._mapCategory(result, rule);
    const severity = this._mapSeverity(result, rule);
    
    const baseEffort = {
      'security': 6,      // Security issues typically need careful review
      'bug': 4,           // Bugs usually straightforward to fix
      'maintainability': 3, // Refactoring effort
      'performance': 5,    // Performance issues can be complex
      'style': 1          // Style issues are usually quick fixes
    };
    
    const severityMultiplier = {
      'critical': 2.0,
      'high': 1.5,
      'medium': 1.0,
      'low': 0.5
    };
    
    const base = baseEffort[category] || 3;
    const multiplier = severityMultiplier[severity] || 1.0;
    
    return Math.ceil(base * multiplier);
  }

  _generateFingerprint(result) {
    // Create unique fingerprint for CodeQL finding
    const location = this._extractPrimaryLocation(result.locations);
    return `${result.ruleId}:${location.file}:${location.startLine}:${location.startColumn}`;
  }

  _extractPrimaryLocation(locations) {
    if (!locations || locations.length === 0) {
      return {
        file: 'unknown',
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0
      };
    }
    
    const loc = locations[0].physicalLocation?.region || {};
    const uri = locations[0].physicalLocation?.artifactLocation?.uri || 'unknown';
    
    return {
      file: uri,
      startLine: loc.startLine || 0,
      startColumn: loc.startColumn || 0,
      endLine: loc.endLine || loc.startLine || 0,
      endColumn: loc.endColumn || loc.startColumn || 0
    };
  }

  _buildRulesMap(rules) {
    const rulesMap = {};
    rules.forEach(rule => {
      rulesMap[rule.id] = rule;
    });
    return rulesMap;
  }

  _hasDataFlowAnalysis(result) {
    // Check if result includes data flow information
    return result.codeFlows && result.codeFlows.length > 0;
  }

  _hasControlFlowAnalysis(result) {
    // Check if result includes control flow information
    return result.locations && result.locations.length > 1;
  }

  _calculateSemanticScore(results) {
    if (results.length === 0) return 100;
    
    // Semantic analysis score based on finding types and semantic complexity
    const maxScore = 100;
    const penalties = {
      'security': 8,  // Security findings are serious in semantic context
      'bug': 5,       // Semantic bugs are usually logic errors
      'maintainability': 3,
      'performance': 4,
      'style': 1
    };
    
    const totalPenalty = results.reduce((penalty, result) => {
      const category = this._mapCategory(result);
      const severity = this._mapSeverity(result);
      const basePenalty = penalties[category] || 3;
      const severityMultiplier = {
        'critical': 2.0,
        'high': 1.5,
        'medium': 1.0,
        'low': 0.5
      };
      return penalty + (basePenalty * (severityMultiplier[severity] || 1.0));
    }, 0);
    
    return Math.max(0, maxScore - totalPenalty);
  }

  _calculateSecurityScore(results) {
    const securityResults = results.filter(r => this._mapCategory(r) === 'security');
    if (securityResults.length === 0) return 100;
    
    const maxScore = 100;
    const penalties = {
      'critical': 15,
      'high': 10,
      'medium': 5,
      'low': 2
    };
    
    const totalPenalty = securityResults.reduce((penalty, result) => 
      penalty + (penalties[this._mapSeverity(result)] || 2), 0);
    
    return Math.max(0, maxScore - totalPenalty);
  }

  // File and city visualization helper methods (similar to other analyzers but CodeQL-specific)

  _getFileType(filePath) {
    if (!filePath) return 'unknown';
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python', 'java': 'java', 'kt': 'kotlin', 'scala': 'scala',
      'go': 'go', 'rs': 'rust', 'rb': 'ruby', 'php': 'php',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'c': 'c', 'cs': 'csharp',
      'swift': 'swift', 'ql': 'codeql-query'
    };
    
    return typeMap[ext] || 'file';
  }

  _calculateFileAttributes(file) {
    const issues = file.issues || [];
    const criticalIssues = issues.filter(i => ['critical', 'high'].includes(i.severity));
    const securityIssues = issues.filter(i => i.type === 'security');
    
    return {
      buildingHeight: this._calculateBuildingHeight(file, issues),
      buildingCondition: this._calculateBuildingCondition(issues),
      securityLevel: this._calculateSecurityLevel(securityIssues, criticalIssues),
      constructionAge: 'recent', // Not available from CodeQL
      trafficLevel: this._calculateTrafficLevel(issues),
      semanticComplexity: this._calculateSemanticComplexity(issues) // CodeQL-specific
    };
  }

  _calculateBuildingHeight(file, issues) {
    const baseHeight = 20;
    const issueHeight = issues.reduce((height, issue) => {
      const severityMultiplier = {
        'critical': 15, // CodeQL critical findings are very significant
        'high': 10,
        'medium': 5,
        'low': 2
      };
      return height + (severityMultiplier[issue.severity] || 2);
    }, 0);
    
    return Math.min(baseHeight + issueHeight, 250); // Cap at 250
  }

  _calculateBuildingCondition(issues) {
    if (!issues || issues.length === 0) return 'excellent';
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const securityIssues = issues.filter(i => i.type === 'security').length;
    
    if (criticalIssues > 2 || securityIssues > 5) return 'poor';
    if (criticalIssues > 0 || securityIssues > 2 || highIssues > 3) return 'fair';
    if (securityIssues > 0 || highIssues > 1) return 'good';
    return 'excellent';
  }

  _calculateSecurityLevel(securityIssues, criticalIssues) {
    const criticalSecurityCount = criticalIssues.filter(i => i.type === 'security').length;
    
    if (criticalSecurityCount > 1 || securityIssues.length > 5) return 'at-risk';
    if (criticalSecurityCount > 0 || securityIssues.length > 2) return 'moderate';
    return 'secure';
  }

  _calculateTrafficLevel(issues) {
    // Traffic based on semantic complexity and issue density
    const semanticWeight = issues.reduce((weight, issue) => {
      const severityWeight = { 'critical': 5, 'high': 4, 'medium': 2, 'low': 1 };
      const categoryWeight = { 'security': 2, 'bug': 1.5, 'maintainability': 1, 'performance': 1.5, 'style': 0.5 };
      return weight + (severityWeight[issue.severity] || 1) * (categoryWeight[issue.type] || 1);
    }, 0);
    
    if (semanticWeight > 40) return 'high';
    if (semanticWeight > 20) return 'medium';
    return 'low';
  }

  _calculateSemanticComplexity(issues) {
    // CodeQL-specific: calculate semantic complexity based on types of findings
    const securityIssues = issues.filter(i => i.type === 'security').length;
    const bugIssues = issues.filter(i => i.type === 'bug').length;
    const totalComplexity = securityIssues * 2 + bugIssues * 1.5;
    
    if (totalComplexity > 15) return 'very-high';
    if (totalComplexity > 10) return 'high';
    if (totalComplexity > 5) return 'medium';
    return 'low';
  }

  // City visualization helper methods (CodeQL-specific implementations)

  _groupFilesIntoDistricts(files) {
    const districts = {};
    
    files.forEach(file => {
      const pathParts = file.path.split('/');
      const districtName = pathParts.length > 1 ? pathParts[0] : 'root';
      
      if (!districts[districtName]) {
        districts[districtName] = {
          name: districtName,
          files: []
        };
      }
      
      districts[districtName].files.push(file);
    });
    
    return Object.values(districts);
  }

  _calculateDistrictCondition(files) {
    if (files.length === 0) return 'excellent';
    
    const conditions = files.map(f => f.cityAttributes.buildingCondition);
    const conditionScores = { 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1 };
    const averageScore = conditions.reduce((sum, condition) => 
      sum + conditionScores[condition], 0) / conditions.length;
    
    if (averageScore >= 3.5) return 'excellent';
    if (averageScore >= 2.5) return 'good';
    if (averageScore >= 1.5) return 'fair';
    return 'poor';
  }

  _calculateDistrictSecurity(files) {
    const securityLevels = files.map(f => f.cityAttributes.securityLevel);
    
    if (securityLevels.includes('at-risk')) return 'at-risk';
    if (securityLevels.includes('moderate')) return 'moderate';
    return 'secure';
  }

  _calculateDistrictComplexity(files) {
    const complexities = files.map(f => f.cityAttributes.semanticComplexity);
    
    if (complexities.includes('very-high')) return 'very-high';
    if (complexities.includes('high')) return 'high';
    if (complexities.includes('medium')) return 'medium';
    return 'low';
  }

  // Placeholder methods for CodeQL-specific city visualization features

  _generateRoadNetwork(files, results) {
    // Could map data flows between files
    return [];
  }

  _generateUtilities(results, language) {
    return {
      power: 'stable',
      water: 'clean',
      internet: 'high-speed',
      security: this._calculateSecurityScore(results) > 80 ? 'strong' : 'moderate',
      semanticAnalysis: 'active' // CodeQL-specific utility
    };
  }

  _generateZoning(files, results) {
    return {
      security: files.filter(f => f.cityAttributes.securityLevel === 'at-risk').map(f => f.id),
      critical: files.filter(f => f.cityAttributes.buildingCondition === 'poor').map(f => f.id),
      stable: files.filter(f => f.cityAttributes.buildingCondition === 'excellent').map(f => f.id),
      complex: files.filter(f => f.cityAttributes.semanticComplexity === 'very-high').map(f => f.id)
    };
  }

  _generateSecurityOverlay(files, results) {
    return {
      type: 'security',
      data: files.map(file => ({
        fileId: file.id,
        securityLevel: file.cityAttributes.securityLevel,
        findings: file.metrics.securityFindings
      }))
    };
  }

  _generateSemanticOverlay(results) {
    // CodeQL-specific: semantic analysis complexity overlay
    return {
      type: 'semantic',
      data: results.map(result => ({
        ruleId: result.ruleId,
        hasDataFlow: this._hasDataFlowAnalysis(result),
        hasControlFlow: this._hasControlFlowAnalysis(result),
        semanticDepth: this._calculateResultSemanticDepth(result)
      }))
    };
  }

  _generateDataFlowOverlay(results) {
    // CodeQL-specific: data flow visualization
    return {
      type: 'dataFlow',
      data: results.filter(r => this._hasDataFlowAnalysis(r)).map(result => ({
        ruleId: result.ruleId,
        flowLength: result.codeFlows?.[0]?.threadFlows?.[0]?.locations?.length || 0
      }))
    };
  }

  _generateDataFlowVisualization(results) {
    // Extract data flow paths for visualization
    return results.filter(r => this._hasDataFlowAnalysis(r)).map(result => ({
      id: result.ruleId,
      source: this._extractDataFlowSource(result),
      sink: this._extractDataFlowSink(result),
      pathLength: result.codeFlows?.[0]?.threadFlows?.[0]?.locations?.length || 0
    }));
  }

  _generateVulnerabilityOverlay(results) {
    return {
      type: 'vulnerability',
      data: results.filter(r => this._mapCategory(r) === 'security')
    };
  }

  _generateComplexityOverlay(files) {
    return {
      type: 'complexity',
      data: files.map(file => ({
        fileId: file.id,
        semanticComplexity: file.cityAttributes.semanticComplexity,
        findingsCount: file.metrics.semanticFindings
      }))
    };
  }

  // Utility methods for CodeQL-specific features

  _calculateResultSemanticDepth(result) {
    // Estimate semantic depth based on code flows and locations
    const flowCount = result.codeFlows?.length || 0;
    const locationCount = result.locations?.length || 1;
    
    if (flowCount > 1 || locationCount > 3) return 'deep';
    if (flowCount > 0 || locationCount > 1) return 'medium';
    return 'shallow';
  }

  _extractDataFlowSource(result) {
    const flows = result.codeFlows?.[0]?.threadFlows?.[0]?.locations;
    if (!flows || flows.length === 0) return null;
    
    const source = flows[0];
    return this._extractPrimaryLocation([source]);
  }

  _extractDataFlowSink(result) {
    const flows = result.codeFlows?.[0]?.threadFlows?.[0]?.locations;
    if (!flows || flows.length === 0) return null;
    
    const sink = flows[flows.length - 1];
    return this._extractPrimaryLocation([sink]);
  }

  _generateProjectKey(sourcePath) {
    return sourcePath.split('/').pop() || 'unknown';
  }

  _extractProjectName(sourcePath) {
    return sourcePath.split('/').pop() || 'Unknown Project';
  }
}

module.exports = CodeQLMapper;