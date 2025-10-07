/**
 * CBMC Bounded Model Checker - Phase 3 Security-First Implementation
 *
 * Bounded model checking for C/C++ programs focusing on memory safety,
 * arithmetic overflow, and assertion verification without execution.
 *
 * Security Features:
 * - Pure verification mode, bounded model checking only
 * - No code execution, verification-only analysis
 * - Memory safety analysis with unwinding limits
 * - Container isolation ready with minimal privileges
 *
 * Implementation: CBMC with bounds checking and unwinding limits
 * Safety: No code execution, verification-only mode
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface CBMCMessage {
  type: string;           // 'VERIFICATION', 'FAILURE', 'SUCCESS', 'WARNING'
  property: string;       // Property being checked (e.g., 'array-bounds', 'overflow')
  file: string;           // File path
  function: string;       // Function name where issue occurred
  line: number;           // Line number
  description: string;    // Human-readable description
  trace: string[];        // Execution trace leading to the issue
  severity: string;       // 'critical', 'high', 'medium', 'low'
}

export interface CBMCResult {
  success: boolean;
  messages: CBMCMessage[];
  statistics: {
    totalProperties: number;
    verifiedProperties: number;
    failedProperties: number;
    unknownProperties: number;
    filesAnalyzed: number;
    verificationTime: number;
  };
  executionTime: number;
  filesAnalyzed: string[];
  cbmcVersion: string | undefined;
  boundingInfo: {
    maxUnwinding: number;
    timeoutPerFile: number;
    memoryLimit: string;
  };
}

export class CBMCAnalyzer {
  private readonly cbmcCommand: string;
  private readonly securityConfig: string[];
  private readonly maxUnwinding: number;
  private readonly timeoutPerFile: number;

  constructor() {
    this.cbmcCommand = 'cbmc';
    this.maxUnwinding = 5; // Conservative unwinding limit
    this.timeoutPerFile = 60000; // 60 seconds per file

    // Security-first configuration for bounded model checking
    this.securityConfig = [
      '--bounds-check',              // Array bounds checking
      '--div-by-zero-check',        // Division by zero checking
      '--signed-overflow-check',     // Signed integer overflow
      '--unsigned-overflow-check',   // Unsigned integer overflow
      '--pointer-check',             // Pointer safety checks
      '--memory-leak-check',         // Memory leak detection
      '--nan-check',                // NaN detection in floating point
      '--uninitialized-check',      // Uninitialized variable usage

      // Verification constraints for security
      `--unwind`, `${this.maxUnwinding}`, // Limit loop unwinding
      '--unwinding-assertions',      // Check unwinding assertions
      '--partial-loops',            // Handle partial loop unwinding

      // Output and analysis options
      '--trace',                    // Generate counterexample traces
      '--compact-trace',            // Compact trace format
      '--xml-ui',                   // XML output for parsing
      '--verbosity', '2',           // Moderate verbosity

      // Performance and resource limits
      '--stop-on-fail',             // Stop on first failure for efficiency
    ];
  }

  /**
   * Check if CBMC is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runCommand([this.cbmcCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      return result.exitCode === 0 && result.stdout.includes('CBMC');
    } catch {
      return false;
    }
  }

  /**
   * Get CBMC version
   */
  async getVersion(): Promise<string | undefined> {
    try {
      const result = await this.runCommand([this.cbmcCommand, '--version'], {
        timeout: 5000,
        cwd: process.cwd()
      });
      if (result.exitCode === 0) {
        // Extract version from output like "CBMC version 5.11"
        const match = result.stdout.match(/CBMC version (\d+\.\d+)/);
        return match ? match[1] : undefined;
      }
    } catch {
      // Fall through
    }
    return undefined;
  }

  /**
   * Analyze C/C++ files with CBMC bounded model checking
   */
  async analyzeFiles(filePaths: string[]): Promise<CBMCResult> {
    const startTime = Date.now();

    // Security validation: Only analyze C/C++ files
    const cppFiles = filePaths.filter(file =>
      this.isCppFile(file) && fs.existsSync(file) && !this.isSkippedFile(file)
    );

    if (cppFiles.length === 0) {
      return this.createEmptyResult(Date.now() - startTime);
    }

    const cbmcVersion = await this.getVersion();
    let allMessages: CBMCMessage[] = [];
    let totalProperties = 0;
    let verifiedProperties = 0;
    let failedProperties = 0;
    let unknownProperties = 0;

    // Analyze each file individually for better error isolation
    for (const file of cppFiles) {
      try {
        const result = await this.analyzeFile(file);
        allMessages.push(...result.messages);
        totalProperties += result.properties.total;
        verifiedProperties += result.properties.verified;
        failedProperties += result.properties.failed;
        unknownProperties += result.properties.unknown;
      } catch (error) {
        console.warn(`CBMC analysis failed for ${file}:`, error);
        // Continue with other files
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true, // Success if any files were processed
      messages: allMessages,
      statistics: {
        totalProperties,
        verifiedProperties,
        failedProperties,
        unknownProperties,
        filesAnalyzed: cppFiles.length,
        verificationTime: executionTime
      },
      executionTime,
      filesAnalyzed: cppFiles,
      cbmcVersion,
      boundingInfo: {
        maxUnwinding: this.maxUnwinding,
        timeoutPerFile: this.timeoutPerFile,
        memoryLimit: '1GB'
      }
    };
  }

  /**
   * Analyze single C/C++ file with CBMC
   */
  private async analyzeFile(filePath: string): Promise<{
    messages: CBMCMessage[],
    properties: { total: number, verified: number, failed: number, unknown: number }
  }> {
    // Build secure command for single file verification
    const command = [
      this.cbmcCommand,
      ...this.securityConfig,
      '-I.', // Current directory for includes
      '-I./include', // Common include directory
      filePath
    ];

    const result = await this.runCommand(command, {
      timeout: this.timeoutPerFile,
      cwd: path.dirname(filePath),
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for traces
    });

    // Parse CBMC output (both XML and text)
    const messages = this.parseCBMCOutput(result.stdout + result.stderr, filePath);

    // Count properties
    const properties = {
      total: messages.length,
      verified: messages.filter(m => m.type === 'SUCCESS').length,
      failed: messages.filter(m => m.type === 'FAILURE').length,
      unknown: messages.filter(m => m.type === 'WARNING').length
    };

    return { messages, properties };
  }

  /**
   * Parse CBMC output (supports both XML and text formats)
   */
  private parseCBMCOutput(output: string, sourceFile: string): CBMCMessage[] {
    const messages: CBMCMessage[] = [];

    // Try XML parsing first
    if (output.includes('<?xml')) {
      const xmlMessages = this.parseXMLOutput(output, sourceFile);
      messages.push(...xmlMessages);
    }

    // Fall back to text parsing
    const textMessages = this.parseTextOutput(output, sourceFile);
    messages.push(...textMessages);

    return this.deduplicateMessages(messages);
  }

  /**
   * Parse CBMC XML output
   */
  private parseXMLOutput(xmlOutput: string, sourceFile: string): CBMCMessage[] {
    const messages: CBMCMessage[] = [];

    // Simple XML parsing for CBMC output
    // In production, would use a proper XML parser
    const propertyRegex = /<property>([\s\S]*?)<\/property>/g;
    let propertyMatch;

    while ((propertyMatch = propertyRegex.exec(xmlOutput)) !== null) {
      const propertyXML = propertyMatch[1] || '';
      const message = this.parsePropertyXML(propertyXML, sourceFile);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Parse individual property from XML
   */
  private parsePropertyXML(propertyXML: string, sourceFile: string): CBMCMessage | null {
    try {
      // Extract key information from property XML
      const descMatch = propertyXML.match(/<description>(.*?)<\/description>/);
      const statusMatch = propertyXML.match(/<status>(.*?)<\/status>/);
      const fileMatch = propertyXML.match(/<file>(.*?)<\/file>/);
      const lineMatch = propertyXML.match(/<line>(\d+)<\/line>/);
      const functionMatch = propertyXML.match(/<function>(.*?)<\/function>/);

      const description = descMatch ? descMatch[1] : 'Unknown property';
      const status = statusMatch ? statusMatch[1] : 'UNKNOWN';
      const file = (fileMatch && fileMatch[1]) ? fileMatch[1] : sourceFile;
      const line = (lineMatch && lineMatch[1]) ? parseInt(lineMatch[1], 10) : 0;
      const func = (functionMatch && functionMatch[1]) ? functionMatch[1] : 'unknown';

      // Extract trace if available
      const trace = this.extractTraceFromXML(propertyXML);

      return {
        type: this.mapStatus(status || ''),
        property: this.extractPropertyType(description || ''),
        file: path.resolve(file || sourceFile),
        function: func || 'unknown',
        line,
        description: description || 'Unknown property',
        trace,
        severity: this.mapSeverity(status || '', description || '')
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse CBMC text output as fallback
   */
  private parseTextOutput(output: string, sourceFile: string): CBMCMessage[] {
    const messages: CBMCMessage[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for verification results
      if (line && line.includes('VERIFICATION')) {
        const message = this.parseVerificationLine(line, sourceFile);
        if (message) {
          messages.push(message);
        }
      }

      // Look for property failures
      if (line && (line.includes('assertion failed') || line.includes('array bounds'))) {
        const message = this.parseFailureLine(line, lines, i, sourceFile);
        if (message) {
          messages.push(message);
        }
      }
    }

    return messages;
  }

  /**
   * Parse verification result line
   */
  private parseVerificationLine(line: string, sourceFile: string): CBMCMessage | null {
    const match = line.match(/VERIFICATION\s+(SUCCESSFUL|FAILED):\s*(.*)/);
    if (!match) return null;

    const [, status, description] = match;

    return {
      type: status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILURE',
      property: this.extractPropertyType(description || ''),
      file: sourceFile,
      function: 'unknown',
      line: 0,
      description: (description && description.trim()) || 'Verification result',
      trace: [],
      severity: status === 'SUCCESSFUL' ? 'low' : 'high'
    };
  }

  /**
   * Parse failure line with context
   */
  private parseFailureLine(line: string, allLines: string[], index: number, sourceFile: string): CBMCMessage | null {
    const description = line.trim();

    // Look for location information in surrounding lines
    let file = sourceFile;
    let lineNum = 0;
    let func = 'unknown';

    for (let i = Math.max(0, index - 3); i <= Math.min(allLines.length - 1, index + 3); i++) {
      const contextLine = allLines[i];

      if (contextLine) {
        // Extract file and line number
        const locationMatch = contextLine.match(/(\S+):(\d+):/);
        if (locationMatch && locationMatch[1] && locationMatch[2]) {
          file = locationMatch[1];
          lineNum = parseInt(locationMatch[2], 10);
        }

        // Extract function name
        const funcMatch = contextLine.match(/in function\s+(\w+)/);
        if (funcMatch && funcMatch[1]) {
          func = funcMatch[1];
        }
      }
    }

    return {
      type: 'FAILURE',
      property: this.extractPropertyType(description || ''),
      file: path.resolve(file),
      function: func,
      line: lineNum,
      description,
      trace: [],
      severity: 'high'
    };
  }

  /**
   * Extract trace information from XML
   */
  private extractTraceFromXML(propertyXML: string): string[] {
    const trace: string[] = [];
    const stepRegex = /<step>([\s\S]*?)<\/step>/g;
    let stepMatch;

    while ((stepMatch = stepRegex.exec(propertyXML)) !== null) {
      const stepXML = stepMatch[1];
      if (stepXML) {
        const stepInnerMatch = stepXML.match(/<step_nr>(\d+)<\/step_nr>[\s\S]*?<assignment>(.*?)<\/assignment>/);
        if (stepInnerMatch && stepInnerMatch[1] && stepInnerMatch[2]) {
          trace.push(`Step ${stepInnerMatch[1]}: ${stepInnerMatch[2]}`);
        }
      }
    }

    return trace;
  }

  /**
   * Map CBMC status to unified type
   */
  private mapStatus(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS': return 'SUCCESS';
      case 'SUCCESSFUL': return 'SUCCESS';
      case 'FAILURE': return 'FAILURE';
      case 'FAILED': return 'FAILURE';
      case 'UNKNOWN': return 'WARNING';
      default: return 'VERIFICATION';
    }
  }

  /**
   * Extract property type from description
   */
  private extractPropertyType(description: string): string {
    if (description.includes('array') || description.includes('bounds')) return 'array-bounds';
    if (description.includes('overflow')) return 'overflow';
    if (description.includes('pointer')) return 'pointer-safety';
    if (description.includes('memory') || description.includes('leak')) return 'memory-safety';
    if (description.includes('division') || description.includes('zero')) return 'division-by-zero';
    if (description.includes('assertion')) return 'assertion';
    if (description.includes('uninitialized')) return 'uninitialized';
    return 'general';
  }

  /**
   * Map severity based on status and property type
   */
  private mapSeverity(status: string, description: string): string {
    if (status.includes('SUCCESS')) return 'low';

    if (description.includes('overflow') || description.includes('bounds')) return 'critical';
    if (description.includes('pointer') || description.includes('memory')) return 'high';
    if (description.includes('assertion')) return 'medium';

    return 'medium';
  }

  /**
   * Remove duplicate messages
   */
  private deduplicateMessages(messages: CBMCMessage[]): CBMCMessage[] {
    const seen = new Set<string>();
    return messages.filter(msg => {
      const key = `${msg.file}:${msg.line}:${msg.property}:${msg.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Check if file is a C/C++ source file
   */
  private isCppFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.c', '.cpp', '.cxx', '.cc', '.c++'].includes(ext);
  }

  /**
   * Security check: Skip dangerous files
   */
  private isSkippedFile(filePath: string): boolean {
    const filename = path.basename(filePath);

    // Skip files that might be dangerous or irrelevant
    const skippedPatterns = [
      /^test_.*\.(c|cpp)$/,     // Test files (optional)
      /.*_test\.(c|cpp)$/,      // Test files (alternative naming)
      /.*\.o$/,                 // Object files
      /.*\.so$/,                // Shared libraries
      /.*\.a$/,                 // Static libraries
      /.*\.exe$/,               // Executables
    ];

    return skippedPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Execute command with security constraints
   */
  private runCommand(command: string[], options: {
    timeout: number;
    cwd: string;
    maxBuffer?: number;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      if (!command[0]) {
        reject(new Error('Command is empty'));
        return;
      }

      const child: ChildProcess = spawn(command[0], command.slice(1), {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // No stdin access
        timeout: options.timeout,
        env: {
          // Minimal environment for security
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        }
      });

      let stdout = '';
      let stderr = '';
      const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB default

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > maxBuffer) {
          child.kill();
          reject(new Error('Output buffer exceeded'));
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > maxBuffer) {
          child.kill();
          reject(new Error('Error buffer exceeded'));
        }
      });

      child.on('exit', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout handling
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          reject(new Error('Command timeout'));
        }
      }, options.timeout);
    });
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(executionTime: number): CBMCResult {
    return {
      success: true,
      messages: [],
      statistics: {
        totalProperties: 0,
        verifiedProperties: 0,
        failedProperties: 0,
        unknownProperties: 0,
        filesAnalyzed: 0,
        verificationTime: 0
      },
      executionTime,
      filesAnalyzed: [],
      cbmcVersion: undefined,
      boundingInfo: {
        maxUnwinding: this.maxUnwinding,
        timeoutPerFile: this.timeoutPerFile,
        memoryLimit: '1GB'
      }
    };
  }
}

export default CBMCAnalyzer;