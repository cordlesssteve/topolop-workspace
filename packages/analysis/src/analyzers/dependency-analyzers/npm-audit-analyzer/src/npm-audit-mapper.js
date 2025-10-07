/**
 * NPM Audit Mapper - Topolop Unified Data Model Integration
 *
 * Maps npm audit output to Topolop's unified data model for cross-tool correlation
 * and city visualization. Follows the exact pattern established by existing analyzers.
 */

// Mock unified model imports for development (replace with actual imports when integrated)
const {
  UnifiedEntity,
  UnifiedIssue,
  UnifiedAnalysisResult,
  IssueSeverity,
  AnalysisType
} = require('../../../core/unified-model/interfaces') || {
  UnifiedEntity: class { constructor(params) { Object.assign(this, params); } },
  UnifiedIssue: class { constructor(params) { Object.assign(this, params); } },
  UnifiedAnalysisResult: class { constructor(params) { Object.assign(this, params); } },
  IssueSeverity: { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'info' },
  AnalysisType: { DEPENDENCY_SECURITY: 'dependency_security' }
};

class NPMAuditMapper {
  constructor() {
    this.toolName = 'npm-audit';
  }

  /**
   * Convert npm audit data to unified model
   *
   * @param {Object} auditData - Raw npm audit JSON output
   * @param {string} projectRoot - Project root path for canonical path generation
   * @param {Object} metadata - Additional analysis metadata
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  toUnifiedModel(auditData, projectRoot = process.cwd(), metadata = {}) {
    try {
      console.log(`🔄 Mapping npm audit data to unified model...`);

      if (!auditData || typeof auditData !== 'object') {
        console.warn('⚠️  Invalid audit data provided to mapper');
        return this._createEmptyResult(projectRoot, 'Invalid audit data');
      }

      // Handle error cases
      if (auditData.error) {
        console.warn(`⚠️  npm audit error: ${auditData.error}`);
        return this._createEmptyResult(projectRoot, auditData.error);
      }

      // Extract vulnerabilities and dependencies
      const entities = this._mapDependencyEntities(auditData, projectRoot);
      const issues = this._mapVulnerabilities(auditData, entities, projectRoot);

      console.log(`✅ Mapped ${issues.length} vulnerabilities and ${entities.length} dependencies`);

      return new UnifiedAnalysisResult({
        tool: this.toolName,
        analysisType: AnalysisType.DEPENDENCY_SECURITY,
        projectPath: projectRoot,
        entities: entities,
        issues: issues,
        metadata: {
          ...metadata,
          totalDependencies: auditData.metadata?.dependencies?.total || 0,
          vulnerabilityCount: auditData.metadata?.vulnerabilities?.total || 0,
          severityBreakdown: auditData.metadata?.vulnerabilities || {},
          auditReportVersion: auditData.auditReportVersion || 'unknown',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('🚨 Error mapping npm audit data:', error);
      return this._createEmptyResult(projectRoot, `Mapping error: ${error.message}`);
    }
  }

  /**
   * Map dependency information to unified entities
   *
   * @param {Object} auditData - npm audit data
   * @param {string} projectRoot - Project root path
   * @returns {Array<UnifiedEntity>} Dependency entities
   */
  _mapDependencyEntities(auditData, projectRoot) {
    const entities = [];

    // Create entity for package.json (main dependency manifest)
    const packageJsonPath = 'package.json';
    entities.push(new UnifiedEntity({
      id: `entity-${packageJsonPath}`,
      type: 'dependency-manifest',
      name: 'package.json',
      canonicalPath: packageJsonPath,
      originalIdentifier: packageJsonPath,
      toolName: this.toolName,
      confidence: 1.0
    }));

    // Create entity for package-lock.json if dependencies exist
    if (auditData.metadata?.dependencies?.total > 0) {
      const lockFilePath = 'package-lock.json';
      entities.push(new UnifiedEntity({
        id: `entity-${lockFilePath}`,
        type: 'dependency-lockfile',
        name: 'package-lock.json',
        canonicalPath: lockFilePath,
        originalIdentifier: lockFilePath,
        toolName: this.toolName,
        confidence: 0.9 // Slightly lower confidence as it might not exist
      }));
    }

    // Map individual vulnerable packages as entities
    if (auditData.vulnerabilities) {
      Object.keys(auditData.vulnerabilities).forEach(packageName => {
        const entityPath = `node_modules/${packageName}`;
        entities.push(new UnifiedEntity({
          id: `entity-${entityPath}`,
          type: 'dependency-package',
          name: packageName,
          canonicalPath: entityPath,
          originalIdentifier: packageName,
          toolName: this.toolName,
          confidence: 0.8 // Virtual path, not actual file
        }));
      });
    }

    return entities;
  }

