/**
 * Unified Data Model Integration for Python Tools
 * 
 * Ensures Python static analysis tools (Bandit, Safety) integrate properly
 * with Topolop's unified data model and correlation engine.
 * 
 * This module provides:
 * - Data model validation
 * - Correlation key generation
 * - Path normalization
 * - Cross-tool correlation support
 */

const crypto = require('crypto');
const path = require('path');

class PythonUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'python_static_analysis';
        this.supportedTools = ['bandit', 'safety'];
        this.version = '1.0.0';
    }

    /**
     * Validate that Python tool results conform to unified data model
     */
    validateUnifiedIssue(issue, toolName) {
        const validationErrors = [];

        // Required fields validation
        const requiredFields = [
            'id', 'title', 'description', 'severity', 'category',
            'file', 'line', 'column', 'tool', 'confidence'
        ];

        requiredFields.forEach(field => {
            if (issue[field] === undefined || issue[field] === null) {
                validationErrors.push(`Missing required field: ${field}`);
            }
        });

        // Type validation
        if (typeof issue.id !== 'string') {
            validationErrors.push('Field "id" must be a string');
        }

        if (typeof issue.title !== 'string') {
            validationErrors.push('Field "title" must be a string');
        }

        if (!['high', 'medium', 'low'].includes(issue.severity)) {
            validationErrors.push('Field "severity" must be one of: high, medium, low');
        }

        if (typeof issue.line !== 'number' || issue.line < 1) {
            validationErrors.push('Field "line" must be a positive number');
        }

        if (typeof issue.column !== 'number' || issue.column < 1) {
            validationErrors.push('Field "column" must be a positive number');
        }

        if (issue.tool !== toolName) {
            validationErrors.push(`Field "tool" must match adapter name: ${toolName}`);
        }

        if (typeof issue.confidence !== 'number' || issue.confidence < 0 || issue.confidence > 1) {
            validationErrors.push('Field "confidence" must be a number between 0 and 1');
        }

        // Python-specific validation
        if (toolName === 'bandit') {
            this.validateBanditSpecificFields(issue, validationErrors);
        } else if (toolName === 'safety') {
            this.validateSafetySpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate Bandit-specific fields
     */
    validateBanditSpecificFields(issue, validationErrors) {
        if (issue.category !== 'security') {
            validationErrors.push('Bandit issues must have category "security"');
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['python', 'security', 'static-analysis'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            const requiredMetadataFields = ['testId', 'testName'];
            requiredMetadataFields.forEach(field => {
                if (!issue.metadata[field]) {
                    validationErrors.push(`Bandit issues must include metadata.${field}`);
                }
            });
            
            if (issue.metadata.testId && !issue.metadata.testId.match(/^B\d+$/)) {
                validationErrors.push('Bandit testId must match pattern: B\\d+');
            }
        }
    }

    /**
     * Validate Safety-specific fields
     */
    validateSafetySpecificFields(issue, validationErrors) {
        const validCategories = ['dependency-security', 'vulnerability'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`Safety category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['python', 'dependency', 'vulnerability'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            const requiredMetadataFields = ['packageName', 'vulnerabilityId'];
            requiredMetadataFields.forEach(field => {
                if (!issue.metadata[field]) {
                    validationErrors.push(`Safety issues must include metadata.${field}`);
                }
            });
        }
    }

    /**
     * Generate correlation key for cross-tool correlation
     */
    generateCorrelationKey(issue, projectRoot) {
        // Normalize file path relative to project root
        const normalizedFile = this.normalizeFilePath(issue.file, projectRoot);
        
        // Create correlation key based on file, line, and issue characteristics
        const keyComponents = [
            normalizedFile,
            issue.line.toString(),
            issue.category,
            issue.tool
        ];

        const keyString = keyComponents.join('|');
        return crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16);
    }

    /**
     * Normalize file path for consistent correlation
     */
    normalizeFilePath(filePath, projectRoot) {
        // Convert to relative path from project root
        let normalized = path.isAbsolute(filePath) 
            ? path.relative(projectRoot, filePath)
            : filePath;

        // Normalize path separators
        normalized = normalized.replace(/\\/g, '/');

        // Remove leading './' if present
        if (normalized.startsWith('./')) {
            normalized = normalized.substring(2);
        }

        return normalized;
    }

    /**
     * Enhance Python tool results for correlation engine
     */
    enhanceForCorrelation(results, projectRoot, toolName) {
        return results.map(issue => {
            const enhanced = { ...issue };

            // Add correlation key
            enhanced.correlationKey = this.generateCorrelationKey(issue, projectRoot);

            // Add tool category for grouping
            enhanced.toolCategory = this.toolCategory;

            // Normalize file path
            enhanced.file = this.normalizeFilePath(issue.file, projectRoot);

            // Add canonical path for PathNormalizer
            enhanced.canonicalPath = path.resolve(projectRoot, enhanced.file);

            // Add ecosystem information
            enhanced.ecosystem = 'python';

            // Add correlation hints for similar issues
            enhanced.correlationHints = this.generateCorrelationHints(issue, toolName);

            return enhanced;
        });
    }

    /**
     * Generate correlation hints for cross-tool matching
     */
    generateCorrelationHints(issue, toolName) {
        const hints = {
            similarityFactors: [],
            searchRadius: { lines: 5, columns: 10 }, // Look for similar issues nearby
            crossToolPatterns: []
        };

        if (toolName === 'bandit') {
            // Bandit correlation hints
            hints.similarityFactors = ['line', 'testType', 'securityCategory'];
            hints.crossToolPatterns.push('security_vulnerability');
            
            // Test-specific patterns
            if (issue.metadata?.testId) {
                const testId = issue.metadata.testId;
                
                // Password/credential related tests
                if (['B105', 'B106', 'B107'].includes(testId)) {
                    hints.crossToolPatterns.push('credential_exposure');
                    hints.crossToolPatterns.push('hardcoded_secrets');
                }
                
                // Injection vulnerabilities
                if (['B608', 'B609'].includes(testId)) {
                    hints.crossToolPatterns.push('injection_vulnerability');
                }
                
                // Command execution issues
                if (['B601', 'B602', 'B603', 'B604', 'B605'].includes(testId)) {
                    hints.crossToolPatterns.push('command_execution');
                    hints.crossToolPatterns.push('shell_injection');
                }
                
                // Cryptographic issues
                if (['B301', 'B302', 'B303', 'B304', 'B305', 'B311'].includes(testId)) {
                    hints.crossToolPatterns.push('cryptographic_weakness');
                    hints.crossToolPatterns.push('insecure_crypto');
                }
                
                // File/path related issues
                if (['B108', 'B306', 'B307'].includes(testId)) {
                    hints.crossToolPatterns.push('path_traversal');
                    hints.crossToolPatterns.push('file_security');
                }
                
                // XML/parsing issues
                if (testId.startsWith('B31') && parseInt(testId.substring(1)) >= 313) {
                    hints.crossToolPatterns.push('xml_vulnerability');
                    hints.crossToolPatterns.push('parsing_issue');
                }
            }

        } else if (toolName === 'safety') {
            // Safety correlation hints
            hints.similarityFactors = ['packageName', 'vulnerabilityType'];
            hints.crossToolPatterns.push('dependency_vulnerability');
            hints.crossToolPatterns.push('third_party_risk');
            
            if (issue.severity === 'high') {
                hints.crossToolPatterns.push('critical_dependency');
            }
            
            // Package-specific patterns
            if (issue.metadata?.packageName) {
                const packageName = issue.metadata.packageName.toLowerCase();
                
                // Web framework vulnerabilities
                if (['django', 'flask', 'tornado', 'fastapi'].includes(packageName)) {
                    hints.crossToolPatterns.push('web_framework_vulnerability');
                }
                
                // Cryptographic library issues
                if (['cryptography', 'pycrypto', 'pyopenssl'].includes(packageName)) {
                    hints.crossToolPatterns.push('cryptographic_vulnerability');
                }
                
                // Database-related vulnerabilities
                if (['sqlalchemy', 'psycopg2', 'pymongo', 'redis'].includes(packageName)) {
                    hints.crossToolPatterns.push('database_vulnerability');
                }
                
                // HTTP/networking issues
                if (['requests', 'urllib3', 'httpx', 'aiohttp'].includes(packageName)) {
                    hints.crossToolPatterns.push('network_vulnerability');
                }
            }
        }

        return hints;
    }

    /**
     * Extract correlation metadata for the correlation engine
     */
    extractCorrelationMetadata(results, toolName) {
        const metadata = {
            tool: toolName,
            category: this.toolCategory,
            ecosystem: 'python',
            totalIssues: results.length,
            issueDistribution: {},
            correlationReadiness: true,
            processingHints: {
                fileBasedCorrelation: true,
                lineBasedCorrelation: toolName === 'bandit', // Safety doesn't have line numbers
                categoryBasedCorrelation: true
            }
        };

        // Calculate issue distribution
        const categories = {};
        const severities = {};

        results.forEach(issue => {
            categories[issue.category] = (categories[issue.category] || 0) + 1;
            severities[issue.severity] = (severities[issue.severity] || 0) + 1;
        });

        metadata.issueDistribution = {
            byCategory: categories,
            bySeverity: severities
        };

        // Tool-specific metadata
        if (toolName === 'bandit') {
            const testTypes = {};
            const securityCategories = {};
            
            results.forEach(issue => {
                if (issue.metadata?.testId) {
                    testTypes[issue.metadata.testId] = (testTypes[issue.metadata.testId] || 0) + 1;
                }
                
                const securityCategory = this.categorizeBanditTest(issue.metadata?.testId);
                securityCategories[securityCategory] = (securityCategories[securityCategory] || 0) + 1;
            });
            
            metadata.banditTestTypes = testTypes;
            metadata.securityCategories = securityCategories;
        }

        if (toolName === 'safety') {
            const packages = {};
            const vulnerabilityTypes = {};
            
            results.forEach(issue => {
                if (issue.metadata?.packageName) {
                    packages[issue.metadata.packageName] = (packages[issue.metadata.packageName] || 0) + 1;
                }
                
                if (issue.metadata?.vulnerabilityId) {
                    const vulnType = this.categorizeVulnerabilityType(issue.metadata.vulnerabilityId);
                    vulnerabilityTypes[vulnType] = (vulnerabilityTypes[vulnType] || 0) + 1;
                }
            });
            
            metadata.affectedPackages = packages;
            metadata.vulnerabilityTypes = vulnerabilityTypes;
        }

        return metadata;
    }

    /**
     * Categorize Bandit test types for metadata
     */
    categorizeBanditTest(testId) {
        if (!testId) return 'unknown';
        
        const categories = {
            'B10': 'hardcoded-secrets',     // B101-B112
            'B30': 'cryptographic',        // B301-B320
            'B60': 'injection',            // B601-B609
            'B40': 'misc-security',        // Other security issues
        };
        
        const prefix = testId.substring(0, 3);
        return categories[prefix] || 'other';
    }

    /**
     * Categorize vulnerability types for Safety metadata
     */
    categorizeVulnerabilityType(vulnerabilityId) {
        if (!vulnerabilityId) return 'unknown';
        
        // Common vulnerability type patterns
        if (vulnerabilityId.includes('XSS') || vulnerabilityId.includes('injection')) {
            return 'injection';
        }
        if (vulnerabilityId.includes('DoS') || vulnerabilityId.includes('denial')) {
            return 'denial-of-service';
        }
        if (vulnerabilityId.includes('crypto') || vulnerabilityId.includes('encryption')) {
            return 'cryptographic';
        }
        if (vulnerabilityId.includes('auth') || vulnerabilityId.includes('privilege')) {
            return 'authentication';
        }
        if (vulnerabilityId.includes('path') || vulnerabilityId.includes('directory')) {
            return 'path-traversal';
        }
        
        return 'general';
    }

    /**
     * Validate that tool results are ready for correlation
     */
    validateCorrelationReadiness(results, toolName) {
        const issues = [];
        let correlationReady = 0;

        results.forEach((issue, index) => {
            const validation = this.validateUnifiedIssue(issue, toolName);
            
            if (!validation.isValid) {
                issues.push({
                    index,
                    id: issue.id || `issue_${index}`,
                    errors: validation.errors
                });
            } else {
                correlationReady++;
            }
        });

        return {
            totalIssues: results.length,
            correlationReady,
            correlationReadyPercentage: results.length > 0 ? (correlationReady / results.length) * 100 : 100,
            validationIssues: issues,
            isReady: issues.length === 0
        };
    }

    /**
     * Generate integration report for tools
     */
    generateIntegrationReport(banditResults, safetyResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze Bandit integration
        if (banditResults) {
            const banditValidation = this.validateCorrelationReadiness(banditResults, 'bandit');
            const banditMetadata = this.extractCorrelationMetadata(banditResults, 'bandit');
            
            report.tools.bandit = {
                validation: banditValidation,
                metadata: banditMetadata,
                enhancedResults: this.enhanceForCorrelation(banditResults, projectRoot, 'bandit')
            };
        }

        // Analyze Safety integration
        if (safetyResults) {
            const safetyValidation = this.validateCorrelationReadiness(safetyResults, 'safety');
            const safetyMetadata = this.extractCorrelationMetadata(safetyResults, 'safety');
            
            report.tools.safety = {
                validation: safetyValidation,
                metadata: safetyMetadata,
                enhancedResults: this.enhanceForCorrelation(safetyResults, projectRoot, 'safety')
            };
        }

        // Calculate overall status
        const allValidations = Object.values(report.tools).map(tool => tool.validation);
        const allReady = allValidations.every(v => v.isReady);
        const someReady = allValidations.some(v => v.correlationReady > 0);

        if (allReady) {
            report.overallStatus = 'ready';
        } else if (someReady) {
            report.overallStatus = 'partial';
        } else {
            report.overallStatus = 'not_ready';
        }

        return report;
    }

    /**
     * Generate cross-tool correlation opportunities
     */
    identifyCorrelationOpportunities(banditResults, safetyResults, projectRoot) {
        const opportunities = [];

        if (!banditResults || !safetyResults) {
            return opportunities;
        }

        // Enhance both result sets for correlation
        const enhancedBandit = this.enhanceForCorrelation(banditResults, projectRoot, 'bandit');
        const enhancedSafety = this.enhanceForCorrelation(safetyResults, projectRoot, 'safety');

        // Look for package-level correlations
        enhancedSafety.forEach(safetyIssue => {
            const packageName = safetyIssue.metadata?.packageName;
            if (packageName) {
                // Look for Bandit issues in files that might use this package
                enhancedBandit.forEach(banditIssue => {
                    if (this.isPackageRelated(banditIssue, packageName)) {
                        opportunities.push({
                            type: 'package_usage_correlation',
                            banditIssue: banditIssue.id,
                            safetyIssue: safetyIssue.id,
                            package: packageName,
                            correlationStrength: 'medium'
                        });
                    }
                });
            }
        });

        // Look for pattern-based correlations
        enhancedBandit.forEach(banditIssue => {
            enhancedSafety.forEach(safetyIssue => {
                const sharedPatterns = this.findSharedPatterns(
                    banditIssue.correlationHints.crossToolPatterns,
                    safetyIssue.correlationHints.crossToolPatterns
                );
                
                if (sharedPatterns.length > 0) {
                    opportunities.push({
                        type: 'pattern_correlation',
                        banditIssue: banditIssue.id,
                        safetyIssue: safetyIssue.id,
                        sharedPatterns,
                        correlationStrength: sharedPatterns.length >= 2 ? 'high' : 'medium'
                    });
                }
            });
        });

        return opportunities;
    }

    /**
     * Check if a Bandit issue is related to a specific package
     */
    isPackageRelated(banditIssue, packageName) {
        // Simple heuristic: check if file contains import statements for the package
        // In a real implementation, this would analyze the actual code
        const fileName = banditIssue.file.toLowerCase();
        const packageLower = packageName.toLowerCase();
        
        // Common patterns that might indicate package usage
        return fileName.includes(packageLower) || 
               fileName.includes('import') ||
               fileName.includes('requirements') ||
               fileName.includes('setup');
    }

    /**
     * Find shared patterns between two arrays
     */
    findSharedPatterns(patterns1, patterns2) {
        return patterns1.filter(pattern => patterns2.includes(pattern));
    }
}

module.exports = PythonUnifiedModelIntegration;