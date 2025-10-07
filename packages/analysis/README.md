# topolop-analysis

> **Universal Analysis Engine for Topolop**
> Integrates 29+ static analysis tools with advanced cross-tool correlation and deduplication

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`topolop-analysis` is the core analysis engine of the Topolop ecosystem, providing:

- **29+ Tool Integrations**: SonarQube, CodeQL, Semgrep, ESLint, and more
- **Cross-Tool Correlation**: Deduplicate and correlate findings across tools
- **Hotspot Detection**: Identify code areas flagged by multiple analyzers
- **Formal Verification**: Z3 SMT solver, CBMC, KLEE integration
- **Dependency Analysis**: Tarjan's algorithm, circular dependency detection
- **Temporal Analysis**: Statistical forecasting and pattern detection
- **Semantic Analysis**: Advanced AST parsing with TypeScript Compiler API

## Architecture

### Core Components

**Tool Adapters** (`src/analyzers/`):
- SonarQube, CodeQL, Semgrep, DeepSource, Checkmarx, Veracode, Codacy, CodeClimate
- Language-specific: Python (Pylint, Mypy, Bandit), JavaScript (ESLint), C++ (Clang, CBMC)
- APM: New Relic, Datadog
- Dependency: npm-audit, Snyk, OSV

**Analysis Engines** (`src/engines/`):
- **Correlation Engine**: Multi-tool deduplication with confidence scoring
- **Dependency Analyzer**: Cycle detection, hub analysis, layer violations
- **Temporal Analyzer**: Issue forecasting, hotspot prediction
- **Semantic Analyzer**: Data flow, control flow, def-use chains

**Outputs**:
- Unified analysis results using `@topolop/shared-types`
- JSON export for external tools
- Event streams for real-time updates
- REST API endpoints

## Installation

```bash
npm install topolop-analysis
```

## Usage

### Programmatic API

```typescript
import { AnalysisEngine } from 'topolop-analysis';
import { UnifiedIssue } from '@topolop/shared-types';

const engine = new AnalysisEngine({
  projectPath: '/path/to/project',
  tools: ['sonarqube', 'semgrep', 'eslint']
});

// Run analysis
const results = await engine.analyze();

// Get issues
const issues: UnifiedIssue[] = results.getIssues();

// Get hotspots
const hotspots = results.getHotspots();
```

### CLI

```bash
# Analyze a project
topolop-analysis analyze --project /path/to/project --tools sonarqube,semgrep

# Get hotspots
topolop-analysis hotspots --project /path/to/project

# Export results
topolop-analysis export --format json --output results.json
```

### Event-Driven Integration

```typescript
import { AnalysisEngine } from 'topolop-analysis';

const engine = new AnalysisEngine(config);

// Subscribe to real-time events
engine.on('issue.found', (issue) => {
  console.log('Issue found:', issue.title);
});

engine.on('analysis.complete', (results) => {
  console.log('Analysis complete:', results.summary);
});

await engine.analyze();
```

## Tool Coverage

### Static Analysis (8 tools)
- SonarQube, CodeClimate, Semgrep, CodeQL, DeepSource, Veracode, Checkmarx, Codacy

### Language-Specific (Multiple)
- **Python**: Pylint, Mypy, Bandit
- **JavaScript/TypeScript**: ESLint, TSC
- **C/C++**: Clang Static Analyzer, CBMC, Valgrind
- **Go**: Staticcheck, Gosec
- **Rust**: Clippy, Cargo Audit

### Formal Verification (3 tools)
- Z3 SMT Solver, CBMC (Bounded Model Checker), KLEE (Symbolic Execution)

### APM & Performance (2 tools)
- New Relic APM, Datadog APM

### Dependency Analysis (Multiple)
- npm-audit, Snyk, OSV, pip-audit, Safety, RetireJS

## Advanced Features

### Cross-Tool Correlation

Automatically deduplicate issues found by multiple tools:

```typescript
const results = await engine.analyze();

// Issues flagged by 3+ tools
const criticalHotspots = results.hotspots.filter(h => h.toolCount >= 3);
```

### Confidence Scoring

Multi-factor confidence scoring for findings:

```typescript
issue.confidence // 0.0 - 1.0
issue.metadata.confidenceFactors // Breakdown
```

### Dependency Analysis

```typescript
import { DependencyAnalyzer } from 'topolop-analysis';

const analyzer = new DependencyAnalyzer();
const cycles = analyzer.detectCycles(projectPath);
const hubs = analyzer.detectHubs(projectPath);
```

### Temporal Analysis

```typescript
import { TemporalAnalyzer } from 'topolop-analysis';

const analyzer = new TemporalAnalyzer();
const forecast = analyzer.predictIssues(historicalData);
const patterns = analyzer.detectPatterns(commits);
```

## Configuration

Create `topolop-analysis.config.json`:

```json
{
  "tools": ["sonarqube", "semgrep", "eslint"],
  "correlation": {
    "enabled": true,
    "proximityThreshold": 5
  },
  "hotspots": {
    "minToolCount": 2,
    "severityWeights": {
      "critical": 10,
      "high": 7,
      "medium": 4
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Integration with Topolop Ecosystem

**topolop-analysis** works with:

- **[@topolop/shared-types](../topolop-shared-types)**: Shared type definitions
- **[topolop-visualization](../topolop-visualization)**: 3D visualization engine
- **[CodebaseManager](../CodebaseManager)**: Orchestration and event coordination

### Event Publishing

Analysis engine publishes events for orchestrator consumption:

```typescript
// Published events
'analysis.started'        // Analysis begins
'analysis.issue.found'    // Issue discovered
'analysis.hotspot.found'  // Hotspot detected
'analysis.complete'       // Analysis finished
'analysis.error'          // Error occurred
```

## Performance

- **Incremental Analysis**: Only analyze changed files
- **Parallel Processing**: Run multiple tools concurrently
- **Caching**: Cache analysis results for unchanged files
- **Streaming**: Stream results as they're discovered

## License

MIT

---

**Part of the Topolop ecosystem**: [@topolop/shared-types](../topolop-shared-types) | [topolop-visualization](../topolop-visualization) | [CodebaseManager](../CodebaseManager)

**Status**: Active extraction from monolith - see [migration plan](./docs/MIGRATION.md)
