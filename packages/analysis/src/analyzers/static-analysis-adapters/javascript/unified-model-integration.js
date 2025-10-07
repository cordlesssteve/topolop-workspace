/**
 * Unified Data Model Integration for JavaScript/TypeScript Tools
 *
 * Ensures JavaScript/TypeScript static analysis tools (ESLint, Madge) integrate properly
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

class JavaScriptUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'javascript_static_analysis';
        this.supportedTools = ['eslint', 'madge'];
        this.version = '1.0.0';
    }

    /**
     * Validate that JavaScript tool results conform to unified data model
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

        // JavaScript-specific validation
        if (toolName === 'eslint') {
            this.validateESLintSpecificFields(issue, validationErrors);
        } else if (toolName === 'madge') {
            this.validateMadgeSpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate ESLint-specific fields
     */
    validateESLintSpecificFields(issue, validationErrors) {
        const validCategories = ['security', 'quality', 'style', 'performance', 'best-practice'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`ESLint category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['javascript', 'lint', 'code-quality'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            if (!issue.metadata.ruleId) {
                validationErrors.push('ESLint issues must include metadata.ruleId');
            }
            if (issue.metadata.nodeType && typeof issue.metadata.nodeType !== 'string') {
                validationErrors.push('metadata.nodeType must be a string');
            }
        }
    }

    /**
     * Validate Madge-specific fields
     */
    validateMadgeSpecificFields(issue, validationErrors) {
        const validCategories = ['dependency', 'architecture', 'circular'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`Madge category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['javascript', 'dependency', 'architecture'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            // Dependency-specific metadata validation
            if (issue.category === 'circular' && !issue.metadata.dependencyChain) {
                validationErrors.push('Circular dependency issues must include metadata.dependencyChain');
            }
            if (issue.category === 'dependency' && !issue.metadata.dependencyType) {
                validationErrors.push('Dependency issues must include metadata.dependencyType');
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
     * Enhance JavaScript tool results for correlation engine
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
            enhanced.ecosystem = 'javascript';

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

        if (toolName === 'eslint') {
            // ESLint correlation hints
            hints.similarityFactors = ['line', 'category', 'ruleType'];

            if (issue.category === 'security') {
                hints.crossToolPatterns.push('security_vulnerability');
                hints.crossToolPatterns.push('code_injection_risk');
            }

            if (issue.category === 'performance') {
                hints.crossToolPatterns.push('performance_bottleneck');
            }

            if (issue.category === 'quality') {
                hints.crossToolPatterns.push('code_quality');
                hints.crossToolPatterns.push('maintainability');
            }

            if (issue.metadata?.ruleId?.includes('no-unused-vars')) {
                hints.crossToolPatterns.push('dead_code');
            }

            if (issue.metadata?.ruleId?.includes('no-undef')) {
                hints.crossToolPatterns.push('undefined_reference');
            }

        } else if (toolName === 'madge') {
            // Madge correlation hints
            hints.similarityFactors = ['file', 'dependencyType'];
            hints.crossToolPatterns.push('architecture_design');

            if (issue.category === 'circular') {
                hints.crossToolPatterns.push('circular_dependency');
                hints.crossToolPatterns.push('architectural_smell');
            }

            if (issue.category === 'dependency') {
                hints.crossToolPatterns.push('coupling_issue');
            }

            // High complexity dependencies might correlate with performance issues
            if (issue.metadata?.complexity === 'high') {
                hints.crossToolPatterns.push('complexity_hotspot');
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
            ecosystem: 'javascript',
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
        if (toolName === 'eslint') {
            const ruleTypes = {};
            results.forEach(issue => {
                if (issue.metadata?.ruleId) {
                    ruleTypes[issue.metadata.ruleId] = (ruleTypes[issue.metadata.ruleId] || 0) + 1;
                }
            });
            metadata.ruleTypes = ruleTypes;

            // ESLint specific processing hints
            metadata.processingHints.ruleBasedCorrelation = true;
            metadata.processingHints.nodeTypeCorrelation = true;
        }

        if (toolName === 'madge') {
            const dependencyTypes = {};
            results.forEach(issue => {
                if (issue.metadata?.dependencyType) {
                    dependencyTypes[issue.metadata.dependencyType] =
                        (dependencyTypes[issue.metadata.dependencyType] || 0) + 1;
                }
            });
            metadata.dependencyTypes = dependencyTypes;

            // Madge specific processing hints
            metadata.processingHints.architecturalCorrelation = true;
            metadata.processingHints.dependencyChainCorrelation = true;
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
    generateIntegrationReport(eslintResults, madgeResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze ESLint integration
        if (eslintResults) {
            const eslintValidation = this.validateCorrelationReadiness(eslintResults, 'eslint');
            const eslintMetadata = this.extractCorrelationMetadata(eslintResults, 'eslint');

            report.tools.eslint = {
                validation: eslintValidation,
                metadata: eslintMetadata,
                enhancedResults: this.enhanceForCorrelation(eslintResults, projectRoot, 'eslint')
            };
        }

        // Analyze Madge integration
        if (madgeResults) {
            const madgeValidation = this.validateCorrelationReadiness(madgeResults, 'madge');
            const madgeMetadata = this.extractCorrelationMetadata(madgeResults, 'madge');

            report.tools.madge = {
                validation: madgeValidation,
                metadata: madgeMetadata,
                enhancedResults: this.enhanceForCorrelation(madgeResults, projectRoot, 'madge')
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
     * Convert ESLint results to unified model format
     */
    convertESLintToUnified(eslintResults, projectRoot) {
        const unifiedIssues = [];

        eslintResults.forEach(fileResult => {
            fileResult.messages.forEach((message, messageIndex) => {
                const issue = {
                    id: `eslint_${path.basename(fileResult.filePath)}_${message.line}_${messageIndex}`,
                    title: message.message,
                    description: `ESLint ${message.ruleId || 'rule'}: ${message.message}`,
                    severity: this.mapESLintSeverity(message.severity),
                    category: this.mapESLintCategory(message.ruleId),
                    file: this.normalizeFilePath(fileResult.filePath, projectRoot),
                    line: message.line || 1,
                    column: message.column || 1,
                    tool: 'eslint',
                    confidence: 0.9, // ESLint rules are generally high confidence
                    tags: ['javascript', 'lint', 'code-quality'],
                    metadata: {
                        ruleId: message.ruleId,
                        nodeType: message.nodeType,
                        severity: message.severity
                    }
                };

                unifiedIssues.push(issue);
            });
        });

        return unifiedIssues;
    }

    /**
     * Convert Madge results to unified model format
     */
    convertMadgeToUnified(madgeResults, projectRoot) {
        const unifiedIssues = [];

        // Convert circular dependencies to issues
        if (madgeResults.circular) {
            madgeResults.circular.forEach((cycle, cycleIndex) => {
                cycle.forEach((file, fileIndex) => {
                    const issue = {
                        id: `madge_circular_${cycleIndex}_${fileIndex}`,
                        title: 'Circular dependency detected',
                        description: `File participates in circular dependency: ${cycle.join(' → ')}`,
                        severity: 'high', // Circular dependencies are serious
                        category: 'circular',
                        file: this.normalizeFilePath(file, projectRoot),
                        line: 1, // Dependencies are file-level issues
                        column: 1,
                        tool: 'madge',
                        confidence: 0.95, // Dependency analysis is very reliable
                        tags: ['javascript', 'dependency', 'architecture', 'circular'],
                        metadata: {
                            dependencyChain: cycle,
                            cycleLength: cycle.length,
                            dependencyType: 'circular'
                        }
                    };

                    unifiedIssues.push(issue);
                });
            });
        }

        return unifiedIssues;
    }

    /**
     * Map ESLint severity to unified model severity
     */
    mapESLintSeverity(eslintSeverity) {
        switch (eslintSeverity) {
            case 2: return 'high';    // error
            case 1: return 'medium';  // warning
            default: return 'low';    // info or unknown
        }
    }

    /**
     * Map ESLint rule to unified model category
     */
    mapESLintCategory(ruleId) {
        if (!ruleId) return 'quality';

        // Security rules
        if (ruleId.includes('no-eval') || ruleId.includes('no-implied-eval') ||
            ruleId.includes('no-new-func') || ruleId.includes('no-script-url')) {
            return 'security';
        }

        // Performance rules
        if (ruleId.includes('performance') || ruleId.includes('complexity')) {
            return 'performance';
        }

        // Style rules
        if (ruleId.includes('style') || ruleId.includes('indent') ||
            ruleId.includes('quotes') || ruleId.includes('semi')) {
            return 'style';
        }

        // Best practice rules
        if (ruleId.includes('best-practices') || ruleId.includes('eqeqeq') ||
            ruleId.includes('curly') || ruleId.includes('no-throw-literal')) {
            return 'best-practice';
        }

        // Default to quality
        return 'quality';
    }
}

module.exports = JavaScriptUnifiedModelIntegration;