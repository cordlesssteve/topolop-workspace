# topolop-visualization

> **3D Visualization Engine for Topolop**
> Render code analysis results as interactive city metaphors using Three.js/WebGL

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`topolop-visualization` transforms code analysis data into immersive 3D environments using familiar metaphors:

- **City Metaphor**: Buildings = modules, roads = dependencies, traffic = calls
- **Real-Time Updates**: Live visualization from analysis events
- **Interactive Exploration**: Zoom, navigate, filter by metrics
- **WebGL Performance**: Hardware-accelerated rendering for large codebases

## Features

### Metaphor-Based Rendering
- **City**: Urban landscape where buildings represent code modules
- **Hotspot Overlays**: Color-coded severity and issue density
- **Dependency Roads**: Visual connections between components
- **Traffic Flow**: Animated call frequency visualization

### Interaction
- **3D Navigation**: Orbit, zoom, pan controls
- **Entity Selection**: Click to inspect details
- **Filtering**: Show/hide by severity, type, tool
- **Time Travel**: Replay analysis timeline

### Performance
- **Level of Detail**: Optimize rendering for distant objects
- **Frustum Culling**: Only render visible objects
- **Instancing**: Efficient rendering of repeated geometries
- **Web Workers**: Offload processing from main thread

## Installation

```bash
npm install topolop-visualization
```

## Usage

### Standalone Viewer

```typescript
import { CityRenderer, VisualizationManager } from 'topolop-visualization';
import { AnalysisResult } from '@topolop/shared-types';

const renderer = new CityRenderer({
  container: document.getElementById('app'),
  width: window.innerWidth,
  height: window.innerHeight
});

const manager = new VisualizationManager(renderer);

// Load analysis results
manager.loadAnalysisData(analysisResults);

// Start rendering
manager.start();
```

### Event-Driven Updates

```typescript
import { VisualizationManager } from 'topolop-visualization';

const manager = new VisualizationManager(renderer);

// Subscribe to analysis events
eventBus.subscribe('analysis.issue.found', (issue) => {
  manager.addIssue(issue);
});

eventBus.subscribe('analysis.hotspot.found', (hotspot) => {
  manager.highlightHotspot(hotspot);
});
```

### HTML Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Topolop 3D Explorer</title>
  <style>
    body { margin: 0; overflow: hidden; }
    #app { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./dist/app.js"></script>
</body>
</html>
```

## Architecture

### Core Components

**Renderers** (`src/renderers/`):
- **CityRenderer**: Three.js city metaphor implementation
- **SceneManager**: 3D scene graph management
- **CameraController**: Navigation and viewpoint control
- **LightingManager**: Dynamic lighting and shadows

**Visualization** (`src/visualization/`):
- **VisualizationManager**: Coordinates rendering and updates
- **VisualizationStrategy**: Pluggable metaphor interface
- **LayoutEngine**: Spatial arrangement algorithms

**Bridge** (`src/bridge/`):
- **AnalysisToCityBridge**: Transforms analysis data to 3D scene
- **MetricsMapper**: Maps quality metrics to visual properties
- **ColorScheme**: Severity-based color mapping

### Data Flow

```
Analysis Results → Bridge → Scene Graph → Renderer → Canvas
        ↓
    @topolop/shared-types (UnifiedIssue, etc.)
```

## City Metaphor Mapping

### Buildings (Code Modules)
- **Height**: Lines of code / complexity
- **Color**: Issue severity (red = critical, yellow = high, etc.)
- **Width/Depth**: Coupling / dependencies
- **Position**: Architectural layer

### Roads (Dependencies)
- **Width**: Dependency strength
- **Color**: Coupling type (import, call, etc.)
- **Traffic**: Call frequency animation

### Districts (Packages/Namespaces)
- **Boundaries**: Visual grouping
- **Elevation**: Abstraction level
- **Zoning**: Architectural layers

## Configuration

Create `visualization.config.json`:

```json
{
  "metaphor": "city",
  "camera": {
    "initialPosition": [100, 100, 100],
    "fov": 60
  },
  "rendering": {
    "antialias": true,
    "shadows": true,
    "levelOfDetail": true
  },
  "colors": {
    "critical": "#ff0000",
    "high": "#ff8800",
    "medium": "#ffcc00",
    "low": "#88ff00",
    "info": "#00ff88"
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

# Serve locally
npm run serve

# Run tests
npm test
```

## Examples

See `src/examples/` for complete demos:

- **3D City Explorer**: Full-featured interactive visualization
- **Hotspot Viewer**: Focus on issue hotspots
- **Dependency Graph**: Animated dependency flow
- **Timeline Playback**: Temporal analysis visualization

## Integration with Topolop Ecosystem

**topolop-visualization** works with:

- **[@topolop/shared-types](../topolop-shared-types)**: Shared type definitions
- **[topolop-analysis](../topolop-analysis)**: Analysis engine data source
- **[CodebaseManager](../CodebaseManager)**: Orchestration and events

### Event Subscription

Visualization subscribes to analysis events:

```typescript
// Subscribed events
'analysis.complete'       // Render full results
'analysis.issue.found'    // Update with new issue
'analysis.hotspot.found'  // Highlight hotspot
'analysis.file.updated'   // Refresh file visualization
```

## Performance Optimization

- **Instanced Rendering**: 1000+ buildings at 60fps
- **Octree Spatial Index**: Fast raycasting for interaction
- **LOD System**: Reduce detail for distant objects
- **Web Workers**: Offload layout calculations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires WebGL 2.0 support

## License

MIT

---

**Part of the Topolop ecosystem**: [@topolop/shared-types](../topolop-shared-types) | [topolop-analysis](../topolop-analysis) | [CodebaseManager](../CodebaseManager)

**Status**: Active extraction from monolith - see [migration plan](./docs/MIGRATION.md)
