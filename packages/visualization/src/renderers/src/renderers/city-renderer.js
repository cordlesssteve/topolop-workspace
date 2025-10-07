/**
 * 3D City Renderer - Creates immersive 3D city visualizations
 * Transforms codebase structures into explorable 3D cities with helicopter navigation
 */

class CityRenderer {
  constructor(canvasEngine, options = {}) {
    this.canvas = canvasEngine;
    this.options = {
      buildingSpacing: 15,
      districtSpacing: 100,
      maxBuildingHeight: 200,
      minBuildingHeight: 5,
      roadWidth: 8,
      enableAnimations: true,
      showTraffic: true,
      showLabels: true,
      ...options
    };

    this.codebase = null;
    this.districtLayout = new Map();
    this.buildingPositions = new Map();
    this.roadNetwork = [];
    
    console.log('🏗️ 3D City Renderer initialized');
  }

  async render(codebase, renderOptions = {}) {
    this.codebase = codebase;
    this.options = { ...this.options, ...renderOptions };

    console.log('🏙️ Building 3D city from codebase...');
    
    await this.canvas.initialize();
    
    // Generate city layout
    this.generateCityLayout();
    
    // Render city components
    await this.renderDistricts();
    await this.renderBuildings();
    await this.renderRoadNetwork();
    
    if (this.options.showTraffic) {
      await this.renderTraffic();
    }
    
    if (this.options.showLabels) {
      await this.renderLabels();
    }
    
    // Setup interactions
    this.setupInteractions();
    
    console.log('✨ 3D city rendering complete!');
    return this.canvas;
  }

  generateCityLayout() {
    console.log('📐 Generating city layout...');
    
    const modules = this.codebase.getNodesByType('module');
    const files = this.codebase.getNodesByType('file');
    
    // Calculate district positions in a grid layout
    const gridSize = Math.ceil(Math.sqrt(modules.length));
    let districtIndex = 0;
    
    modules.forEach(module => {
      const row = Math.floor(districtIndex / gridSize);
      const col = districtIndex % gridSize;
      
      const districtX = (col - gridSize / 2) * this.options.districtSpacing;
      const districtZ = (row - gridSize / 2) * this.options.districtSpacing;
      
      this.districtLayout.set(module.id, {
        module,
        centerX: districtX,
        centerZ: districtZ,
        buildings: [],
        bounds: { minX: districtX - 40, maxX: districtX + 40, minZ: districtZ - 40, maxZ: districtZ + 40 }
      });
      
      districtIndex++;
    });
    
    // Position buildings within districts
    files.forEach(file => {
      const parentModule = this.codebase.getParentNode(file.id);
      if (!parentModule || !this.districtLayout.has(parentModule.id)) {
        return;
      }
      
      const district = this.districtLayout.get(parentModule.id);
      const position = this.calculateBuildingPosition(file, district);
      
      this.buildingPositions.set(file.id, {
        file,
        x: position.x,
        z: position.z,
        district: district
      });
      
      district.buildings.push(file);
    });
  }

  calculateBuildingPosition(file, district) {
    const buildingsCount = district.buildings.length;
    const buildingsPerRow = Math.ceil(Math.sqrt(buildingsCount + 1));
    
    const row = Math.floor(buildingsCount / buildingsPerRow);
    const col = buildingsCount % buildingsPerRow;
    
    const offsetX = (col - buildingsPerRow / 2) * this.options.buildingSpacing;
    const offsetZ = (row - buildingsPerRow / 2) * this.options.buildingSpacing;
    
    return {
      x: district.centerX + offsetX,
      z: district.centerZ + offsetZ
    };
  }

