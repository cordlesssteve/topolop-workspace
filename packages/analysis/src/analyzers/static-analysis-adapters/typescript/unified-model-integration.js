/**
 * Unified Data Model Integration for TypeScript Tools
 *
 * Ensures TypeScript static analysis tools (TSC) integrate properly
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

class TypeScriptUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'typescript_static_analysis';
        this.supportedTools = ['tsc'];
        this.version = '1.0.0';
    }

    /**
     * Validate that TypeScript tool results conform to unified data model
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

        // TypeScript-specific validation
        if (toolName === 'tsc') {
            this.validateTSCSpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate TSC-specific fields
     */
    validateTSCSpecificFields(issue, validationErrors) {
        const validCategories = ['type-error', 'strict-mode-violation', 'unused-declaration', 'import-export-issue'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`TSC category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['typescript', 'type-checking', 'compilation'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            if (!issue.metadata.errorCode) {
                validationErrors.push('TSC issues must include metadata.errorCode');
            }
            if (issue.metadata.errorCode && !issue.metadata.errorCode.startsWith('TS')) {
                validationErrors.push('TSC error codes must start with "TS"');
            }
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
        // Handle edge cases
        if (!filePath || filePath === '.' || filePath === './') {
            return '';
        }

        // Handle cases where filePath is already relative
        if (!path.isAbsolute(filePath)) {
            // Normalize path separators and remove leading './'
            let normalized = filePath.replace(/\\/g, '/');
            if (normalized.startsWith('./')) {
                normalized = normalized.substring(2);
            }
            return normalized;
        }

        // Convert to relative path from project root
        const relativePath = path.relative(projectRoot, filePath);

        // If the relative path contains "..", it means the file is outside the project root
        // In that case, we should return the original path
        if (relativePath.startsWith('..')) {
            return filePath;
        }

        // Normalize path separators
        let normalized = relativePath.replace(/\\/g, '/');

        // Remove leading './' if present
        if (normalized.startsWith('./')) {
            normalized = normalized.substring(2);
        }

        return normalized;
    }

    /**
     * Enhance TypeScript tool results for correlation engine
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
            enhanced.ecosystem = 'typescript';

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
            searchRadius: { lines: 3, columns: 10 }, // TypeScript errors are usually precise
            crossToolPatterns: []
        };

        if (toolName === 'tsc') {
            // TSC correlation hints
            hints.similarityFactors = ['line', 'category', 'errorCode'];

            if (issue.category === 'type-error') {
                hints.crossToolPatterns.push('type_safety');
                hints.crossToolPatterns.push('compilation_error');
            }

            if (issue.category === 'strict-mode-violation') {
                hints.crossToolPatterns.push('code_quality');
                hints.crossToolPatterns.push('type_safety');
            }

            if (issue.category === 'unused-declaration') {
                hints.crossToolPatterns.push('dead_code');
                hints.crossToolPatterns.push('maintainability');
            }

            if (issue.category === 'import-export-issue') {
                hints.crossToolPatterns.push('dependency_issue');
                hints.crossToolPatterns.push('module_resolution');
            }

            // Specific error code patterns
            if (issue.metadata?.errorCode) {
                const errorCode = issue.metadata.errorCode;

                if (['TS2322', 'TS2345'].includes(errorCode)) {
                    hints.crossToolPatterns.push('type_mismatch');
                }

                if (['TS2307', 'TS2305'].includes(errorCode)) {
                    hints.crossToolPatterns.push('import_resolution');
                }

                if (['TS7006', 'TS7031'].includes(errorCode)) {
                    hints.crossToolPatterns.push('implicit_any');
                }

                if (['TS6133', 'TS6196'].includes(errorCode)) {
                    hints.crossToolPatterns.push('unused_code');
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
            ecosystem: 'typescript',
            totalIssues: results.length,
            issueDistribution: {},
            correlationReadiness: true,
            processingHints: {
                fileBasedCorrelation: true,
                lineBasedCorrelation: true,
                categoryBasedCorrelation: true,
                errorCodeBasedCorrelation: true
            }
        };

        // Calculate issue distribution
        const categories = {};
        const severities = {};
        const errorCodes = {};

        results.forEach(issue => {
            categories[issue.category] = (categories[issue.category] || 0) + 1;
            severities[issue.severity] = (severities[issue.severity] || 0) + 1;

            if (issue.metadata?.errorCode) {
                errorCodes[issue.metadata.errorCode] = (errorCodes[issue.metadata.errorCode] || 0) + 1;
            }
        });

        metadata.issueDistribution = {
            byCategory: categories,
            bySeverity: severities,
            byErrorCode: errorCodes
        };

        // TypeScript specific metadata
        if (toolName === 'tsc') {
            metadata.errorCodeTypes = this.categorizeErrorCodes(errorCodes);
            metadata.processingHints.typeErrorCorrelation = true;
            metadata.processingHints.strictModeCorrelation = true;
        }

        return metadata;
    }

    /**
     * Categorize TypeScript error codes by type
     */
    categorizeErrorCodes(errorCodes) {
        const categories = {
            typeErrors: [],
            importErrors: [],
            strictModeErrors: [],
            unusedCodeErrors: [],
            other: []
        };

        Object.keys(errorCodes).forEach(code => {
            if (['TS2322', 'TS2345', 'TS2339', 'TS2304'].includes(code)) {
                categories.typeErrors.push(code);
            } else if (['TS2307', 'TS2305', 'TS1149'].includes(code)) {
                categories.importErrors.push(code);
            } else if (['TS7006', 'TS7031', 'TS2367'].includes(code)) {
                categories.strictModeErrors.push(code);
            } else if (['TS6133', 'TS6196'].includes(code)) {
                categories.unusedCodeErrors.push(code);
            } else {
                categories.other.push(code);
            }
        });

        return categories;
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
     * Generate integration report for TypeScript tools
     */
    generateIntegrationReport(tscResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze TSC integration
        if (tscResults) {
            const tscValidation = this.validateCorrelationReadiness(tscResults, 'tsc');
            const tscMetadata = this.extractCorrelationMetadata(tscResults, 'tsc');

            report.tools.tsc = {
                validation: tscValidation,
                metadata: tscMetadata,
                enhancedResults: this.enhanceForCorrelation(tscResults, projectRoot, 'tsc')
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
     * Convert TSC results to unified model format
     */
    convertTSCToUnified(tscResults, projectRoot) {
        const unifiedIssues = [];

        // Convert all issue types from TSC results
        const issueTypes = [
            { key: 'typeErrors', baseCategory: 'type-error' },
            { key: 'strictModeViolations', baseCategory: 'strict-mode-violation' },
            { key: 'unusedDeclarations', baseCategory: 'unused-declaration' },
            { key: 'importExportIssues', baseCategory: 'import-export-issue' }
        ];

        issueTypes.forEach(({ key, baseCategory }) => {
            if (tscResults[key]) {
                tscResults[key].forEach((issue, index) => {
                    const unifiedIssue = {
                        id: `tsc_${baseCategory}_${path.basename(issue.file)}_${issue.line}_${index}`,
                        title: this.generateIssueTitle(issue, baseCategory),
                        description: `TypeScript ${issue.errorCode}: ${issue.message}`,
                        severity: this.mapTSCSeverity(issue.severity, baseCategory),
                        category: baseCategory,
                        file: this.normalizeFilePath(issue.file, projectRoot),
                        line: issue.line,
                        column: issue.column,
                        tool: 'tsc',
                        confidence: this.calculateTSCConfidence(issue, baseCategory),
                        tags: ['typescript', 'type-checking', 'compilation'],
                        metadata: {
                            errorCode: issue.errorCode,
                            category: issue.category || baseCategory,
                            originalSeverity: issue.severity
                        }
                    };

                    unifiedIssues.push(unifiedIssue);
                });
            }
        });

        return unifiedIssues;
    }

    /**
     * Generate appropriate issue title based on category
     */
    generateIssueTitle(issue, category) {
        const titles = {
            'type-error': 'Type Error',
            'strict-mode-violation': 'Strict Mode Violation',
            'unused-declaration': 'Unused Declaration',
            'import-export-issue': 'Import/Export Issue'
        };

        const baseTitle = titles[category] || 'TypeScript Issue';

        // Add specificity if we can determine it from the error code
        if (issue.errorCode) {
            const specificTitles = {
                'TS2322': 'Type Assignment Error',
                'TS2307': 'Module Resolution Error',
                'TS2339': 'Property Access Error',
                'TS7006': 'Implicit Any Parameter',
                'TS6133': 'Unused Variable',
                'TS6196': 'Unused Parameter'
            };

            return specificTitles[issue.errorCode] || baseTitle;
        }

        return baseTitle;
    }

    /**
     * Map TSC severity to unified model severity
     */
    mapTSCSeverity(tscSeverity, category) {
        // TypeScript compiler error levels mapping
        if (tscSeverity === 'error' || category === 'type-error' || category === 'import-export-issue') {
            return 'high'; // Compilation errors are critical
        }

        if (tscSeverity === 'warning' || category === 'strict-mode-violation') {
            return 'medium'; // Strict mode violations are important but not blocking
        }

        if (category === 'unused-declaration') {
            return 'low'; // Unused code is cleanup, not critical
        }

        // Default mapping
        switch (tscSeverity) {
            case 'error': return 'high';
            case 'warning': return 'medium';
            case 'info': return 'low';
            default: return 'medium';
        }
    }

    /**
     * Calculate confidence score for TSC issues
     */
    calculateTSCConfidence(issue, category) {
        // TypeScript compiler is very reliable
        let baseConfidence = 0.95;

        // Type errors are extremely reliable
        if (category === 'type-error') {
            baseConfidence = 0.98;
        }

        // Import issues are also very reliable
        if (category === 'import-export-issue') {
            baseConfidence = 0.97;
        }

        // Unused declarations might have false positives (dynamic usage)
        if (category === 'unused-declaration') {
            baseConfidence = 0.85;
        }

        // Strict mode violations are reliable but context-dependent
        if (category === 'strict-mode-violation') {
            baseConfidence = 0.90;
        }

        return baseConfidence;
    }
}

module.exports = TypeScriptUnifiedModelIntegration;