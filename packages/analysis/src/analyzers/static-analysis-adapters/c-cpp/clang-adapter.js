/**
 * Clang Static Analyzer Adapter for Topolop
 * 
 * Transforms Clang Static Analyzer output into city visualization data.
 * 
 * City Metaphor Mapping:
 * - Static analysis warnings → Yellow construction warning signs
 * - Memory leaks → Red hazmat warning beacons
 * - Null pointer dereferences → Emergency stop signs
 * - Dead code → Abandoned building sections
 * - Code paths → Traffic flow analysis through buildings
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ClangStaticAnalyzerAdapter {
  constructor() {
    this.name = 'clang-static-analyzer';
    this.supportedLanguages = ['c-cpp'];
    this.description = 'Clang static analyzer for C/C++ code';
  }

  /**
   * Check if Clang Static Analyzer is available
   */
  async checkAvailability() {
    try {
      execSync('clang --version', { stdio: 'pipe' });
      execSync('scan-build --help', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Clang Static Analyzer on codebase
   */
  async analyze(codebasePath, options = {}) {
    if (!await this.checkAvailability()) {
      throw new Error('Clang Static Analyzer not available. Install clang and scan-build');
    }

    const outputDir = path.join(codebasePath, '.topolop-clang-output');
    const plistDir = path.join(outputDir, 'plist');
    
    try {
      // Create output directories
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      if (!fs.existsSync(plistDir)) {
        fs.mkdirSync(plistDir, { recursive: true });
      }

      // Find build command or use default
      const buildCommand = this.detectBuildCommand(codebasePath, options);
      
      // Run scan-build with plist output
      const scanCommand = `scan-build -o "${plistDir}" --use-analyzer=/usr/bin/clang -plist-html --keep-going ${buildCommand}`;
      
      let scanOutput = '';
      try {
        scanOutput = execSync(scanCommand, { 
          cwd: codebasePath, 
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // scan-build returns non-zero when issues found, but we still want the output
        scanOutput = error.stdout || error.stderr || '';
      }

      // Parse plist files
      const analysisResults = this.parsePlistFiles(plistDir);
      
      // Parse scan-build summary
      const summary = this.parseScanBuildOutput(scanOutput);
      
      // Clean up temp files
      this.cleanupTempFiles(outputDir);
      
      return {
        tool: 'clang-static-analyzer',
        timestamp: new Date().toISOString(),
        codebasePath,
        buildCommand,
        results: analysisResults,
        scanSummary: summary,
        summary: this.generateSummary(analysisResults)
      };
      
    } catch (error) {
      // Clean up temp files if they exist
      this.cleanupTempFiles(outputDir);
      throw new Error(`Clang Static Analyzer failed: ${error.message}`);
    }
  }

  detectBuildCommand(codebasePath, options) {
    if (options.buildCommand) {
      return options.buildCommand;
    }

    // Try to detect common build systems
    if (fs.existsSync(path.join(codebasePath, 'Makefile'))) {
      return 'make';
    }
    if (fs.existsSync(path.join(codebasePath, 'CMakeLists.txt'))) {
      return 'cmake . && make';
    }
    if (fs.existsSync(path.join(codebasePath, 'configure'))) {
      return './configure && make';
    }
    
    // Fallback: try to compile all C/C++ files
    const sourceFiles = this.findSourceFiles(codebasePath);
    if (sourceFiles.length > 0) {
      return `clang -c ${sourceFiles.slice(0, 10).join(' ')}`; // Limit to first 10 files
    }
    
    return 'echo "No build command detected"';
  }

  findSourceFiles(codebasePath) {
    const sourceFiles = [];
    
    const walkDirectory = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory() && !file.name.startsWith('.') && 
              !['build', 'obj', 'bin'].includes(file.name)) {
            walkDirectory(fullPath);
          } else if (file.isFile() && /\.(c|cpp|cc|cxx)$/.test(file.name)) {
            sourceFiles.push(path.relative(codebasePath, fullPath));
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDirectory(codebasePath);
    return sourceFiles;
  }

  parsePlistFiles(plistDir) {
    const results = [];
    
    try {
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            walkDir(fullPath);
          } else if (file.name.endsWith('.plist')) {
            try {
              // Parse plist file (simplified XML parsing)
              const content = fs.readFileSync(fullPath, 'utf8');
              const issues = this.parsePlistContent(content);
              results.push(...issues);
            } catch (error) {
              console.warn(`Failed to parse plist file ${fullPath}: ${error.message}`);
            }
          }
        }
      };
      
      if (fs.existsSync(plistDir)) {
        walkDir(plistDir);
      }
    } catch (error) {
      console.warn(`Failed to read plist directory: ${error.message}`);
    }
    
    return results;
  }

  parsePlistContent(content) {
    const issues = [];
    
    // Simple regex-based parsing for key plist elements
    // This is a simplified parser - for production use, consider a proper plist parser
    const bugTypePattern = /<key>type<\/key>\s*<string>([^<]+)<\/string>/g;
    const descriptionPattern = /<key>description<\/key>\s*<string>([^<]+)<\/string>/g;
    const filePattern = /<key>file<\/key>\s*<integer>(\d+)<\/integer>/g;
    const linePattern = /<key>line<\/key>\s*<integer>(\d+)<\/integer>/g;
    const colPattern = /<key>col<\/key>\s*<integer>(\d+)<\/integer>/g;

    let bugTypeMatch, descMatch, fileMatch, lineMatch, colMatch;
    
    // Extract all matches
    const bugTypes = [];
    const descriptions = [];
    const files = [];
    const lines = [];
    const cols = [];
    
    while ((bugTypeMatch = bugTypePattern.exec(content)) !== null) {
      bugTypes.push(bugTypeMatch[1]);
    }
    while ((descMatch = descriptionPattern.exec(content)) !== null) {
      descriptions.push(descMatch[1]);
    }
    while ((fileMatch = filePattern.exec(content)) !== null) {
      files.push(parseInt(fileMatch[1]));
    }
    while ((lineMatch = linePattern.exec(content)) !== null) {
      lines.push(parseInt(lineMatch[1]));
    }
    while ((colMatch = colPattern.exec(content)) !== null) {
      cols.push(parseInt(colMatch[1]));
    }

    // Combine the data (simplified approach)
    const maxLength = Math.max(bugTypes.length, descriptions.length);
    for (let i = 0; i < maxLength; i++) {
      issues.push({
        type: bugTypes[i] || 'Unknown',
        description: descriptions[i] || 'No description',
        file: files[i] || 0,
        line: lines[i] || 0,
        column: cols[i] || 0,
        severity: this.classifyBugSeverity(bugTypes[i] || 'Unknown')
      });
    }
    
    return issues;
  }

  classifyBugSeverity(bugType) {
    const highSeverity = ['Memory leak', 'Null pointer dereference', 'Use-after-free', 'Buffer overflow'];
    const mediumSeverity = ['Dead store', 'Uninitialized variable', 'Logic error'];
    
    if (highSeverity.some(severity => bugType.includes(severity))) {
      return 'high';
    }
    if (mediumSeverity.some(severity => bugType.includes(severity))) {
      return 'medium';
    }
    return 'low';
  }

  parseScanBuildOutput(output) {
    const summary = {
      bugsFound: 0,
      filesAnalyzed: 0,
      buildSuccess: false
    };

    // Extract summary information from scan-build output
    const bugsMatch = output.match(/scan-build: (\d+) bugs? found/);
    if (bugsMatch) {
      summary.bugsFound = parseInt(bugsMatch[1]);
    }

    const filesMatch = output.match(/(\d+) files? analyzed/);
    if (filesMatch) {
      summary.filesAnalyzed = parseInt(filesMatch[1]);
    }

    summary.buildSuccess = !output.includes('Build failed') && !output.includes('error:');
    
    return summary;
  }

  cleanupTempFiles(outputDir) {
    try {
      if (fs.existsSync(outputDir)) {
        const rmCommand = process.platform === 'win32' ? `rmdir /s /q "${outputDir}"` : `rm -rf "${outputDir}"`;
        execSync(rmCommand, { stdio: 'pipe' });
      }
    } catch (error) {
      // Cleanup is best effort
    }
  }

  /**
   * Generate analysis summary
   */
  generateSummary(analysisResults) {
    const severityCounts = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    const bugTypes = {};
    const fileStats = {};

    for (const issue of analysisResults) {
      // Count by severity
      severityCounts[issue.severity]++;

      // Track bug types
      bugTypes[issue.type] = (bugTypes[issue.type] || 0) + 1;

      // Track per-file stats
      const fileId = issue.file.toString();
      if (!fileStats[fileId]) {
        fileStats[fileId] = {
          high: 0,
          medium: 0,
          low: 0,
          total: 0,
          issues: []
        };
      }
      
      fileStats[fileId][issue.severity]++;
      fileStats[fileId].total++;
      fileStats[fileId].issues.push(issue);
    }

    return {
      totalIssues: analysisResults.length,
      severityCounts,
      fileStats,
      topBugTypes: this.getTopBugTypes(bugTypes, 10),
      codeQualityScore: this.calculateCodeQualityScore(severityCounts),
      memoryManagementScore: this.calculateMemoryManagementScore(bugTypes)
    };
  }

  getTopBugTypes(bugTypes, limit = 10) {
    return Object.entries(bugTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  calculateCodeQualityScore(severityCounts) {
    const highPenalty = severityCounts.high * 20;
    const mediumPenalty = severityCounts.medium * 8;
    const lowPenalty = severityCounts.low * 3;
    
    return Math.max(0, 100 - highPenalty - mediumPenalty - lowPenalty);
  }

  calculateMemoryManagementScore(bugTypes) {
    const memoryBugs = Object.entries(bugTypes)
      .filter(([type]) => type.toLowerCase().includes('memory') || 
                         type.toLowerCase().includes('leak') ||
                         type.toLowerCase().includes('free'))
      .reduce((sum, [, count]) => sum + count, 0);
    
    return Math.max(0, 100 - memoryBugs * 15);
  }

  /**
   * Transform Clang output into city visualization data
   */
  toCityData(clangOutput) {
    const { results, summary } = clangOutput;
    
    const cityData = {
      staticAnalysisIssues: [],
      buildingEnhancements: {},
      memoryManagement: {},
      codePathAnalysis: {}
    };

    // Process each file's static analysis issues
    for (const [fileId, stats] of Object.entries(summary.fileStats)) {
      const fileName = `file_${fileId}`; // Since we only have file IDs from plist
      
      if (stats.total > 0) {
        // Add static analysis issues for visualization
        cityData.staticAnalysisIssues.push({
          file: fileName,
          type: 'clang-static-analyzer',
          severity: this.calculateOverallSeverity(stats),
          count: stats.total,
          details: {
            high: stats.high,
            medium: stats.medium,
            low: stats.low,
            topIssueTypes: this.getTopIssueTypesForFile(stats.issues)
          }
        });

        // Building enhancement data
        cityData.buildingEnhancements[fileName] = {
          structuralIntegrity: this.calculateStructuralIntegrity(stats),
          safetyLevel: this.calculateSafetyLevel(stats),
          constructionQuality: this.calculateConstructionQuality(stats),
          visualEffects: {
            hazmatBeacons: this.hasMemoryIssues(stats.issues),
            emergencyStops: this.hasNullPointerIssues(stats.issues),
            constructionWarnings: stats.medium > 0,
            abandonedSections: this.hasDeadCodeIssues(stats.issues),
            safetyInspections: stats.high > 0
          }
        };

        // Memory management data
        cityData.memoryManagement[fileName] = {
          memoryLeaks: this.countMemoryLeaks(stats.issues),
          memoryScore: this.calculateFileMemoryScore(stats.issues),
          memoryRisk: this.assessMemoryRisk(stats.issues)
        };

        // Code path analysis
        cityData.codePathAnalysis[fileName] = {
          pathComplexity: this.analyzePathComplexity(stats.issues),
          unreachableCode: this.countUnreachableCode(stats.issues),
          logicErrors: this.countLogicErrors(stats.issues)
        };
      }
    }

    return cityData;
  }

  calculateOverallSeverity(stats) {
    if (stats.high > 0) return 'critical';
    if (stats.medium > 0) return 'high';
    return 'medium';
  }

  getTopIssueTypesForFile(issues) {
    const typeCounts = {};
    for (const issue of issues) {
      typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  calculateStructuralIntegrity(stats) {
    const criticalIssues = stats.high;
    if (criticalIssues === 0) return 'excellent';
    if (criticalIssues <= 1) return 'good';
    if (criticalIssues <= 3) return 'fair';
    return 'poor';
  }

  calculateSafetyLevel(stats) {
    const safetyScore = 100 - (stats.high * 25 + stats.medium * 10 + stats.low * 3);
    
    if (safetyScore >= 90) return 'maximum';
    if (safetyScore >= 70) return 'high';
    if (safetyScore >= 50) return 'medium';
    return 'low';
  }

  calculateConstructionQuality(stats) {
    const totalIssues = stats.total;
    if (totalIssues === 0) return 'excellent';
    if (totalIssues <= 3) return 'good';
    if (totalIssues <= 8) return 'fair';
    return 'poor';
  }

  hasMemoryIssues(issues) {
    return issues.some(issue => 
      issue.type.toLowerCase().includes('memory') ||
      issue.type.toLowerCase().includes('leak') ||
      issue.type.toLowerCase().includes('free')
    );
  }

  hasNullPointerIssues(issues) {
    return issues.some(issue => 
      issue.type.toLowerCase().includes('null') ||
      issue.type.toLowerCase().includes('pointer')
    );
  }

  hasDeadCodeIssues(issues) {
    return issues.some(issue => 
      issue.type.toLowerCase().includes('dead') ||
      issue.type.toLowerCase().includes('unreachable')
    );
  }

  countMemoryLeaks(issues) {
    return issues.filter(issue => 
      issue.type.toLowerCase().includes('leak')
    ).length;
  }

  calculateFileMemoryScore(issues) {
    const memoryIssues = issues.filter(issue => 
      issue.type.toLowerCase().includes('memory') ||
      issue.type.toLowerCase().includes('leak') ||
      issue.type.toLowerCase().includes('free')
    );
    
    return Math.max(0, 100 - memoryIssues.length * 20);
  }

  assessMemoryRisk(issues) {
    const memoryIssueCount = this.countMemoryLeaks(issues);
    if (memoryIssueCount === 0) return 'low';
    if (memoryIssueCount <= 2) return 'medium';
    return 'high';
  }

  analyzePathComplexity(issues) {
    // Simplified path complexity based on logic-related issues
    const pathIssues = issues.filter(issue => 
      issue.type.toLowerCase().includes('logic') ||
      issue.type.toLowerCase().includes('branch') ||
      issue.type.toLowerCase().includes('condition')
    );
    
    if (pathIssues.length === 0) return 'simple';
    if (pathIssues.length <= 2) return 'moderate';
    return 'complex';
  }

  countUnreachableCode(issues) {
    return issues.filter(issue => 
      issue.type.toLowerCase().includes('unreachable') ||
      issue.type.toLowerCase().includes('dead')
    ).length;
  }

  countLogicErrors(issues) {
    return issues.filter(issue => 
      issue.type.toLowerCase().includes('logic')
    ).length;
  }
}

module.exports = new ClangStaticAnalyzerAdapter();