  async renderDistricts() {
    console.log('🏘️ Rendering districts...');
    
    this.districtLayout.forEach((district, moduleId) => {
      // Create district base/platform
      const platformWidth = 80;
      const platformDepth = 80;
      const platformHeight = 2;
      
      this.canvas.drawBuilding({
        x: district.centerX,
        y: 0,
        width: platformWidth,
        height: platformHeight,
        depth: platformDepth,
        language: 'platform',
        complexity: 0,
        linesOfCode: 0,
        filePath: `district-${district.module.data.name}`,
        metadata: {
          type: 'district',
          moduleName: district.module.data.name,
          fileCount: district.buildings.length
        }
      });
      
      // Add district label
      if (this.options.showLabels) {
        // Labels would be implemented with Three.js text geometry or sprites
        this.addDistrictLabel(district);
      }
    });
  }

  async renderBuildings() {
    console.log('🏢 Rendering buildings...');
    
    this.buildingPositions.forEach((buildingData, fileId) => {
      const file = buildingData.file;
      const fileData = file.data;
      
      // Calculate building dimensions based on file metrics
      const linesOfCode = fileData.linesOfCode || 10;
      const complexity = fileData.complexity?.branches || 1;
      
      // Height based on lines of code (logarithmic scale for better visualization)
      const height = Math.max(
        this.options.minBuildingHeight,
        Math.min(
          this.options.maxBuildingHeight,
          Math.log(linesOfCode + 1) * 15
        )
      );
      
      // Width and depth based on complexity and file size
      const baseSize = Math.max(8, Math.min(20, Math.sqrt(linesOfCode) * 0.5));
      const width = baseSize + (complexity * 0.5);
      const depth = baseSize;
      
      // Get verification data for this file
      const verificationData = this.getFileVerificationData(file.id);
      
      this.canvas.drawBuilding({
        x: buildingData.x,
        y: 2, // On top of district platform
        width: width,
        height: height,
        depth: depth,
        language: fileData.language || 'unknown',
        complexity: complexity,
        linesOfCode: linesOfCode,
        filePath: fileData.path,
        verification: verificationData,
        metadata: {
          type: 'building',
          fileName: fileData.name,
          functions: fileData.functions || 0,
          classes: fileData.classes || 0,
          imports: fileData.imports?.length || 0,
          exports: fileData.exports?.length || 0
        }
      });
    });
  }

  /**
   * Get verification data for a file
   */
  getFileVerificationData(fileNodeId) {
    const verification = this.codebase?.data?.verification;
    if (!verification) {
      return null;
    }

    const fileNode = this.codebase.getNode(fileNodeId);
    if (!fileNode) return null;

    // Count functions in this file and their verification status
    const fileFunctions = fileNode.data.functions || [];
    let verifiedFunctions = 0;
    let totalContracts = 0;
    let hasFailures = false;

    for (const func of fileFunctions) {
      const funcVerification = verification.functions[func.id];
      if (funcVerification) {
        totalContracts += (funcVerification.contracts?.preconditions?.length || 0) + 
                         (funcVerification.contracts?.postconditions?.length || 0);
        
        if (funcVerification.verificationStatus === 'VERIFIED') {
          verifiedFunctions++;
        } else if (funcVerification.verificationStatus === 'FAILED') {
          hasFailures = true;
        }
      }
    }

    // Calculate overall file verification status
    let status = 'UNKNOWN';
    let trustScore = 0;
    
    if (fileFunctions.length > 0) {
      const verificationRate = verifiedFunctions / fileFunctions.length;
      if (hasFailures) {
        status = 'FAILED';
        trustScore = Math.max(0, verificationRate * 50);
      } else if (verifiedFunctions > 0) {
        status = 'VERIFIED';
        trustScore = 70 + (verificationRate * 30);
      } else if (totalContracts > 0) {
        status = 'NO_VERIFICATION';
        trustScore = 30;
      } else {
        status = 'NO_CONTRACTS';
        trustScore = 20;
      }
    }

    // Generate visual effects
    const effects = [];
    if (status === 'VERIFIED') {
      effects.push('glow_green', 'verified_badge');
      if (totalContracts > 0) effects.push('contract_foundation');
    } else if (status === 'FAILED') {
      effects.push('warning_flicker', 'structural_damage');
    } else if (totalContracts > 0) {
      effects.push('contract_foundation');
    }

    return {
      status,
      trustScore: Math.round(trustScore),
      hasContracts: totalContracts > 0,
      functionsVerified: verifiedFunctions,
      totalFunctions: fileFunctions.length,
      totalContracts,
      effects
    };
  }

