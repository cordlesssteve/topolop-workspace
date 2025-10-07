/**
 * SonarQube Data Mapper
 * 
 * Maps SonarQube analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor defined in STRATEGY.md
 */

class SonarQubeMapper {
  constructor() {
    // Mapping configurations
    this.severityMapping = {
      'BLOCKER': 'critical',
      'CRITICAL': 'high', 
      'MAJOR': 'medium',
      'MINOR': 'low',
      'INFO': 'info'
    };

    this.typeMapping = {
      'BUG': 'bug',
      'VULNERABILITY': 'vulnerability', 
      'CODE_SMELL': 'code_smell',
      'SECURITY_HOTSPOT': 'security_hotspot'
    };

    this.ratingMapping = {
      '1.0': 'A', '2.0': 'B', '3.0': 'C', '4.0': 'D', '5.0': 'E'
    };
  }

  /**
   * Map complete SonarQube project analysis to unified data model
   */
  mapProjectAnalysis(sonarQubeData) {
    const { projectKey, qualityGate, measures, issues, components, hotspots, analysisHistory, metadata } = sonarQubeData;

    return {
      // Layer 2 unified data model structure
      source: 'sonarqube',
      sourceVersion: metadata.sonarQubeVersion || 'unknown',
      analyzedAt: metadata.analyzedAt,
      
      // Project-level data
      project: {
        key: projectKey,
        name: projectKey,
        qualityGate: this._mapQualityGate(qualityGate),
        metrics: this._mapProjectMetrics(measures),
        overallRating: this._calculateOverallRating(measures)
      },

      // File-level data (buildings in city metaphor)
      files: this._mapComponents(components, issues),
      
      // Issues mapped to city attributes
      issues: this._mapIssues(issues),
      
      // Security hotspots
      securityHotspots: this._mapHotspots(hotspots),
      
      // City visualization mapping
      cityVisualization: this._generateCityMapping(components, issues, measures),
      
      // Temporal data for 4D visualization
      temporal: {
        analysisHistory: this._mapAnalysisHistory(analysisHistory),
        lastAnalysis: metadata.analyzedAt
      },

      // Raw metadata
      metadata: {
        ...metadata,
        totalMetrics: measures?.measures?.length || 0,
        processingTime: new Date().toISOString()
      }
    };
  }

  /**
   * Map SonarQube quality gate to unified format
   */
  _mapQualityGate(qualityGate) {
    if (!qualityGate || !qualityGate.projectStatus) {
      return { status: 'unknown', conditions: [] };
    }

    const status = qualityGate.projectStatus.status; // OK, WARN, ERROR
    const conditions = qualityGate.projectStatus.conditions || [];

    return {
      status: status.toLowerCase(),
      passed: status === 'OK',
      conditions: conditions.map(condition => ({
        metric: condition.metricKey,
        operator: condition.comparator,
        threshold: condition.threshold,
        actualValue: condition.actualValue,
        status: condition.status.toLowerCase()
      }))
    };
  }

  /**
   * Map SonarQube measures to unified metrics
   */
  _mapProjectMetrics(measuresData) {
    if (!measuresData || !measuresData.measures) {
      return {};
    }

    const metrics = {};
    measuresData.measures.forEach(measure => {
      const value = parseFloat(measure.value) || measure.value;
      
      switch (measure.metric) {
        case 'ncloc':
          metrics.linesOfCode = value;
          break;
        case 'complexity':
          metrics.cyclomaticComplexity = value;
          break;
        case 'cognitive_complexity':
          metrics.cognitiveComplexity = value;
          break;
        case 'duplicated_lines_density':
          metrics.duplicationPercentage = value;
          break;
        case 'coverage':
          metrics.testCoverage = value;
          break;
        case 'bugs':
          metrics.bugCount = value;
          break;
        case 'vulnerabilities':
          metrics.vulnerabilityCount = value;
          break;
        case 'code_smells':
          metrics.codeSmellCount = value;
          break;
        case 'security_hotspots':
          metrics.securityHotspotCount = value;
          break;
        case 'sqale_index':
          metrics.technicalDebtMinutes = value;
          break;
        case 'reliability_rating':
          metrics.reliabilityRating = this.ratingMapping[value] || value;
          break;
        case 'security_rating':
          metrics.securityRating = this.ratingMapping[value] || value;
          break;
        case 'sqale_rating':
          metrics.maintainabilityRating = this.ratingMapping[value] || value;
          break;
        default:
          metrics[measure.metric] = value;
      }
    });

    return metrics;
  }

