/**
 * Snyk Security Dependency Adapter - Topolop Phase 2
 *
 * Comprehensive dependency security analysis using Snyk API.
 * Integrates vulnerability scanning, license compliance, and supply chain risk assessment.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 */

import axios, { AxiosInstance } from 'axios';
import * as semver from 'semver';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import {
  DependencyAdapter,
  DependencyIssue,
  DependencyInfo,
  VulnerabilityInfo
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity } from '@topolop/shared-types';

/**
 * Snyk API configuration
 */
export interface SnykConfig {
  apiToken: string;
  orgId?: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Snyk vulnerability response structure
 */
interface SnykVulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore?: number;
  cve?: string[];
  exploitMaturity?: 'mature' | 'proof-of-concept' | 'no-known-exploit';
  patches: Array<{
    version: string;
    modificationTime: string;
  }>;
  upgradePath: string[];
}

/**
 * Snyk project test response
 */
interface SnykTestResponse {
  ok: boolean;
  issues: {
    vulnerabilities: SnykVulnerability[];
    licenses: Array<{
      id: string;
      title: string;
      severity: string;
      packageName: string;
      version: string;
      licenseText: string;
    }>;
  };
  dependencyCount: number;
  packageManager: string;
}

/**
 * Package.json dependency structure
 */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Enhanced Snyk dependency security adapter
 */
export class SnykAdapter implements DependencyAdapter {
  public readonly name = 'Snyk Security Scanner';
  public readonly version = '1.0.0';
  public readonly type = 'security' as const;

  public readonly capabilities = {
    vulnerabilityScanning: true,
    licenseDetection: true,
    usageAnalysis: false, // Requires additional tooling
    fixSuggestions: true
  };

  private config: SnykConfig | null = null;
  private apiClient: AxiosInstance | null = null;

