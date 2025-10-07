/**
 * Three.js 3D City Renderer for Topolop
 * 
 * Renders city visualization data as an interactive 3D scene
 * with buildings, roads, and animated elements.
 */

class ThreeCityRenderer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.buildings = [];
    this.roads = [];
    this.animations = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedObject = null;
    this.tooltip = null;
    
    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 1000);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75, 
      this.container.clientWidth / this.container.clientHeight, 
      0.1, 
      2000
    );
    this.camera.position.set(50, 80, 50);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground

    // Lighting
    this.setupLighting();

    // Ground
    this.createGround();

    // Event listeners
    this.setupEventListeners();

    // Create tooltip
    this.createTooltip();

    // Start render loop
    this.animate();
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Point lights for ambiance
    const pointLight1 = new THREE.PointLight(0xffffff, 0.3, 100);
    pointLight1.position.set(-50, 30, -50);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.3, 100);
    pointLight2.position.set(50, 30, 50);
    this.scene.add(pointLight2);
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(400, 400);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x90EE90,
      transparent: true,
      opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { type: 'ground' };
    this.scene.add(ground);

    // Grid
    const gridHelper = new THREE.GridHelper(400, 40, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  setupEventListeners() {
    // Mouse events for interaction
    this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
    this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
    
    // Resize handling
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.padding = '10px';
    this.tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    this.tooltip.style.color = 'white';
    this.tooltip.style.borderRadius = '5px';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.display = 'none';
    this.tooltip.style.zIndex = '1000';
    this.tooltip.style.fontSize = '12px';
    this.tooltip.style.fontFamily = 'monospace';
    this.container.appendChild(this.tooltip);
  }

  renderCityVisualization(cityData) {
    console.log('🏙️ Rendering 3D city with:', {
      buildings: cityData.buildings.length,
      roads: cityData.roads.length,
      districts: cityData.districts.length
    });

    // Clear existing objects
    this.clearScene();

    // Render buildings
    this.renderBuildings(cityData.buildings);

    // Render roads
    this.renderRoads(cityData.roads);

    // Render districts
    if (cityData.districts && cityData.districts.length > 0) {
      this.renderDistricts(cityData.districts);
    }

    // Add city metadata display
    this.displayMetadata(cityData.metadata);

    console.log('✅ 3D city rendering complete!');
  }

  renderBuildings(buildings) {
    buildings.forEach((building, index) => {
      const buildingMesh = this.createBuildingMesh(building, index);
      this.buildings.push(buildingMesh);
      this.scene.add(buildingMesh);
    });
  }

  createBuildingMesh(building, index) {
    // Building dimensions
    const width = building.dimensions?.width || 4;
    const depth = building.dimensions?.depth || 4;
    const height = building.dimensions?.height || 8;

    // Building geometry
    const geometry = new THREE.BoxGeometry(width, height, depth);
    
    // Building material based on type and health
    const color = this.parseColor(building.color) || 0x4A90E2;
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position building
    const x = building.position?.x || (index % 10) * 8 - 40;
    const z = building.position?.z || Math.floor(index / 10) * 8 - 40;
    mesh.position.set(x, height / 2, z);

    // Shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store building data for interaction
    mesh.userData = {
      type: 'building',
      buildingData: building,
      originalColor: color
    };

    // Add glow effect for performance hotspots
    if (building.performance && building.performance.cpu > 0.7) {
      this.addGlowEffect(mesh, 0xff4444);
    }

    return mesh;
  }

  renderRoads(roads) {
    roads.forEach((road) => {
      const roadMesh = this.createRoadMesh(road);
      if (roadMesh) {
        this.roads.push(roadMesh);
        this.scene.add(roadMesh);
      }
    });
  }

  createRoadMesh(road) {
    // Create road as a connection between buildings
    const startBuilding = this.findBuildingById(road.start);
    const endBuilding = this.findBuildingById(road.end);

    if (!startBuilding && !endBuilding) {
      // Create a simple road segment
      return this.createSimpleRoad(road);
    }

    // Create connection line between buildings
    const points = [];
    
    if (startBuilding) {
      points.push(new THREE.Vector3(
        startBuilding.position.x,
        1,
        startBuilding.position.z
      ));
    }
    
    if (endBuilding) {
      points.push(new THREE.Vector3(
        endBuilding.position.x,
        1,
        endBuilding.position.z
      ));
    }

    if (points.length < 2) {
      return this.createSimpleRoad(road);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const color = this.parseColor(road.color) || 0x888888;
    const material = new THREE.LineBasicMaterial({ 
      color: color,
      linewidth: road.width || 2,
      transparent: true,
      opacity: road.opacity || 0.8
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
      type: 'road',
      roadData: road
    };

    // Add animation if specified
    if (road.animation && road.animation.type !== 'none') {
      this.addRoadAnimation(line, road.animation);
    }

    return line;
  }

  createSimpleRoad(road) {
    // Create a simple road segment
    const geometry = new THREE.PlaneGeometry(road.width || 2, 20);
    const color = this.parseColor(road.color) || 0x666666;
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      transparent: true,
      opacity: road.opacity || 0.6
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.1;
    
    // Random positioning for demonstration
    mesh.position.x = (Math.random() - 0.5) * 80;
    mesh.position.z = (Math.random() - 0.5) * 80;
    
    mesh.userData = {
      type: 'road',
      roadData: road
    };

    return mesh;
  }

  renderDistricts(districts) {
    districts.forEach((district) => {
      const districtMesh = this.createDistrictBoundary(district);
      if (districtMesh) {
        this.scene.add(districtMesh);
      }
    });
  }

  createDistrictBoundary(district) {
    if (!district.bounds) return null;

    const { width, height } = district.bounds;
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x4A90E2,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      district.position?.x || 0,
      0.05,
      district.position?.z || 0
    );
    mesh.rotation.x = -Math.PI / 2;

    mesh.userData = {
      type: 'district',
      districtData: district
    };

    return mesh;
  }

  findBuildingById(id) {
    return this.buildings.find(building => 
      building.userData.buildingData.id === id
    );
  }

  addGlowEffect(mesh, color) {
    // Add a subtle glow effect using a larger, transparent mesh
    const glowGeometry = mesh.geometry.clone();
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.multiplyScalar(1.1);
    mesh.add(glowMesh);
  }

  addRoadAnimation(roadMesh, animation) {
    // Add to animations array for update loop
    this.animations.push({
      mesh: roadMesh,
      animation: animation,
      time: 0
    });
  }

  displayMetadata(metadata) {
    // Create a simple stats display
    const statsDiv = document.createElement('div');
    statsDiv.style.position = 'absolute';
    statsDiv.style.top = '10px';
    statsDiv.style.left = '10px';
    statsDiv.style.background = 'rgba(0, 0, 0, 0.7)';
    statsDiv.style.color = 'white';
    statsDiv.style.padding = '10px';
    statsDiv.style.borderRadius = '5px';
    statsDiv.style.fontFamily = 'monospace';
    statsDiv.style.fontSize = '12px';
    statsDiv.style.zIndex = '1000';

    statsDiv.innerHTML = `
      <h4 style="margin: 0 0 10px 0;">📊 Topolop City Stats</h4>
      <div>Nodes: ${metadata.nodeCount || 0}</div>
      <div>Edges: ${metadata.edgeCount || 0}</div>
      <div>Files: ${metadata.statistics?.totalFiles || 0}</div>
      <div>Functions: ${metadata.statistics?.totalFunctions || 0}</div>
      <div>Sources: ${metadata.dataSourcesUsed?.join(', ') || 'N/A'}</div>
    `;

    this.container.appendChild(statsDiv);
  }

  parseColor(colorString) {
    if (!colorString) return null;
    if (colorString.startsWith('#')) {
      return parseInt(colorString.substring(1), 16);
    }
    return null;
  }

  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections
    const intersects = this.raycaster.intersectObjects([...this.buildings, ...this.roads], true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      
      // Show tooltip
      if (object.userData.type) {
        this.showTooltip(event, object.userData);
      }

      // Highlight object
      this.highlightObject(object);
    } else {
      this.hideTooltip();
      this.clearHighlight();
    }
  }

  onMouseClick(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([...this.buildings, ...this.roads], true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      this.selectObject(object);
    }
  }

  showTooltip(event, userData) {
    let content = '';
    
    if (userData.type === 'building' && userData.buildingData) {
      const building = userData.buildingData;
      content = `
        <strong>${building.subtype || 'Building'}</strong><br>
        Type: ${building.type}<br>
        ${building.tooltip?.title || 'File'}<br>
        Height: ${building.dimensions?.height?.toFixed(1) || 'N/A'}<br>
        Complexity: ${building.complexity || 'N/A'}
      `;
    } else if (userData.type === 'road' && userData.roadData) {
      const road = userData.roadData;
      content = `
        <strong>Road</strong><br>
        Type: ${road.subtype || road.type}<br>
        Width: ${road.width || 'N/A'}<br>
        Traffic: ${road.traffic || 'Low'}
      `;
    }

    if (content) {
      this.tooltip.innerHTML = content;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (event.clientX + 10) + 'px';
      this.tooltip.style.top = (event.clientY + 10) + 'px';
    }
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  highlightObject(object) {
    this.clearHighlight();
    
    if (object.material) {
      object.material.emissive = new THREE.Color(0x444444);
      this.selectedObject = object;
    }
  }

  clearHighlight() {
    if (this.selectedObject && this.selectedObject.material) {
      this.selectedObject.material.emissive = new THREE.Color(0x000000);
      this.selectedObject = null;
    }
  }

  selectObject(object) {
    console.log('Selected object:', object.userData);
    
    // Focus camera on object
    if (object.position) {
      this.controls.target.copy(object.position);
      this.controls.update();
    }
  }

  clearScene() {
    // Remove buildings
    this.buildings.forEach(building => {
      this.scene.remove(building);
    });
    this.buildings = [];

    // Remove roads
    this.roads.forEach(road => {
      this.scene.remove(road);
    });
    this.roads = [];

    // Clear animations
    this.animations = [];
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update controls
    this.controls.update();

    // Update animations
    this.updateAnimations();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  updateAnimations() {
    this.animations.forEach(animData => {
      animData.time += 0.016; // ~60fps
      
      const { mesh, animation } = animData;
      
      if (animation.type === 'pulse' && mesh.material) {
        const intensity = 0.5 + 0.3 * Math.sin(animData.time * 4);
        mesh.material.opacity = intensity;
      }
    });
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    if (this.controls) {
      this.controls.dispose();
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThreeCityRenderer;
} else {
  window.ThreeCityRenderer = ThreeCityRenderer;
}