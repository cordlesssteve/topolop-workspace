# CodeClimate Analyzer - Topolop Layer 1 Data Source

**Status**: ✅ Production Ready  
**Tier**: 1 (High Priority)  
**Market Share**: 15.3%  
**Integration Type**: REST API  

The CodeClimate analyzer is a critical component of Topolop's Tier 1 tool integration strategy, enabling unified analysis of code quality, maintainability, and technical debt metrics from CodeClimate Quality platform.

## Features

✨ **Core Analysis Capabilities**
- 🔍 Maintainability ratings and scores  
- 🏗️ Technical debt quantification and tracking
- 📊 Test coverage analysis
- 🔄 Code duplication detection
- 🎯 Issue categorization and tracking
- 📈 Analysis history and trends

🏙️ **City Visualization Mapping**
- 🏢 Buildings: Files with height based on issue count estimation
- 🏘️ Districts: Directory structure grouping  
- 🎨 Building Condition: Issue severity and count
- 🔒 Security Zones: Security issue density
- 🚧 Infrastructure: Maintainability ratings and technical debt

📊 **Unified Data Model**
- Maps CodeClimate data to Topolop's Layer 2 unified schema
- Standardizes metrics across all analysis tools
- Enables cross-tool correlation and deduplication
- Provides temporal analysis capabilities

## Quick Start

### 1. Installation

```bash
cd src/analyzers/codeclimate-analyzer
npm install
```

### 2. Configuration

Set required environment variables:

```bash
# Required
export CODECLIMATE_TOKEN="your-codeclimate-api-token"

# Optional (defaults to api.codeclimate.com)
export CODECLIMATE_URL="https://api.codeclimate.com"
```

Get your API token from: https://codeclimate.com/profile/tokens

### 3. Basic Usage

#### Standalone Usage

```javascript
const CodeClimateAnalyzer = require('./src/index');

async function analyzeCodeClimateRepository() {
  const analyzer = new CodeClimateAnalyzer({
    token: process.env.CODECLIMATE_TOKEN
  });

  // Analyze by GitHub slug
  const analysis = await analyzer.analyzeRepository('owner/repository-name');
  
  // Or analyze by CodeClimate repository ID
  const analysis2 = await analyzer.analyzeRepository('12345');
  
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
    codeClimate: {
      token: process.env.CODECLIMATE_TOKEN
    }
  });

  await layer1.initialize('./my-project');

  // Collect all data including CodeClimate
  const allData = await layer1.collectAllData({
    codeClimate: {
      repository: 'owner/repository-name',
      options: {
        pageSize: 100
      }
    }
  });

  console.log('CodeClimate analysis:', allData.codeClimate);
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

### List Repositories
```bash
node src/cli.js repos
node src/cli.js repos 10  # Limit to 10 results
```

### Search Repositories
```bash
node src/cli.js search "owner/repository-name"
```

### Analyze Repository
```bash
node src/cli.js analyze "owner/repository-name"
node src/cli.js analyze "12345"  # By repository ID
```

### Validate Repository
```bash
node src/cli.js validate "owner/repository-name"
```

### Show Capabilities
```bash
node src/cli.js capabilities
```

## API Reference

### CodeClimateAnalyzer Class

#### Constructor
```javascript
new CodeClimateAnalyzer(config)
```

**Parameters:**
- `config.token` - CodeClimate API token for authentication
- `config.baseUrl` - CodeClimate API URL (default: 'https://api.codeclimate.com')

#### Methods

##### `analyzeRepository(repoIdentifier, options)`
Performs comprehensive repository analysis.

**Parameters:**
- `repoIdentifier` (string) - Repository ID or GitHub slug (e.g., 'owner/repo')
- `options` (object) - Analysis options

**Returns:** Unified data model object with:
- Repository metrics and ratings
- File-level data with city attributes
- Issues mapped to unified format
- City visualization data
- Temporal analysis data

##### `getRepositories(options)`
Get user's repositories.

##### `searchRepositories(githubSlug, options)`
Search for repositories by GitHub slug.

##### `getCapabilities()`
Returns analyzer capabilities and features.

##### `isConfigured()`
Checks if analyzer is properly configured.

##### `generateAnalysisSummary(unifiedData)`
Generates human-readable analysis summary.

## Data Model Mapping

### CodeClimate → Unified Schema

| CodeClimate | Unified Model | Description |
|-------------|---------------|-------------|
| `lines_of_code` | `linesOfCode` | Total lines of code |
| `rating.letter` | `maintainabilityRating` | A-F maintainability rating |
| `rating.measure.value` | `maintainabilityScore` | Numeric maintainability score |
| `test_coverage_value` | `testCoverage` | Test coverage percentage |
| `technical_debt_minutes` | `technicalDebtMinutes` | Technical debt in minutes |
| `issue_count` | `issueCount` | Total number of issues |
| `duplication_mass` | `duplicationPercentage` | Code duplication percentage |

### Issue Mapping

| CodeClimate Category | Unified Type | City Impact |
|---------------------|--------------|-------------|
| `Bug Risk` | `bug` | Building structural issues |
| `Clarity` | `maintainability` | Building maintenance needs |
| `Complexity` | `complexity` | Building design complexity |
| `Duplication` | `duplication` | Building redundancy |
| `Performance` | `performance` | Building efficiency |
| `Security` | `security` | Building security level |
| `Style` | `style` | Building aesthetic condition |

## City Visualization

The CodeClimate analyzer maps analysis results to the city metaphor:

### Buildings (Files)
- **Height**: Based on estimated lines of code + issue count
- **Condition**: Determined by issue severity and count
  - `excellent`: 0-2 low severity issues
  - `good`: 3-10 low severity issues  
  - `fair`: 3+ medium severity issues
  - `poor`: 5+ high severity issues

### Districts (Directories)
- Grouped by directory structure
- District condition = majority building condition
- Security level = worst building security level

### Infrastructure
- **Maintainability**: Based on CodeClimate rating
- **Technical Debt**: Visualized as infrastructure decay
- **Test Coverage**: Infrastructure reliability indicator

## Integration Examples

### With Git and AST Analysis

```javascript
const layer1 = new Layer1DataSources();
await layer1.initialize('./my-project');

