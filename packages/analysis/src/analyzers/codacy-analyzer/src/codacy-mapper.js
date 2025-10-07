/**
 * Codacy Data Mapper
 * 
 * Maps Codacy API responses to unified Layer 2 data model schema.
 * Focuses on code quality perspective with grade assessment, issue categorization,
 * and quality trends analysis.
 */
class CodacyMapper {
  constructor(config = {}) {
    this.config = {
      includeFileMetrics: config.includeFileMetrics !== false,
      qualityThresholds: {
        excellent: 'A',
        good: 'B', 
        fair: 'C',
        poor: 'D',
        critical: 'F'
      },
      ...config
    };
  }

  /**
   * Map comprehensive repository quality data to Layer 2 unified model
   */
  mapToLayer2(repositoryQualityData) {
    const { analysis, issues, files, summary } = repositoryQualityData;

    return {
      // Layer 2 Standard Fields
      source: 'codacy',
      analysisType: 'code-quality',
      timestamp: new Date().toISOString(),
      
      // Repository Information
      repository: this._mapRepositoryInfo(analysis),
      
      // Quality Project Metrics
      project: this._mapProjectMetrics(analysis, summary),
      
      // Issue Analysis
      issues: this._mapIssuesToStandardFormat(issues),
      
      // File-level Metrics (if enabled)
      files: this.config.includeFileMetrics ? this._mapFileMetrics(files) : [],
      
      // Quality Summary
      summary: this._mapQualitySummary(analysis, summary),
      
      // City Visualization Data
      cityData: this._mapToCityVisualization(analysis, issues, files)
    };
  }

  /**
   * Map repository basic information
   */
  _mapRepositoryInfo(analysis) {
    return {
      name: analysis?.repositoryName || 'unknown',
      provider: analysis?.provider || 'github',
      organization: analysis?.organizationName || 'unknown',
      branch: analysis?.branch || 'main',
      lastAnalyzed: analysis?.lastAnalyzedAt || new Date().toISOString(),
      isPrivate: analysis?.isPrivate || false,
      url: analysis?.repositoryUrl || null
    };
  }

  /**
   * Map project-level quality metrics
   */
  _mapProjectMetrics(analysis, summary) {
    const grade = analysis?.grade || 'F';
    const quality = analysis?.quality || {};
    
    return {
      // Quality Assessment
      overallRating: grade,
      qualityGrade: grade,
      qualityScore: this._gradeToScore(grade),
      
      // Quality Metrics
      metrics: {
        // Core Quality Metrics
        totalIssues: summary?.totalIssues || 0,
        totalFiles: summary?.totalFiles || 0,
        
        // Quality Dimensions
        complexity: quality?.complexity || 0,
        coverage: quality?.coverage || 0,
        duplication: quality?.duplication || 0,
        
        // Issue Distribution
        errorIssues: this._countIssuesBySeverity(analysis?.issues, 'Error'),
        warningIssues: this._countIssuesBySeverity(analysis?.issues, 'Warning'),
        infoIssues: this._countIssuesBySeverity(analysis?.issues, 'Info'),
        
        // Category Distribution
        securityIssues: this._countIssuesByCategory(analysis?.issues, 'Security'),
        codeStyleIssues: this._countIssuesByCategory(analysis?.issues, 'CodeStyle'),
        performanceIssues: this._countIssuesByCategory(analysis?.issues, 'Performance'),
        compatibilityIssues: this._countIssuesByCategory(analysis?.issues, 'Compatibility'),
        
        // Quality Indicators
        technicalDebt: this._calculateTechnicalDebt(quality),
        maintainabilityIndex: this._calculateMaintainabilityIndex(quality),
        qualityTrend: this._determineQualityTrend(analysis)
      },
      
      // Quality Configuration
      qualityProfile: {
        gradeSystem: 'A-F',
        thresholds: this.config.qualityThresholds,
        analysisDate: analysis?.createdAt || new Date().toISOString()
      }
    };
  }

  /**
   * Map issues to standard format
   */
  _mapIssuesToStandardFormat(issues) {
    if (!issues || !Array.isArray(issues)) return [];

    return issues.map(issue => ({
      // Standard Issue Fields
      id: issue.issueId || issue.id,
      title: issue.patternInfo?.title || 'Code Quality Issue',
      description: issue.patternInfo?.description || issue.message || '',
      
      // Location Information
      file: issue.filePath || 'unknown',
      line: issue.line || 0,
      column: issue.column || 0,
      
      // Quality-specific Classification
      severity: this._mapSeverity(issue.level),
      category: this._mapCategory(issue.patternInfo?.category),
      type: 'quality',
      
      // Codacy-specific Data
      codacyData: {
        patternId: issue.patternId,
        level: issue.level,
        category: issue.patternInfo?.category,
        subcategory: issue.patternInfo?.subcategory,
        language: issue.language,
        tool: issue.tool,
        
        // Pattern Information
        patternInfo: {
          title: issue.patternInfo?.title,
          description: issue.patternInfo?.description,
          explanation: issue.patternInfo?.explanation,
          timeToFix: issue.patternInfo?.timeToFix
        },
        
        // Quality Context
        qualityImpact: this._assessQualityImpact(issue),
        technicalDebtMinutes: issue.patternInfo?.timeToFix || 0
      },
      
      // Standardized Fields
      source: 'codacy',
      ruleId: issue.patternId,
      message: issue.message || issue.patternInfo?.title || '',
      created: issue.createdAt || new Date().toISOString()
    }));
  }