  /**
   * Map npm audit vulnerabilities to unified issues
   *
   * @param {Object} auditData - npm audit data
   * @param {Array<UnifiedEntity>} entities - Mapped entities
   * @param {string} projectRoot - Project root path
   * @returns {Array<UnifiedIssue>} Vulnerability issues
   */
  _mapVulnerabilities(auditData, entities, projectRoot) {
    const issues = [];

    if (!auditData.vulnerabilities) {
      return issues;
    }

    Object.entries(auditData.vulnerabilities).forEach(([packageName, vulnInfo]) => {
      if (!vulnInfo || typeof vulnInfo !== 'object') {
        return;
      }

      // Find the corresponding entity
      const packageEntity = entities.find(e => e.name === packageName);
      if (!packageEntity) {
        console.warn(`⚠️  No entity found for package: ${packageName}`);
        return;
      }

      // Map severity
      const severity = this._mapSeverity(vulnInfo.severity);

      // Process individual vulnerabilities
      const viaEntries = Array.isArray(vulnInfo.via) ? vulnInfo.via : [];

      viaEntries.forEach((via, index) => {
        if (typeof via === 'object' && via.source) {
          const issueId = `npm-audit-${packageName}-${via.source || index}`;

          issues.push(new UnifiedIssue({
            id: issueId,
            entity: packageEntity,
            severity: severity,
            analysisType: AnalysisType.DEPENDENCY_SECURITY,
            title: via.title || `Vulnerability in ${packageName}`,
            description: this._buildDescription(via, vulnInfo, packageName),
            ruleId: via.source || `npm-audit-${packageName}`,
            line: null, // Dependencies don't have line numbers
            column: null,
            endLine: null,
            endColumn: null,
            toolName: this.toolName,
            metadata: {
              packageName: packageName,
              vulnerabilityId: via.source,
              url: via.url || '',
              cwe: via.cwe || [],
              cvss: via.cvss || {},
              severity: vulnInfo.severity,
              range: vulnInfo.range || 'unknown',
              fixAvailable: vulnInfo.fixAvailable || false,
              isDirect: vulnInfo.isDirect || false,
              effects: vulnInfo.effects || [],
              npmAuditVersion: 2
            }
          }));
        }
      });

      // If no specific vulnerabilities but general vulnerability info exists
      if (viaEntries.length === 0 && vulnInfo.severity) {
        const issueId = `npm-audit-${packageName}-general`;

        issues.push(new UnifiedIssue({
          id: issueId,
          entity: packageEntity,
          severity: severity,
          analysisType: AnalysisType.DEPENDENCY_SECURITY,
          title: `Security vulnerability in ${packageName}`,
          description: `Package ${packageName} has known security vulnerabilities. Severity: ${vulnInfo.severity}`,
          ruleId: `npm-audit-general-${packageName}`,
          line: null,
          column: null,
          endLine: null,
          endColumn: null,
          toolName: this.toolName,
          metadata: {
            packageName: packageName,
            severity: vulnInfo.severity,
            range: vulnInfo.range || 'unknown',
            fixAvailable: vulnInfo.fixAvailable || false,
            isDirect: vulnInfo.isDirect || false,
            effects: vulnInfo.effects || []
          }
        }));
      }
    });

    return issues;
  }

  /**
   * Map npm audit severity to unified severity
   *
   * @param {string} npmSeverity - npm audit severity
   * @returns {string} Unified severity
   */
  _mapSeverity(npmSeverity) {
    if (!npmSeverity) return IssueSeverity.INFO;

    switch (npmSeverity.toLowerCase()) {
      case 'critical':
        return IssueSeverity.CRITICAL;
      case 'high':
        return IssueSeverity.HIGH;
      case 'moderate':
      case 'medium':
        return IssueSeverity.MEDIUM;
      case 'low':
        return IssueSeverity.LOW;
      case 'info':
      default:
        return IssueSeverity.INFO;
    }
  }

  /**
   * Build detailed description for vulnerability
   *
   * @param {Object} via - Vulnerability details
   * @param {Object} vulnInfo - Parent vulnerability info
   * @param {string} packageName - Package name
   * @returns {string} Detailed description
   */
  _buildDescription(via, vulnInfo, packageName) {
    let description = via.title || `Security vulnerability found in ${packageName}`;

    if (via.url) {
      description += `\n\nMore information: ${via.url}`;
    }

    if (vulnInfo.range) {
      description += `\nAffected versions: ${vulnInfo.range}`;
    }

    if (vulnInfo.fixAvailable) {
      description += '\nFix available: Update to a patched version';
    }

    if (vulnInfo.isDirect) {
      description += '\nThis is a direct dependency of your project';
    } else {
      description += '\nThis is a transitive dependency';
    }

    return description;
  }

  /**
   * Create empty result for error cases
   *
   * @param {string} projectRoot - Project root path
   * @param {string} errorMessage - Error message
   * @returns {UnifiedAnalysisResult} Empty result with error
   */
  _createEmptyResult(projectRoot, errorMessage) {
    return new UnifiedAnalysisResult({
      tool: this.toolName,
      analysisType: AnalysisType.DEPENDENCY_SECURITY,
      projectPath: projectRoot,
      entities: [],
      issues: [],
      metadata: {
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = NPMAuditMapper;