const data = await layer1.collectAllData({
  git: { maxCommits: 1000 },
  ast: { languages: ['javascript', 'typescript', 'python'] },
  codeClimate: {
    repository: 'owner/my-project',
    options: { pageSize: 100 }
  }
});

// Cross-reference Git hotspots with CodeClimate issues
const gitHotspots = data.git.hotspots;
const codeClimateIssues = data.codeClimate.issues;
```

### With City Visualization

```javascript
const GraphAnalyzer = require('../../core/graph-model/src/index');
const analyzer = new GraphAnalyzer();

// Build graph from all data
analyzer.buildFromGitAnalysis(data.git);
analyzer.enhanceWithASTAnalysis(data.ast);

// Generate city with CodeClimate quality overlays
const cityData = analyzer.generateCityVisualization({
  qualityOverlay: data.codeClimate.cityVisualization.overlays.quality,
  debtOverlay: data.codeClimate.cityVisualization.overlays.debt
});
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CODECLIMATE_TOKEN` | Yes | - | API token for authentication |
| `CODECLIMATE_URL` | No | https://api.codeclimate.com | CodeClimate API URL |

### Programmatic Configuration

```javascript
const analyzer = new CodeClimateAnalyzer({
  token: 'your-token',
  baseUrl: 'https://api.codeclimate.com',
  // Optional request timeout
  timeout: 30000
});
```

## Error Handling

The analyzer includes comprehensive error handling:

```javascript
try {
  const analysis = await analyzer.analyzeRepository('invalid-repo');
} catch (error) {
  if (error.message.includes('404')) {
    console.log('Repository not found');
  } else if (error.message.includes('401')) {
    console.log('Authentication failed - check token');
  } else if (error.message.includes('403')) {
    console.log('Permission denied - check repository access');
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
node test-codeclimate-integration.js
```

### CLI Testing
```bash
# Test without real credentials
node src/cli.js capabilities
node src/cli.js config
```

## Troubleshooting

### Common Issues

1. **"CodeClimate token is required"**
   - Set `CODECLIMATE_TOKEN` environment variable
   - Get token from: https://codeclimate.com/profile/tokens

2. **"Repository not found"**
   - Verify repository exists in CodeClimate
   - Check GitHub slug format: `owner/repository-name`
   - Ensure you have access to the repository

3. **"Connection failed"** 
   - Check `CODECLIMATE_URL` if using custom endpoint
   - Verify network access to CodeClimate servers
   - Test with `node src/cli.js test`

4. **"API rate limit exceeded"**
   - CodeClimate has API rate limits
   - Reduce request frequency or implement backoff

### Debug Mode

Enable verbose logging:
```bash
DEBUG=codeclimate node your-script.js
```

## Contributing

This analyzer follows Topolop's architecture patterns:

1. **REST API Client** (`codeclimate-client.js`) - Handles API communication
2. **Data Mapper** (`codeclimate-mapper.js`) - Maps to unified schema  
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

1. **Semgrep** (CLI-friendly, JSON output)  
2. **GitHub CodeQL** (GraphQL API, SARIF parsing)
3. **Snyk** (CLI and API options)

This CodeClimate integration serves as the second template (after SonarQube) for Tier 1 tool integrations.

## Important Notes

⚠️ **CodeClimate Transition**: CodeClimate Quality is being replaced with Qlty Cloud. New users should sign up at qlty.sh. This integration may need updates as the transition completes.

✅ **Production Status**: Despite the transition, the current CodeClimate API remains functional and this integration is production-ready for existing CodeClimate users.