  /**
   * Map file-level metrics
   */
  _mapFileMetrics(files) {
    if (!files || !Array.isArray(files)) return [];

    return files.map(file => ({
      // File Information
      path: file.path,
      language: file.language,
      
      // Quality Metrics
      grade: file.grade,
      qualityScore: this._gradeToScore(file.grade),
      
      // Metrics
      metrics: {
        totalIssues: file.issues || 0,
        complexity: file.complexity || 0,
        coverage: file.coverage || 0,
        duplication: file.duplication || 0,
        linesOfCode: file.linesOfCode || 0
      },
      
      // Issue Distribution
      issueDistribution: {
        errors: file.errorIssues || 0,
        warnings: file.warningIssues || 0,
        info: file.infoIssues || 0
      }
    }));
  }

  /**
   * Map quality summary
   */
  _mapQualitySummary(analysis, summary) {
    const grade = analysis?.grade || 'F';
    const quality = analysis?.quality || {};
    
    return {
      // Overall Assessment
      overallGrade: grade,
      qualityScore: this._gradeToScore(grade),
      
      // Quality Metrics Summary
      totalFiles: summary?.totalFiles || 0,
      totalIssues: summary?.totalIssues || 0,
      
      // Quality Dimensions
      complexity: quality?.complexity || 0,
      coverage: quality?.coverage || 0,
      duplication: quality?.duplication || 0,
      
      // Quality Assessment
      qualityLevel: this._determineQualityLevel(grade),
      technicalDebt: this._calculateTechnicalDebt(quality),
      maintainabilityIndex: this._calculateMaintainabilityIndex(quality),
      
      // Recommendations
      recommendations: this._generateQualityRecommendations(analysis, summary)
    };
  }

  /**
   * Map to city visualization format
   */
  _mapToCityVisualization(analysis, issues, files) {
    return {
      // City Metaphor: Buildings represent files, districts represent directories
      buildings: this._mapFilesToBuildings(files, issues),
      districts: this._mapDirectoriesToDistricts(files),
      
      // Quality Overlays
      qualityZones: this._createQualityZones(analysis),
      qualityOverlays: this._createQualityOverlays(analysis),
      
      // City Infrastructure (represents overall quality)
      infrastructure: {
        overallHealth: this._gradeToScore(analysis?.grade),
        qualityGrade: analysis?.grade || 'F',
        
        // Quality Infrastructure
        qualityInfrastructure: {
          codeStandards: this._assessCodeStandards(issues),
          maintainability: this._calculateMaintainabilityIndex(analysis?.quality),
          technicalDebt: this._calculateTechnicalDebt(analysis?.quality)
        }
      },
      
      // City Metrics for Visualization
      cityMetrics: {
        totalBuildings: files?.length || 0,
        totalDistricts: this._countUniqueDirectories(files),
        overallGrade: analysis?.grade || 'F',
        qualityDensity: this._calculateQualityDensity(issues, files)
      }
    };
  }

  // Helper methods for mapping
  _gradeToScore(grade) {
    const gradeMap = { 'A': 90, 'B': 80, 'C': 70, 'D': 60, 'F': 50 };
    return gradeMap[grade] || 50;
  }

  _mapSeverity(level) {
    const severityMap = {
      'Error': 'high',
      'Warning': 'medium', 
      'Info': 'low'
    };
    return severityMap[level] || 'medium';
  }

  _mapCategory(category) {
    const categoryMap = {
      'Security': 'security',
      'CodeStyle': 'style',
      'Performance': 'performance',
      'Compatibility': 'compatibility',
      'Documentation': 'documentation'
    };
    return categoryMap[category] || 'quality';
  }

  _countIssuesBySeverity(issues, severity) {
    if (!issues) return 0;
    return issues.filter(issue => issue.level === severity).length;
  }

  _countIssuesByCategory(issues, category) {
    if (!issues) return 0;
    return issues.filter(issue => issue.patternInfo?.category === category).length;
  }

  _calculateTechnicalDebt(quality) {
    if (!quality) return 0;
    // Estimate technical debt based on quality metrics
    const complexityDebt = (quality.complexity || 0) * 0.3;
    const duplicationDebt = (quality.duplication || 0) * 0.4;
    const coverageDebt = (100 - (quality.coverage || 0)) * 0.2;
    return Math.round(complexityDebt + duplicationDebt + coverageDebt);
  }

  _calculateMaintainabilityIndex(quality) {
    if (!quality) return 50;
    // Calculate maintainability index (0-100 scale)
    const complexityFactor = Math.max(0, 100 - (quality.complexity || 0));
    const coverageFactor = quality.coverage || 0;
    const duplicationFactor = Math.max(0, 100 - (quality.duplication || 0));
    return Math.round((complexityFactor + coverageFactor + duplicationFactor) / 3);
  }

