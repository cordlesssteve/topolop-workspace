/**
 * Node.js Built-in Profiler Integration for WSL2/Windows Environments
 * 
 * Alternative to Linux perf tool using Node.js built-in profiling capabilities.
 * Provides CPU profiling and basic performance metrics for JavaScript applications.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class NodeJSProfilerIntegration {
  constructor() {
    this.name = 'nodejs-profiler';
    this.supportedPlatforms = ['linux', 'win32', 'darwin'];
    this.supportedLanguages = ['javascript', 'typescript'];
    this.available = true; // Always available with Node.js
  }

  async checkAvailability() {
    try {
      // Check if Node.js has profiling capabilities
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      // Node.js has built-in profiling since v8
      return majorVersion >= 8;
    } catch (error) {
      return false;
    }
  }

  /**
   * Profile a JavaScript project using Node.js built-in profiler
   */
  async profileProject(projectPath, options = {}) {
    const {
      duration = 10000, // 10 seconds default
      outputDir = path.join(projectPath, 'profiling-output'),
      entryPoint = 'index.js'
    } = options;

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Find the main entry point
      const mainFile = await this.findMainFile(projectPath, entryPoint);
      if (!mainFile) {
        throw new Error('No suitable entry point found for profiling');
      }

      console.log(`🔍 Profiling ${mainFile} for ${duration}ms...`);

      // Run Node.js with CPU profiling
      const profileData = await this.runNodeProfiler(mainFile, duration, outputDir);
      
      // Parse and transform profile data
      const transformedData = this.transformProfileData(profileData, projectPath);
      
      return transformedData;

    } catch (error) {
      console.error(`❌ Node.js profiling failed: ${error.message}`);
      return this.createFallbackData(projectPath, error);
    }
  }

  async findMainFile(projectPath, entryPoint) {
    const possibleFiles = [
      path.join(projectPath, entryPoint),
      path.join(projectPath, 'index.js'),
      path.join(projectPath, 'main.js'),
      path.join(projectPath, 'app.js'),
      path.join(projectPath, 'src/index.js'),
      path.join(projectPath, 'src/main.js')
    ];

    for (const file of possibleFiles) {
      try {
        await fs.access(file);
        return file;
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    // Check package.json for main field
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (packageJson.main) {
        const mainFile = path.join(projectPath, packageJson.main);
        await fs.access(mainFile);
        return mainFile;
      }
    } catch (error) {
      // No package.json or main field
    }

    return null;
  }

  async runNodeProfiler(mainFile, duration, outputDir) {
    return new Promise((resolve, reject) => {
      const profileFile = path.join(outputDir, 'cpu-profile.json');
      
      // Use Node.js --cpu-prof flag for built-in profiling
      const args = [
        '--cpu-prof',
        '--cpu-prof-dir', outputDir,
        '--cpu-prof-name', 'cpu-profile.json',
        mainFile
      ];

      console.log(`Executing: node ${args.join(' ')}`);

      const child = spawn('node', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: duration + 5000 // Extra time for cleanup
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Kill the process after duration
      const killTimer = setTimeout(() => {
        child.kill('SIGTERM');
      }, duration);

      child.on('close', async (code) => {
        clearTimeout(killTimer);
        
        try {
          // Try to read the generated profile
          const profileData = await fs.readFile(profileFile, 'utf8');
          const parsed = JSON.parse(profileData);
          
          resolve({
            profileData: parsed,
            stdout,
            stderr,
            exitCode: code
          });
        } catch (error) {
          // Profile might not have been generated
          resolve({
            profileData: null,
            stdout,
            stderr,
            exitCode: code,
            error: error.message
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(killTimer);
        reject(new Error(`Profiling process error: ${error.message}`));
      });
    });
  }

  transformProfileData(profileResult, projectPath) {
    const { profileData, stdout, stderr } = profileResult;

    if (!profileData) {
      return this.createFallbackData(projectPath, new Error('No profile data generated'));
    }

    try {
      // Transform V8 CPU profile format to our standard format
      const hotspots = this.extractHotspots(profileData, projectPath);
      const callGraph = this.extractCallGraph(profileData, projectPath);

      return {
        tool: 'nodejs-profiler',
        timestamp: new Date().toISOString(),
        projectPath,
        hotspots,
        callGraph,
        metadata: {
          totalSamples: profileData.samples ? profileData.samples.length : 0,
          startTime: profileData.startTime,
          endTime: profileData.endTime,
          profileVersion: profileData.version || '1.0'
        },
        rawOutput: {
          stdout: stdout.slice(0, 1000), // Truncate for size
          stderr: stderr.slice(0, 1000)
        }
      };
    } catch (error) {
      return this.createFallbackData(projectPath, error);
    }
  }

  extractHotspots(profileData, projectPath) {
    const hotspots = [];

    if (!profileData.nodes) {
      return hotspots;
    }

    // Calculate hit counts for each function
    const nodeCounts = {};
    if (profileData.samples) {
      profileData.samples.forEach(sample => {
        nodeCounts[sample] = (nodeCounts[sample] || 0) + 1;
      });
    }

    // Extract top functions by sample count
    profileData.nodes.forEach((node, index) => {
      const hitCount = nodeCounts[index] || 0;
      
      if (hitCount > 0 && node.callFrame) {
        const frame = node.callFrame;
        const fileName = frame.url ? path.relative(projectPath, frame.url) : 'unknown';
        
        hotspots.push({
          symbol: frame.functionName || '(anonymous)',
          file: fileName,
          line: frame.lineNumber || 0,
          column: frame.columnNumber || 0,
          samples: hitCount,
          percentage: (hitCount / profileData.samples.length) * 100,
          cpuTime: hitCount * 0.1 // Estimate: 0.1ms per sample
        });
      }
    });

    // Sort by sample count and return top 20
    return hotspots
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 20);
  }

  extractCallGraph(profileData, projectPath) {
    const callGraph = [];

    if (!profileData.nodes) {
      return callGraph;
    }

    profileData.nodes.forEach(node => {
      if (node.children && node.callFrame) {
        const parentFrame = node.callFrame;
        const parentFile = parentFrame.url ? path.relative(projectPath, parentFrame.url) : 'unknown';
        
        node.children.forEach(childId => {
          const childNode = profileData.nodes[childId];
          if (childNode && childNode.callFrame) {
            const childFrame = childNode.callFrame;
            const childFile = childFrame.url ? path.relative(projectPath, childFrame.url) : 'unknown';
            
            callGraph.push({
              caller: {
                file: parentFile,
                function: parentFrame.functionName || '(anonymous)',
                line: parentFrame.lineNumber || 0
              },
              callee: {
                file: childFile,
                function: childFrame.functionName || '(anonymous)',
                line: childFrame.lineNumber || 0
              },
              count: 1 // V8 profiles don't provide call counts directly
            });
          }
        });
      }
    });

    return callGraph.slice(0, 50); // Limit to top 50 call relationships
  }

  createFallbackData(projectPath, error) {
    return {
      tool: 'nodejs-profiler',
      timestamp: new Date().toISOString(),
      projectPath,
      hotspots: [],
      callGraph: [],
      error: error.message,
      metadata: {
        fallbackMode: true,
        reason: 'Profiling failed or no JavaScript entry point found'
      },
      note: 'Node.js profiling available but requires runnable JavaScript application'
    };
  }
}

module.exports = NodeJSProfilerIntegration;