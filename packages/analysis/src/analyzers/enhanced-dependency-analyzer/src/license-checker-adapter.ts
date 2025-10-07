/**
 * License Checker Dependency Adapter - Topolop Phase 2
 *
 * Analyzes license compliance, compatibility, and policy violations
 * using license-checker library and custom compliance rules.
 *
 * Created: 2025-09-27
 * Phase: 2.0 - Workflow Integration - Sprint 3-4
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  DependencyAdapter,
  DependencyIssue,
  DependencyInfo,
  WorkflowRecommendation
} from '@topolop/shared-types';
import { AnalysisType, IssueSeverity, UnifiedEntity } from '@topolop/shared-types';

/**
 * License compatibility matrix and risk levels
 */
const LICENSE_COMPATIBILITY = {
  // Permissive licenses (low risk)
  permissive: ['MIT', 'BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC'],

  // Weak copyleft (medium risk)
  weakCopyleft: ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-2.0'],

  // Strong copyleft (high risk for proprietary)
  strongCopyleft: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],

  // Commercial/Proprietary (requires review)
  commercial: ['Commercial', 'Proprietary', 'Custom'],

  // Unknown or unspecified (high risk)
  unknown: ['UNKNOWN', 'UNLICENSED', '']
};

/**
 * License checker configuration
 */
export interface LicenseCheckerConfig {
  allowedLicenses?: string[];
  forbiddenLicenses?: string[];
  customLicenseFile?: string;
  includeDevDependencies?: boolean;
  includePeerDependencies?: boolean;
  failOnDisallowed?: boolean;
  excludePrivatePackages?: boolean;
}

/**
 * License information structure
 */
interface PackageLicense {
  name: string;
  version: string;
  licenses: string | string[];
  repository?: string;
  publisher?: string;
  email?: string;
  path: string;
  licenseFile?: string;
}

/**
 * License analysis result
 */
interface LicenseAnalysisResult {
  [packageName: string]: PackageLicense;
}

/**
 * Enhanced License Checker adapter for compliance analysis
 */
export class LicenseCheckerAdapter implements DependencyAdapter {
  public readonly name = 'License Checker Adapter';
  public readonly version = '1.0.0';
  public readonly type = 'licensing' as const;
  public readonly capabilities = {
    vulnerabilityScanning: false,
    licenseDetection: true,
    usageAnalysis: false,
    fixSuggestions: true
  };

  private config: LicenseCheckerConfig;

  constructor(config: LicenseCheckerConfig = {}) {
    this.config = {
      allowedLicenses: ['MIT', 'BSD', 'Apache-2.0', 'ISC'],
      forbiddenLicenses: ['GPL-3.0', 'AGPL-3.0'],
      includeDevDependencies: false,
      includePeerDependencies: false,
      failOnDisallowed: false,
      excludePrivatePackages: true,
      ...config
    };
  }

