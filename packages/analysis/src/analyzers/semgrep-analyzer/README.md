# Semgrep Analyzer - Topolop Layer 1 Data Source

🛡️ **Semgrep security analysis integration for Topolop's unified codebase analysis platform**

## Overview

The Semgrep Analyzer is a **Tier 1** data source integration for Topolop, providing static application security testing (SAST) capabilities through the Semgrep CLI. This integration maps security findings to Topolop's unified data model and city visualization metaphor.

### Key Features

- 🔍 **CLI-based Security Analysis** - Leverages Semgrep CLI for comprehensive SAST scanning
- 🛡️ **Security-focused Analysis** - Specializes in vulnerability detection and security compliance  
- 🎯 **Rule-based Detection** - Supports custom rules and registry rulesets (OWASP, CWE)
- 🏙️ **City Visualization** - Maps security findings to building conditions and security zones
- 🌍 **Multi-language Support** - Supports 15+ programming languages
- ⚡ **Performance Optimized** - Efficient CLI execution with JSON output parsing

## Market Position

- **Tier**: 1 (High Priority)
- **Market Share**: ~12.1% of SAST market
- **Focus**: Static Application Security Testing (SAST)
- **Integration Priority**: 3rd after SonarQube and CodeClimate

## Installation & Setup

### Prerequisites

1. **Semgrep CLI** must be installed:
   ```bash
   # Via pip
   pip install semgrep
   
   # Via Homebrew (macOS)
   brew install semgrep
   
   # Via Docker
   docker pull returntocorp/semgrep
   ```

2. **Node.js dependencies**:
   ```bash
   cd src/analyzers/semgrep-analyzer
   npm install
   ```

### Configuration

The Semgrep analyzer requires minimal configuration - just the CLI availability:

```javascript
const Layer1DataSources = require('./src/analyzers/index');

const layer1 = new Layer1DataSources({
  semgrep: {
    semgrepPath: 'semgrep',          // Path to semgrep binary (optional)
    timeout: 120000,                 // Analysis timeout in ms (optional)
    defaultRules: 'p/security-audit' // Default ruleset (optional)
  }
});
```

### Optional Environment Variables

```bash
# Optional: Enhanced registry access
export SEMGREP_APP_TOKEN="your-semgrep-app-token"
```

## Usage

### 1. Basic Security Analysis

```javascript
const SemgrepAnalyzer = require('./src/analyzers/semgrep-analyzer/src/index');

const analyzer = new SemgrepAnalyzer();
await analyzer.initialize();

// Analyze a codebase directory
const results = await analyzer.analyzeTarget('/path/to/codebase');

console.log(`Security Score: ${results.project.metrics.securityScore}/100`);
console.log(`Findings: ${results.issues.length}`);
console.log(`Risk Level: ${results.project.metrics.riskLevel}`);
```

### 2. Layer 1 Integration

```javascript
const Layer1DataSources = require('./src/analyzers/index');

const layer1 = new Layer1DataSources({
  semgrep: {
    defaultRules: 'p/owasp-top-10'
  }
});

await layer1.initialize('/path/to/codebase');

// Collect all data including Semgrep security analysis
const data = await layer1.collectAllData({
  semgrep: {
    target: '/path/to/codebase',
    options: {
      rules: 'p/security-audit',
      severity: ['ERROR', 'WARNING']
    }
  }
});

console.log('Semgrep Results:', data.semgrep);
```

### 3. Security-focused Analysis

```javascript
// Run security-focused analysis with OWASP rules
const results = await analyzer.securityAnalysis('/path/to/codebase', {
  rules: 'p/owasp-top-10',
  severity: ['ERROR', 'WARNING']
});

// Security-specific metrics
console.log(`Critical Findings: ${results.project.metrics.criticalFindings}`);
console.log(`Security Findings: ${results.project.metrics.securityFindings}`);
```

### 4. Custom Rules Analysis

