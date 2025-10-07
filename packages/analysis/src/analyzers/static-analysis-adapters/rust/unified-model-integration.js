/**
 * Unified Data Model Integration for Rust Tools
 * 
 * Ensures Rust static analysis tools (Clippy, Cargo Audit) integrate properly
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

class RustUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'rust_static_analysis';
        this.supportedTools = ['clippy', 'cargo-audit'];
        this.version = '1.0.0';
    }

    /**
     * Validate that Rust tool results conform to unified data model
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

        // Rust-specific validation
        if (toolName === 'clippy') {
            this.validateClippySpecificFields(issue, validationErrors);
        } else if (toolName === 'cargo-audit') {
            this.validateCargoAuditSpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate Clippy-specific fields
     */
    validateClippySpecificFields(issue, validationErrors) {
        const validCategories = ['correctness', 'performance', 'style', 'complexity', 'suspicious'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`Clippy category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['rust', 'lint', 'code-quality'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            if (!issue.metadata.lintName) {
                validationErrors.push('Clippy issues must include metadata.lintName');
            }
        }
    }

    /**
     * Validate Cargo Audit-specific fields
     */
    validateCargoAuditSpecificFields(issue, validationErrors) {
        if (issue.category !== 'security') {
            validationErrors.push('Cargo Audit issues must have category "security"');
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['rust', 'vulnerability', 'security'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            const requiredMetadataFields = ['package', 'version'];
            requiredMetadataFields.forEach(field => {
                if (!issue.metadata[field]) {
                    validationErrors.push(`Cargo Audit issues must include metadata.${field}`);
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
     * Enhance Rust tool results for correlation engine
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
            enhanced.ecosystem = 'rust';

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

        if (toolName === 'clippy') {
            // Clippy correlation hints
            hints.similarityFactors = ['line', 'category', 'lintType'];
            
            if (issue.category === 'performance') {
                hints.crossToolPatterns.push('performance_bottleneck');
            }
            
            if (issue.category === 'correctness') {
                hints.crossToolPatterns.push('logical_error');
                hints.crossToolPatterns.push('potential_panic');
            }

            if (issue.metadata?.lintName?.includes('unsafe')) {
                hints.crossToolPatterns.push('memory_safety');
            }

        } else if (toolName === 'cargo-audit') {
            // Cargo Audit correlation hints
            hints.similarityFactors = ['package', 'vulnerability'];
            hints.crossToolPatterns.push('dependency_security');
            
            if (issue.severity === 'critical' || issue.severity === 'high') {
                hints.crossToolPatterns.push('critical_security');
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
            ecosystem: 'rust',
            totalIssues: results.length,
            issueDistribution: {},
            correlationReadiness: true,
            processingHints: {
                fileBasedCorrelation: true,
                lineBasedCorrelation: true,
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
        if (toolName === 'clippy') {
            const lintTypes = {};
            results.forEach(issue => {
                if (issue.metadata?.lintName) {
                    lintTypes[issue.metadata.lintName] = (lintTypes[issue.metadata.lintName] || 0) + 1;
                }
            });
            metadata.lintTypes = lintTypes;
        }

        if (toolName === 'cargo-audit') {
            const packages = {};
            results.forEach(issue => {
                if (issue.metadata?.package) {
                    packages[issue.metadata.package] = (packages[issue.metadata.package] || 0) + 1;
                }
            });
            metadata.affectedPackages = packages;
        }

        return metadata;
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
    generateIntegrationReport(clippyResults, cargoAuditResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze Clippy integration
        if (clippyResults) {
            const clippyValidation = this.validateCorrelationReadiness(clippyResults, 'clippy');
            const clippyMetadata = this.extractCorrelationMetadata(clippyResults, 'clippy');
            
            report.tools.clippy = {
                validation: clippyValidation,
                metadata: clippyMetadata,
                enhancedResults: this.enhanceForCorrelation(clippyResults, projectRoot, 'clippy')
            };
        }

        // Analyze Cargo Audit integration
        if (cargoAuditResults) {
            const auditValidation = this.validateCorrelationReadiness(cargoAuditResults, 'cargo-audit');
            const auditMetadata = this.extractCorrelationMetadata(cargoAuditResults, 'cargo-audit');
            
            report.tools['cargo-audit'] = {
                validation: auditValidation,
                metadata: auditMetadata,
                enhancedResults: this.enhanceForCorrelation(cargoAuditResults, projectRoot, 'cargo-audit')
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
}

module.exports = RustUnifiedModelIntegration;