  /**
   * Initialize the adapter with configuration
   */
  async initialize(config: any): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Analyze dependency tree for license compliance
   */
  async analyzeDependencyTree(projectPath: string): Promise<DependencyIssue[]> {
    // Delegate to checkLicenseCompliance for main analysis
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return [];
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});

    return this.checkLicenseCompliance(dependencies.map(name => ({ name })));
  }

  /**
   * Main license compliance checking
   */
  async checkLicenseCompliance(dependencies: any[]): Promise<DependencyIssue[]> {
    try {
      // Get current working directory for package analysis
      const projectPath = process.cwd();

      // Run license-checker
      const licenseData = await this.runLicenseChecker(projectPath);

      // Analyze license compliance
      const issues: DependencyIssue[] = [];

      for (const [packageName, licenseInfo] of Object.entries(licenseData)) {
        const packageIssues = this.analyzeLicenseCompliance(packageName, licenseInfo, projectPath);
        issues.push(...packageIssues);
      }

      // Add summary analysis
      issues.push(...this.createLicenseSummary(licenseData, projectPath));

      return issues;

    } catch (error) {
      console.error('Error checking license compliance:', error);
      return [];
    }
  }

  /**
   * Assess supply chain risk based on license type
   */
  assessSupplyChainRisk(dependency: any): 'low' | 'medium' | 'high' | 'critical' {
    const licenses = Array.isArray(dependency.licenses) ? dependency.licenses : [dependency.licenses];

    // Check for high-risk licenses
    for (const license of licenses) {
      if (LICENSE_COMPATIBILITY.strongCopyleft.includes(license)) {
        return 'high';
      }
      if (LICENSE_COMPATIBILITY.unknown.includes(license)) {
        return 'critical';
      }
      if (LICENSE_COMPATIBILITY.commercial.includes(license)) {
        return 'high';
      }
    }

    // Check for medium-risk licenses
    for (const license of licenses) {
      if (LICENSE_COMPATIBILITY.weakCopyleft.includes(license)) {
        return 'medium';
      }
    }

    return 'low';
  }

  /**
   * Run license-checker command
   */
  private async runLicenseChecker(projectPath: string): Promise<LicenseAnalysisResult> {
    try {
      const cmd = this.buildLicenseCheckerCommand();

      const output = execSync(cmd, {
        cwd: projectPath,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 120000 // 2 minute timeout
      });

      return JSON.parse(output);

    } catch (error) {
      console.warn('License-checker not available, using package.json fallback');
      return this.fallbackLicenseAnalysis(projectPath);
    }
  }

  /**
   * Build license-checker command
   */
  private buildLicenseCheckerCommand(): string {
    const cmd = ['npx license-checker'];

    // JSON output
    cmd.push('--json');

    // Include/exclude options
    if (!this.config.includeDevDependencies) {
      cmd.push('--production');
    }

    if (this.config.excludePrivatePackages) {
      cmd.push('--excludePrivatePackages');
    }

    // Custom license file
    if (this.config.customLicenseFile) {
      cmd.push(`--customPath ${this.config.customLicenseFile}`);
    }

    return cmd.join(' ');
  }

  /**
   * Fallback license analysis using package.json
   */
  private fallbackLicenseAnalysis(projectPath: string): LicenseAnalysisResult {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    const result: LicenseAnalysisResult = {};

    // Add project itself
    if (packageJson.license) {
      result[packageJson.name] = {
        name: packageJson.name,
        version: packageJson.version,
        licenses: packageJson.license,
        path: projectPath
      };
    }

    return result;
  }

  /**
   * Analyze license compliance for a package
   */
  private analyzeLicenseCompliance(
    packageName: string,
    licenseInfo: PackageLicense,
    projectPath: string
  ): DependencyIssue[] {
    const issues: DependencyIssue[] = [];
    const licenses = Array.isArray(licenseInfo.licenses)
      ? licenseInfo.licenses
      : [licenseInfo.licenses];

    // Check each license
    for (const license of licenses) {
      const riskLevel = this.getLicenseRiskLevel(license);
      const isAllowed = this.isLicenseAllowed(license);
      const isForbidden = this.isLicenseForbidden(license);

      // Create issue for policy violations
      if (isForbidden || (!isAllowed && this.config.allowedLicenses)) {
        issues.push(this.createLicensePolicyIssue(packageName, licenseInfo, license, projectPath));
      }

      // Create issue for high-risk licenses
      if (riskLevel === 'high' || riskLevel === 'critical') {
        issues.push(this.createLicenseRiskIssue(packageName, licenseInfo, license, riskLevel, projectPath));
      }

      // Create info issue for unknown licenses
      if (riskLevel === 'unknown') {
        issues.push(this.createUnknownLicenseIssue(packageName, licenseInfo, license, projectPath));
      }
    }

    return issues;
  }

  /**
   * Get license risk level
   */
  private getLicenseRiskLevel(license: string): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
    if (LICENSE_COMPATIBILITY.permissive.includes(license)) return 'low';
    if (LICENSE_COMPATIBILITY.weakCopyleft.includes(license)) return 'medium';
    if (LICENSE_COMPATIBILITY.strongCopyleft.includes(license)) return 'high';
    if (LICENSE_COMPATIBILITY.commercial.includes(license)) return 'high';
    if (LICENSE_COMPATIBILITY.unknown.includes(license) || !license) return 'critical';
    return 'unknown';
  }

  /**
   * Check if license is in allowed list
   */
  private isLicenseAllowed(license: string): boolean {
    if (!this.config.allowedLicenses) return true;
    return this.config.allowedLicenses.includes(license);
  }

  /**
   * Check if license is in forbidden list
   */
  private isLicenseForbidden(license: string): boolean {
    if (!this.config.forbiddenLicenses) return false;
    return this.config.forbiddenLicenses.includes(license);
  }

  /**
   * Create license policy violation issue
   */
  private createLicensePolicyIssue(
    packageName: string,
    licenseInfo: PackageLicense,
    license: string,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `license-policy-${packageName}-${license}`,
      title: `License policy violation: ${packageName} (${license})`,
      description: `Package '${packageName}' uses license '${license}' which violates the project's license policy.`,
      entity: new UnifiedEntity({
        id: `license-${packageName}`,
        type: 'dependency',
        name: packageName,
        canonicalPath: `package.json#dependencies.${packageName}`
      }),
      severity: IssueSeverity.HIGH,
      analysisType: AnalysisType.DEPENDENCY_LICENSING,
      ruleId: 'license-policy-violation',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'License Checker Adapter',
      metadata: { license: license, policy: 'restrictive' },
      createdAt: new Date().toISOString(),
      dependencyInfo: {
        packageName: packageName,
        version: licenseInfo.version,
        type: 'direct',
        depth: 0,
        licenses: [license],
        vulnerabilities: []
      },
      dependencyCategory: 'licensing',
      supplyChainRisk: this.assessSupplyChainRisk({ licenses: license }),
      remediationSuggestion: {
        action: 'replace',
        description: `Replace package '${packageName}' with an alternative that uses an allowed license`,
        automatable: false
      }
    } as unknown as DependencyIssue;
  }

  /**
   * Create license risk issue
   */
  private createLicenseRiskIssue(
    packageName: string,
    licenseInfo: PackageLicense,
    license: string,
    riskLevel: string,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `license-risk-${packageName}-${license}`,
      title: `${riskLevel.toUpperCase()} license risk: ${packageName} (${license})`,
      description: `Package '${packageName}' uses '${license}' license which may pose ${riskLevel} risk for commercial use.`,
      entity: new UnifiedEntity({
        id: `license-risk-${packageName}`,
        type: 'dependency',
        name: packageName,
        canonicalPath: `package.json#dependencies.${packageName}`
      }),
      severity: riskLevel === 'critical' ? IssueSeverity.CRITICAL : IssueSeverity.MEDIUM,
      analysisType: AnalysisType.DEPENDENCY_LICENSING,
      ruleId: 'license-risk-assessment',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'License Checker Adapter',
      metadata: { riskLevel: riskLevel, licenses: licenseInfo.licenses },
      createdAt: new Date().toISOString(),
      dependencyInfo: {
        packageName: packageName,
        version: licenseInfo.version,
        type: 'direct',
        depth: 0,
        licenses: [license],
        vulnerabilities: []
      },
      dependencyCategory: 'licensing',
      supplyChainRisk: this.assessSupplyChainRisk({ licenses: license }),
      remediationSuggestion: {
        action: 'review',
        description: `Review legal implications of ${license} license for your use case`,
        automatable: false
      }
    } as unknown as DependencyIssue;
  }

  /**
   * Create unknown license issue
   */
  private createUnknownLicenseIssue(
    packageName: string,
    licenseInfo: PackageLicense,
    license: string,
    projectPath: string
  ): DependencyIssue {
    return {
      id: `license-unknown-${packageName}`,
      title: `Unknown license: ${packageName}`,
      description: `Package '${packageName}' has unknown or unspecified license information.`,
      entity: new UnifiedEntity({
        id: `license-unknown-${packageName}`,
        type: 'dependency',
        name: packageName,
        canonicalPath: `package.json#dependencies.${packageName}`
      }),
      severity: IssueSeverity.MEDIUM,
      analysisType: AnalysisType.DEPENDENCY_LICENSING,
      ruleId: 'license-unknown',
      line: 0,
      column: 0,
      endLine: 0,
      endColumn: 0,
      toolName: 'License Checker Adapter',
      metadata: { licenses: licenseInfo.licenses },
      createdAt: new Date().toISOString(),
      dependencyInfo: {
        packageName: packageName,
        version: licenseInfo.version,
        type: 'direct',
        depth: 0,
        licenses: [license],
        vulnerabilities: []
      },
      dependencyCategory: 'licensing',
      supplyChainRisk: 'critical',
      remediationSuggestion: {
        action: 'review',
        description: `Investigate license information for package '${packageName}'`,
        automatable: false
      }
    } as unknown as DependencyIssue;
  }

  /**
   * Create license summary analysis
   */
  private createLicenseSummary(
    licenseData: LicenseAnalysisResult,
    projectPath: string
  ): DependencyIssue[] {
    const licenseCounts: { [key: string]: number } = {};
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };

    // Count license types and risk levels
    for (const [packageName, licenseInfo] of Object.entries(licenseData)) {
      const licenses = Array.isArray(licenseInfo.licenses)
        ? licenseInfo.licenses
        : [licenseInfo.licenses];

      for (const license of licenses) {
        licenseCounts[license] = (licenseCounts[license] || 0) + 1;
        const riskLevel = this.getLicenseRiskLevel(license);
        if (riskLevel in riskCounts) {
          riskCounts[riskLevel as keyof typeof riskCounts]++;
        }
      }
    }

    const totalPackages = Object.keys(licenseData).length;
    const issues: DependencyIssue[] = [];

    // Create summary issue if there are high-risk packages
    if (riskCounts.high > 0 || riskCounts.critical > 0) {
      issues.push({
        id: 'license-summary-risk',
        title: `License compliance summary: ${riskCounts.high + riskCounts.critical} high-risk packages`,
        description: `Found ${totalPackages} packages with ${riskCounts.critical} critical and ${riskCounts.high} high-risk licenses.`,
        entity: new UnifiedEntity({
          id: 'license-summary',
          type: 'project',
          name: 'License Summary',
          canonicalPath: 'package.json'
        }),
        severity: riskCounts.critical > 0 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
        analysisType: AnalysisType.DEPENDENCY_LICENSING,
        ruleId: 'license-compliance-summary',
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
        toolName: 'License Checker Adapter',
        metadata: { totalPackages, riskCounts },
        createdAt: new Date().toISOString(),
        dependencyInfo: {
          packageName: 'project-summary',
          version: '1.0.0',
          type: 'direct',
          depth: 0,
          licenses: Object.keys(licenseCounts),
          vulnerabilities: []
        },
        dependencyCategory: 'licensing',
        supplyChainRisk: riskCounts.critical > 0 ? 'critical' : 'high',
        remediationSuggestion: {
          action: 'review',
          description: 'Establish license compliance policy and review high-risk packages',
          automatable: false
        }
      } as unknown as DependencyIssue);
    }

    return issues;
  }
}

export default LicenseCheckerAdapter;