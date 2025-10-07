/**
 * NPM Audit Dependency Adapter - Topolop Phase 2
 *
 * Built-in npm audit integration for baseline dependency security analysis.
 * Complements Snyk adapter with zero-cost security scanning.
 *
 * Created: 2025-09-20
 * Phase: 2.0 - Workflow Integration
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DependencyAdapter,
  DependencyIssue,
  DependencyInfo,
  VulnerabilityInfo
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity } from '@topolop/shared-types';

/**
 * NPM Audit configuration
 */
export interface NpmAuditConfig {
  auditLevel?: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  production?: boolean;
  includeDevDependencies?: boolean;
  timeout?: number;
}

/**
 * NPM Audit vulnerability structure
 */
interface NpmAuditVulnerability {
  source: number;
  name: string;
  dependency: string;
  title: string;
  url: string;
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  range: string;
  versions: string[];
  via: string[] | number[];
  effects: string[];
  fixAvailable: boolean | {
    name: string;
    version: string;
    isSemVerMajor: boolean;
  };
}

/**
 * NPM Audit report structure
 */
interface NpmAuditReport {
  auditReportVersion: number;
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies: {
      prod: number;
      dev: number;
      optional: number;
      peer: number;
      peerOptional: number;
      total: number;
    };
  };
}

/**
 * Package lock dependency structure
 */
interface PackageLockDependency {
  version: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
  dependencies?: Record<string, PackageLockDependency>;
}

/**
 * Enhanced NPM Audit dependency adapter
 */
export class NpmAuditAdapter implements DependencyAdapter {
  public readonly name = 'NPM Audit Scanner';
  public readonly version = '1.0.0';
  public readonly type = 'security' as const;

  public readonly capabilities = {
    vulnerabilityScanning: true,
    licenseDetection: false, // NPM audit doesn't provide license info
    usageAnalysis: false,
    fixSuggestions: true
  };

  private config: NpmAuditConfig = {};

  /**
   * Initialize NPM Audit adapter with configuration
   */
  async initialize(config: NpmAuditConfig): Promise<void> {
    this.config = {
      auditLevel: 'low',
      production: false,
      includeDevDependencies: true,
      timeout: 30000,
      ...config
    };

    // Verify npm is available
    try {
      execSync('npm --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('NPM is not available in the system PATH');
    }
  }

  /**
   * Analyze dependency tree using npm audit
   */
  async analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]> {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageLockPath = join(projectPath, 'package-lock.json');

    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project path');
    }

