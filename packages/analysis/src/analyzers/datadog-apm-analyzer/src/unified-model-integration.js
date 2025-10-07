/**
 * Unified Data Model Integration for DataDog APM
 *
 * Ensures DataDog Application Performance Monitoring integrates properly
 * with Topolop's unified data model and correlation engine.
 *
 * This module provides:
 * - Data model validation
 * - Correlation key generation
 * - Path normalization
 * - Cross-tool correlation support for performance monitoring
 */

const crypto = require('crypto');
const path = require('path');

class DataDogUnifiedModelIntegration {
    constructor() {
        this.toolCategory = 'performance_monitoring';
        this.supportedTools = ['datadog-apm'];
        this.version = '1.0.0';
    }

    /**
     * Validate that DataDog APM results conform to unified data model
     */
    validateUnifiedIssue(issue, toolName) {
        const validationErrors = [];

        // Required fields validation
        const requiredFields = [
            'id', 'title', 'description', 'severity', 'category',
            'tool', 'confidence', 'performanceMetrics'
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

        if (!['critical', 'high', 'medium', 'low'].includes(issue.severity)) {
            validationErrors.push('Field "severity" must be one of: critical, high, medium, low');
        }

        if (issue.tool !== toolName) {
            validationErrors.push(`Field "tool" must match adapter name: ${toolName}`);
        }

        if (typeof issue.confidence !== 'number' || issue.confidence < 0 || issue.confidence > 1) {
            validationErrors.push('Field "confidence" must be a number between 0 and 1');
        }

        // DataDog APM-specific validation
        if (toolName === 'datadog-apm') {
            this.validateDataDogSpecificFields(issue, validationErrors);
        }

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    }

    /**
     * Validate DataDog APM-specific fields
     */
    validateDataDogSpecificFields(issue, validationErrors) {
        const validCategories = ['response_time', 'availability', 'loading', 'memory', 'cpu', 'throughput'];
        if (!validCategories.includes(issue.performanceCategory)) {
            validationErrors.push(`DataDog APM category must be one of: ${validCategories.join(', ')}`);
        }

        if (!Array.isArray(issue.tags)) {
            validationErrors.push('Field "tags" must be an array');
        } else {
            const requiredTags = ['performance', 'apm', 'monitoring'];
            requiredTags.forEach(tag => {
                if (!issue.tags.includes(tag)) {
                    validationErrors.push(`Missing required tag: ${tag}`);
                }
            });
        }

        if (issue.performanceMetrics) {
            if (typeof issue.performanceMetrics !== 'object') {
                validationErrors.push('Field "performanceMetrics" must be an object');
            }
        } else {
            validationErrors.push('DataDog APM issues must include performanceMetrics');
        }

        if (issue.metadata) {
            if (!issue.metadata.source) {
                validationErrors.push('DataDog APM issues must include metadata.source');
            }
            if (issue.metadata.source && issue.metadata.source !== 'datadog_apm') {
                validationErrors.push('DataDog APM metadata.source must be "datadog_apm"');
            }
        }
    }

    /**
     * Generate correlation key for cross-tool correlation
     */
    generateCorrelationKey(issue, projectRoot) {
        // For performance issues, correlation is based on service/endpoint
        const entityId = issue.entity?.id || 'unknown';
        const performanceCategory = issue.performanceCategory || 'unknown';

        // Create correlation key based on entity, category, and tool
        const keyComponents = [
            entityId,
            performanceCategory,
            issue.tool
        ];

        const keyString = keyComponents.join('|');
        return crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16);
    }

    /**
     * Normalize entity path for consistent correlation
     */
    normalizeEntityPath(entityPath, projectRoot) {
        if (!entityPath) return '';

        // For services, keep as-is
        if (entityPath.startsWith('services/')) {
            return entityPath;
        }

        // For hosts, normalize
        if (entityPath.startsWith('hosts/')) {
            return entityPath;
        }

        // Default normalization
        let normalized = entityPath.replace(/\\/g, '/');

        // Remove leading './' if present
        if (normalized.startsWith('./')) {
            normalized = normalized.substring(2);
        }

        return normalized;
    }

