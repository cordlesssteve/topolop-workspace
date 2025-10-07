/**
 * Unified Data Model Integration for C/C++ Analysis Tools
 *
 * Ensures C/C++ static analysis tools (CBMC, Clang, Valgrind) integrate properly
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

class CppUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'cpp_static_analysis';
        this.supportedTools = ['cbmc', 'clang', 'valgrind'];
        this.version = '1.0.0';
    }

    /**
     * Validate that C/C++ tool results conform to unified data model
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

        // C/C++-specific validation
        if (this.supportedTools.includes(toolName)) {
            this.validateCppSpecificFields(issue, validationErrors, toolName);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate C/C++-specific fields
     */
    validateCppSpecificFields(issue, validationErrors, toolName) {
        let validCategories = [];

        if (toolName === 'cbmc') {
            validCategories = ['bounds_violation', 'assertion_failure', 'integer_overflow', 'memory_leak', 'null_dereference', 'use_after_free', 'concurrency_bug', 'division_by_zero'];
        } else if (toolName === 'clang') {
            validCategories = ['memory_error', 'security_issue', 'dead_code', 'logic_error', 'api_misuse', 'potential_bug', 'performance_issue'];
        } else if (toolName === 'valgrind') {
            validCategories = ['memory_leak', 'invalid_memory_access', 'uninitialized_memory', 'memory_overlap', 'file_descriptor_leak', 'heap_corruption'];
        }

        if (!validCategories.includes(issue.category)) {
            validationErrors.push(`${toolName.toUpperCase()} category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['cpp', 'static-analysis'];
            if (toolName === 'cbmc') requiredTags.push('formal-verification');
            if (toolName === 'clang') requiredTags.push('clang-analyzer');
            if (toolName === 'valgrind') requiredTags.push('dynamic-analysis');

            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.metadata) {
            if (toolName === 'cbmc' && !issue.metadata.property) {
                validationErrors.push('CBMC issues must include metadata.property');
            }
            if (toolName === 'clang' && !issue.metadata.checker) {
                validationErrors.push('Clang issues must include metadata.checker');
            }
            if (toolName === 'valgrind' && !issue.metadata.tool) {
                validationErrors.push('Valgrind issues must include metadata.tool');
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
     * Enhance C/C++ tool results for correlation engine
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
            enhanced.ecosystem = 'cpp';

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
            searchRadius: { lines: 5, columns: 15 }, // C/C++ issues may span multiple lines
            crossToolPatterns: []
        };

        if (toolName === 'cbmc') {
            // CBMC correlation hints
            hints.similarityFactors = ['line', 'category', 'property'];

            if (issue.category === 'bounds_violation') {
                hints.crossToolPatterns.push('buffer_overflow');
                hints.crossToolPatterns.push('array_bounds');
            }

            if (issue.category === 'assertion_failure') {
                hints.crossToolPatterns.push('logic_error');
                hints.crossToolPatterns.push('contract_violation');
            }

            if (issue.category === 'memory_leak') {
                hints.crossToolPatterns.push('memory_management');
                hints.crossToolPatterns.push('resource_leak');
            }

            if (issue.category === 'null_dereference') {
                hints.crossToolPatterns.push('null_pointer');
                hints.crossToolPatterns.push('memory_safety');
            }

            if (issue.category === 'use_after_free') {
                hints.crossToolPatterns.push('memory_corruption');
                hints.crossToolPatterns.push('dangling_pointer');
            }
        }

        if (toolName === 'clang') {
            // Clang correlation hints
            hints.similarityFactors = ['line', 'category', 'checker'];

            if (issue.category === 'memory_error') {
                hints.crossToolPatterns.push('memory_safety');
                hints.crossToolPatterns.push('buffer_overflow');
            }

            if (issue.category === 'security_issue') {
                hints.crossToolPatterns.push('security_vulnerability');
                hints.crossToolPatterns.push('injection_attack');
            }

            if (issue.category === 'dead_code') {
                hints.crossToolPatterns.push('unreachable_code');
                hints.crossToolPatterns.push('maintainability');
            }

            if (issue.category === 'logic_error') {
                hints.crossToolPatterns.push('program_logic');
                hints.crossToolPatterns.push('control_flow');
            }
        }

        if (toolName === 'valgrind') {
            // Valgrind correlation hints
            hints.similarityFactors = ['line', 'category', 'tool'];

            if (issue.category === 'memory_leak') {
                hints.crossToolPatterns.push('resource_leak');
                hints.crossToolPatterns.push('memory_management');
            }

            if (issue.category === 'invalid_memory_access') {
                hints.crossToolPatterns.push('buffer_overflow');
                hints.crossToolPatterns.push('memory_safety');
            }

            if (issue.category === 'uninitialized_memory') {
                hints.crossToolPatterns.push('memory_initialization');
                hints.crossToolPatterns.push('undefined_behavior');
            }

            if (issue.category === 'heap_corruption') {
                hints.crossToolPatterns.push('memory_corruption');
                hints.crossToolPatterns.push('heap_management');
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
            ecosystem: 'cpp',
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
        const checkers = {};

        results.forEach(issue => {
            categories[issue.category] = (categories[issue.category] || 0) + 1;
            severities[issue.severity] = (severities[issue.severity] || 0) + 1;

            if (issue.metadata?.checker) {
                checkers[issue.metadata.checker] = (checkers[issue.metadata.checker] || 0) + 1;
            }
            if (issue.metadata?.property) {
                checkers[issue.metadata.property] = (checkers[issue.metadata.property] || 0) + 1;
            }
            if (issue.metadata?.tool) {
                checkers[issue.metadata.tool] = (checkers[issue.metadata.tool] || 0) + 1;
            }
        });

        metadata.issueDistribution = {
            byCategory: categories,
            bySeverity: severities,
            byChecker: checkers
        };

        // Tool-specific metadata
        if (toolName === 'cbmc') {
            metadata.verificationProperties = this.categorizeVerificationProperties(checkers);
            metadata.processingHints.formalVerificationCorrelation = true;
        } else if (toolName === 'clang') {
            metadata.checkerTypes = this.categorizeClangCheckers(checkers);
            metadata.processingHints.staticAnalysisCorrelation = true;
        } else if (toolName === 'valgrind') {
            metadata.valgrindTools = this.categorizeValgrindTools(checkers);
            metadata.processingHints.dynamicAnalysisCorrelation = true;
        }

        return metadata;
    }

    /**
     * Categorize CBMC verification properties
     */
    categorizeVerificationProperties(properties) {
        const categories = {
            memoryProperties: [],
            arithmeticProperties: [],
            concurrencyProperties: [],
            assertionProperties: [],
            other: []
        };

        Object.keys(properties).forEach(prop => {
            if (prop.includes('bounds') || prop.includes('pointer')) {
                categories.memoryProperties.push(prop);
            } else if (prop.includes('overflow') || prop.includes('div-by-zero')) {
                categories.arithmeticProperties.push(prop);
            } else if (prop.includes('deadlock') || prop.includes('data-race')) {
                categories.concurrencyProperties.push(prop);
            } else if (prop.includes('assertion')) {
                categories.assertionProperties.push(prop);
            } else {
                categories.other.push(prop);
            }
        });

        return categories;
    }

    /**
     * Categorize Clang Static Analyzer checkers
     */
    categorizeClangCheckers(checkers) {
        const categories = {
            coreCheckers: [],
            securityCheckers: [],
            unixCheckers: [],
            deadcodeCheckers: [],
            other: []
        };

        Object.keys(checkers).forEach(checker => {
            if (checker.startsWith('core.')) {
                categories.coreCheckers.push(checker);
            } else if (checker.startsWith('security.')) {
                categories.securityCheckers.push(checker);
            } else if (checker.startsWith('unix.')) {
                categories.unixCheckers.push(checker);
            } else if (checker.startsWith('deadcode.')) {
                categories.deadcodeCheckers.push(checker);
            } else {
                categories.other.push(checker);
            }
        });

        return categories;
    }

    /**
     * Categorize Valgrind tools
     */
    categorizeValgrindTools(tools) {
        const categories = {
            memcheckTools: [],
            cachegrindTools: [],
            callgrindTools: [],
            massifTools: [],
            other: []
        };

        Object.keys(tools).forEach(tool => {
            if (tool.includes('memcheck')) {
                categories.memcheckTools.push(tool);
            } else if (tool.includes('cachegrind')) {
                categories.cachegrindTools.push(tool);
            } else if (tool.includes('callgrind')) {
                categories.callgrindTools.push(tool);
            } else if (tool.includes('massif')) {
                categories.massifTools.push(tool);
            } else {
                categories.other.push(tool);
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
     * Generate integration report for C/C++ tools
     */
    generateIntegrationReport(cbmcResults, clangResults, valgrindResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze CBMC integration
        if (cbmcResults) {
            const cbmcValidation = this.validateCorrelationReadiness(cbmcResults, 'cbmc');
            const cbmcMetadata = this.extractCorrelationMetadata(cbmcResults, 'cbmc');

            report.tools.cbmc = {
                validation: cbmcValidation,
                metadata: cbmcMetadata,
                enhancedResults: this.enhanceForCorrelation(cbmcResults, projectRoot, 'cbmc')
            };
        }

        // Analyze Clang integration
        if (clangResults) {
            const clangValidation = this.validateCorrelationReadiness(clangResults, 'clang');
            const clangMetadata = this.extractCorrelationMetadata(clangResults, 'clang');

            report.tools.clang = {
                validation: clangValidation,
                metadata: clangMetadata,
                enhancedResults: this.enhanceForCorrelation(clangResults, projectRoot, 'clang')
            };
        }

        // Analyze Valgrind integration
        if (valgrindResults) {
            const valgrindValidation = this.validateCorrelationReadiness(valgrindResults, 'valgrind');
            const valgrindMetadata = this.extractCorrelationMetadata(valgrindResults, 'valgrind');

            report.tools.valgrind = {
                validation: valgrindValidation,
                metadata: valgrindMetadata,
                enhancedResults: this.enhanceForCorrelation(valgrindResults, projectRoot, 'valgrind')
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
     * Convert tool-specific results to unified model format
     */
    convertToUnified(toolResults, projectRoot, toolName) {
        const unifiedIssues = [];

        if (!toolResults || !Array.isArray(toolResults)) {
            return unifiedIssues;
        }

        toolResults.forEach((issue, index) => {
            const unifiedIssue = {
                id: `${toolName}_${issue.category || 'unknown'}_${path.basename(issue.file || 'unknown')}_${issue.line || 0}_${index}`,
                title: this.generateIssueTitle(issue, toolName),
                description: issue.message || issue.description || 'No description available',
                severity: this.mapSeverity(issue.severity, issue.category, toolName),
                category: issue.category || 'unknown',
                file: this.normalizeFilePath(issue.file || '', projectRoot),
                line: issue.line || 1,
                column: issue.column || 1,
                tool: toolName,
                confidence: this.calculateConfidence(issue, toolName),
                tags: this.generateTags(toolName),
                metadata: {
                    originalSeverity: issue.severity,
                    ...this.extractToolSpecificMetadata(issue, toolName)
                }
            };

            unifiedIssues.push(unifiedIssue);
        });

        return unifiedIssues;
    }

    /**
     * Generate appropriate issue title based on tool and category
     */
    generateIssueTitle(issue, toolName) {
        const titles = {
            cbmc: {
                'bounds_violation': 'Array Bounds Violation',
                'assertion_failure': 'Assertion Failure',
                'integer_overflow': 'Integer Overflow',
                'memory_leak': 'Memory Leak',
                'null_dereference': 'Null Pointer Dereference',
                'use_after_free': 'Use After Free',
                'concurrency_bug': 'Concurrency Bug',
                'division_by_zero': 'Division by Zero'
            },
            clang: {
                'memory_error': 'Memory Error',
                'security_issue': 'Security Issue',
                'dead_code': 'Dead Code',
                'logic_error': 'Logic Error',
                'api_misuse': 'API Misuse',
                'potential_bug': 'Potential Bug',
                'performance_issue': 'Performance Issue'
            },
            valgrind: {
                'memory_leak': 'Memory Leak',
                'invalid_memory_access': 'Invalid Memory Access',
                'uninitialized_memory': 'Uninitialized Memory',
                'memory_overlap': 'Memory Overlap',
                'file_descriptor_leak': 'File Descriptor Leak',
                'heap_corruption': 'Heap Corruption'
            }
        };

        const toolTitles = titles[toolName] || {};
        return toolTitles[issue.category] || `${toolName.toUpperCase()} Issue`;
    }

    /**
     * Map tool-specific severity to unified model severity
     */
    mapSeverity(originalSeverity, category, toolName) {
        // High severity categories
        const highSeverityCategories = [
            'bounds_violation', 'assertion_failure', 'use_after_free', 'null_dereference',
            'memory_error', 'security_issue', 'invalid_memory_access', 'heap_corruption'
        ];

        // Medium severity categories
        const mediumSeverityCategories = [
            'integer_overflow', 'memory_leak', 'logic_error', 'api_misuse',
            'uninitialized_memory', 'memory_overlap', 'file_descriptor_leak'
        ];

        if (highSeverityCategories.includes(category)) {
            return 'high';
        }

        if (mediumSeverityCategories.includes(category)) {
            return 'medium';
        }

        // Map original severity if available
        if (originalSeverity) {
            switch (originalSeverity.toLowerCase()) {
                case 'error':
                case 'fatal':
                case 'critical':
                    return 'high';
                case 'warning':
                case 'minor':
                    return 'medium';
                case 'info':
                case 'style':
                    return 'low';
                default:
                    return 'medium';
            }
        }

        return 'medium';
    }

    /**
     * Calculate confidence score for tool issues
     */
    calculateConfidence(issue, toolName) {
        let baseConfidence = 0.85;

        // Tool-specific confidence adjustments
        if (toolName === 'cbmc') {
            baseConfidence = 0.95; // Formal verification is very reliable
        } else if (toolName === 'clang') {
            baseConfidence = 0.90; // Static analysis is reliable
        } else if (toolName === 'valgrind') {
            baseConfidence = 0.85; // Dynamic analysis can have false positives
        }

        // Category-specific adjustments
        if (issue.category === 'assertion_failure' || issue.category === 'bounds_violation') {
            baseConfidence = Math.min(0.98, baseConfidence + 0.05);
        }

        if (issue.category === 'potential_bug' || issue.category === 'performance_issue') {
            baseConfidence = Math.max(0.70, baseConfidence - 0.15);
        }

        return baseConfidence;
    }

    /**
     * Generate tags for tool
     */
    generateTags(toolName) {
        const baseTags = ['cpp', 'static-analysis'];

        if (toolName === 'cbmc') {
            return [...baseTags, 'formal-verification', 'bounded-model-checking'];
        } else if (toolName === 'clang') {
            return [...baseTags, 'clang-analyzer', 'compiler-based'];
        } else if (toolName === 'valgrind') {
            return [...baseTags, 'dynamic-analysis', 'runtime-checking'];
        }

        return baseTags;
    }

    /**
     * Extract tool-specific metadata
     */
    extractToolSpecificMetadata(issue, toolName) {
        const metadata = {};

        if (toolName === 'cbmc') {
            metadata.property = issue.property || 'unknown';
            metadata.counterexample = issue.counterexample || null;
        } else if (toolName === 'clang') {
            metadata.checker = issue.checker || 'unknown';
            metadata.bugType = issue.bugType || 'unknown';
        } else if (toolName === 'valgrind') {
            metadata.tool = issue.tool || 'memcheck';
            metadata.stackTrace = issue.stackTrace || null;
        }

        return metadata;
    }
}

module.exports = CppUnifiedModelIntegration;