    try {
      // Run npm audit and get JSON report
      const auditReport = await this.runNpmAudit(projectPath);

      // Load package.json and package-lock.json for dependency info
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const packageLock = existsSync(packageLockPath)
        ? JSON.parse(readFileSync(packageLockPath, 'utf8'))
        : null;

      // Convert vulnerabilities to dependency issues
      const issues: DependencyIssue[] = [];

      for (const [packageName, vulnerability] of Object.entries(auditReport.vulnerabilities)) {
        const dependencyInfo = this.createDependencyInfo(
          packageName,
          vulnerability,
          packageJson,
          packageLock
        );

        const issue = this.createSecurityIssue(vulnerability, dependencyInfo, projectPath);
        issues.push(issue);
      }

      return issues;

    } catch (error) {
      throw new Error(`NPM Audit analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check license compliance (not supported by npm audit)
   */
  async checkLicenseCompliance(dependencies: DependencyInfo[]): Promise<DependencyIssue[]> {
    // NPM audit doesn't provide license information
    return [];
  }

  /**
   * Assess supply chain risk based on vulnerability data
   */
  assessSupplyChainRisk(dependency: DependencyInfo): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Factor 1: Vulnerability severity and count
    const criticalVulns = dependency.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = dependency.vulnerabilities.filter(v => v.severity === 'high').length;

    riskScore += criticalVulns * 10;
    riskScore += highVulns * 5;
    riskScore += dependency.vulnerabilities.length * 2;

    // Factor 2: Dependency type
    if (dependency.type === 'direct') riskScore += 2;
    if (dependency.type === 'transitive') riskScore += 1;

    // Factor 3: Update availability
    if (dependency.updateAvailable) riskScore -= 1; // Lower risk if fix available

    // Convert to risk level
    if (riskScore >= 15) return 'critical';
    if (riskScore >= 8) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Run npm audit command and parse JSON output
   */
  private async runNpmAudit(projectPath: string): Promise<NpmAuditReport> {
    const auditArgs = [
      'audit',
      '--json',
      this.config.production ? '--production' : '',
      this.config.auditLevel ? `--audit-level=${this.config.auditLevel}` : ''
    ].filter(Boolean);

    try {
      const output = execSync(`npm ${auditArgs.join(' ')}`, {
        cwd: projectPath,
        encoding: 'utf8',
        timeout: this.config.timeout,
        stdio: 'pipe'
      });

      return JSON.parse(output);

    } catch (error: any) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch (parseError) {
          throw new Error(`Failed to parse npm audit output: ${parseError}`);
        }
      }
      throw new Error(`npm audit execution failed: ${error.message}`);
    }
  }

  /**
   * Create dependency information from npm audit data
   */
  private createDependencyInfo(
    packageName: string,
    vulnerability: NpmAuditVulnerability,
    packageJson: any,
    packageLock: any
  ): DependencyInfo {
    const isDirect = !!(packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]);
    const isDevDependency = !!packageJson.devDependencies?.[packageName];

    // Get version from package-lock if available
    let version = 'unknown';
    let depth = 0;

    if (packageLock?.packages?.[`node_modules/${packageName}`]) {
      version = packageLock.packages[`node_modules/${packageName}`].version;
    } else if (packageLock?.dependencies?.[packageName]) {
      version = packageLock.dependencies[packageName].version;
    }

    // Calculate depth (simplified)
    if (!isDirect) {
      depth = this.calculateDependencyDepth(packageName, packageLock);
    }

    return {
      packageName,
      version,
      type: isDirect ? (isDevDependency ? 'dev' : 'direct') : 'transitive',
      depth,
      licenses: [], // npm audit doesn't provide license info
      vulnerabilities: [this.convertNpmVulnerability(vulnerability)],
      updateAvailable: !!vulnerability.fixAvailable,
      usageAnalysis: {
        isUsed: true,
        usageCount: vulnerability.effects.length || 1,
        criticalUsage: vulnerability.severity === 'critical' || vulnerability.severity === 'high'
      }
    };
  }

  /**
   * Create security issue from npm audit vulnerability
   */
  private createSecurityIssue(
    vulnerability: NpmAuditVulnerability,
    dependencyInfo: DependencyInfo,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `npm-audit-${vulnerability.source}`,
      title: vulnerability.title,
      description: `${vulnerability.title} in ${vulnerability.name}. ${vulnerability.url}`,
      severity: this.convertSeverity(vulnerability.severity),
      analysisType: AnalysisType.DEPENDENCY_SECURITY,

      entity: {
        id: `dep-${vulnerability.name}`,
        name: vulnerability.name,
        type: 'dependency',
        canonicalPath: `node_modules/${vulnerability.name}`,
        originalIdentifier: vulnerability.name,
        toolName: this.name,
        confidence: 0.9
      },

      ruleId: 'npm-audit-vulnerability',
      line: 1,
      column: 1,
      endLine: null,
      endColumn: null,
      toolName: this.name,

      dependencyInfo,
      dependencyCategory: 'security',
      supplyChainRisk: this.assessSupplyChainRisk(dependencyInfo),

      remediationSuggestion: this.createRemediationSuggestion(vulnerability),

      metadata: {
        toolName: this.name,
        category: 'security',
        confidence: 0.9,
        tags: [
          'npm-audit',
          vulnerability.severity,
          ...(vulnerability.effects || [])
        ]
      },

      // Required UnifiedIssue properties
      createdAt: new Date().toISOString(),
      isNearby: () => false,
      getLocationFingerprint: () => `npm-audit-${vulnerability.source}`
    } as DependencyIssue;
  }

  /**
   * Calculate dependency depth in the tree
   */
  private calculateDependencyDepth(packageName: string, packageLock: any): number {
    if (!packageLock?.dependencies) return 1;

    // Simplified depth calculation - would need more sophisticated tree traversal
    let depth = 1;
    const searchQueue = [{ deps: packageLock.dependencies, currentDepth: 1 }];

    while (searchQueue.length > 0) {
      const { deps, currentDepth } = searchQueue.shift()!;

      for (const [depName, depInfo] of Object.entries(deps)) {
        if (depName === packageName) {
          return currentDepth;
        }

        if ((depInfo as any).dependencies) {
          searchQueue.push({
            deps: (depInfo as any).dependencies,
            currentDepth: currentDepth + 1
          });
        }
      }
    }

    return depth;
  }

  /**
   * Convert npm audit vulnerability to unified format
   */
  private convertNpmVulnerability(vulnerability: NpmAuditVulnerability): VulnerabilityInfo {
    return {
      id: vulnerability.source.toString(),
      severity: this.convertSeverity(vulnerability.severity),
      description: vulnerability.title,
      patchedVersions: this.extractPatchedVersions(vulnerability),
      exploitExists: false // npm audit doesn't provide exploit information
    };
  }

  /**
   * Extract patched versions from fix information
   */
  private extractPatchedVersions(vulnerability: NpmAuditVulnerability): string[] {
    if (typeof vulnerability.fixAvailable === 'object' && vulnerability.fixAvailable.version) {
      return [vulnerability.fixAvailable.version];
    }
    return [];
  }

  /**
   * Convert npm audit severity to unified severity
   */
  private convertSeverity(npmSeverity: string): IssueSeverity {
    switch (npmSeverity.toLowerCase()) {
      case 'critical': return IssueSeverity.CRITICAL;
      case 'high': return IssueSeverity.HIGH;
      case 'moderate': return IssueSeverity.MEDIUM;
      case 'low': return IssueSeverity.LOW;
      case 'info': return IssueSeverity.LOW;
      default: return IssueSeverity.MEDIUM;
    }
  }

  /**
   * Create remediation suggestion based on fix availability
   */
  private createRemediationSuggestion(vulnerability: NpmAuditVulnerability) {
    if (vulnerability.fixAvailable) {
      if (typeof vulnerability.fixAvailable === 'object') {
        const fix = vulnerability.fixAvailable;
        return {
          action: 'update' as const,
          description: `Update ${fix.name} to version ${fix.version}${fix.isSemVerMajor ? ' (breaking change)' : ''}`,
          automatable: !fix.isSemVerMajor
        };
      } else {
        return {
          action: 'update' as const,
          description: `Run 'npm audit fix' to automatically resolve this vulnerability`,
          automatable: true
        };
      }
    }

    return {
      action: 'review' as const,
      description: 'No automated fix available. Consider manual review and alternative packages.',
      automatable: false
    };
  }
}