```javascript
// Use custom rules file
const results = await analyzer.analyzeWithCustomRules(
  '/path/to/codebase',
  './custom-security-rules.yml'
);

// Use specific registry ruleset
const results = await analyzer.analyzeWithRegistry(
  '/path/to/codebase', 
  'p/cwe-top-25'
);
```

## CLI Interface

The package includes a comprehensive CLI for testing and analysis:

```bash
# Test Semgrep availability
node src/cli.js test

# Show configuration status
node src/cli.js config

# Run comprehensive analysis
node src/cli.js analyze /path/to/project

# Run security-focused analysis
node src/cli.js security /path/to/project --rules p/owasp-top-10

# List available rules
node src/cli.js rules

# Validate target path
node src/cli.js validate /path/to/project

# Show capabilities
node src/cli.js capabilities

# Analysis with options
node src/cli.js analyze /path --rules p/security-audit --severity ERROR,WARNING --exclude "*.test.js"
```

## Data Model Mapping

### Unified Data Structure

```javascript
{
  source: 'semgrep',
  project: {
    metrics: {
      securityScore: 85,           // 0-100 security score
      riskLevel: 'medium',         // low, medium, high, critical
      totalFindings: 12,
      criticalFindings: 2,
      securityFindings: 8,
      filesScanned: 45
    },
    overallRating: 'B'             // A-F rating based on findings
  },
  issues: [{
    type: 'security',              // security, bug, performance
    severity: 'critical',          // critical, high, medium, low
    rule: { key: 'python.flask.security.xss' },
    location: { file: 'app.py', line: 42 },
    semgrepData: {
      cwe: ['CWE-79'],            // CWE mappings
      owasp: ['A3:2021']          // OWASP mappings
    }
  }],
  cityVisualization: {
    districts: [...],              // Security zones by directory
    overlays: {
      security: { ... },          // Security risk overlay
      vulnerability: { ... },     // Vulnerability heat map  
      compliance: { ... },        // CWE/OWASP compliance
      risk: { ... }               // Risk assessment overlay
    }
  }
}
```

### City Visualization Mapping

- **Buildings (Files)**: Height based on security findings and severity
- **Building Condition**: Determined by security risk level and vulnerability count
- **Security Zones**: Critical security findings create high-risk zones
- **Districts**: Directory-based grouping with security-focused analysis
- **Overlays**: Vulnerability heat maps, compliance status, and risk assessments

## Available Rules and Rulesets

### Registry Rulesets
- `p/security-audit` - Comprehensive security audit (default)
- `p/owasp-top-10` - OWASP Top 10 security issues
- `p/cwe-top-25` - CWE Top 25 most dangerous software errors
- `p/code-quality` - Basic code quality checks
- `p/performance` - Performance-related issues

### Custom Rules
- Supports YAML rules files
- Custom rule development documentation: https://semgrep.dev/docs/writing-rules/

## Language Support

Supports 15+ programming languages including:

- **JavaScript/TypeScript** - Full support with React/Node.js rules
- **Python** - Django/Flask security rules
- **Java** - Spring framework security checks
- **Go** - Security and performance rules
- **Ruby** - Rails security checks
- **PHP** - Security vulnerability detection
- **C/C++** - Memory safety and security issues
- **C#** - .NET security rules
- **Kotlin/Scala** - JVM security checks
- **Swift** - iOS security patterns
- **Rust** - Memory safety and security
- **Shell/Bash** - Security misconfigurations

## Integration Capabilities

- ✅ **CLI Integration** - Direct command-line execution
- ✅ **CI/CD Integration** - Automated security scanning
- ✅ **Multi-repository** - Supports multiple project analysis
- ✅ **Custom Rules** - Organization-specific security patterns
- ✅ **Registry Rules** - Community and professional rule sets
- ✅ **City Visualization** - Security-focused visualization mapping

## City Visualization Features

### Security Zones
```javascript
const securityZones = {
  critical: ['files with critical security vulnerabilities'],
  moderate: ['files with medium security issues'],
  secure: ['files with minimal or no security findings']
};
```