  async renderRoadNetwork() {
    console.log('🛣️ Rendering road network...');
    
    // Get dependency edges
    const dependencies = this.codebase.getEdgesByType('depends_on');
    
    dependencies.forEach(edge => {
      const sourcePos = this.buildingPositions.get(edge.sourceId);
      const targetPos = this.buildingPositions.get(edge.targetId);
      
      if (sourcePos && targetPos) {
        this.canvas.drawRoad({
          x1: sourcePos.x,
          y1: sourcePos.z,
          x2: targetPos.x,
          y2: targetPos.z,
          width: this.options.roadWidth,
          type: 'dependency'
        });
        
        this.roadNetwork.push({
          from: sourcePos,
          to: targetPos,
          edge: edge
        });
      }
    });
    
    // Add main streets between districts
    this.renderMainStreets();
  }

  renderMainStreets() {
    const districts = Array.from(this.districtLayout.values());
    
    // Connect nearby districts with main streets
    for (let i = 0; i < districts.length; i++) {
      for (let j = i + 1; j < districts.length; j++) {
        const distA = districts[i];
        const distB = districts[j];
        
        const distance = Math.sqrt(
          (distA.centerX - distB.centerX) ** 2 + 
          (distA.centerZ - distB.centerZ) ** 2
        );
        
        // Connect districts that are close enough
        if (distance < this.options.districtSpacing * 1.5) {
          this.canvas.drawRoad({
            x1: distA.centerX,
            y1: distA.centerZ,
            x2: distB.centerX,
            y2: distB.centerZ,
            width: this.options.roadWidth * 1.5,
            type: 'main_street'
          });
        }
      }
    }
  }

  async renderTraffic() {
    console.log('🚗 Rendering traffic...');
    
    // Traffic would represent function calls, data flow, etc.
    // This could be animated particles moving along roads
    const functionCalls = this.codebase.getEdgesByType('calls');
    
    functionCalls.forEach(call => {
      // Add animated traffic between buildings based on function calls
      this.addTrafficAnimation(call);
    });
  }

  addTrafficAnimation(call) {
    // Implementation would create animated particles/vehicles
    // moving along roads to represent function calls/data flow
    console.log(`🚗 Traffic from ${call.sourceId} to ${call.targetId}`);
  }

  async renderLabels() {
    console.log('🏷️ Adding labels...');
    
    // Add labels for important buildings and districts
    this.districtLayout.forEach(district => {
      this.addDistrictLabel(district);
    });
    
    // Add labels for significant buildings
    this.buildingPositions.forEach((buildingData, fileId) => {
      if (buildingData.file.data.linesOfCode > 500) {
        this.addBuildingLabel(buildingData);
      }
    });
  }

  addDistrictLabel(district) {
    // Implementation would create 3D text or sprite labels
    console.log(`🏷️ Label for district: ${district.module.data.name}`);
  }

  addBuildingLabel(buildingData) {
    // Implementation would create building name labels
    console.log(`🏷️ Label for building: ${buildingData.file.data.name}`);
  }