    /**
     * Enhance DataDog APM results for correlation engine
     */
    enhanceForCorrelation(results, projectRoot, toolName) {
        return results.map(issue => {
            const enhanced = { ...issue };

            // Add correlation key
            enhanced.correlationKey = this.generateCorrelationKey(issue, projectRoot);

            // Add tool category for grouping
            enhanced.toolCategory = this.toolCategory;

            // Normalize entity path
            if (enhanced.entity?.canonicalPath) {
                enhanced.entity.canonicalPath = this.normalizeEntityPath(enhanced.entity.canonicalPath, projectRoot);
            }

            // Add ecosystem information
            enhanced.ecosystem = 'performance';

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
            searchRadius: { services: 1, endpoints: 3 }, // Performance issues are service/endpoint specific
            crossToolPatterns: []
        };

        if (toolName === 'datadog-apm') {
            // DataDog APM correlation hints
            hints.similarityFactors = ['entity', 'performanceCategory', 'impactLevel'];

            if (issue.performanceCategory === 'response_time') {
                hints.crossToolPatterns.push('performance_degradation');
                hints.crossToolPatterns.push('latency_issue');
                hints.crossToolPatterns.push('slow_query');
                hints.crossToolPatterns.push('bottleneck');
            }

            if (issue.performanceCategory === 'availability') {
                hints.crossToolPatterns.push('error_spike');
                hints.crossToolPatterns.push('service_failure');
                hints.crossToolPatterns.push('timeout');
                hints.crossToolPatterns.push('connection_issue');
            }

            if (issue.performanceCategory === 'memory') {
                hints.crossToolPatterns.push('memory_leak');
                hints.crossToolPatterns.push('resource_consumption');
                hints.crossToolPatterns.push('garbage_collection');
                hints.crossToolPatterns.push('heap_issue');
            }

            if (issue.performanceCategory === 'cpu') {
                hints.crossToolPatterns.push('cpu_spike');
                hints.crossToolPatterns.push('resource_consumption');
                hints.crossToolPatterns.push('infinite_loop');
                hints.crossToolPatterns.push('computation_heavy');
            }

            if (issue.performanceCategory === 'throughput') {
                hints.crossToolPatterns.push('capacity_issue');
                hints.crossToolPatterns.push('scaling_problem');
                hints.crossToolPatterns.push('rate_limiting');
                hints.crossToolPatterns.push('queue_backup');
            }

            // Impact-based patterns
            if (issue.impactLevel === 'user_facing') {
                hints.crossToolPatterns.push('user_experience');
                hints.crossToolPatterns.push('frontend_issue');
            }

            if (issue.impactLevel === 'system_level') {
                hints.crossToolPatterns.push('infrastructure_issue');
                hints.crossToolPatterns.push('system_resource');
            }

            // Severity-based patterns
            if (issue.severity === 'critical' || issue.severity === 'high') {
                hints.crossToolPatterns.push('urgent_fix');
                hints.crossToolPatterns.push('production_impact');
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
            ecosystem: 'performance',
            totalIssues: results.length,
            issueDistribution: {},
            correlationReadiness: true,
            processingHints: {
                serviceBasedCorrelation: true,
                performanceCategoryCorrelation: true,
                impactLevelCorrelation: true,
                metricBasedCorrelation: true
            }
        };

        // Calculate issue distribution
        const categories = {};
        const severities = {};
        const impactLevels = {};
        const services = {};

        results.forEach(issue => {
            categories[issue.performanceCategory] = (categories[issue.performanceCategory] || 0) + 1;
            severities[issue.severity] = (severities[issue.severity] || 0) + 1;

            if (issue.impactLevel) {
                impactLevels[issue.impactLevel] = (impactLevels[issue.impactLevel] || 0) + 1;
            }

            if (issue.entity?.name) {
                services[issue.entity.name] = (services[issue.entity.name] || 0) + 1;
            }
        });

        metadata.issueDistribution = {
            byCategory: categories,
            bySeverity: severities,
            byImpactLevel: impactLevels,
            byService: services
        };

        // DataDog APM specific metadata
        if (toolName === 'datadog-apm') {
            metadata.performanceCategories = this.categorizePerformanceIssues(categories);
            metadata.processingHints.realTimeMonitoring = true;
            metadata.processingHints.distributedTracingCorrelation = true;
        }

        return metadata;
    }

    /**
     * Categorize DataDog APM performance issues
     */
    categorizePerformanceIssues(categories) {
        const classification = {
            latencyIssues: [],
            availabilityIssues: [],
            resourceIssues: [],
            throughputIssues: [],
            other: []
        };

        Object.keys(categories).forEach(category => {
            if (['response_time', 'loading'].includes(category)) {
                classification.latencyIssues.push(category);
            } else if (['availability'].includes(category)) {
                classification.availabilityIssues.push(category);
            } else if (['memory', 'cpu'].includes(category)) {
                classification.resourceIssues.push(category);
            } else if (['throughput'].includes(category)) {
                classification.throughputIssues.push(category);
            } else {
                classification.other.push(category);
            }
        });

        return classification;
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
     * Generate integration report for DataDog APM
     */
    generateIntegrationReport(datadogResults, projectRoot) {
        const report = {
            timestamp: new Date().toISOString(),
            projectRoot,
            tools: {},
            overallStatus: 'unknown'
        };

        // Analyze DataDog APM integration
        if (datadogResults) {
            const datadogValidation = this.validateCorrelationReadiness(datadogResults, 'datadog-apm');
            const datadogMetadata = this.extractCorrelationMetadata(datadogResults, 'datadog-apm');

            report.tools['datadog-apm'] = {
                validation: datadogValidation,
                metadata: datadogMetadata,
                enhancedResults: this.enhanceForCorrelation(datadogResults, projectRoot, 'datadog-apm')
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
     * Convert DataDog APM results to unified model format
     */
    convertDataDogToUnified(datadogResults, projectRoot) {
        const unifiedIssues = [];

        if (!datadogResults || !Array.isArray(datadogResults)) {
            return unifiedIssues;
        }

        datadogResults.forEach((issue, index) => {
            const unifiedIssue = {
                id: issue.id || `datadog-apm_${issue.performanceCategory || 'unknown'}_${index}`,
                title: issue.title || 'Performance Issue',
                description: issue.description || 'Performance monitoring detected an issue',
                severity: this.mapDataDogSeverity(issue.severity),
                category: issue.performanceCategory || 'performance',
                entity: issue.entity || {
                    id: 'unknown',
                    type: 'service',
                    name: 'Unknown Service',
                    canonicalPath: 'services/unknown'
                },
                tool: 'datadog-apm',
                confidence: this.calculateDataDogConfidence(issue),
                tags: this.generateTags(),
                metadata: {
                    source: 'datadog_apm',
                    performanceCategory: issue.performanceCategory,
                    impactLevel: issue.impactLevel,
                    originalSeverity: issue.severity
                },
                performanceMetrics: issue.performanceMetrics || {},
                performanceCategory: issue.performanceCategory || 'performance',
                impactLevel: issue.impactLevel || 'system_level',
                optimizationOpportunity: issue.optimizationOpportunity,
                createdAt: issue.createdAt || new Date().toISOString()
            };

            unifiedIssues.push(unifiedIssue);
        });

        return unifiedIssues;
    }

    /**
     * Map DataDog severity to unified model severity
     */
    mapDataDogSeverity(datadogSeverity) {
        // DataDog APM uses standard severity levels
        switch (datadogSeverity?.toLowerCase()) {
            case 'critical':
                return 'high'; // Map critical to high for unified model
            case 'high':
                return 'high';
            case 'medium':
            case 'warning':
                return 'medium';
            case 'low':
            case 'info':
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Calculate confidence score for DataDog APM issues
     */
    calculateDataDogConfidence(issue) {
        let baseConfidence = 0.90; // DataDog APM is very reliable

        // Performance monitoring is generally accurate
        if (issue.performanceCategory === 'response_time') {
            baseConfidence = 0.95; // Response time measurements are very accurate
        }

        if (issue.performanceCategory === 'availability') {
            baseConfidence = 0.98; // Error tracking is extremely reliable
        }

        if (issue.performanceCategory === 'memory' || issue.performanceCategory === 'cpu') {
            baseConfidence = 0.93; // Resource metrics are very accurate
        }

        // Adjust based on impact level
        if (issue.impactLevel === 'user_facing') {
            baseConfidence = Math.min(0.98, baseConfidence + 0.03);
        }

        // Adjust based on optimization opportunity confidence
        if (issue.optimizationOpportunity?.priority === 'high') {
            baseConfidence = Math.min(0.98, baseConfidence + 0.02);
        }

        return baseConfidence;
    }

    /**
     * Generate tags for DataDog APM issues
     */
    generateTags() {
        return ['performance', 'apm', 'monitoring', 'datadog'];
    }

    /**
     * Generate appropriate issue title based on performance category
     */
    generateIssueTitle(issue) {
        const titles = {
            'response_time': 'High Response Time',
            'availability': 'Service Availability Issue',
            'loading': 'Slow Loading Performance',
            'memory': 'Memory Usage Issue',
            'cpu': 'CPU Usage Issue',
            'throughput': 'Low Throughput'
        };

        return titles[issue.performanceCategory] || 'Performance Issue';
    }

    /**
     * Extract service names from DataDog APM results for correlation
     */
    extractServiceNames(results) {
        const services = new Set();

        results.forEach(issue => {
            if (issue.entity?.name) {
                services.add(issue.entity.name);
            }
        });

        return Array.from(services);
    }

    /**
     * Extract performance metrics summary for correlation
     */
    extractPerformanceMetricsSummary(results) {
        const summary = {
            avgResponseTime: 0,
            totalErrors: 0,
            avgThroughput: 0,
            servicesAffected: 0,
            criticalIssues: 0
        };

        let responseTimeSum = 0;
        let responseTimeCount = 0;
        let throughputSum = 0;
        let throughputCount = 0;

        const affectedServices = new Set();

        results.forEach(issue => {
            if (issue.performanceMetrics?.responseTime) {
                responseTimeSum += issue.performanceMetrics.responseTime;
                responseTimeCount++;
            }

            if (issue.performanceMetrics?.throughput) {
                throughputSum += issue.performanceMetrics.throughput;
                throughputCount++;
            }

            if (issue.performanceMetrics?.errorRate) {
                summary.totalErrors += issue.performanceMetrics.errorRate;
            }

            if (issue.entity?.name) {
                affectedServices.add(issue.entity.name);
            }

            if (issue.severity === 'critical' || issue.severity === 'high') {
                summary.criticalIssues++;
            }
        });

        summary.avgResponseTime = responseTimeCount > 0 ? responseTimeSum / responseTimeCount : 0;
        summary.avgThroughput = throughputCount > 0 ? throughputSum / throughputCount : 0;
        summary.servicesAffected = affectedServices.size;

        return summary;
    }
}

module.exports = DataDogUnifiedModelIntegration;