# Experimental Templates

This directory contains experimental and prototype visualization templates that are being tested and developed.

## Template Categories

### 🧪 **Experimental Templates**
- Templates testing new features, data sources, or visualization approaches
- May have incomplete functionality or be under active development
- Used for proof-of-concept and iteration

### ✅ **Production-Ready Templates**
- Located in parent directory (`../`)
- Fully tested and stable
- Ready for enterprise deployment

## Current Experimental Templates

### REAL-DATA-TEMPLATE.html
**Status:** ✅ Working - Real Data Integration Complete  
**Purpose:** Integration of actual Semgrep + CodeQL security analysis data  
**Features:**
- 438 real security issues from live analysis
- 160 files with actual vulnerability findings
- Tool-specific filtering (Semgrep vs CodeQL)
- Color-coded severity mapping from real data
- Production-ready visualization pipeline

**Data Source:** `real-unified-analysis.json` (26K lines, real analysis results)  
**Access:** http://127.0.0.1:8098/experimental/REAL-DATA-TEMPLATE.html

## Development Guidelines

### When to Create Experimental Templates
- Testing new data integration approaches
- Prototyping visualization features
- Exploring different UI/UX patterns
- Validating analysis tool integrations

### Promotion Criteria (Experimental → Production)
1. **Functionality Complete:** All core features working
2. **Data Integration Stable:** Reliable data loading and processing
3. **User Testing Passed:** Usable interface and clear value proposition
4. **Performance Validated:** Smooth rendering and interaction
5. **Documentation Complete:** Clear usage instructions and examples

### Template Naming Convention
- `[PURPOSE]-TEMPLATE.html` (e.g., `REAL-DATA-TEMPLATE.html`)
- `[TOOL-NAME]-INTEGRATION.html` (e.g., `SONARQUBE-INTEGRATION.html`)
- `[EXPERIMENT-NAME]-PROTOTYPE.html` (e.g., `TEMPORAL-ANALYSIS-PROTOTYPE.html`)

## Future Experimental Ideas
- **Multi-Tool Correlation Template:** Advanced cross-tool issue correlation
- **Temporal Analysis Template:** 4D visualization with git history timeline
- **AI-Powered Insights Template:** Integration with DeepSource Autofix™
- **Enterprise Dashboard Template:** Executive-level security overview
- **Performance Analysis Template:** APM and profiling data visualization

## Migration Path
Once an experimental template proves successful:
1. Move to parent directory
2. Update main documentation
3. Add to production deployment pipeline
4. Archive experimental version with promotion notes