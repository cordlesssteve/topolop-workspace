/**
 * OSV-Scanner Mapper - Topolop Unified Data Model Integration
 *
 * Maps OSV-Scanner output to Topolop's unified data model for cross-tool correlation
 * and city visualization. OSV-Scanner provides comprehensive vulnerability data
 * across multiple package ecosystems (npm, PyPI, Go, Rust, etc.).
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

class OSVMapper {
  constructor() {
    this.toolName = 'osv-scanner';
  }

  /**
   * Convert OSV-Scanner data to unified model
   *
   * @param {Object} osvData - Raw OSV-Scanner JSON output
   * @param {string} projectRoot - Project root path for canonical path generation
   * @param {Object} metadata - Additional analysis metadata
   * @returns {UnifiedAnalysisResult} Unified analysis result
   */
  toUnifiedModel(osvData, projectRoot = process.cwd(), metadata = {}) {
    try {
      console.log(`🔄 Mapping OSV-Scanner data to unified model...`);

      if (!osvData || typeof osvData !== 'object') {
        console.warn('⚠️  Invalid OSV data provided to mapper');
        return this._createEmptyResult(projectRoot, 'Invalid OSV data');
      }

      // Handle error cases
      if (osvData.error) {
        console.warn(`⚠️  OSV-Scanner error: ${osvData.error}`);
        return this._createEmptyResult(projectRoot, osvData.error);
      }

      // Extract vulnerabilities and source information
      const entities = this._mapSourceEntities(osvData, projectRoot);
      const issues = this._mapVulnerabilities(osvData, entities, projectRoot);

      console.log(`✅ Mapped ${issues.length} vulnerabilities from ${entities.length} sources`);

      return new UnifiedAnalysisResult({
        tool: this.toolName,
        analysisType: AnalysisType.DEPENDENCY_SECURITY,
        projectPath: projectRoot,
        entities: entities,
        issues: issues,
        metadata: {
          ...metadata,
          osvScannerVersion: osvData.version || 'unknown',
          scannedSources: this._extractScannedSources(osvData),
          totalVulnerabilities: issues.length,
          vulnerabilityDatabase: 'OSV (Open Source Vulnerabilities)',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('🚨 Error mapping OSV-Scanner data:', error);
      return this._createEmptyResult(projectRoot, `Mapping error: ${error.message}`);
    }
  }

  /**
   * Map source files and packages to unified entities
   *
   * @param {Object} osvData - OSV-Scanner data
   * @param {string} projectRoot - Project root path
   * @returns {Array<UnifiedEntity>} Source entities
   */
  _mapSourceEntities(osvData, projectRoot) {
    const entities = [];
    const entityMap = new Map(); // Prevent duplicates

    // Process scanned sources
    if (osvData.results && Array.isArray(osvData.results)) {
      osvData.results.forEach(result => {
        if (result.source && result.source.path) {
          const sourcePath = result.source.path;
          const entityKey = `source-${sourcePath}`;

          if (!entityMap.has(entityKey)) {
            const entity = new UnifiedEntity({
              id: `entity-${sourcePath}`,
              type: this._getSourceType(sourcePath),
              name: sourcePath.split('/').pop() || sourcePath,
              canonicalPath: this._normalizeSourcePath(sourcePath, projectRoot),
              originalIdentifier: sourcePath,
              toolName: this.toolName,
              confidence: 1.0
            });

            entities.push(entity);
            entityMap.set(entityKey, entity);
          }
        }

        // Process individual packages within the source
        if (result.packages && Array.isArray(result.packages)) {
          result.packages.forEach(pkg => {
            if (pkg.package && pkg.package.name) {
              const packageName = pkg.package.name;
              const entityKey = `package-${packageName}`;

              if (!entityMap.has(entityKey)) {
                const packagePath = this._generatePackagePath(pkg, result.source);

                const entity = new UnifiedEntity({
                  id: `entity-${packagePath}`,
                  type: 'dependency-package',
                  name: packageName,
                  canonicalPath: packagePath,
                  originalIdentifier: `${packageName}@${pkg.package.version || 'unknown'}`,
                  toolName: this.toolName,
                  confidence: 0.9 // High confidence for OSV data
                });

                entities.push(entity);
                entityMap.set(entityKey, entity);
              }
            }
          });
        }
      });
    }

    return entities;
  }

  /**
   * Map OSV vulnerabilities to unified issues
   *
   * @param {Object} osvData - OSV-Scanner data
   * @param {Array<UnifiedEntity>} entities - Mapped entities
   * @param {string} projectRoot - Project root path
   * @returns {Array<UnifiedIssue>} Vulnerability issues
   */
  _mapVulnerabilities(osvData, entities, projectRoot) {
    const issues = [];

    if (!osvData.results || !Array.isArray(osvData.results)) {
      return issues;
    }

    osvData.results.forEach(result => {
      if (!result.packages || !Array.isArray(result.packages)) {
        return;
      }

      result.packages.forEach(pkg => {
        if (!pkg.vulnerabilities || !Array.isArray(pkg.vulnerabilities)) {
          return;
        }

        // Find the corresponding entity
        const packageEntity = entities.find(e =>
          e.name === pkg.package?.name ||
          e.originalIdentifier?.includes(pkg.package?.name)
        );

        if (!packageEntity) {
          console.warn(`⚠️  No entity found for package: ${pkg.package?.name}`);
          return;
        }

        // Map each vulnerability
        pkg.vulnerabilities.forEach(vuln => {
          const issueId = `osv-${vuln.id || 'unknown'}-${pkg.package?.name || 'unknown'}`;

          const issue = new UnifiedIssue({
            id: issueId,
            entity: packageEntity,
            severity: this._mapSeverity(vuln),
            analysisType: AnalysisType.DEPENDENCY_SECURITY,
            title: this._buildTitle(vuln, pkg.package),
            description: this._buildDescription(vuln, pkg.package),
            ruleId: vuln.id || 'osv-vulnerability',
            line: null, // Dependencies don't have line numbers
            column: null,
            endLine: null,
            endColumn: null,
            toolName: this.toolName,
            metadata: {
              osvId: vuln.id,
              packageName: pkg.package?.name,
              packageVersion: pkg.package?.version,
              ecosystem: pkg.package?.ecosystem,
              source: result.source?.path,
              aliases: vuln.aliases || [],
              references: vuln.references || [],
              databaseSpecific: vuln.database_specific || {},
              published: vuln.published,
              modified: vuln.modified,
              withdrawn: vuln.withdrawn,
              details: vuln.details,
              summary: vuln.summary,
              affected: vuln.affected || []
            }
          });

          issues.push(issue);
        });
      });
    });

    return issues;
  }

  /**
   * Map OSV severity to unified severity
   * OSV uses CVSS scores and severity ratings
   */
  _mapSeverity(vulnerability) {
    // Check for explicit severity in database_specific
    if (vulnerability.database_specific?.severity) {
      const severity = vulnerability.database_specific.severity.toLowerCase();
      switch (severity) {
        case 'critical':
          return IssueSeverity.CRITICAL;
        case 'high':
          return IssueSeverity.HIGH;
        case 'medium':
        case 'moderate':
          return IssueSeverity.MEDIUM;
        case 'low':
          return IssueSeverity.LOW;
        default:
          break;
      }
    }

    // Check for CVSS score
    if (vulnerability.severity && Array.isArray(vulnerability.severity)) {
      for (const sev of vulnerability.severity) {
        if (sev.score && typeof sev.score === 'number') {
          if (sev.score >= 9.0) return IssueSeverity.CRITICAL;
          if (sev.score >= 7.0) return IssueSeverity.HIGH;
          if (sev.score >= 4.0) return IssueSeverity.MEDIUM;
          if (sev.score >= 0.1) return IssueSeverity.LOW;
        }
      }
    }

    // Default based on vulnerability type or aliases
    if (vulnerability.aliases && Array.isArray(vulnerability.aliases)) {
      // CVE aliases often indicate higher severity
      const hasCVE = vulnerability.aliases.some(alias => alias.startsWith('CVE-'));
      if (hasCVE) {
        return IssueSeverity.MEDIUM; // Default CVE to medium
      }
    }

    return IssueSeverity.INFO; // Default fallback
  }

  /**
   * Build vulnerability title
   */
  _buildTitle(vulnerability, packageInfo) {
    if (vulnerability.summary) {
      return vulnerability.summary;
    }

    const packageName = packageInfo?.name || 'Unknown package';
    const vulnId = vulnerability.id || 'Unknown vulnerability';

    return `${vulnId} in ${packageName}`;
  }

  /**
   * Build detailed vulnerability description
   */
  _buildDescription(vulnerability, packageInfo) {
    let description = vulnerability.details || vulnerability.summary || 'Vulnerability found in dependency';

    if (packageInfo) {
      description += `\n\nAffected package: ${packageInfo.name}@${packageInfo.version || 'unknown'}`;
      description += `\nEcosystem: ${packageInfo.ecosystem || 'unknown'}`;
    }

    if (vulnerability.id) {
      description += `\nVulnerability ID: ${vulnerability.id}`;
    }

    if (vulnerability.aliases && vulnerability.aliases.length > 0) {
      description += `\nAliases: ${vulnerability.aliases.join(', ')}`;
    }

    if (vulnerability.references && vulnerability.references.length > 0) {
      description += '\n\nReferences:';
      vulnerability.references.forEach(ref => {
        if (ref.url) {
          description += `\n- ${ref.url}`;
        }
      });
    }

    if (vulnerability.published) {
      description += `\nPublished: ${vulnerability.published}`;
    }

    if (vulnerability.modified) {
      description += `\nLast modified: ${vulnerability.modified}`;
    }

    return description;
  }

  /**
   * Determine source file type
   */
  _getSourceType(sourcePath) {
    const filename = sourcePath.split('/').pop() || sourcePath;

    if (filename === 'package-lock.json' || filename === 'yarn.lock') {
      return 'dependency-lockfile';
    }
    if (filename === 'package.json') {
      return 'dependency-manifest';
    }
    if (filename === 'requirements.txt' || filename === 'Pipfile.lock') {
      return 'dependency-manifest';
    }
    if (filename === 'Cargo.lock' || filename === 'Cargo.toml') {
      return 'dependency-manifest';
    }
    if (filename === 'go.mod' || filename === 'go.sum') {
      return 'dependency-manifest';
    }

    return 'dependency-source';
  }

  /**
   * Normalize source path relative to project root
   */
  _normalizeSourcePath(sourcePath, projectRoot) {
    // Remove absolute path prefixes and normalize to relative paths
    if (sourcePath.startsWith(projectRoot)) {
      return sourcePath.substring(projectRoot.length + 1);
    }

    // Remove common temporary path prefixes
    if (sourcePath.includes('/tmp/') || sourcePath.includes('/temp/')) {
      const parts = sourcePath.split('/');
      const relevantParts = parts.slice(-2); // Take last 2 parts
      return relevantParts.join('/');
    }

    return sourcePath;
  }

  /**
   * Generate package path for entity identification
   */
  _generatePackagePath(packageInfo, source) {
    const packageName = packageInfo.package?.name || 'unknown';
    const ecosystem = packageInfo.package?.ecosystem || 'unknown';

    // Generate ecosystem-specific paths
    switch (ecosystem.toLowerCase()) {
      case 'npm':
        return `node_modules/${packageName}`;
      case 'pypi':
        return `site-packages/${packageName}`;
      case 'cargo':
        return `target/package/${packageName}`;
      case 'go':
        return `go/pkg/${packageName}`;
      default:
        return `dependencies/${ecosystem}/${packageName}`;
    }
  }

  /**
   * Extract scanned sources summary
   */
  _extractScannedSources(osvData) {
    const sources = [];

    if (osvData.results && Array.isArray(osvData.results)) {
      osvData.results.forEach(result => {
        if (result.source && result.source.path) {
          sources.push({
            path: result.source.path,
            type: result.source.type || 'unknown',
            packageCount: result.packages ? result.packages.length : 0
          });
        }
      });
    }

    return sources;
  }

  /**
   * Create empty result for error cases
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

module.exports = OSVMapper;