  setupInteractions() {
    console.log('🎮 Setting up interactions...');
    
    // Building click interactions
    this.canvas.onBuildingClick((buildingData) => {
      this.onBuildingSelected(buildingData);
    });
    
    // Keyboard shortcuts for navigation
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event) => {
        switch(event.key) {
          case 't':
            this.startHelicopterTour();
            break;
          case 'o':
            this.showOverview();
            break;
          case 'f':
            this.focusOnLargestBuilding();
            break;
        }
      });
    }
  }

  onBuildingSelected(buildingData) {
    console.log('🏢 Building selected:', buildingData);
    
    // Show building information panel
    this.showBuildingDetails(buildingData);
    
    // Fly camera to building
    const building = this.canvas.buildings.get(buildingData.filePath);
    if (building) {
      this.canvas.flyToBuilding(building);
    }
  }

  showBuildingDetails(buildingData) {
    // Implementation would show a UI panel with building/file details
    console.log('📊 Building Details:', {
      file: buildingData.filePath,
      language: buildingData.language,
      linesOfCode: buildingData.linesOfCode,
      complexity: buildingData.complexity,
      functions: buildingData.functions,
      classes: buildingData.classes
    });
  }

  startHelicopterTour() {
    console.log('🚁 Starting helicopter tour...');
    this.canvas.helicopterTour();
  }

  showOverview() {
    console.log('🌐 Showing city overview...');
    // Move camera to overview position
    const overviewPosition = { x: 300, y: 400, z: 300 };
    const centerTarget = { x: 0, y: 0, z: 0 };
    this.canvas.animateCamera(overviewPosition, centerTarget);
  }

  focusOnLargestBuilding() {
    console.log('🏗️ Focusing on largest building...');
    
    let largestBuilding = null;
    let maxLines = 0;
    
    this.buildingPositions.forEach((buildingData) => {
      const lines = buildingData.file.data.linesOfCode || 0;
      if (lines > maxLines) {
        maxLines = lines;
        largestBuilding = buildingData;
      }
    });
    
    if (largestBuilding) {
      const building = this.canvas.buildings.get(largestBuilding.file.data.path);
      if (building) {
        this.canvas.flyToBuilding(building);
      }
    }
  }

  // Exploration helpers
  exploreDistrict(districtName) {
    const district = Array.from(this.districtLayout.values())
      .find(d => d.module.data.name === districtName);
    
    if (district) {
      this.canvas.flyOverDistrict(districtName);
    }
  }

  searchBuilding(fileName) {
    const building = Array.from(this.buildingPositions.values())
      .find(b => b.file.data.name.includes(fileName));
    
    if (building) {
      const buildingMesh = this.canvas.buildings.get(building.file.data.path);
      if (buildingMesh) {
        this.canvas.flyToBuilding(buildingMesh);
      }
    }
  }

  // Analytics and insights
  getCityStats() {
    const stats = {
      districts: this.districtLayout.size,
      buildings: this.buildingPositions.size,
      roads: this.roadNetwork.length,
      totalLinesOfCode: 0,
      averageBuildingHeight: 0,
      languageDistribution: new Map()
    };
    
    this.buildingPositions.forEach((buildingData) => {
      const file = buildingData.file;
      stats.totalLinesOfCode += file.data.linesOfCode || 0;
      
      const language = file.data.language || 'unknown';
      stats.languageDistribution.set(
        language,
        (stats.languageDistribution.get(language) || 0) + 1
      );
    });
    
    stats.averageBuildingHeight = stats.totalLinesOfCode / stats.buildings;
    
    return stats;
  }

  getNavigationHelp() {
    return {
      mouse: {
        'Left click + drag': 'Rotate camera (helicopter view)',
        'Right click + drag': 'Pan camera',
        'Scroll wheel': 'Zoom in/out',
        'Click building': 'Select and inspect building'
      },
      keyboard: {
        'T': 'Start automatic helicopter tour',
        'O': 'Overview of entire city',
        'F': 'Focus on largest building'
      },
      navigation: {
        'Districts': 'Each module becomes a district with buildings (files)',
        'Buildings': 'Height = lines of code, Color = language, Width = complexity',
        'Roads': 'Gray roads = dependencies, Wider roads = main connections'
      }
    };
  }
}

module.exports = CityRenderer;