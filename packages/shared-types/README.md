# @topolop/shared-types

Shared TypeScript type definitions for the Topolop analysis and visualization ecosystem.

## Overview

This package provides common data structures used by both `topolop-analysis` and `topolop-visualization` components, enabling type-safe communication between analysis engines and visualization renderers.

## Installation

```bash
npm install @topolop/shared-types
```

## Core Types

### UnifiedEntity

Canonical entity identification for cross-tool correlation.

```typescript
import { UnifiedEntity } from '@topolop/shared-types';

const entity = new UnifiedEntity({
  id: 'entity-src/App.ts',
  type: 'file',
  name: 'App.ts',
  canonicalPath: 'src/App.ts'
});
```

### UnifiedIssue

Standardized issue representation across all analysis tools.

```typescript
import { UnifiedIssue, IssueSeverity, AnalysisType } from '@topolop/shared-types';

const issue = new UnifiedIssue({
  id: 'issue-123',
  entity: entity,
  severity: IssueSeverity.HIGH,
  analysisType: AnalysisType.SECURITY,
  title: 'SQL Injection vulnerability',
  description: 'User input not sanitized',
  ruleId: 'sql-injection',
  line: 42,
  column: 10,
  toolName: 'semgrep'
});
```

### UnifiedFileMetrics

Aggregated metrics for file-level analysis.

```typescript
import { UnifiedFileMetrics } from '@topolop/shared-types';

const metrics = new UnifiedFileMetrics('src/App.ts');
metrics.addIssue(issue);

console.log(metrics.hotspotScore);  // 0-100 risk score
console.log(metrics.toolCoverage);  // ['semgrep', 'eslint', ...]
```

## Enumerations

### IssueSeverity

```typescript
enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}
```

### AnalysisType

```typescript
enum AnalysisType {
  QUALITY = 'quality',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STYLE = 'style',
  COMPLEXITY = 'complexity',
  SEMANTIC = 'semantic',
  AI_POWERED = 'ai_powered',
  // ... and more
}
```

## Version Compatibility

| @topolop/shared-types | topolop-analysis | topolop-visualization |
|-----------------------|------------------|----------------------|
| 0.1.x                 | 0.1.x            | 0.1.x                |

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Clean
npm run clean
```

## License

MIT

---

**Part of the Topolop ecosystem**: [topolop-analysis](https://github.com/cordlesssteve/topolop-analysis) | [topolop-visualization](https://github.com/cordlesssteve/topolop-visualization) | [CodebaseManager](https://github.com/cordlesssteve/CodebaseManager)