### Building Conditions
- **Poor**: Critical security vulnerabilities (3+ critical findings)
- **Fair**: Multiple high-severity issues (1-2 critical, 5+ high)
- **Good**: Some security concerns (0-1 critical, 2-5 high)
- **Excellent**: Minimal security issues

### Security Overlays
- **Vulnerability Overlay**: Heat map of security vulnerability density
- **Compliance Overlay**: CWE/OWASP compliance status visualization
- **Risk Overlay**: Overall security risk assessment by area
- **Critical Path Overlay**: High-traffic security-critical code paths

## API Reference

### SemgrepAnalyzer Class

#### Constructor
```javascript
const analyzer = new SemgrepAnalyzer(config);
```

#### Methods
- `initialize()` - Initialize and test Semgrep CLI
- `analyzeTarget(path, options)` - Comprehensive security analysis
- `securityAnalysis(path, options)` - Security-focused analysis
- `analyzeWithCustomRules(path, rulesPath, options)` - Custom rules analysis
- `analyzeWithRegistry(path, registry, options)` - Registry ruleset analysis
- `getCapabilities()` - Get analyzer capabilities
- `getAvailableRulesets()` - List available rule sets
- `validateTarget(path)` - Validate target for analysis
- `generateAnalysisSummary(data)` - Generate analysis summary

### Configuration Options
```javascript
{
  semgrepPath: 'semgrep',          // Path to Semgrep binary
  timeout: 120000,                 // Analysis timeout (ms)
  defaultRules: 'p/security-audit' // Default ruleset
}
```

### Analysis Options
```javascript
{
  rules: 'p/owasp-top-10',         // Ruleset or custom rules file
  severity: ['ERROR', 'WARNING'],   // Severity filter
  exclude: ['*.test.js', 'vendor/'], // Exclude patterns  
  languages: ['javascript', 'python'], // Language filter
  jobs: 4                          // Parallel jobs
}
```

## Performance Considerations

- **Analysis Time**: 30 seconds to 5 minutes depending on codebase size
- **Memory Usage**: ~100-500MB during analysis
- **Disk Usage**: Minimal (no persistent storage required)
- **Network**: No network requirements (offline analysis)
- **Parallelization**: Supports multi-core analysis with `jobs` option

## Troubleshooting

### Common Issues

1. **"Semgrep not found"**
   ```bash
   # Install Semgrep
   pip install semgrep
   # or add to PATH
   export PATH=$PATH:/path/to/semgrep
   ```

2. **"Analysis timeout"**
   ```javascript
   const analyzer = new SemgrepAnalyzer({
     timeout: 300000 // Increase to 5 minutes
   });
   ```

3. **"Invalid rules file"**
   ```bash
   # Validate rules syntax
   semgrep --validate --config ./custom-rules.yml
   ```

4. **"Out of memory"**
   ```javascript
   // Use exclude patterns to reduce analysis scope
   const options = {
     exclude: ['node_modules/', '*.min.js', 'vendor/']
   };
   ```

### Debug Mode

```bash
# Enable verbose logging
SEMGREP_LOG_LEVEL=DEBUG node src/cli.js analyze /path
```

## Integration Examples

### GitHub Actions
```yaml
- name: Semgrep Security Analysis
  run: |
    npm install -g @topolop/semgrep-analyzer
    semgrep-analyzer security . --rules p/owasp-top-10
```

### Docker Integration
```dockerfile
FROM returntocorp/semgrep:latest
RUN npm install -g @topolop/semgrep-analyzer
CMD ["semgrep-analyzer", "security", "/src"]
```

## Contributing

1. Follow the established Topolop analyzer pattern
2. Maintain compatibility with unified data model
3. Update city visualization mappings for security context
4. Add comprehensive test coverage
5. Update documentation for new features

## License

MIT - Part of the Topolop codebase analysis platform.

---

**Part of Topolop's Tier 1 integration strategy - delivering unified security analysis with city visualization.**