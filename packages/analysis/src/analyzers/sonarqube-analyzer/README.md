# SonarQube Analyzer - Topolop Layer 1 Data Source

**Status**: ✅ Production Ready  
**Tier**: 1 (Highest Priority)  
**Market Share**: 22.7%  
**Integration Type**: REST API  

The SonarQube analyzer is a critical component of Topolop's Tier 1 tool integration strategy, enabling unified analysis of code quality, security, and maintainability metrics from SonarQube/SonarCloud.

## Features

✨ **Core Analysis Capabilities**
- 🔍 Code quality metrics (complexity, duplication, coverage)  
- 🛡️ Security vulnerability detection
- 🏗️ Maintainability and reliability ratings
- 🔥 Security hotspot identification
- ⚡ Technical debt quantification
- 🚪 Quality gate status validation

🏙️ **City Visualization Mapping**
- 🏢 Buildings: Files with height based on complexity + LOC
- 🏘️ Districts: Directory structure grouping  
- 🎨 Building Condition: Issue severity and count
- 🔒 Security Zones: Vulnerability and hotspot density
- 🚧 Infrastructure: Dependency and utility mapping

📊 **Unified Data Model**
- Maps SonarQube data to Topolop's Layer 2 unified schema
- Standardizes metrics across all analysis tools
- Enables cross-tool correlation and deduplication
- Provides temporal analysis capabilities

## Quick Start

### 1. Installation

```bash
cd src/analyzers/sonarqube-analyzer
npm install
```

### 2. Configuration

Set required environment variables:

```bash
# Required
export SONARQUBE_TOKEN="your-sonarqube-api-token"

# Required for SonarCloud
export SONARQUBE_ORG="your-organization-key"

# Optional (defaults to SonarCloud)
export SONARQUBE_URL="https://your-sonarqube-server.com"
```

### 3. Basic Usage

#### Standalone Usage

```javascript
const SonarQubeAnalyzer = require('./src/index');

async function analyzeSonarQubeProject() {
  const analyzer = new SonarQubeAnalyzer({
    baseUrl: 'https://sonarcloud.io',
    token: process.env.SONARQUBE_TOKEN,
    organization: process.env.SONARQUBE_ORG
  });

  // Analyze a project
  const analysis = await analyzer.analyzeProject('my-org_my-project');
  
  // Generate summary
  const summary = analyzer.generateAnalysisSummary(analysis);
  console.log(summary);
}
```

#### Layer 1 Integration (Recommended)

```javascript
const Layer1DataSources = require('../../../index');

async function comprehensiveAnalysis() {
  const layer1 = new Layer1DataSources({
    sonarQube: {
      baseUrl: 'https://sonarcloud.io',
      token: process.env.SONARQUBE_TOKEN,
      organization: process.env.SONARQUBE_ORG
    }
  });

  await layer1.initialize('./my-project');

  // Collect all data including SonarQube
  const allData = await layer1.collectAllData({
    sonarQube: {
      projectKey: 'my-org_my-project',
      options: {
        pageSize: 500,
        severities: 'CRITICAL,HIGH,MAJOR'
      }
    }
  });

  console.log('SonarQube analysis:', allData.sonarQube);
}
```

## CLI Usage

The analyzer includes a comprehensive CLI for testing and analysis:

### Test Connection
```bash
node src/cli.js test
```

### Check Configuration
```bash
node src/cli.js config
```

### Search Projects
```bash
node src/cli.js search
node src/cli.js search "my-project"
```

### Analyze Project
```bash
node src/cli.js analyze "my-org_my-project"
```

### Validate Project
```bash
node src/cli.js validate "my-org_my-project"
```

### Show Capabilities
```bash
node src/cli.js capabilities
```

## API Reference

### SonarQubeAnalyzer Class

#### Constructor
```javascript
new SonarQubeAnalyzer(config)
```

**Parameters:**
- `config.baseUrl` - SonarQube server URL (default: 'https://sonarcloud.io')
- `config.token` - API token for authentication
- `config.organization` - Organization key (required for SonarCloud)

#### Methods

##### `analyzeProject(projectKey, options)`
Performs comprehensive project analysis.

**Parameters:**
- `projectKey` (string) - SonarQube project key
- `options` (object) - Analysis options

**Returns:** Unified data model object with:
- Project metrics and ratings
- File-level data with city attributes
- Issues mapped to unified format
- Security hotspots
- City visualization data
- Temporal analysis data

##### `searchProjects(searchTerm, options)`
Search for projects in the organization.

##### `getCapabilities()`
Returns analyzer capabilities and features.

##### `isConfigured()`
Checks if analyzer is properly configured.

##### `generateAnalysisSummary(unifiedData)`
Generates human-readable analysis summary.

## Data Model Mapping

### SonarQube → Unified Schema

| SonarQube | Unified Model | Description |
|-----------|---------------|-------------|
| `ncloc` | `linesOfCode` | Non-comment lines of code |
| `complexity` | `cyclomaticComplexity` | Cyclomatic complexity |
| `cognitive_complexity` | `cognitiveComplexity` | Cognitive complexity |
| `duplicated_lines_density` | `duplicationPercentage` | Code duplication % |
| `coverage` | `testCoverage` | Test coverage % |
| `bugs` | `bugCount` | Number of bugs |
| `vulnerabilities` | `vulnerabilityCount` | Security vulnerabilities |
| `code_smells` | `codeSmellCount` | Code smells |
| `sqale_index` | `technicalDebtMinutes` | Technical debt |
| `reliability_rating` | `reliabilityRating` | A-E reliability rating |
| `security_rating` | `securityRating` | A-E security rating |
| `sqale_rating` | `maintainabilityRating` | A-E maintainability rating |

