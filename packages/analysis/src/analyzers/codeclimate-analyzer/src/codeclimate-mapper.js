/**
 * CodeClimate Data Mapper
 * 
 * Maps CodeClimate analysis results to Topolop's unified data model schema.
 * Following the city visualization metaphor defined in STRATEGY.md
 */

class CodeClimateMapper {
  constructor() {
    // Mapping configurations for CodeClimate
    this.severityMapping = {
      'blocker': 'critical',
      'critical': 'critical',
      'major': 'high', 
      'minor': 'medium',
      'info': 'low'
    };

    this.categoryMapping = {
      'Bug Risk': 'bug',
      'Clarity': 'maintainability',
      'Compatibility': 'compatibility',
      'Complexity': 'complexity',
      'Duplication': 'duplication',
      'Performance': 'performance',
      'Security': 'security',
      'Style': 'style'
    };

    this.ratingMapping = {
      'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'F': 'F'
    };
  }

  /**
   * Map complete CodeClimate repository analysis to unified data model
   */
  mapRepositoryAnalysis(codeClimateData) {
    const { repositoryId, repository, snapshot, issues, metrics, analysisHistory, metadata } = codeClimateData;

    return {
      // Layer 2 unified data model structure
      source: 'codeclimate',
      sourceVersion: '1.0.0',
      analyzedAt: metadata.analyzedAt,
      
      // Project-level data
      project: {
        key: repositoryId,
        name: repository.data.attributes.human_name || repository.data.attributes.github_slug,
        githubSlug: repository.data.attributes.github_slug,
        metrics: this._mapRepositoryMetrics(repository, snapshot, metrics),
        overallRating: this._calculateOverallRating(repository, snapshot)
      },

      // File-level data (buildings in city metaphor)
      files: this._mapFiles(snapshot, issues),
      
      // Issues mapped to city attributes
      issues: this._mapIssues(issues),
      
      // City visualization mapping
      cityVisualization: this._generateCityMapping(snapshot, issues, repository),
      
      // Temporal data for 4D visualization
      temporal: {
        analysisHistory: this._mapAnalysisHistory(analysisHistory),
        lastAnalysis: metadata.analyzedAt
      },

      // Raw metadata
      metadata: {
        ...metadata,
        totalFiles: snapshot?.data?.attributes?.file_count || 0,
        processingTime: new Date().toISOString()
      }
    };
  }

  /**
   * Map CodeClimate repository metrics to unified format
   */
  _mapRepositoryMetrics(repository, snapshot, metrics) {
    const repoAttrs = repository.data.attributes;
    const snapshotAttrs = snapshot?.data?.attributes || {};
    
    return {
      // Basic metrics
      linesOfCode: snapshotAttrs.lines_of_code || 0,
      
      // CodeClimate-specific ratings
      maintainabilityRating: repoAttrs.rating?.letter || 'unknown',
      maintainabilityScore: repoAttrs.rating?.measure?.value || 0,
      
      // Test coverage
      testCoverage: repoAttrs.test_coverage_value || 0,
      
      // Technical debt
      technicalDebtMinutes: snapshotAttrs.technical_debt_minutes || 0,
      technicalDebtRatio: snapshotAttrs.technical_debt_ratio || 0,
      
      // Issue counts by category
      issueCount: snapshotAttrs.issue_count || 0,
      
      // File metrics
      fileCount: snapshotAttrs.file_count || 0,
      
      // Duplication
      duplicationPercentage: snapshotAttrs.duplication_mass || 0
    };
  }

  /**
   * Calculate overall project rating based on CodeClimate factors
   */
  _calculateOverallRating(repository, snapshot) {
    const maintainabilityRating = repository.data.attributes.rating?.letter;
    const testCoverage = repository.data.attributes.test_coverage_value || 0;
    const issueCount = snapshot?.data?.attributes?.issue_count || 0;
    
    // If we have a maintainability rating, use it as primary factor
    if (maintainabilityRating && maintainabilityRating !== 'unknown') {
      // Adjust based on test coverage and issue count
      if (testCoverage > 90 && issueCount < 5) {
        // Boost rating for excellent coverage and low issues
        const ratingValue = this._ratingToNumber(maintainabilityRating);
        return this._numberToRating(Math.max(1, ratingValue - 1));
      }
      return maintainabilityRating;
    }
    
    // Fallback calculation if no rating available
    if (testCoverage > 80 && issueCount < 10) return 'B';
    if (testCoverage > 60 && issueCount < 25) return 'C';
    if (testCoverage > 40 && issueCount < 50) return 'D';
    return 'F';
  }

  /**
   * Map CodeClimate issues to unified format
   */
  _mapIssues(issues) {
    if (!issues || issues.length === 0) {
      return [];
    }

    return issues.map(issue => {
      const attrs = issue.attributes;
      
      return {
        id: issue.id,
        type: this.categoryMapping[attrs.categories[0]] || 'maintainability',
        severity: this.severityMapping[attrs.severity] || 'medium',
        component: attrs.path,
        rule: {
          key: attrs.engine_name,
          name: attrs.description
        },
        message: attrs.description,
        location: {
          file: attrs.path,
          line: attrs.location?.start_line || 0,
          column: attrs.location?.start_column || 0,
          endLine: attrs.location?.end_line || 0,
          endColumn: attrs.location?.end_column || 0
        },
        effort: attrs.remediation_points || 0,
        categories: attrs.categories || [],
        fingerprint: attrs.fingerprint,
        status: 'open', // CodeClimate issues are typically open
        createdAt: attrs.created_at,
        updatedAt: attrs.updated_at
      };
    });
  }

