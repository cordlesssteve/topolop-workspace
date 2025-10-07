/**
 * C/C++ Security Configuration for Topolop
 *
 * Centralized security configuration for C/C++ static analysis tools.
 * Implements defense-in-depth security policies for memory-unsafe languages.
 *
 * Security Principles:
 * - Zero arbitrary code execution
 * - Maximum analysis depth with resource limits
 * - Container isolation compatible
 * - Path traversal protection
 * - Memory and time constraints
 */

const path = require('path');
const { resolveConfig } = require('../../config/default-config');

class CppSecurityConfig {
    constructor() {
        this.securityLevel = 'strict';
        this.containerMode = true;
        this.maxAnalysisTime = resolveConfig('staticAnalysis.cpp.timeout') || 600000; // 10 minutes
        this.maxFileSize = resolveConfig('staticAnalysis.cpp.maxFileSize') || 5 * 1024 * 1024; // 5MB
        this.maxMemoryUsage = resolveConfig('staticAnalysis.cpp.maxMemory') || '2GB';

        // File type security policies
        this.allowedExtensions = new Set([
            '.c', '.cpp', '.cc', '.cxx', '.c++',  // Source files
            '.h', '.hpp', '.hxx', '.hh'           // Header files
        ]);

        // Dangerous patterns to exclude from analysis
        this.dangerousPatterns = [
            /\#include\s*<windows\.h>/i,         // Windows-specific APIs
            /\#include\s*<winsock.*\.h>/i,       // Network APIs
            /\#include\s*<sys\/socket\.h>/i,     // Socket APIs
            /\#include\s*<netinet\/.*\.h>/i,     // Network headers
            /\#pragma\s+pack/i,                  // Memory layout manipulation
            /\basm\b/i,                          // Inline assembly
            /\b__asm\b/i,                        // Assembly blocks
            /\#pragma\s+comment\s*\(\s*lib/i,    // Library linking
            /\bsystem\s*\(/i,                    // System calls
            /\bexec[lv]p?\s*\(/i,                // Process execution
            /\bpopen\s*\(/i,                     // Pipe execution
        ];

        // Safe directory patterns
        this.safeDirPatterns = [
            /^src\//,
            /^source\//,
            /^lib\//,
            /^include\//,
            /^core\//,
            /^common\//,
            /^utils\//,
            /^util\//
        ];

        // Directories to always skip
        this.skipDirPatterns = [
            /^\.git\//,
            /^build\//,
            /^cmake-build-.*/,
            /^\.vscode\//,
            /^\.idea\//,
            /^node_modules\//,
            /^third[_-]party\//,
            /^3rdparty\//,
            /^vendor\//,
            /^external\//,
            /^deps\//,
            /^dependencies\//,
            /^\..*\//,                           // Hidden directories
            /test.*\//,                          // Test directories (often complex)
            /example.*\//,                       // Example directories
            /sample.*\//,                        // Sample directories
            /benchmark.*\//,                     // Benchmark directories
            /doc.*\//,                           // Documentation directories
        ];
    }

    /**
     * Get security configuration for Clang Static Analyzer
     */
    getClangSecurityConfig() {
        return {
            // Core security checkers
            enabledCheckers: [
                'core',                          // Core checkers (null dereference, etc.)
                'deadcode',                      // Dead code detection
                'security',                      // Security-related issues
                'unix',                          // Unix API checkers
                'alpha.security.ArrayBoundV2',   // Array bounds checking
                'alpha.security.MallocOverflow', // Malloc overflow detection
                'alpha.security.ReturnPtrRange', // Return pointer range
                'alpha.core.CastSize',           // Cast size issues
                'alpha.core.SizeofPtr'           // Sizeof pointer issues
            ],

            // Disabled checkers (too noisy or not security-focused)
            disabledCheckers: [
                'alpha.security.taint.TaintPropagation', // Too noisy for automation
                'debug',                         // Debug checkers not needed
                'osx',                          // macOS-specific (skip for portability)
                'fuchsia'                       // Fuchsia-specific
            ],

            // Analysis configuration
            analysisConfig: {
                maxLoopIterations: 4,            // Limit loop analysis
                maxInlineStackDepth: 4,          // Limit recursion depth
                maxNodesThreshold: 150000,       // Limit analysis complexity
                eagerlyAssume: true,             // Aggressive analysis
                suppressNullReturnPaths: false,  // Don't suppress null paths
                crosscheck: false                // No cross-checking (performance)
            },

            // Resource limits
            resourceLimits: {
                timeout: this.maxAnalysisTime,
                maxFileSize: this.maxFileSize,
                maxMemory: this.maxMemoryUsage
            },

            // Security-focused arguments
            secureArgs: [
                '--analyze',
                '--analyzer-output=plist-multi-file',
                '-Xanalyzer', '-analyzer-eagerly-assume',
                '-Xanalyzer', '-analyzer-checker=security',
                '-Xanalyzer', '-analyzer-checker=core',
                '-Xanalyzer', '-analyzer-checker=deadcode',
                '-Xanalyzer', '-analyzer-checker=unix',
                '-Xanalyzer', '-analyzer-max-loop=4',
                '-Xanalyzer', '-analyzer-inline-max-stack-depth=4',
                '-fsyntax-only',
                '-w', // Suppress warnings to focus on analysis
                '-fno-builtin', // Don't assume builtin functions
                '-fno-common'   // Better error detection
            ]
        };
    }

    /**
     * Get security configuration for CBMC
     */
    getCBMCSecurityConfig() {
        return {
            // Security-focused properties
            enabledProperties: [
                'bounds-check',              // Array bounds checking
                'pointer-check',             // Pointer validity
                'div-by-zero-check',         // Division by zero
                'signed-overflow-check',     // Integer overflow (signed)
                'unsigned-overflow-check',   // Integer overflow (unsigned)
                'conversion-check',          // Type conversion issues
                'memory-leak-check',         // Memory leak detection
                'nan-check',                 // NaN detection
                'undefined-shift-check'      // Undefined bit shifts
            ],

            // Analysis bounds (security vs performance trade-off)
            analysisBounds: {
                maxUnwindBound: 20,          // Maximum loop unwinding
                maxDepthBound: 15,           // Maximum recursion depth
                maxArraySize: 1000,          // Maximum array size to analyze
                partialLoops: true,          // Handle partial loop unwinding
                noUnwindingAssertions: true  // Don't fail on unwinding limits
            },

            // Resource limits
            resourceLimits: {
                timeout: this.maxAnalysisTime,
                maxFileSize: this.maxFileSize,
                maxMemory: this.maxMemoryUsage,
                maxProcesses: 1              // Single process for security
            },

            // Security-focused arguments
            secureArgs: [
                '--bounds-check',
                '--div-by-zero-check',
                '--signed-overflow-check',
                '--unsigned-overflow-check',
                '--pointer-check',
                '--memory-leak-check',
                '--nan-check',
                '--xml-ui',
                '--no-assertions',           // Don't require user assertions
                '--partial-loops',
                '--no-unwinding-assertions',
                '--flush',
                '--verbosity', '2'
            ],

            // File filtering for CBMC (more restrictive)
            fileFilters: {
                maxComplexity: 500,          // Cyclomatic complexity limit
                maxFunctions: 20,            // Max functions per file
                maxLines: 1000,              // Max lines per file
                requireMain: false,          // Don't require main function
                allowInlineAssembly: false,  // No inline assembly
                allowSystemCalls: false      // No system calls
            }
        };
    }

    /**
     * Validate file for C/C++ analysis
     */
    async validateFile(filePath, content = null) {
        const validation = {
            isValid: false,
            reason: '',
            securityLevel: 'unknown',
            allowedTools: []
        };

        try {
            // Check file extension
            const ext = path.extname(filePath).toLowerCase();
            if (!this.allowedExtensions.has(ext)) {
                validation.reason = `File extension ${ext} not allowed`;
                return validation;
            }

            // Check file size (if we have stats)
            try {
                const fs = require('fs').promises;
                const stats = await fs.stat(filePath);
                if (stats.size > this.maxFileSize) {
                    validation.reason = `File too large: ${stats.size} bytes`;
                    return validation;
                }
            } catch (error) {
                // File might not exist yet, skip size check
            }

            // Check directory patterns
            const normalizedPath = path.normalize(filePath);

            // Skip dangerous directories
            if (this.skipDirPatterns.some(pattern => pattern.test(normalizedPath))) {
                validation.reason = 'File in excluded directory';
                return validation;
            }

            // Analyze content if provided
            if (content) {
                const contentValidation = this.validateContent(content);
                if (!contentValidation.isValid) {
                    validation.reason = contentValidation.reason;
                    validation.securityLevel = contentValidation.securityLevel;
                    return validation;
                }
                validation.securityLevel = contentValidation.securityLevel;
                validation.allowedTools = contentValidation.allowedTools;
            } else {
                validation.securityLevel = 'medium';
                validation.allowedTools = ['clang', 'cbmc'];
            }

            validation.isValid = true;
            return validation;

        } catch (error) {
            validation.reason = `Validation error: ${error.message}`;
            return validation;
        }
    }

    /**
     * Validate file content for security
     */
    validateContent(content) {
        const validation = {
            isValid: false,
            reason: '',
            securityLevel: 'high',
            allowedTools: []
        };

        // Check for dangerous patterns
        const dangerousPattern = this.dangerousPatterns.find(pattern => pattern.test(content));
        if (dangerousPattern) {
            validation.reason = `Contains dangerous pattern: ${dangerousPattern.source}`;
            validation.securityLevel = 'restricted';
            return validation;
        }

        // Analyze complexity and determine suitable tools
        const complexity = this.analyzeComplexity(content);

        if (complexity.isSuitable) {
            validation.isValid = true;
            validation.securityLevel = complexity.securityLevel;
            validation.allowedTools = complexity.allowedTools;
        } else {
            validation.reason = complexity.reason;
            validation.securityLevel = 'restricted';
        }

        return validation;
    }

    /**
     * Analyze code complexity and suitability for different tools
     */
    analyzeComplexity(content) {
        const analysis = {
            isSuitable: true,
            reason: '',
            securityLevel: 'high',
            allowedTools: []
        };

        // Count various code constructs
        const metrics = {
            lines: content.split('\n').length,
            functions: (content.match(/\b\w+\s*\([^)]*\)\s*\{/g) || []).length,
            loops: (content.match(/\b(for|while|do)\s*\(/g) || []).length,
            conditionals: (content.match(/\bif\s*\(/g) || []).length,
            pointers: (content.match(/\*\w+|\w+\s*\*/g) || []).length,
            malloc: (content.match(/\b(malloc|calloc|realloc|free)\s*\(/g) || []).length,
            includes: (content.match(/\#include/g) || []).length,
            templates: (content.match(/template\s*</g) || []).length,
            classes: (content.match(/\bclass\s+\w+/g) || []).length
        };

        // Determine tool suitability based on complexity

        // Clang Static Analyzer - good for most C/C++ code
        const clangSuitable = metrics.lines < 5000 &&
                             metrics.functions < 100 &&
                             metrics.templates < 10;

        // CBMC - better for smaller, simpler functions
        const cbmcSuitable = metrics.lines < 1000 &&
                            metrics.functions < 20 &&
                            metrics.loops < 10 &&
                            metrics.templates === 0 &&
                            metrics.classes < 5;

        if (clangSuitable) {
            analysis.allowedTools.push('clang');
        }

        if (cbmcSuitable) {
            analysis.allowedTools.push('cbmc');
        }

        // Determine security level based on code characteristics
        if (metrics.pointers > 20 || metrics.malloc > 10) {
            analysis.securityLevel = 'critical'; // High memory management complexity
        } else if (metrics.pointers > 5 || metrics.malloc > 2) {
            analysis.securityLevel = 'high';     // Some memory management
        } else {
            analysis.securityLevel = 'medium';   // Limited memory management
        }

        // Check if any tools are suitable
        if (analysis.allowedTools.length === 0) {
            analysis.isSuitable = false;
            analysis.reason = 'Code too complex for available analysis tools';
        }

        return analysis;
    }

    /**
     * Get container security configuration
     */
    getContainerConfig() {
        return {
            // Container resource limits
            resources: {
                memory: this.maxMemoryUsage,
                cpus: '1.0',
                timeout: this.maxAnalysisTime / 1000, // Convert to seconds
                tmpfs: '/tmp:rw,size=1G',
                readOnly: true
            },

            // Security options
            security: {
                user: 'nobody:nogroup',
                noNetwork: true,
                noNewPrivileges: true,
                seccompProfile: 'default',
                apparmorProfile: 'docker-default',
                dropCapabilities: ['ALL'],
                addCapabilities: [], // No additional capabilities
            },

            // Mount configuration
            mounts: {
                readonly: ['/etc', '/usr', '/lib', '/bin', '/sbin'],
                tmpfs: ['/tmp', '/var/tmp'],
                noExec: ['/tmp', '/var/tmp', '/dev/shm']
            },

            // Environment restrictions
            environment: {
                PATH: '/usr/local/bin:/usr/bin:/bin',
                HOME: '/tmp',
                USER: 'nobody',
                TMPDIR: '/tmp',
                // Remove potentially dangerous environment variables
                unset: ['LD_PRELOAD', 'LD_LIBRARY_PATH', 'PYTHONPATH']
            }
        };
    }

    /**
     * Get runtime security policies
     */
    getRuntimePolicies() {
        return {
            // Process execution policies
            execution: {
                allowChildProcesses: false,     // No child process spawning
                allowNetworkAccess: false,      // No network access
                allowFileSystemWrite: false,    // Read-only file system
                maxProcesses: 1,               // Single process only
                maxOpenFiles: 100,             // Limit open file descriptors
                maxMemoryMB: 2048,             // Memory limit
                maxCpuTimeSeconds: this.maxAnalysisTime / 1000
            },

            // File system policies
            filesystem: {
                allowedReadPaths: [
                    '/usr/bin/clang',
                    '/usr/bin/cbmc',
                    '/usr/include',
                    '/usr/lib',
                    '/lib',
                    '/tmp'
                ],
                allowedWritePaths: [
                    '/tmp'
                ],
                blockedPaths: [
                    '/proc',
                    '/sys',
                    '/dev',
                    '/etc/passwd',
                    '/etc/shadow',
                    '/home',
                    '/root'
                ]
            },

            // System call filtering
            systemCalls: {
                allowed: [
                    'read', 'write', 'open', 'close', 'stat', 'fstat',
                    'lseek', 'mmap', 'munmap', 'brk', 'rt_sigaction',
                    'rt_sigprocmask', 'ioctl', 'access', 'exit',
                    'exit_group', 'wait4', 'kill', 'getpid', 'clone',
                    'execve', 'getcwd', 'chdir', 'readdir', 'getdents64'
                ],
                blocked: [
                    'socket', 'connect', 'bind', 'listen', 'accept',
                    'ptrace', 'personality', 'prctl', 'arch_prctl',
                    'modify_ldt', 'pivot_root', 'chroot', 'mount',
                    'umount', 'swapon', 'swapoff', 'reboot'
                ]
            }
        };
    }

    /**
     * Generate secure command line arguments
     */
    generateSecureArgs(tool, additionalArgs = []) {
        const baseConfig = tool === 'cbmc' ? this.getCBMCSecurityConfig() : this.getClangSecurityConfig();

        return {
            args: [...baseConfig.secureArgs, ...additionalArgs],
            env: {
                PATH: '/usr/local/bin:/usr/bin:/bin',
                HOME: '/tmp',
                TMPDIR: '/tmp',
                // Tool-specific environment variables
                ...(tool === 'cbmc' ? { CBMC_MAX_MEMORY: this.maxMemoryUsage } : {}),
                ...(tool === 'clang' ? { CLANG_ANALYZER_MAX_MEMORY: this.maxMemoryUsage } : {})
            },
            limits: baseConfig.resourceLimits
        };
    }
}

module.exports = new CppSecurityConfig();