### Issue Severity Mapping

| SonarQube | Unified | City Impact |
|-----------|---------|-------------|
| `BLOCKER` | `critical` | Building in critical condition |
| `CRITICAL` | `high` | Building needs major repairs |
| `MAJOR` | `medium` | Building has maintenance issues |
| `MINOR` | `low` | Building has minor wear |
| `INFO` | `info` | Building information only |

## City Visualization

The SonarQube analyzer maps analysis results to the city metaphor:

### Buildings (Files)
- **Height**: Based on `log10(LOC + complexity * 10) * 20`
- **Condition**: Determined by issue severity and count
  - `excellent`: 0-2 minor issues
  - `good`: 3-10 minor issues  
  - `fair`: 3+ major issues
  - `poor`: 5+ critical issues

### Districts (Directories)
- Grouped by directory structure
- District condition = majority building condition
- Security level = worst building security level

### Security Zones
- `secure`: No security issues
- `moderate`: 1-2 security issues
- `at-risk`: 3+ security issues

## Integration Examples

### With Git and AST Analysis

```javascript
const layer1 = new Layer1DataSources();
await layer1.initialize('./my-project');

const data = await layer1.collectAllData({
  git: { maxCommits: 1000 },
  ast: { languages: ['javascript', 'typescript'] },
  sonarQube: {
    projectKey: 'my-org_my-project',
    options: { severities: 'CRITICAL,HIGH' }
  }
});

// Cross-reference Git hotspots with SonarQube issues
const gitHotspots = data.git.hotspots;
const sonarQubeIssues = data.sonarQube.issues;
```

### With City Visualization

```javascript
const GraphAnalyzer = require('../../core/graph-model/src/index');
const analyzer = new GraphAnalyzer();

// Build graph from all data
analyzer.buildFromGitAnalysis(data.git);
analyzer.enhanceWithASTAnalysis(data.ast);

// Generate city with SonarQube quality overlays
const cityData = analyzer.generateCityVisualization({
  qualityOverlay: data.sonarQube.cityVisualization.overlays.quality,
  securityOverlay: data.sonarQube.cityVisualization.overlays.security
});
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SONARQUBE_TOKEN` | Yes | - | API token for authentication |
| `SONARQUBE_ORG` | Yes* | - | Organization key (*required for SonarCloud) |
| `SONARQUBE_URL` | No | https://sonarcloud.io | SonarQube server URL |

### Programmatic Configuration

```javascript
const analyzer = new SonarQubeAnalyzer({
  baseUrl: 'https://sonarcloud.io',
  token: 'your-token',
  organization: 'your-org',
  // Optional request timeout
  timeout: 30000
});
```

## Error Handling

The analyzer includes comprehensive error handling:

```javascript
try {
  const analysis = await analyzer.analyzeProject('invalid-project');
} catch (error) {
  if (error.message.includes('404')) {
    console.log('Project not found');
  } else if (error.message.includes('401')) {
    console.log('Authentication failed - check token');
  } else if (error.message.includes('403')) {
    console.log('Permission denied - check organization access');
  }
}
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests  
```bash
# From project root
node test-sonarqube-integration.js
```

### CLI Testing
```bash
# Test without real credentials
node src/cli.js capabilities
node src/cli.js config
```

## Troubleshooting

### Common Issues

1. **"SonarQube token is required"**
   - Set `SONARQUBE_TOKEN` environment variable
   - Ensure token has project access permissions

2. **"Project not found"**
   - Verify project key format: `organization_project-name`
   - Check organization access
   - Use search command to find available projects

3. **"Connection failed"** 
   - Check `SONARQUBE_URL` if using on-premise
   - Verify network access to SonarQube server
   - Test with `node src/cli.js test`

4. **"Quality gate failed"**
   - This is informational - not an error
   - Check project quality gate conditions in SonarQube

### Debug Mode

Enable verbose logging:
```bash
DEBUG=sonarqube node your-script.js
```

## Contributing

This analyzer follows Topolop's architecture patterns:

1. **REST API Client** (`sonarqube-client.js`) - Handles API communication
2. **Data Mapper** (`sonarqube-mapper.js`) - Maps to unified schema  
3. **Main Analyzer** (`index.js`) - Orchestrates analysis
4. **CLI Interface** (`cli.js`) - Command-line testing

When extending:
- Add new API endpoints to the client
- Update mapper for new data types
- Maintain city visualization metaphor
- Follow error handling patterns
- Update capabilities reporting

## Next Steps

Following the STRATEGY.md roadmap, next Tier 1 integrations:

1. **CodeClimate** (Simple REST API)
2. **Semgrep** (CLI-friendly, JSON output)  
3. **GitHub CodeQL** (GraphQL API, SARIF parsing)

This SonarQube integration serves as the template for all Tier 1 tool integrations.