  /**
   * Map CodeClimate files to unified format
   */
  _mapFiles(snapshot, issues) {
    if (!snapshot?.data?.attributes) {
      return [];
    }

    // CodeClimate doesn't provide file-level details in the main snapshot
    // We'll extract unique files from issues and create file objects
    const fileMap = new Map();
    
    issues.forEach(issue => {
      const filePath = issue.attributes.path;
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          id: filePath,
          name: filePath.split('/').pop(),
          path: filePath,
          type: this._getFileType(filePath),
          metrics: {
            linesOfCode: 0 // Not available from CodeClimate API
          },
          issues: [],
          cityAttributes: {
            buildingHeight: 0,
            buildingCondition: 'good',
            securityLevel: 'secure',
            constructionAge: 'recent',
            trafficLevel: 'low'
          }
        });
      }
      
      // Add issue to file
      const file = fileMap.get(filePath);
      file.issues.push({
        id: issue.id,
        type: this.categoryMapping[issue.attributes.categories[0]] || 'maintainability',
        severity: this.severityMapping[issue.attributes.severity] || 'medium',
        message: issue.attributes.description,
        line: issue.attributes.location?.start_line || 0
      });
    });

    // Calculate city attributes for each file
    const files = Array.from(fileMap.values());
    files.forEach(file => {
      file.cityAttributes = this._calculateFileAttributes(file);
    });

    return files;
  }

  /**
   * Generate city visualization mapping
   */
  _generateCityMapping(snapshot, issues, repository) {
    const files = this._mapFiles(snapshot, issues);
    const districts = this._groupFilesIntoDistricts(files);
    
    return {
      metaphor: 'city',
      districts: districts.map(district => ({
        id: district.name,
        name: district.name,
        files: district.files,
        overallCondition: this._calculateDistrictCondition(district.files),
        securityLevel: this._calculateDistrictSecurity(district.files)
      })),
      
      infrastructure: {
        roads: this._generateRoadNetwork(files),
        utilities: this._generateUtilities(snapshot),
        zoning: this._generateZoning(files)
      },
      
      overlays: {
        quality: this._generateQualityOverlay(files),
        security: this._generateSecurityOverlay(files),
        complexity: this._generateComplexityOverlay(files),
        debt: this._generateDebtOverlay(files)
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

    return analysisHistory.map(snapshot => ({
      id: snapshot.id,
      date: snapshot.attributes.created_at,
      commitSha: snapshot.attributes.commit_sha,
      metrics: {
        issueCount: snapshot.attributes.issue_count,
        linesOfCode: snapshot.attributes.lines_of_code,
        technicalDebt: snapshot.attributes.technical_debt_minutes
      }
    }));
  }

  // Helper methods for city visualization calculations

  _getFileType(filePath) {
    if (!filePath) return 'unknown';
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const typeMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript', 
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust'
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
      securityLevel: this._calculateSecurityLevel(securityIssues),
      constructionAge: 'recent', // Not available from CodeClimate
      trafficLevel: this._calculateTrafficLevel(issues)
    };
  }

  _calculateBuildingHeight(file, issues) {
    // Height based on estimated LOC + issue count
    const estimatedLOC = Math.max(100, issues.length * 20); // Rough estimate
    const issueWeight = issues.length * 5;
    
    return Math.log10(estimatedLOC + issueWeight) * 25;
  }

  _calculateBuildingCondition(issues) {
    if (!issues || issues.length === 0) return 'excellent';
    
    const criticalIssues = issues.filter(i => ['critical', 'high'].includes(i.severity)).length;
    
    if (criticalIssues > 5) return 'poor';
    if (criticalIssues > 2) return 'fair';
    if (issues.length > 10) return 'good';
    return 'excellent';
  }

  _calculateSecurityLevel(securityIssues) {
    if (securityIssues.length === 0) return 'secure';
    if (securityIssues.length <= 2) return 'moderate';
    return 'at-risk';
  }

  _calculateTrafficLevel(issues) {
    // Traffic based on issue density
    if (issues.length > 20) return 'high';
    if (issues.length > 10) return 'medium';
    return 'low';
  }

  _groupFilesIntoDistricts(files) {
    // Group by directory structure
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
    const conditionCounts = {};
    conditions.forEach(condition => {
      conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
    });
    
    // Return most common condition
    return Object.keys(conditionCounts).reduce((a, b) => 
      conditionCounts[a] > conditionCounts[b] ? a : b
    );
  }

  _calculateDistrictSecurity(files) {
    const securityLevels = files.map(f => f.cityAttributes.securityLevel);
    
    // If any file is at-risk, district is at-risk
    if (securityLevels.includes('at-risk')) return 'at-risk';
    if (securityLevels.includes('moderate')) return 'moderate';
    return 'secure';
  }

  // Placeholder methods for future city visualization features
  _generateRoadNetwork(files) {
    return [];
  }

  _generateUtilities(snapshot) {
    return {
      power: 'stable',
      water: 'clean',
      internet: 'high-speed'
    };
  }

  _generateZoning(files) {
    return {
      residential: [],
      commercial: [],
      industrial: [],
      security: []
    };
  }

  _generateQualityOverlay(files) {
    return { type: 'quality', data: [] };
  }

  _generateSecurityOverlay(files) {
    return { type: 'security', data: [] };
  }

  _generateComplexityOverlay(files) {
    return { type: 'complexity', data: [] };
  }

  _generateDebtOverlay(files) {
    return { type: 'technical_debt', data: [] };
  }

  // Utility methods for rating conversion
  _ratingToNumber(letter) {
    const map = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };
    return map[letter] || 5;
  }

  _numberToRating(number) {
    const map = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'F' };
    return map[number] || 'F';
  }
}

module.exports = CodeClimateMapper;