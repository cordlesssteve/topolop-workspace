# DEV-TOOLS Project Relationships

## Mega-Projects (contain submodules)

### CodebaseManager
**Purpose:** Unified codebase analysis and management tool
**Dependencies:**
- `ImTheMap` (structural analysis)
- `topolop-shared-types` (type definitions)
- `topolop-analysis` (analysis engine)
- `topolop-visualization` (visualization layer)

**Work here when:** Building high-level orchestration/UI for codebase management

---

### ImTheMap
**Purpose:** Structural code mapping and dependency visualization
**Dependencies:**
- `topolop` (core analysis engine)

**Work here when:** Building structural analysis features independent of CodebaseManager

---

### ai-benchmark-suite
**Purpose:** AI model evaluation harnesses
**Dependencies:**
- External: bigcode-evaluation-harness
- External: lm-evaluation-harness

**Work here when:** Running AI benchmarks or comparing model performance

---

## The Topolop Ecosystem

**Core Philosophy:** Modular analysis components

- **topolop** (`~/projects/Utility/DEV-TOOLS/topolop`)
  - Main repo: Core analysis engine
  - Work here for: Core language parsing, AST analysis

- **topolop-analysis** (`~/projects/Utility/DEV-TOOLS/topolop-analysis`)
  - Analysis algorithms and processors
  - Work here for: New analysis types, metrics calculation

- **topolop-shared-types** (`~/projects/Utility/DEV-TOOLS/topolop-shared-types`)
  - Common TypeScript types across ecosystem
  - Work here for: Type definitions shared by all topolop packages

- **topolop-visualization** (`~/projects/Utility/DEV-TOOLS/topolop-visualization`)
  - Visual representation of analysis results
  - Work here for: Charts, graphs, interactive visualizations

### Decision Tree: Where to Work?

```
Are you adding a new language parser?
  → topolop (core)

Are you creating a new analysis algorithm?
  → topolop-analysis

Are you adding shared interfaces/types?
  → topolop-shared-types

Are you building visualizations?
  → topolop-visualization

Are you integrating analysis into a bigger tool?
  → CodebaseManager or ImTheMap

Do you need structural mapping only?
  → ImTheMap

Do you need full codebase management?
  → CodebaseManager
```

---

## Quick Navigation

```bash
# Jump to projects
cd ~/projects/Utility/DEV-TOOLS/CodebaseManager  # Mega-project
cd ~/projects/Utility/DEV-TOOLS/ImTheMap         # Structural mapper
cd ~/projects/Utility/DEV-TOOLS/topolop          # Core engine
cd ~/projects/Utility/DEV-TOOLS/topolop-analysis # Analysis algos
```

---

## Future Consideration: Monorepo Migration

If topolop-* packages are tightly coupled and frequently developed together, consider migrating to a monorepo workspace structure.