  /**
   * Calculate overall project rating based on multiple factors
   */
  _calculateOverallRating(measuresData) {
    if (!measuresData || !measuresData.measures) {
      return 'unknown';
    }

    const ratings = {};
    measuresData.measures.forEach(measure => {
      if (measure.metric.endsWith('_rating')) {
        ratings[measure.metric] = parseFloat(measure.value) || 5.0;
      }
    });

    // Calculate weighted average (reliability=40%, security=35%, maintainability=25%)
    const weights = {
      'reliability_rating': 0.4,
      'security_rating': 0.35,
      'sqale_rating': 0.25
    };

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([metric, weight]) => {
      if (ratings[metric] !== undefined) {
        weightedSum += ratings[metric] * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return 'unknown';
    
    const avgRating = weightedSum / totalWeight;
    return this.ratingMapping[Math.round(avgRating).toString() + '.0'] || 'C';
  }

  /**
   * Map SonarQube components (files) to unified format
   */
  _mapComponents(components, issues) {
    if (!components || components.length === 0) {
      return [];
    }

    return components.map(component => {
      const componentIssues = issues.filter(issue => 
        issue.component === component.key
      );

      return {
        id: component.key,
        name: component.name,
        path: component.path || component.key,
        type: this._getComponentType(component),
        metrics: this._mapComponentMetrics(component),
        issues: componentIssues.map(issue => ({
          id: issue.key,
          type: this.typeMapping[issue.type] || issue.type.toLowerCase(),
          severity: this.severityMapping[issue.severity] || issue.severity.toLowerCase(),
          rule: issue.rule,
          message: issue.message,
          line: issue.line,
          effort: issue.effort,
          debt: issue.debt,
          status: issue.status.toLowerCase()
        })),
        
        // City visualization attributes
        cityAttributes: {
          buildingHeight: this._calculateBuildingHeight(component, componentIssues),
          buildingCondition: this._calculateBuildingCondition(componentIssues),
          securityLevel: this._calculateSecurityLevel(componentIssues),
          constructionAge: this._calculateConstructionAge(component),
          trafficLevel: this._calculateTrafficLevel(component)
        }
      };
    });
  }

  /**
   * Map individual issues to unified format
   */
  _mapIssues(issues) {
    if (!issues || issues.length === 0) {
      return [];
    }

    return issues.map(issue => ({
      id: issue.key,
      type: this.typeMapping[issue.type] || issue.type.toLowerCase(),
      severity: this.severityMapping[issue.severity] || issue.severity.toLowerCase(),
      component: issue.component,
      rule: {
        key: issue.rule,
        name: issue.ruleName || issue.rule
      },
      message: issue.message,
      location: {
        file: issue.component,
        line: issue.line,
        column: issue.column,
        textRange: issue.textRange
      },
      effort: issue.effort,
      debt: issue.debt,
      tags: issue.tags || [],
      status: issue.status.toLowerCase(),
      resolution: issue.resolution,
      assignee: issue.assignee,
      author: issue.author,
      creationDate: issue.creationDate,
      updateDate: issue.updateDate
    }));
  }

  /**
   * Map security hotspots
   */
  _mapHotspots(hotspots) {
    if (!hotspots || hotspots.length === 0) {
      return [];
    }

    return hotspots.map(hotspot => ({
      id: hotspot.key,
      type: 'security_hotspot',
      severity: 'medium', // Hotspots don't have severity, default to medium
      component: hotspot.component,
      rule: {
        key: hotspot.ruleKey,
        name: hotspot.ruleName || hotspot.ruleKey
      },
      message: hotspot.message,
      status: hotspot.status.toLowerCase(),
      vulnerabilityProbability: hotspot.vulnerabilityProbability,
      securityCategory: hotspot.securityCategory,
      location: {
        file: hotspot.component,
        line: hotspot.line,
        textRange: hotspot.textRange
      },
      assignee: hotspot.assignee,
      author: hotspot.author,
      creationDate: hotspot.creationDate,
      updateDate: hotspot.updateDate
    }));
  }

  /**
   * Generate city visualization mapping
   */
  _generateCityMapping(components, issues, measures) {
    const districts = this._groupComponentsIntoDistricts(components);
    
    return {
      metaphor: 'city',
      districts: districts.map(district => ({
        id: district.name,
        name: district.name,
        components: district.components,
        overallCondition: this._calculateDistrictCondition(district.components, issues),
        securityLevel: this._calculateDistrictSecurity(district.components, issues)
      })),
      
      infrastructure: {
        roads: this._generateRoadNetwork(components, issues),
        utilities: this._generateUtilities(measures),
        zoning: this._generateZoning(components, issues)
      },
      
      overlays: {
        quality: this._generateQualityOverlay(components, issues),
        security: this._generateSecurityOverlay(components, issues),
        complexity: this._generateComplexityOverlay(components),
        debt: this._generateDebtOverlay(components, issues)
      }
    };
  }

  /**
   * Map analysis history for temporal visualization
   */
  _mapAnalysisHistory(analysisHistory) {
    if (!analysisHistory || analysisHistory.length === 0) {
      return [];
    }

    return analysisHistory.map(analysis => ({
      id: analysis.key,
      date: analysis.date,
      projectVersion: analysis.projectVersion,
      manualAnalysis: analysis.manualAnalysis || false,
      events: analysis.events || []
    }));
  }

  // Helper methods for city visualization calculations

  _getComponentType(component) {
    if (!component.path && !component.name) return 'unknown';
    const path = component.path || component.name;
    
    // Determine file type based on extension
    const ext = path.split('.').pop()?.toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript', 
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby'
    };
    
    return typeMap[ext] || 'file';
  }

  _mapComponentMetrics(component) {
    const metrics = {};
    
    if (component.measures) {
      component.measures.forEach(measure => {
        metrics[measure.metric] = parseFloat(measure.value) || measure.value;
      });
    }
    
    return metrics;
  }

  _calculateBuildingHeight(component, issues) {
    // Height based on lines of code + complexity
    const loc = component.measures?.find(m => m.metric === 'ncloc')?.value || 100;
    const complexity = component.measures?.find(m => m.metric === 'complexity')?.value || 1;
    
    // Logarithmic scaling for realistic visualization 
    return Math.log10(parseInt(loc) + parseInt(complexity) * 10) * 20;
  }

  _calculateBuildingCondition(issues) {
    if (!issues || issues.length === 0) return 'excellent';
    
    const criticalIssues = issues.filter(i => 
      ['BLOCKER', 'CRITICAL'].includes(i.severity)
    ).length;
    
    if (criticalIssues > 5) return 'poor';
    if (criticalIssues > 2) return 'fair';
    if (issues.length > 10) return 'good';
    return 'excellent';
  }

  _calculateSecurityLevel(issues) {
    const securityIssues = issues.filter(i => 
      ['VULNERABILITY', 'SECURITY_HOTSPOT'].includes(i.type)
    );
    
    if (securityIssues.length === 0) return 'secure';
    if (securityIssues.length <= 2) return 'moderate';
    return 'at-risk';
  }

  _calculateConstructionAge(component) {
    // This would ideally come from Git data
    // For now, return a placeholder
    return 'recent';
  }

  _calculateTrafficLevel(component) {
    // Traffic based on complexity - high complexity = high traffic
    const complexity = component.measures?.find(m => m.metric === 'complexity')?.value || 0;
    
    if (complexity > 20) return 'high';
    if (complexity > 10) return 'medium';
    return 'low';
  }

  _groupComponentsIntoDistricts(components) {
    // Group by directory structure
    const districts = {};
    
    components.forEach(component => {
      const path = component.path || component.name || '';
      const pathParts = path.split('/');
      const districtName = pathParts.length > 1 ? pathParts[0] : 'root';
      
      if (!districts[districtName]) {
        districts[districtName] = {
          name: districtName,
          components: []
        };
      }
      
      districts[districtName].components.push(component);
    });
    
    return Object.values(districts);
  }

  _calculateDistrictCondition(components, issues) {
    // Average condition of all buildings in district
    const conditions = components.map(component => {
      const componentIssues = issues.filter(issue => issue.component === component.key);
      return this._calculateBuildingCondition(componentIssues);
    });
    
    // Simple majority rule
    const conditionCounts = {};
    conditions.forEach(condition => {
      conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
    });
    
    return Object.keys(conditionCounts).reduce((a, b) => 
      conditionCounts[a] > conditionCounts[b] ? a : b
    );
  }

  _calculateDistrictSecurity(components, issues) {
    const securityLevels = components.map(component => {
      const componentIssues = issues.filter(issue => issue.component === component.key);
      return this._calculateSecurityLevel(componentIssues);
    });
    
    // If any component is at-risk, district is at-risk
    if (securityLevels.includes('at-risk')) return 'at-risk';
    if (securityLevels.includes('moderate')) return 'moderate';
    return 'secure';
  }

  // Placeholder methods for future city visualization features
  _generateRoadNetwork(components, issues) {
    return [];
  }

  _generateUtilities(measures) {
    return {
      power: 'stable',
      water: 'clean',
      internet: 'high-speed'
    };
  }

  _generateZoning(components, issues) {
    return {
      residential: [],
      commercial: [],
      industrial: [],
      security: []
    };
  }

  _generateQualityOverlay(components, issues) {
    return { type: 'quality', data: [] };
  }

  _generateSecurityOverlay(components, issues) {
    return { type: 'security', data: [] };
  }

  _generateComplexityOverlay(components) {
    return { type: 'complexity', data: [] };
  }

  _generateDebtOverlay(components, issues) {
    return { type: 'technical_debt', data: [] };
  }
}

module.exports = SonarQubeMapper;