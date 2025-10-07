const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class CityRenderer {
  constructor(canvasEngine) {
    this.canvas = canvasEngine;
    this.config = null;
    this.layoutCache = new Map();
    this.animationState = {
      buildingGrowth: new Map(),
      trafficFlow: new Map(),
      constructionSites: new Set()
    };
  }

  async loadConfig() {
    const configPath = path.join(__dirname, '../../../../metaphors/city.yaml');
    const configData = await fs.readFile(configPath, 'utf8');
    this.config = yaml.load(configData);
  }

  async render(codebaseGraph, options = {}) {
    if (!this.config) {
      await this.loadConfig();
    }

    const {
      showTraffic = true,
      showConstruction = true,
      animateGrowth = true,
      showPerformance = true,
      timeRange = null
    } = options;

    // Clear canvas
    this.canvas.clear();

    // Compute city layout with performance data
    const cityLayout = this.computeCityLayout(codebaseGraph);

    // Get performance visualization data
    const performanceData = showPerformance ? codebaseGraph.getVisualizationData() : {};
    
    // Enhance buildings with performance data
    if (showPerformance) {
      this.enhanceBuildingsWithPerformance(cityLayout.buildings, performanceData);
    }

    // Render city districts (modules/packages)
    await this.renderDistricts(cityLayout.districts);

    // Render buildings (files/classes) with performance visualization
    await this.renderBuildings(cityLayout.buildings, animateGrowth, performanceData);

    // Render roads (dependencies)
    await this.renderRoads(cityLayout.roads);

    // Render traffic (function calls, data flow) with performance-based intensity
    if (showTraffic) {
      await this.renderTraffic(cityLayout.traffic, performanceData);
    }

    // Render construction sites (recent changes)
    if (showConstruction) {
      await this.renderConstructionSites(cityLayout.construction);
    }

    // Render performance hotspots and indicators
    if (showPerformance) {
      await this.renderPerformanceIndicators(cityLayout.buildings, performanceData);
    }

    // Add city infrastructure
    await this.renderInfrastructure(cityLayout);

    return cityLayout;
  }

  computeCityLayout(graph) {
    const cacheKey = graph.getVersion();
    if (this.layoutCache.has(cacheKey)) {
      return this.layoutCache.get(cacheKey);
    }

    const buildings = this.computeBuildings(graph);
    const layout = {
      districts: this.computeDistricts(graph),
      buildings: buildings,
      roads: this.computeRoads(graph, buildings),
      traffic: this.computeTraffic(graph),
      construction: this.computeConstructionSites(graph),
      infrastructure: this.computeInfrastructure(graph)
    };

    this.layoutCache.set(cacheKey, layout);
    return layout;
  }

  computeDistricts(graph) {
    const districts = [];
    const modules = graph.getNodesByType('module');
    
    // Use force-directed layout for district positioning
    const districtPositions = this.computeForceLayout(modules, {
      nodeRadius: 200,
      linkDistance: 400,
      centerForce: 0.1
    });

    modules.forEach((module, index) => {
      const pos = districtPositions[index];
      // Get only the direct child files in this module (not nested functions/classes)
      const directChildren = graph.getChildNodes(module.id);
      const files = directChildren.filter(node => node.type === 'file');
      const complexity = this.calculateModuleComplexity(files);
      
      districts.push({
        id: module.id,
        name: module.data?.name || module.id,
        x: pos.x,
        y: pos.y,
        size: this.mapComplexityToSize(complexity),
        color: this.mapModuleTypeToColor(module.data?.type),
        population: files.length,
        density: complexity / Math.max(files.length, 1),
        buildings: files.map(f => f.id)
      });
    });

    return districts;
  }

  computeBuildings(graph) {
    const buildings = [];
    const files = graph.getNodesByType('file');

    files.forEach(file => {
      // Get classes and functions that are contained within this file
      const classes = graph.getChildNodes(file.id).filter(node => node.type === 'class');
      const functions = graph.getChildNodes(file.id).filter(node => node.type === 'function');
      
      // Map file characteristics to building properties
      const complexity = this.calculateFileComplexity(file);
      const activity = this.calculateFileActivity(file);
      const dependencies = graph.getEdgesByType('depends_on').filter(e => e.sourceId === file.id).length;

      const building = {
        id: file.id,
        name: file.data?.name || file.id,
        x: 0, // Will be positioned within district
        y: 0,
        type: this.mapFileToBuildingType(file, classes, functions),
        height: this.mapComplexityToHeight(complexity),
        width: this.mapSizeToWidth(file.data?.lines || 100),
        depth: this.mapDependenciesToDepth(dependencies),
        color: this.mapActivityToColor(activity),
        floors: Math.max(1, Math.floor(complexity / 50)),
        windows: functions.length,
        entrances: this.calculatePublicMethods(classes, functions),
        lastModified: file.data?.lastModified,
        hotspot: activity > 0.8,
        underConstruction: this.isRecentlyModified(file)
      };

      buildings.push(building);
    });

    // Position buildings within their districts
    this.positionBuildingsInDistricts(buildings, graph);

    return buildings;
  }

  computeRoads(graph, buildings) {
    const roads = [];
    const dependencies = graph.getEdgesByType('depends_on');
    console.log(`🛣️  Computing roads from ${dependencies.length} dependencies...`);
    
    // Group dependencies by strength to create different road types
    const roadTypes = this.classifyDependencies(dependencies);

    roadTypes.forEach(({ type, edges, width, style }) => {
      console.log(`  Road type '${type}': ${edges.length} edges`);
      edges.forEach(edge => {
        console.log(`    Checking edge: ${edge.sourceId} -> ${edge.targetId}`);
        const fromBuilding = this.getBuildingById(edge.sourceId, buildings);
        const toBuilding = this.getBuildingById(edge.targetId, buildings);
        console.log(`    Buildings: ${fromBuilding?.id || 'null'} -> ${toBuilding?.id || 'null'}`);
        
        if (fromBuilding && toBuilding) {
          roads.push({
            id: edge.id,
            from: { x: fromBuilding.x, y: fromBuilding.y },
            to: { x: toBuilding.x, y: toBuilding.y },
            type: type,
            width: width,
            style: style,
            traffic: this.calculateTrafficVolume(edge),
            condition: this.calculateRoadCondition(edge)
          });
        }
      });
    });

    return roads;
  }

  computeTraffic(graph) {
    const traffic = [];
    const functionCalls = graph.getEdgesByType('calls');
    console.log(`🚗 Computing traffic from ${functionCalls.length} function calls...`);
    
    // Create traffic flow based on function call frequency
    functionCalls.forEach(call => {
      console.log(`    Function call: ${call.sourceId} -> ${call.targetId}`);
      // Get the files containing the source and target nodes
      const fromFile = graph.getFileContaining(call.sourceId);
      const toFile = graph.getFileContaining(call.targetId);
      console.log(`    Files: ${fromFile?.id || 'null'} -> ${toFile?.id || 'null'}`);
      
      if (fromFile && toFile && fromFile.id !== toFile.id) {
        traffic.push({
          id: call.id,
          from: { x: 100, y: 100, id: fromFile.id }, // Mock positions - will be updated by layout
          to: { x: 200, y: 200, id: toFile.id },
          volume: call.data?.frequency || 1,
          speed: this.mapCallFrequencyToSpeed(call.data?.frequency),
          direction: 'bidirectional',
          vehicleType: this.mapCallTypeToVehicle(call.data?.type)
        });
      }
    });

    return traffic;
  }

  computeConstructionSites(graph) {
    const construction = [];
    const recentCommits = graph.data.gitHistory?.commits?.slice(0, 10) || [];
    
    recentCommits.forEach(commit => {
      commit.files?.forEach(filePath => {
        const file = graph.findNodeByPath(filePath) || graph.findNodesByPattern(filePath, 'name')[0];
        if (file) {
          construction.push({
            id: `construction_${file.id}`,
            buildingId: file.id,
            type: this.mapChangeTypeToConstruction(commit.type),
            progress: this.calculateConstructionProgress(commit, file),
            workers: commit.author ? [commit.author] : [],
            startDate: commit.date,
            equipment: this.mapChangeSizeToEquipment(commit.stats)
          });
        }
      });
    });

    return construction;
  }

  computeInfrastructure(graph) {
    return {
      parks: this.identifyTestAreas(graph),
      utilities: this.identifyConfigFiles(graph),
      landmarks: this.identifyImportantFiles(graph),
      publicTransport: this.identifyMainDataFlows(graph)
    };
  }

  async renderDistricts(districts) {
    for (const district of districts) {
      // Draw district boundary
      this.canvas.drawPolygon({
        points: this.generateDistrictBoundary(district),
        fillColor: district.color,
        fillAlpha: 0.1,
        strokeColor: district.color,
        strokeWidth: 2,
        strokeStyle: 'dashed'
      });

      // Draw district label
      this.canvas.drawText({
        text: district.name,
        x: district.x,
        y: district.y - district.size - 20,
        font: 'bold 16px Arial',
        color: '#333',
        align: 'center'
      });

      // Draw population indicator
      this.canvas.drawCircle({
        x: district.x + district.size - 20,
        y: district.y - district.size + 20,
        radius: Math.sqrt(district.population) * 2,
        fillColor: '#4CAF50',
        fillAlpha: 0.7
      });
    }
  }

  // Performance enhancement methods
  enhanceBuildingsWithPerformance(buildings, performanceData) {
    buildings.forEach(building => {
      const nodePerf = performanceData[building.id];
      if (nodePerf) {
        // Modify building properties based on performance data
        building.performanceColor = this.getPerformanceColor(nodePerf);
        building.performanceHeat = nodePerf.visual.heat;
        building.performanceSize = nodePerf.visual.size;
        building.performanceAnimation = nodePerf.visual.animation;
        building.cpuUsage = nodePerf.performance.cpu;
        building.memoryUsage = nodePerf.performance.memory;
        building.errorCount = nodePerf.performance.errors;
        building.throughput = nodePerf.execution.throughput;
        
        // Adjust building height based on activity
        building.originalHeight = building.height;
        building.height = Math.max(building.height, building.height * (1 + nodePerf.visual.size * 0.5));
        
        // Mark as hotspot if high performance load
        building.isPerformanceHotspot = nodePerf.visual.heat > 0.7;
      }
    });
  }

  getPerformanceColor(nodePerf) {
    const heat = nodePerf.visual.heat;
    const color = nodePerf.visual.color;
    
    // Create heat-based color variations
    if (color === 'red') return '#FF5722'; // Critical performance issues
    if (color === 'orange') return '#FF9800'; // High load
    if (color === 'yellow') return '#FFC107'; // Low test coverage
    if (color === 'purple') return '#9C27B0'; // Low maintainability
    return '#4CAF50'; // Good performance
  }

  async renderBuildings(buildings, animate = false, performanceData = {}) {
    for (const building of buildings) {
      const currentHeight = animate ? 
        this.getAnimatedHeight(building) : 
        building.height;

      // Use performance-enhanced color if available
      const buildingColor = building.performanceColor || building.color;
      const strokeColor = building.isPerformanceHotspot ? '#FF1744' : '#666';
      const strokeWidth = building.isPerformanceHotspot ? 2 : 1;

      // Draw building base with performance-based coloring
      this.canvas.drawRectangle({
        x: building.x - building.width / 2,
        y: building.y - building.depth / 2,
        width: building.width,
        height: building.depth,
        fillColor: buildingColor,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
      });

      // Draw building height (3D effect) with performance-based intensity
      this.canvas.drawPolygon({
        points: [
          { x: building.x - building.width / 2, y: building.y - building.depth / 2 },
          { x: building.x + building.width / 2, y: building.y - building.depth / 2 },
          { x: building.x + building.width / 2 - 5, y: building.y - building.depth / 2 - currentHeight },
          { x: building.x - building.width / 2 - 5, y: building.y - building.depth / 2 - currentHeight }
        ],
        fillColor: this.lightenColor(buildingColor, 0.2),
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
      });

      // Draw building side with heat-based glow effect
      const sideColor = building.performanceHeat > 0.5 ? 
        this.addHeatGlow(buildingColor, building.performanceHeat) : 
        this.darkenColor(buildingColor, 0.1);
        
      this.canvas.drawPolygon({
        points: [
          { x: building.x + building.width / 2, y: building.y - building.depth / 2 },
          { x: building.x + building.width / 2, y: building.y + building.depth / 2 },
          { x: building.x + building.width / 2 - 5, y: building.y + building.depth / 2 - currentHeight },
          { x: building.x + building.width / 2 - 5, y: building.y - building.depth / 2 - currentHeight }
        ],
        fillColor: sideColor,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
      });

      // Draw windows (representing functions)
      this.drawBuildingWindows(building, currentHeight);

      // Draw construction indicators
      if (building.underConstruction) {
        this.drawConstructionIndicators(building);
      }

      // Draw performance hotspot indicator
      if (building.isPerformanceHotspot) {
        // Pulsing hotspot indicator
        const pulseRadius = 5 + Math.sin(Date.now() * 0.005) * 2;
        this.canvas.drawCircle({
          x: building.x,
          y: building.y - currentHeight - 15,
          radius: pulseRadius,
          fillColor: '#FF1744',
          strokeColor: '#D32F2F',
          strokeWidth: 2
        });
      }

      // Draw legacy hotspot indicator
      if (building.hotspot) {
        this.canvas.drawCircle({
          x: building.x,
          y: building.y - currentHeight - 10,
          radius: 5,
          fillColor: '#FF5722',
          strokeColor: '#D32F2F',
          strokeWidth: 1
        });
      }
    }
  }

  async renderPerformanceIndicators(buildings, performanceData) {
    for (const building of buildings) {
      const nodePerf = performanceData[building.id];
      if (!nodePerf) continue;

      // Draw CPU usage bar
      if (nodePerf.performance.cpu > 20) {
        this.drawPerformanceBar(building, 'CPU', nodePerf.performance.cpu, '#FF5722', -25);
      }

      // Draw memory usage bar
      if (nodePerf.performance.memory > 50) {
        this.drawPerformanceBar(building, 'MEM', nodePerf.performance.memory, '#2196F3', -35);
      }

      // Draw error indicator
      if (nodePerf.performance.errors > 0) {
        this.drawErrorIndicator(building, nodePerf.performance.errors);
      }

      // Draw throughput animation
      if (nodePerf.execution.throughput > 0) {
        this.drawThroughputAnimation(building, nodePerf.execution.throughput);
      }
    }
  }

  drawPerformanceBar(building, label, value, color, yOffset) {
    const barWidth = 20;
    const barHeight = 8;
    const fillWidth = (value / 100) * barWidth;

    // Background bar
    this.canvas.drawRectangle({
      x: building.x - barWidth / 2,
      y: building.y + yOffset,
      width: barWidth,
      height: barHeight,
      fillColor: '#333',
      strokeColor: '#666',
      strokeWidth: 1
    });

    // Fill bar
    this.canvas.drawRectangle({
      x: building.x - barWidth / 2,
      y: building.y + yOffset,
      width: fillWidth,
      height: barHeight,
      fillColor: color,
      strokeColor: 'transparent'
    });

    // Label
    this.canvas.drawText({
      text: `${label}:${Math.round(value)}%`,
      x: building.x,
      y: building.y + yOffset - 5,
      fontSize: 8,
      fillColor: '#333',
      textAlign: 'center'
    });
  }

  drawErrorIndicator(building, errorCount) {
    // Flashing error indicator
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      this.canvas.drawText({
        text: '⚠️',
        x: building.x + building.width / 2 + 10,
        y: building.y - building.height,
        fontSize: 12,
        fillColor: '#FF1744'
      });
    }
  }

  drawThroughputAnimation(building, throughput) {
    // Animated particles rising from building
    const particleCount = Math.min(throughput / 10, 5);
    for (let i = 0; i < particleCount; i++) {
      const time = Date.now() * 0.003 + i * 0.5;
      const x = building.x + Math.sin(time) * 10;
      const y = building.y - building.height - (time % 30);
      
      this.canvas.drawCircle({
        x: x,
        y: y,
        radius: 2,
        fillColor: '#4CAF50',
        strokeColor: 'transparent',
        fillOpacity: Math.max(0, 1 - (time % 30) / 30)
      });
    }
  }

  // Color utility methods for performance visualization
  addHeatGlow(baseColor, heatIntensity) {
    // Add red glow to buildings with high performance load
    const glow = Math.floor(heatIntensity * 100);
    return this.blendColors(baseColor, `rgb(255, ${255 - glow}, ${255 - glow})`);
  }

  blendColors(color1, color2, ratio = 0.5) {
    // Simple color blending (could be enhanced with proper color space conversion)
    return color2; // Simplified for now
  }

  async renderRoads(roads) {
    // Sort roads by type (highways first, then streets, then alleys)
    const sortedRoads = roads.sort((a, b) => {
      const order = { highway: 0, street: 1, alley: 2 };
      return order[a.type] - order[b.type];
    });

    for (const road of sortedRoads) {
      // Draw road base
      this.canvas.drawLine({
        x1: road.from.x,
        y1: road.from.y,
        x2: road.to.x,
        y2: road.to.y,
        strokeColor: this.getRoadColor(road.type),
        strokeWidth: road.width,
        strokeStyle: road.style
      });

      // Draw road markings for larger roads
      if (road.width > 4) {
        this.drawRoadMarkings(road);
      }
    }
  }

  async renderTraffic(traffic, performanceData = {}) {
    for (const flow of traffic) {
      const particles = this.generateTrafficParticles(flow);
      
      particles.forEach(particle => {
        this.canvas.drawCircle({
          x: particle.x,
          y: particle.y,
          radius: particle.size,
          fillColor: particle.color,
          fillAlpha: 0.8
        });
      });
    }
  }

  async renderConstructionSites(construction) {
    for (const site of construction) {
      const building = this.getBuildingById(site.buildingId);
      if (!building) continue;

      // Draw construction scaffolding
      this.drawScaffolding(building, site.progress);

      // Draw construction equipment
      site.equipment.forEach((equipment, index) => {
        this.drawConstructionEquipment(
          building.x + (index * 15) - 10,
          building.y + 20,
          equipment
        );
      });

      // Draw progress indicator
      this.canvas.drawRectangle({
        x: building.x - 15,
        y: building.y - building.height - 25,
        width: 30,
        height: 5,
        fillColor: '#E0E0E0',
        strokeColor: '#666',
        strokeWidth: 1
      });

      this.canvas.drawRectangle({
        x: building.x - 15,
        y: building.y - building.height - 25,
        width: 30 * site.progress,
        height: 5,
        fillColor: '#4CAF50'
      });
    }
  }

  async renderInfrastructure(layout) {
    // Draw parks (test areas)
    layout.infrastructure.parks.forEach(park => {
      this.canvas.drawCircle({
        x: park.x,
        y: park.y,
        radius: park.size,
        fillColor: '#4CAF50',
        fillAlpha: 0.3,
        strokeColor: '#388E3C',
        strokeWidth: 2,
        strokeStyle: 'dotted'
      });
    });

    // Draw utilities (config files)
    layout.infrastructure.utilities.forEach(utility => {
      this.canvas.drawRectangle({
        x: utility.x - 5,
        y: utility.y - 5,
        width: 10,
        height: 10,
        fillColor: '#FF9800',
        strokeColor: '#F57C00',
        strokeWidth: 1
      });
    });

    // Draw landmarks (important files)
    layout.infrastructure.landmarks.forEach(landmark => {
      this.canvas.drawPolygon({
        points: this.generateLandmarkShape(landmark),
        fillColor: '#9C27B0',
        strokeColor: '#7B1FA2',
        strokeWidth: 2
      });
    });
  }

  // Helper methods for calculations and mappings
  calculateModuleComplexity(files) {
    return files.reduce((sum, file) => {
      const cyclomaticComplexity = file.data?.cyclomaticComplexity || 1;
      const lines = file.data?.lines || 0;
      return sum + cyclomaticComplexity * Math.log(lines + 1);
    }, 0);
  }

  calculateFileComplexity(file) {
    const cyclomatic = file.data?.cyclomaticComplexity || 1;
    const lines = file.data?.lines || 0;
    const functions = file.data?.functionCount || 1;
    return cyclomatic + Math.log(lines + 1) + (functions * 2);
  }

  calculateFileActivity(file) {
    const commits = file.data?.commitCount || 0;
    const lastModified = new Date(file.data?.lastModified || 0);
    const daysSinceModified = (Date.now() - lastModified) / (1000 * 60 * 60 * 24);
    
    // Activity score: more commits = higher activity, recent changes = higher activity
    const commitScore = Math.min(commits / 100, 1); // Normalize to 0-1
    const recencyScore = Math.max(0, 1 - daysSinceModified / 365); // Decay over a year
    
    return (commitScore * 0.7) + (recencyScore * 0.3);
  }

  mapComplexityToSize(complexity) {
    return Math.min(300, Math.max(50, complexity * 10));
  }

  mapComplexityToHeight(complexity) {
    return Math.min(100, Math.max(10, complexity * 5));
  }

  mapSizeToWidth(lines) {
    return Math.min(40, Math.max(10, lines / 10));
  }

  mapDependenciesToDepth(deps) {
    return Math.min(30, Math.max(8, deps * 2));
  }

  mapActivityToColor(activity) {
    // Color gradient from blue (low activity) to red (high activity)
    const r = Math.floor(activity * 255);
    const b = Math.floor((1 - activity) * 255);
    return `rgb(${r}, 100, ${b})`;
  }

  mapModuleTypeToColor(type) {
    const colors = {
      'core': '#2196F3',
      'feature': '#4CAF50', 
      'utility': '#FF9800',
      'test': '#9C27B0',
      'config': '#607D8B',
      'default': '#757575'
    };
    return colors[type] || colors.default;
  }

  mapFileToBuildingType(file, classes, functions) {
    const name = file.data?.name || file.name || '';
    if (name.includes('test')) return 'gymnasium';
    if (name.includes('config')) return 'utility';
    if (classes.length > 3) return 'office_complex';
    if (functions.length > 10) return 'factory';
    if (name.includes('index')) return 'terminal';
    return 'residential';
  }

  lightenColor(color, factor) {
    // Simple color lightening - would need proper color manipulation in real implementation
    return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, (match, r, g, b) => {
      const newR = Math.min(255, Math.floor(parseInt(r) * (1 + factor)));
      const newG = Math.min(255, Math.floor(parseInt(g) * (1 + factor)));
      const newB = Math.min(255, Math.floor(parseInt(b) * (1 + factor)));
      return `rgb(${newR}, ${newG}, ${newB})`;
    });
  }

  darkenColor(color, factor) {
    return this.lightenColor(color, -factor);
  }

  getBuildingById(id, currentBuildings = null) {
    // First check the current buildings list if provided
    if (currentBuildings) {
      const building = currentBuildings.find(b => b.id === id);
      if (building) return building;
    }
    
    // Find in current layout cache
    const cached = Array.from(this.layoutCache.values());
    for (const layout of cached) {
      const building = layout.buildings?.find(b => b.id === id);
      if (building) return building;
    }
    return null;
  }

  classifyDependencies(dependencies) {
    const roadTypes = [];
    
    // Group by frequency/strength
    const strongDeps = dependencies.filter(dep => dep.data?.frequency > 10);
    const mediumDeps = dependencies.filter(dep => (dep.data?.frequency || 0) > 3 && (dep.data?.frequency || 0) <= 10);
    const weakDeps = dependencies.filter(dep => (dep.data?.frequency || 0) <= 3);

    if (strongDeps.length) {
      roadTypes.push({
        type: 'highway',
        edges: strongDeps,
        width: 8,
        style: 'solid'
      });
    }

    if (mediumDeps.length) {
      roadTypes.push({
        type: 'street',
        edges: mediumDeps,
        width: 4,
        style: 'solid'
      });
    }

    if (weakDeps.length) {
      roadTypes.push({
        type: 'alley',
        edges: weakDeps,
        width: 2,
        style: 'dashed'
      });
    }

    return roadTypes;
  }

  calculateTrafficVolume(edge) {
    return Math.max(1, edge.data?.frequency || 1);
  }

  calculateRoadCondition(edge) {
    const age = edge.data?.age || 0;
    const usage = edge.data?.frequency || 1;
    return Math.max(0.2, 1 - (age * 0.001) - (usage * 0.01));
  }

  mapCallFrequencyToSpeed(frequency) {
    return Math.min(2.0, 0.1 + (frequency || 1) * 0.1);
  }

  mapCallTypeToVehicle(callType) {
    const mapping = {
      'sync': 'car',
      'async': 'truck',
      'event': 'signal',
      'data': 'data'
    };
    return mapping[callType] || 'car';
  }

  mapChangeTypeToConstruction(changeType) {
    const mapping = {
      'feature': 'new_building',
      'bugfix': 'repair',
      'refactor': 'renovation'
    };
    return mapping[changeType] || 'maintenance';
  }

  calculateConstructionProgress(commit, file) {
    const additions = commit.stats?.additions || 0;
    const deletions = commit.stats?.deletions || 0;
    const totalChanges = additions + deletions;
    
    // Mock progress based on change size
    return Math.min(0.9, totalChanges / 100);
  }

  mapChangeSizeToEquipment(stats) {
    const total = (stats?.additions || 0) + (stats?.deletions || 0);
    if (total > 50) return ['crane', 'excavator'];
    if (total > 20) return ['bulldozer'];
    return ['tools'];
  }

  identifyTestAreas(graph) {
    return graph.findNodesByPattern('test|spec', 'name')
      .filter(node => node.type === 'file')
      .map(node => ({
        x: Math.random() * 1000,
        y: Math.random() * 800,
        size: 30 + Math.random() * 20,
        name: node.data?.name || 'Test File'
      }));
  }

  identifyConfigFiles(graph) {
    const configFiles = [
      ...graph.findNodesByPattern('config', 'name'),
      ...graph.findNodesByPattern('\\.json$', 'name'),
      ...graph.findNodesByPattern('\\.env$', 'name'),
      ...graph.findNodesByPattern('package\\.json$', 'name')
    ];
    
    return [...new Set(configFiles)] // Remove duplicates
      .filter(node => node.type === 'file')
      .map(node => ({
        x: Math.random() * 1000,
        y: Math.random() * 800,
        type: 'config',
        name: node.data?.name || 'Config File'
      }));
  }

  identifyImportantFiles(graph) {
    const importantFiles = [
      ...graph.findNodesByPattern('index', 'name'),
      ...graph.findNodesByPattern('main', 'name'),
      ...graph.findNodesByPattern('app\\.', 'name'),
      ...graph.findNodesByPattern('server\\.', 'name')
    ];
    
    return [...new Set(importantFiles)]
      .filter(node => node.type === 'file')
      .map(node => ({
        x: Math.random() * 1000,
        y: Math.random() * 800,
        size: 25,
        type: 'tower',
        name: node.data?.name || 'Important File'
      }));
  }

  identifyMainDataFlows(graph) {
    return graph.getEdgesByType('calls')
      .slice(0, 5)
      .map(edge => ({
        from: edge.sourceId,
        to: edge.targetId,
        type: 'subway'
      }));
  }

  positionBuildingsInDistricts(buildings, graph) {
    // Simple positioning - in real implementation this would be more sophisticated
    buildings.forEach((building, index) => {
      building.x = 100 + (index % 10) * 80;
      building.y = 100 + Math.floor(index / 10) * 80;
    });
  }

  calculatePublicMethods(classes, functions) {
    return classes.reduce((sum, cls) => sum + (cls.methods?.length || 0), 0) +
           functions.filter(fn => !(fn.name || '').startsWith('_')).length;
  }

  getAnimatedHeight(building) {
    const animation = this.animationState.buildingGrowth.get(building.id);
    return animation ? animation.currentHeight : building.height;
  }

  drawBuildingWindows(building, height) {
    const windowsPerFloor = Math.min(building.windows, 8);
    const floors = building.floors;
    
    for (let floor = 0; floor < floors; floor++) {
      for (let window = 0; window < windowsPerFloor; window++) {
        this.canvas.drawRectangle({
          x: building.x - building.width/2 + 5 + window * (building.width-10) / windowsPerFloor,
          y: building.y - building.depth/2 + 5 + floor * (building.depth-10) / floors,
          width: 3,
          height: 3,
          fillColor: '#FFEB3B',
          strokeColor: '#333',
          strokeWidth: 0.5
        });
      }
    }
  }

  drawConstructionIndicators(building) {
    this.canvas.drawPolygon({
      points: [
        { x: building.x - 5, y: building.y - 5 },
        { x: building.x + 5, y: building.y - 5 },
        { x: building.x, y: building.y - 15 }
      ],
      fillColor: '#FF9800',
      strokeColor: '#F57C00',
      strokeWidth: 1
    });
  }

  drawRoadMarkings(road) {
    // Draw center line for larger roads
    this.canvas.drawLine({
      x1: road.from.x,
      y1: road.from.y,
      x2: road.to.x,
      y2: road.to.y,
      strokeColor: '#FFEB3B',
      strokeWidth: 1,
      strokeStyle: 'dashed'
    });
  }

  generateTrafficParticles(flow) {
    const count = Math.min(5, flow.volume);
    const particles = [];
    
    for (let i = 0; i < count; i++) {
      particles.push({
        x: flow.from.x || 0,
        y: flow.from.y || 0,
        size: 2,
        color: '#4CAF50',
        progress: i * 0.2
      });
    }
    
    return particles;
  }

  drawScaffolding(building, progress) {
    const scaffoldHeight = building.height * progress;
    
    // Draw vertical scaffolding poles
    for (let i = 0; i < 3; i++) {
      const x = building.x - building.width/2 + i * building.width/2;
      this.canvas.drawLine({
        x1: x,
        y1: building.y,
        x2: x,
        y2: building.y - scaffoldHeight,
        strokeColor: '#757575',
        strokeWidth: 2
      });
    }
  }

  drawConstructionEquipment(x, y, equipment) {
    const colors = {
      'crane': '#FFEB3B',
      'excavator': '#FF9800',
      'bulldozer': '#FFC107',
      'tools': '#9E9E9E'
    };
    
    this.canvas.drawRectangle({
      x: x - 5,
      y: y - 3,
      width: 10,
      height: 6,
      fillColor: colors[equipment] || '#9E9E9E',
      strokeColor: '#424242',
      strokeWidth: 1
    });
  }

  getRoadColor(type) {
    const colors = {
      'highway': '#424242',
      'street': '#616161',
      'alley': '#9E9E9E'
    };
    return colors[type] || '#757575';
  }

  isRecentlyModified(file, days = 7) {
    const lastModified = new Date(file.data?.lastModified || 0);
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return lastModified > threshold;
  }

  generateDistrictBoundary(district) {
    const { x, y, size } = district;
    const sides = 6; // Hexagon
    const points = [];
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const radius = size * 0.9;
      points.push({
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle)
      });
    }
    
    return points;
  }

  computeForceLayout(nodes, options) {
    // Simple circular layout for testing
    const positions = [];
    const centerX = 600;
    const centerY = 400;
    const radius = 200;
    
    nodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });
    
    return positions;
  }

  generateLandmarkShape(landmark) {
    const { x, y, size, type } = landmark;
    
    switch (type) {
      case 'tower':
        return [
          { x: x - size/4, y: y + size/2 },
          { x: x + size/4, y: y + size/2 },
          { x: x + size/6, y: y - size/2 },
          { x: x - size/6, y: y - size/2 }
        ];
      
      case 'monument':
        const points = [];
        const sides = 8;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides;
          const radius = i % 2 === 0 ? size : size * 0.7;
          points.push({
            x: x + radius * Math.cos(angle),
            y: y + radius * Math.sin(angle)
          });
        }
        return points;
      
      default: // Default to diamond shape
        return [
          { x: x, y: y - size },
          { x: x + size, y: y },
          { x: x, y: y + size },
          { x: x - size, y: y }
        ];
    }
  }
}

module.exports = CityRenderer;