/**
 * Unified Data Model Integration for Go Tools
 * 
 * Ensures Go static analysis tools (Staticcheck, Gosec) integrate properly
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

class GoUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'go_static_analysis';
        this.supportedTools = ['staticcheck', 'gosec'];
        this.version = '1.0.0';
    }

    /**
     * Validate that Go tool results conform to unified data model
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

        // Go-specific validation
        if (toolName === 'staticcheck') {
            this.validateStaticcheckSpecificFields(issue, validationErrors);
        } else if (toolName === 'gosec') {
            this.validateGosecSpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate Staticcheck-specific fields
     */
    validateStaticcheckSpecificFields(issue, validationErrors) {
        const validCategories = ['bug', 'performance', 'style', 'unused', 'suggestion', 'other'];
        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`Staticcheck category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['go', 'lint', 'code-quality'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            if (!issue.metadata.checkId) {
                validationErrors.push('Staticcheck issues must include metadata.checkId');
            }
            
            if (issue.metadata.checkId && !issue.metadata.checkId.match(/^(SA|S|ST|U|QF)\d+$/)) {
                validationErrors.push('Staticcheck checkId must match pattern: (SA|S|ST|U|QF)\\d+');
            }
        }
    }

    /**
     * Validate Gosec-specific fields
     */
    validateGosecSpecificFields(issue, validationErrors) {
        if (issue.category !== 'security') {
            validationErrors.push('Gosec issues must have category "security"');
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['go', 'security'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            const requiredMetadataFields = ['ruleId'];
            requiredMetadataFields.forEach(field => {
                if (!issue.metadata[field]) {
                    validationErrors.push(`Gosec issues must include metadata.${field}`);
                }
            });

            if (issue.metadata.ruleId && !issue.metadata.ruleId.match(/^G\d+$/)) {
                validationErrors.push('Gosec ruleId must match pattern: G\\d+');
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
     * Enhance Go tool results for correlation engine
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
            enhanced.ecosystem = 'go';

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

        if (toolName === 'staticcheck') {
            // Staticcheck correlation hints
            hints.similarityFactors = ['line', 'category', 'checkType'];
            
            if (issue.category === 'performance') {
                hints.crossToolPatterns.push('performance_bottleneck');
            }
            
            if (issue.category === 'bug') {
                hints.crossToolPatterns.push('logical_error');
                hints.crossToolPatterns.push('potential_panic');
            }

            if (issue.metadata?.checkId?.includes('unused')) {
                hints.crossToolPatterns.push('dead_code');
            }

            if (issue.category === 'style') {
                hints.crossToolPatterns.push('code_style');
            }

        } else if (toolName === 'gosec') {
            // Gosec correlation hints
            hints.similarityFactors = ['ruleId', 'securityCategory'];
            hints.crossToolPatterns.push('security_vulnerability');
            
            if (issue.severity === 'high') {
                hints.crossToolPatterns.push('critical_security');
            }

            // Rule-specific patterns
            if (issue.metadata?.ruleId) {
                const ruleId = issue.metadata.ruleId;
                
                if (ruleId.startsWith('G1')) { // G101-G115 general security
                    hints.crossToolPatterns.push('general_security');
                }
                
                if (ruleId.startsWith('G2')) { // G201-G204 injection
                    hints.crossToolPatterns.push('injection_vulnerability');
                }
                
                if (ruleId.startsWith('G3')) { // G301-G307 file security
                    hints.crossToolPatterns.push('file_security');
                }
                
                if (ruleId.startsWith('G4') || ruleId.startsWith('G5')) { // crypto
                    hints.crossToolPatterns.push('cryptographic_issue');
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
            ecosystem: 'go',
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
        if (toolName === 'staticcheck') {
            const checkTypes = {};
            results.forEach(issue => {
                if (issue.metadata?.checkId) {
                    const prefix = issue.metadata.checkId.match(/^[A-Z]+/)?.[0] || 'UNKNOWN';
                    checkTypes[prefix] = (checkTypes[prefix] || 0) + 1;
                }
            });
            metadata.checkTypes = checkTypes;
        }

        if (toolName === 'gosec') {
            const securityRules = {};
            const confidenceLevels = {};
            
            results.forEach(issue => {
                if (issue.metadata?.ruleId) {
                    securityRules[issue.metadata.ruleId] = (securityRules[issue.metadata.ruleId] || 0) + 1;
                }
                
                if (issue.metadata?.confidence) {
                    confidenceLevels[issue.metadata.confidence] = (confidenceLevels[issue.metadata.confidence] || 0) + 1;
                }
            });
            
            metadata.securityRules = securityRules;
            metadata.confidenceLevels = confidenceLevels;
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
    generateIntegrationReport(staticcheckResults, gosecResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze Staticcheck integration
        if (staticcheckResults) {
            const staticcheckValidation = this.validateCorrelationReadiness(staticcheckResults, 'staticcheck');
            const staticcheckMetadata = this.extractCorrelationMetadata(staticcheckResults, 'staticcheck');
            
            report.tools.staticcheck = {
                validation: staticcheckValidation,
                metadata: staticcheckMetadata,
                enhancedResults: this.enhanceForCorrelation(staticcheckResults, projectRoot, 'staticcheck')
            };
        }

        // Analyze Gosec integration
        if (gosecResults) {
            const gosecValidation = this.validateCorrelationReadiness(gosecResults, 'gosec');
            const gosecMetadata = this.extractCorrelationMetadata(gosecResults, 'gosec');
            
            report.tools.gosec = {
                validation: gosecValidation,
                metadata: gosecMetadata,
                enhancedResults: this.enhanceForCorrelation(gosecResults, projectRoot, 'gosec')
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
    identifyCorrelationOpportunities(staticcheckResults, gosecResults, projectRoot) {
        const opportunities = [];

        if (!staticcheckResults || !gosecResults) {
            return opportunities;
        }

        // Enhance both result sets for correlation
        const enhancedStaticcheck = this.enhanceForCorrelation(staticcheckResults, projectRoot, 'staticcheck');
        const enhancedGosec = this.enhanceForCorrelation(gosecResults, projectRoot, 'gosec');

        // Look for same-file correlations
        enhancedStaticcheck.forEach(staticcheckIssue => {
            enhancedGosec.forEach(gosecIssue => {
                if (staticcheckIssue.file === gosecIssue.file) {
                    const lineDifference = Math.abs(staticcheckIssue.line - gosecIssue.line);
                    
                    // Issues within 10 lines of each other are potentially related
                    if (lineDifference <= 10) {
                        opportunities.push({
                            type: 'same_file_proximity',
                            staticcheckIssue: staticcheckIssue.id,
                            gosecIssue: gosecIssue.id,
                            file: staticcheckIssue.file,
                            lineDifference,
                            correlationStrength: lineDifference <= 3 ? 'high' : 'medium'
                        });
                    }
                }
            });
        });

        // Look for pattern-based correlations
        enhancedStaticcheck.forEach(staticcheckIssue => {
            enhancedGosec.forEach(gosecIssue => {
                const sharedPatterns = this.findSharedPatterns(
                    staticcheckIssue.correlationHints.crossToolPatterns,
                    gosecIssue.correlationHints.crossToolPatterns
                );
                
                if (sharedPatterns.length > 0) {
                    opportunities.push({
                        type: 'pattern_correlation',
                        staticcheckIssue: staticcheckIssue.id,
                        gosecIssue: gosecIssue.id,
                        sharedPatterns,
                        correlationStrength: sharedPatterns.length >= 2 ? 'high' : 'medium'
                    });
                }
            });
        });

        return opportunities;
    }

    /**
     * Find shared patterns between two arrays
     */
    findSharedPatterns(patterns1, patterns2) {
        return patterns1.filter(pattern => patterns2.includes(pattern));
    }
}

module.exports = GoUnifiedModelIntegration;