  /**
   * Initialize Snyk adapter with configuration
   */
  async initialize(config: SnykConfig): Promise<void> {
    this.config = config;

    this.apiClient = axios.create({
      baseURL: config.baseUrl || 'https://snyk.io/api/v1',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `token ${config.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `Topolop-Snyk-Adapter/${this.version}`
      }
    });

    // Verify API connectivity
    try {
      await this.apiClient.get('/user/me');
    } catch (error) {
      throw new Error(`Snyk API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze dependency tree for security vulnerabilities and license issues
   */
  async analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]> {
    if (!this.apiClient || !this.config) {
      throw new Error('Snyk adapter not initialized');
    }

    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project path');
    }

    try {
      // Read package.json
      const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      // Test project for vulnerabilities
      const testResponse = await this.testProject(projectPath);

      // Convert to dependency issues
      const issues: DependencyIssue[] = [];

      // Process vulnerabilities
      for (const vuln of testResponse.issues.vulnerabilities) {
        const dependencyInfo = this.extractDependencyInfo(vuln, packageJson);
        const issue = this.createSecurityIssue(vuln, dependencyInfo);
        issues.push(issue);
      }

      // Process license issues
      for (const license of testResponse.issues.licenses) {
        const dependencyInfo = this.createDependencyInfoFromLicense(license, packageJson);
        const issue = this.createLicenseIssue(license, dependencyInfo);
        issues.push(issue);
      }

      return issues;

    } catch (error) {
      throw new Error(`Dependency analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check license compliance for dependencies
   */
  async checkLicenseCompliance(dependencies: DependencyInfo[]): Promise<DependencyIssue[]> {
    if (!this.apiClient) {
      throw new Error('Snyk adapter not initialized');
    }

    const issues: DependencyIssue[] = [];

    // Define problematic licenses
    const problematicLicenses = [
      'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0',
      'CPOL-1.02', 'EPL-1.0', 'EPL-2.0'
    ];

    for (const dep of dependencies) {
      for (const license of dep.licenses) {
        if (problematicLicenses.includes(license)) {
          const issue: DependencyIssue = {
            id: `license-${dep.packageName}-${license}`,
            title: `Potentially Problematic License: ${license}`,
            description: `Package ${dep.packageName} uses ${license} license which may have compliance implications`,
            severity: this.getLicenseSeverity(license),
            analysisType: AnalysisType.DEPENDENCY_LICENSING,

            entity: {
              id: `dep-${dep.packageName}`,
              name: dep.packageName,
              type: 'dependency',
              canonicalPath: `node_modules/${dep.packageName}`,
              originalIdentifier: dep.packageName,
              toolName: this.name,
              confidence: 0.9
            },

            ruleId: 'license-compliance',
            line: 1,
            column: 1,
            endLine: null,
            endColumn: null,
            toolName: this.name,

            dependencyInfo: dep,
            dependencyCategory: 'licensing',
            supplyChainRisk: 'medium',

            remediationSuggestion: {
              action: 'review',
              description: `Review ${license} license terms and ensure compliance with organizational policies`,
              automatable: false
            },

            metadata: {
              toolName: this.name,
              category: 'license',
              confidence: 0.9,
              tags: ['license-compliance', license.toLowerCase()]
            },

            // Required UnifiedIssue properties
            createdAt: new Date().toISOString(),
            isNearby: () => false,
            getLocationFingerprint: () => `license-${dep.packageName}-${license}`
          } as DependencyIssue;

          issues.push(issue);
        }
      }
    }

    return issues;
  }

  /**
   * Assess supply chain risk for a dependency
   */
  assessSupplyChainRisk(dependency: DependencyInfo): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Factor 1: Vulnerability count and severity
    const criticalVulns = dependency.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = dependency.vulnerabilities.filter(v => v.severity === 'high').length;

    riskScore += criticalVulns * 10;
    riskScore += highVulns * 5;
    riskScore += dependency.vulnerabilities.length * 1;

    // Factor 2: Dependency depth (transitive dependencies are riskier)
    if (dependency.depth > 3) riskScore += 3;
    if (dependency.depth > 5) riskScore += 5;

    // Factor 3: Package type
    if (dependency.type === 'direct') riskScore += 0;
    if (dependency.type === 'transitive') riskScore += 2;

    // Factor 4: Version staleness
    if (dependency.updateAvailable) riskScore += 2;

    // Factor 5: License risk
    const riskLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'];
    if (dependency.licenses.some(l => riskLicenses.includes(l))) {
      riskScore += 3;
    }

    // Convert score to risk level
    if (riskScore >= 20) return 'critical';
    if (riskScore >= 10) return 'high';
    if (riskScore >= 5) return 'medium';
    return 'low';
  }

  /**
   * Test project using Snyk API
   */
  private async testProject(projectPath: string): Promise<SnykTestResponse> {
    if (!this.apiClient) {
      throw new Error('API client not initialized');
    }

    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = readFileSync(packageJsonPath, 'utf8');

    const response = await this.apiClient.post('/test/npm', {
      files: {
        target: {
          contents: packageJson
        }
      }
    });

    return response.data;
  }

  /**
   * Extract dependency information from vulnerability data
   */
  private extractDependencyInfo(vuln: SnykVulnerability, packageJson: PackageJson): DependencyInfo {
    // Parse package name from vulnerability (Snyk format: package@version)
    const packageInfo = this.parsePackageFromVuln(vuln);

    return {
      packageName: packageInfo.name,
      version: packageInfo.version,
      type: this.getDependencyType(packageInfo.name, packageJson),
      depth: this.calculateDepth(packageInfo.name), // Simplified - would need dependency tree
      licenses: [], // Would need separate license lookup
      vulnerabilities: [this.convertSnykVulnerability(vuln)],
      updateAvailable: vuln.upgradePath.length > 0,
      usageAnalysis: {
        isUsed: true, // Would need usage analysis
        usageCount: 1,
        criticalUsage: true
      }
    };
  }

  /**
   * Create dependency issue from Snyk vulnerability
   */
  private createSecurityIssue(vuln: SnykVulnerability, dependencyInfo: DependencyInfo): DependencyIssue {
    return {
      id: `snyk-${vuln.id}`,
      title: vuln.title,
      description: vuln.description,
      severity: this.convertSeverity(vuln.severity),
      analysisType: AnalysisType.DEPENDENCY_SECURITY,

      entity: {
        id: `dep-${dependencyInfo.packageName}`,
        name: dependencyInfo.packageName,
        type: 'dependency',
        canonicalPath: `node_modules/${dependencyInfo.packageName}`,
        originalIdentifier: dependencyInfo.packageName,
        toolName: this.name,
        confidence: 0.95
      },

      ruleId: 'snyk-vulnerability',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'security',
      supplyChainRisk: this.assessSupplyChainRisk(dependencyInfo),

      remediationSuggestion: this.createRemediationSuggestion(vuln),

      metadata: {
        toolName: this.name,
        category: 'security',
        confidence: 0.95,
        tags: ['vulnerability', vuln.severity, ...(vuln.cve || [])]
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `snyk-${vuln.id}`
    } as DependencyIssue;
  }

  /**
   * Create dependency issue from license information
   */
  private createLicenseIssue(license: any, dependencyInfo: DependencyInfo): DependencyIssue {
    return {
      id: `license-${license.id}`,
      title: `License Issue: ${license.title}`,
      description: `License compliance issue detected for ${license.packageName}`,
      severity: this.convertSeverity(license.severity),
      analysisType: AnalysisType.DEPENDENCY_LICENSING,

      entity: {
        id: `dep-${license.packageName}`,
        name: license.packageName,
        type: 'dependency',
        canonicalPath: `node_modules/${license.packageName}`,
        originalIdentifier: license.packageName,
        toolName: this.name,
        confidence: 0.9
      },

      ruleId: 'snyk-license-compliance',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'licensing',
      supplyChainRisk: 'medium',

      remediationSuggestion: {
        action: 'review',
        description: `Review license terms for ${license.packageName}`,
        automatable: false
      },

      metadata: {
        toolName: this.name,
        category: 'license',
        confidence: 0.9,
        tags: ['license', license.severity]
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `license-${license.id}`
    } as DependencyIssue;
  }

  /**
   * Helper methods
   */
  private parsePackageFromVuln(vuln: SnykVulnerability): { name: string; version: string } {
    // Simplified parsing - would need more robust implementation
    return {
      name: vuln.title.split('@')[0] || 'unknown',
      version: '0.0.0'
    };
  }

  private getDependencyType(packageName: string, packageJson: PackageJson): 'direct' | 'transitive' | 'dev' | 'peer' {
    if (packageJson.dependencies?.[packageName]) return 'direct';
    if (packageJson.devDependencies?.[packageName]) return 'dev';
    if (packageJson.peerDependencies?.[packageName]) return 'peer';
    return 'transitive';
  }

  private calculateDepth(packageName: string): number {
    // Simplified - would need full dependency tree analysis
    return 1;
  }

  private convertSnykVulnerability(vuln: SnykVulnerability): VulnerabilityInfo {
    return {
      id: vuln.id,
      cve: vuln.cve?.[0],
      severity: this.convertSeverity(vuln.severity),
      cvssScore: vuln.cvssScore,
      description: vuln.description,
      patchedVersions: vuln.patches.map(p => p.version),
      exploitExists: vuln.exploitMaturity === 'mature'
    };
  }

  private convertSeverity(snykSeverity: string): IssueSeverity {
    switch (snykSeverity.toLowerCase()) {
      case 'critical': return IssueSeverity.CRITICAL;
      case 'high': return IssueSeverity.HIGH;
      case 'medium': return IssueSeverity.MEDIUM;
      case 'low': return IssueSeverity.LOW;
      default: return IssueSeverity.MEDIUM;
    }
  }

  private getLicenseSeverity(license: string): IssueSeverity {
    const criticalLicenses = ['AGPL-1.0', 'AGPL-3.0'];
    const highLicenses = ['GPL-2.0', 'GPL-3.0'];

    if (criticalLicenses.includes(license)) return IssueSeverity.CRITICAL;
    if (highLicenses.includes(license)) return IssueSeverity.HIGH;
    return IssueSeverity.MEDIUM;
  }

  private createRemediationSuggestion(vuln: SnykVulnerability) {
    if (vuln.upgradePath.length > 0) {
      return {
        action: 'update' as const,
        description: `Update to version ${vuln.upgradePath[vuln.upgradePath.length - 1]} to fix vulnerability`,
        automatable: true
      };
    }

    if (vuln.patches.length > 0) {
      return {
        action: 'update' as const,
        description: `Apply patch version ${vuln.patches[0]?.version || 'latest'}`,
        automatable: true
      };
    }

    return {
      action: 'review' as const,
      description: 'No automated fix available, manual review required',
      automatable: false
    };
  }

  private createDependencyInfoFromLicense(license: any, packageJson: PackageJson): DependencyInfo {
    return {
      packageName: license.packageName,
      version: license.version,
      type: this.getDependencyType(license.packageName, packageJson),
      depth: 1,
      licenses: [license.title],
      vulnerabilities: [],
      updateAvailable: false,
      usageAnalysis: {
        isUsed: true,
        usageCount: 1,
        criticalUsage: false
      }
    };
  }
}