  _determineQualityTrend(analysis) {
    // Placeholder for quality trend analysis
    // In a real implementation, this would compare with historical data
    return 'stable';
  }

  _determineQualityLevel(grade) {
    if (['A', 'B'].includes(grade)) return 'excellent';
    if (grade === 'C') return 'good';
    if (grade === 'D') return 'fair';
    return 'needs-improvement';
  }

  _assessQualityImpact(issue) {
    const level = issue.level;
    const category = issue.patternInfo?.category;
    
    if (level === 'Error') return 'high';
    if (level === 'Warning' && category === 'Security') return 'high';
    if (level === 'Warning') return 'medium';
    return 'low';
  }

  _generateQualityRecommendations(analysis, summary) {
    const recommendations = [];
    const grade = analysis?.grade;
    const quality = analysis?.quality || {};
    
    if (grade && ['D', 'F'].includes(grade)) {
      recommendations.push('Consider improving overall code quality to achieve higher grade');
    }
    
    if (quality.complexity > 80) {
      recommendations.push('Reduce code complexity by refactoring complex methods');
    }
    
    if (quality.coverage < 70) {
      recommendations.push('Increase test coverage to improve code reliability');
    }
    
    if (quality.duplication > 20) {
      recommendations.push('Reduce code duplication by extracting common functionality');
    }
    
    if (summary?.totalIssues > 100) {
      recommendations.push('Address high-priority quality issues to improve maintainability');
    }
    
    return recommendations;
  }

  _mapFilesToBuildings(files, issues) {
    if (!files) return [];
    
    return files.map(file => ({
      id: file.path,
      name: file.path.split('/').pop(),
      path: file.path,
      
      // Building characteristics based on quality
      height: Math.max(1, file.linesOfCode || 10),
      condition: this._getConditionFromGrade(file.grade),
      
      // Quality indicators
      qualityGrade: file.grade,
      issueCount: file.issues || 0,
      
      // Building metadata
      language: file.language,
      metrics: file.metrics || {}
    }));
  }

  _mapDirectoriesToDistricts(files) {
    if (!files) return [];
    
    const directories = new Map();
    
    files.forEach(file => {
      const pathParts = file.path.split('/');
      pathParts.pop(); // Remove filename
      const dirPath = pathParts.join('/') || '/';
      
      if (!directories.has(dirPath)) {
        directories.set(dirPath, {
          id: dirPath,
          name: dirPath.split('/').pop() || 'root',
          path: dirPath,
          fileCount: 0,
          totalIssues: 0,
          averageGrade: 'C'
        });
      }
      
      const district = directories.get(dirPath);
      district.fileCount++;
      district.totalIssues += (file.issues || 0);
    });
    
    return Array.from(directories.values());
  }

  _createQualityZones(analysis) {
    const grade = analysis?.grade || 'F';
    const quality = analysis?.quality || {};
    
    return [
      {
        type: 'overall-quality',
        grade: grade,
        score: this._gradeToScore(grade),
        color: this._getColorFromGrade(grade)
      },
      {
        type: 'complexity',
        level: quality.complexity || 0,
        threshold: 80,
        status: (quality.complexity || 0) > 80 ? 'high' : 'acceptable'
      },
      {
        type: 'coverage',
        level: quality.coverage || 0,
        threshold: 80,
        status: (quality.coverage || 0) < 80 ? 'low' : 'good'
      }
    ];
  }

  _createQualityOverlays(analysis) {
    return {
      gradeOverlay: {
        grade: analysis?.grade || 'F',
        color: this._getColorFromGrade(analysis?.grade),
        opacity: 0.7
      },
      metricsOverlay: {
        complexity: analysis?.quality?.complexity || 0,
        coverage: analysis?.quality?.coverage || 0,
        duplication: analysis?.quality?.duplication || 0
      }
    };
  }

  _countUniqueDirectories(files) {
    if (!files) return 0;
    const directories = new Set();
    files.forEach(file => {
      const pathParts = file.path.split('/');
      pathParts.pop();
      directories.add(pathParts.join('/') || '/');
    });
    return directories.size;
  }

  _calculateQualityDensity(issues, files) {
    if (!files || files.length === 0) return 0;
    const totalIssues = issues?.length || 0;
    return totalIssues / files.length;
  }

  _getConditionFromGrade(grade) {
    const conditionMap = {
      'A': 'excellent',
      'B': 'good', 
      'C': 'fair',
      'D': 'poor',
      'F': 'critical'
    };
    return conditionMap[grade] || 'fair';
  }

  _getColorFromGrade(grade) {
    const colorMap = {
      'A': '#4CAF50', // Green
      'B': '#8BC34A', // Light Green
      'C': '#FFC107', // Amber
      'D': '#FF9800', // Orange  
      'F': '#F44336'  // Red
    };
    return colorMap[grade] || '#9E9E9E';
  }
}

module.exports = CodacyMapper;