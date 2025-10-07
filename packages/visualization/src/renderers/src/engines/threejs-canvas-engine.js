/**
 * Three.js Canvas Engine - 3D City Visualization
 * Provides immersive 3D helicopter-view exploration of codebases
 */

const BaseCanvasEngine = require('./base-canvas-engine');

class ThreeJSCanvasEngine extends BaseCanvasEngine {
  constructor(options = {}) {
    super(options);
    
    this.options = {
      width: 1600,
      height: 1200,
      antialias: true,
      enableShadows: true,
      fogEnabled: true,
      ...options
    };

    // Detect server-side environment early
    this.isServerSide = (typeof window === 'undefined' || typeof THREE === 'undefined');
    
    // Three.js core components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // City components
    this.buildings = new Map();
    this.districts = new Map();
    this.roads = [];
    this.effects = [];
    this.ground = null;
    this.cityBounds = { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
    
    // Materials cache
    this.materials = new Map();
    this.geometries = new Map();
    
    // Event listeners tracking
    this.eventListeners = new Set();
    
    // Cleanup flag
    this.isDisposed = false;
    
    // Animation
    this.animationFrame = null;
    this.helicopterPath = null;
    this.isFlying = false;
    
    if (this.isServerSide) {
      console.log('🚁 Three.js 3D Canvas Engine initialized (server-side mode)');
    } else {
      console.log('🚁 Three.js 3D Canvas Engine initialized');
    }
  }

  async initialize() {
    if (typeof window === 'undefined' || typeof THREE === 'undefined') {
      // Server-side rendering fallback
      this.isServerSide = true;
      return this.initializeServerSide();
    }
    
    await this.loadThreeJS();
    this.initializeScene();
    this.initializeCamera();
    this.initializeRenderer();
    this.initializeControls();
    this.initializeLighting();
    this.initializeGround();
    this.initializeFog();
    
    this.startRenderLoop();
    
    console.log('🏙️ 3D City scene initialized');
  }

  async loadThreeJS() {
    // In a real implementation, this would dynamically load Three.js
    // For now, assume it's available globally or imported
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js library not available. Please include Three.js in your HTML.');
    }
    
    this.THREE = THREE;
  }

  initializeScene() {
    this.scene = new this.THREE.Scene();
    this.scene.background = new this.THREE.Color(0x87CEEB); // Sky blue
  }

  initializeCamera() {
    this.camera = new this.THREE.PerspectiveCamera(
      75, // Field of view
      this.options.width / this.options.height, // Aspect ratio
      1, // Near clipping plane
      5000 // Far clipping plane
    );
    
    // Start with helicopter view
    this.camera.position.set(200, 300, 400);
    this.camera.lookAt(0, 0, 0);
  }

  initializeRenderer() {
    this.renderer = new this.THREE.WebGLRenderer({ 
      antialias: this.options.antialias,
      alpha: true
    });
    
    this.renderer.setSize(this.options.width, this.options.height);
    this.renderer.shadowMap.enabled = this.options.enableShadows;
    this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
    
    // Add to DOM if container provided
    if (this.options.container) {
      this.options.container.appendChild(this.renderer.domElement);
    }
  }

  initializeControls() {
    // Helicopter-style controls for exploration
    if (this.THREE.OrbitControls) {
      this.controls = new this.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 50;
      this.controls.maxDistance = 2000;
      this.controls.maxPolarAngle = Math.PI / 2.2; // Prevent going below ground
      
      // Helicopter movement settings
      this.controls.enablePan = true;
      this.controls.panSpeed = 1.0;
      this.controls.rotateSpeed = 0.5;
      this.controls.zoomSpeed = 1.0;
    }
  }

  initializeLighting() {
    // Ambient light for overall illumination
    const ambientLight = new this.THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun) with shadows
    const directionalLight = new this.THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 1000, 300);
    directionalLight.castShadow = true;
    
    // Shadow camera setup for better quality
    directionalLight.shadow.camera.left = -1000;
    directionalLight.shadow.camera.right = 1000;
    directionalLight.shadow.camera.top = 1000;
    directionalLight.shadow.camera.bottom = -1000;
    directionalLight.shadow.camera.near = 500;
    directionalLight.shadow.camera.far = 2000;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    this.scene.add(directionalLight);

    // Additional lighting for atmosphere
    const hemisphereLight = new this.THREE.HemisphereLight(0x87CEEB, 0x362D1D, 0.3);
    this.scene.add(hemisphereLight);
  }

  initializeGround() {
    // Create a large ground plane - store geometry and material for proper disposal
    const groundGeometry = new this.THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new this.THREE.MeshLambertMaterial({ 
      color: 0x2d5016,
      transparent: true,
      opacity: 0.8
    });
    
    // Store in caches for disposal
    this.geometries.set('ground-plane', groundGeometry);
    this.materials.set('ground-material', groundMaterial);
    
    this.ground = new this.THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.isGround = true;
    this.scene.add(this.ground);

    // Add grid lines for reference
    const gridHelper = new this.THREE.GridHelper(2000, 50, 0x444444, 0x444444);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.2;
    gridHelper.userData.isGrid = true;
    this.scene.add(gridHelper);
    
    // Store grid references for disposal
    this.effects.push(gridHelper);
  }

  initializeFog() {
    if (this.options.fogEnabled) {
      this.scene.fog = new this.THREE.Fog(0x87CEEB, 500, 3000);
    }
  }

  createBuildingMaterial(language, complexity, linesOfCode) {
    const materialKey = `${language}-${Math.floor(complexity/10)}-${Math.floor(linesOfCode/100)}`;
    
    if (this.materials.has(materialKey)) {
      return this.materials.get(materialKey);
    }

    // Color based on language
    const languageColors = {
      javascript: 0xF7DF1E,
      typescript: 0x3178C6,
      python: 0x3776AB,
      java: 0xED8B00,
      go: 0x00ADD8,
      rust: 0xCE422B,
      csharp: 0x239120,
      php: 0x777BB4,
      ruby: 0xCC342D,
      cpp: 0x00599C,
      c: 0x555555,
      default: 0x888888
    };

    let baseColor = languageColors[language] || languageColors.default;
    
    // Modify color based on complexity
    if (complexity > 20) {
      baseColor = this.darkenColor(baseColor, 0.3); // Darker for high complexity
    } else if (complexity > 10) {
      baseColor = this.darkenColor(baseColor, 0.15);
    }

    const material = new this.THREE.MeshPhongMaterial({ 
      color: baseColor,
      shininess: 30,
      specular: 0x222222
    });

    this.materials.set(materialKey, material);
    return material;
  }

  darkenColor(color, factor) {
    const r = ((color >> 16) & 0xFF) * (1 - factor);
    const g = ((color >> 8) & 0xFF) * (1 - factor);
    const b = (color & 0xFF) * (1 - factor);
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  drawBuilding(options) {
    if (this.isDisposed) return null;
    if (this.isServerSide) return null;
    
    const {
      x = 0,
      y = 0,
      width = 10,
      height = 20,
      depth = 10,
      language = 'default',
      complexity = 1,
      linesOfCode = 100,
      filePath = '',
      metadata = {},
      verification = null
    } = options;

    // Create or reuse building geometry
    const geometryKey = `box-${width}-${height}-${depth}`;
    let geometry = this.geometries.get(geometryKey);
    if (!geometry) {
      geometry = new this.THREE.BoxGeometry(width, height, depth);
      this.geometries.set(geometryKey, geometry);
    }
    const material = this.createVerificationMaterial(language, complexity, linesOfCode, verification);
    
    const building = new this.THREE.Mesh(geometry, material);
    building.position.set(x, height / 2, y); // y becomes z in 3D
    building.castShadow = true;
    building.receiveShadow = true;

    // Store metadata for interaction
    building.userData = {
      filePath,
      language,
      complexity,
      linesOfCode,
      verification,
      ...metadata
    };

    // Add roof detail for larger buildings
    if (height > 50) {
      const roofGeometryKey = `cone-${width * 0.6}-${height * 0.1}`;
      let roofGeometry = this.geometries.get(roofGeometryKey);
      if (!roofGeometry) {
        roofGeometry = new this.THREE.ConeGeometry(width * 0.6, height * 0.1, 8);
        this.geometries.set(roofGeometryKey, roofGeometry);
      }
      
      const roofMaterialKey = 'roof-standard';
      let roofMaterial = this.materials.get(roofMaterialKey);
      if (!roofMaterial) {
        roofMaterial = new this.THREE.MeshPhongMaterial({ color: 0x654321 });
        this.materials.set(roofMaterialKey, roofMaterial);
      }
      
      const roof = new this.THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.set(x, height + (height * 0.05), y);
      roof.castShadow = true;
      roof.userData.isRoof = true;
      roof.userData.parentBuilding = filePath;
      this.scene.add(roof);
      
      // Track for cleanup
      this.effects.push(roof);
    }

    // Add windows for detail
    this.addBuildingWindows(building, width, height, depth);

    // Add verification-specific visual effects
    if (verification) {
      this.addVerificationEffects(building, verification, x, y, width, height, depth);
    }

    this.scene.add(building);
    this.buildings.set(filePath, building);

    return building;
  }

  addBuildingWindows(building, width, height, depth) {
    // Get or create shared window material
    const windowMaterialKey = 'window-standard';
    let windowMaterial = this.materials.get(windowMaterialKey);
    if (!windowMaterial) {
      windowMaterial = new this.THREE.MeshBasicMaterial({ 
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.6
      });
      this.materials.set(windowMaterialKey, windowMaterial);
    }

    // Add windows based on building size
    const windowSize = Math.min(width, depth) * 0.1;
    const windowsPerFloor = Math.floor(height / 15);
    
    // Get or create shared window geometry
    const windowGeometryKey = `window-${windowSize}`;
    let windowGeometry = this.geometries.get(windowGeometryKey);
    if (!windowGeometry) {
      windowGeometry = new this.THREE.PlaneGeometry(windowSize, windowSize);
      this.geometries.set(windowGeometryKey, windowGeometry);
    }

    for (let floor = 0; floor < windowsPerFloor; floor++) {
      const y = (floor * 15) - (height / 2) + 7;
      
      // Front face windows
      for (let i = 0; i < Math.floor(width / 8); i++) {
        const window = new this.THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set((i * 8) - (width / 2) + 4, y, (depth / 2) + 0.1);
        window.userData.isWindow = true;
        building.add(window);
      }
      
      // Side face windows
      for (let i = 0; i < Math.floor(depth / 8); i++) {
        const window = new this.THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set((width / 2) + 0.1, y, (i * 8) - (depth / 2) + 4);
        window.rotation.y = Math.PI / 2;
        window.userData.isWindow = true;
        building.add(window);
      }
    }
  }

  drawRoad(options) {
    if (this.isDisposed) return null;
    if (this.isServerSide) return null;
    
    const {
      x1, y1, x2, y2,
      width = 4,
      type = 'dependency'
    } = options;

    // Create road geometry - use shared geometries for common sizes
    const roadLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const roadGeometryKey = `road-${Math.round(roadLength/10)*10}-${width}`;
    let roadGeometry = this.geometries.get(roadGeometryKey);
    if (!roadGeometry) {
      roadGeometry = new this.THREE.PlaneGeometry(roadLength, width);
      this.geometries.set(roadGeometryKey, roadGeometry);
    }
    
    const roadColor = type === 'dependency' ? 0x666666 : 0x888888;
    const roadMaterialKey = `road-${roadColor}`;
    let roadMaterial = this.materials.get(roadMaterialKey);
    if (!roadMaterial) {
      roadMaterial = new this.THREE.MeshLambertMaterial({ 
        color: roadColor,
        transparent: true,
        opacity: 0.8
      });
      this.materials.set(roadMaterialKey, roadMaterial);
    }
    
    const road = new this.THREE.Mesh(roadGeometry, roadMaterial);
    
    // Position and rotate road
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    road.position.set(midX, 0.1, midY);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    
    this.scene.add(road);
    this.roads.push(road);

    // Add road markings
    this.addRoadMarkings(road, roadLength, width);
  }

  addRoadMarkings(road, length, width) {
    // Get or create shared marking material
    const markingMaterialKey = 'road-marking';
    let markingMaterial = this.materials.get(markingMaterialKey);
    if (!markingMaterial) {
      markingMaterial = new this.THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      this.materials.set(markingMaterialKey, markingMaterial);
    }
    
    const markingWidth = width * 0.1;
    const markingLength = length * 0.1;
    
    // Get or create shared marking geometry
    const markingGeometryKey = `marking-${markingLength}-${markingWidth}`;
    let markingGeometry = this.geometries.get(markingGeometryKey);
    if (!markingGeometry) {
      markingGeometry = new this.THREE.PlaneGeometry(markingLength, markingWidth);
      this.geometries.set(markingGeometryKey, markingGeometry);
    }
    
    // Center line
    for (let i = 0; i < length; i += markingLength * 3) {
      const markingMesh = new this.THREE.Mesh(markingGeometry, markingMaterial);
      markingMesh.position.set(i - (length / 2), 0.01, 0);
      markingMesh.userData.isMarking = true;
      road.add(markingMesh);
    }
  }

  // Helicopter navigation methods
  flyToBuilding(building) {
    if (!building || !this.controls) return;

    const targetPosition = building.position.clone();
    targetPosition.y += 100; // Hover above building
    
    this.animateCamera(targetPosition, building.position);
  }

  flyOverDistrict(districtName) {
    const district = this.districts.get(districtName);
    if (!district) return;

    // Calculate district center and bounds
    const bounds = this.calculateDistrictBounds(district);
    const center = bounds.center;
    const size = bounds.size;
    
    // Set camera height based on district size
    const height = Math.max(size.x, size.z) + 100;
    const targetPosition = new this.THREE.Vector3(center.x, height, center.z + size.z);
    
    this.animateCamera(targetPosition, center);
  }

  helicopterTour() {
    if (this.isFlying) return;
    
    this.isFlying = true;
    const waypoints = this.generateTourWaypoints();
    this.flyThroughWaypoints(waypoints);
  }

  generateTourWaypoints() {
    const waypoints = [];
    const districts = Array.from(this.districts.values());
    
    // Start with overview
    waypoints.push({
      position: new this.THREE.Vector3(300, 400, 300),
      target: new this.THREE.Vector3(0, 0, 0),
      duration: 2000
    });
    
    // Visit each district
    districts.forEach(district => {
      const bounds = this.calculateDistrictBounds(district);
      waypoints.push({
        position: new this.THREE.Vector3(
          bounds.center.x + 50,
          bounds.size.y + 80,
          bounds.center.z + 50
        ),
        target: bounds.center,
        duration: 3000
      });
    });
    
    // End with wide overview
    waypoints.push({
      position: new this.THREE.Vector3(-300, 500, 400),
      target: new this.THREE.Vector3(0, 0, 0),
      duration: 2000
    });
    
    return waypoints;
  }

  animateCamera(targetPosition, targetLookAt, duration = 2000) {
    if (!this.camera || !this.controls) return;

    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing
      const easeProgress = this.easeInOutCubic(progress);
      
      // Interpolate camera position
      this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      
      // Interpolate look-at target
      this.controls.target.lerpVectors(startTarget, targetLookAt, easeProgress);
      this.controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isFlying = false;
      }
    };
    
    animate();
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  startRenderLoop() {
    const render = () => {
      this.animationFrame = requestAnimationFrame(render);
      
      if (this.controls) {
        this.controls.update();
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    
    render();
  }

  stopRenderLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Interaction methods
  onBuildingClick(callback) {
    if (!this.renderer || this.isDisposed || this.isServerSide) return;

    const raycaster = new this.THREE.Raycaster();
    const mouse = new this.THREE.Vector2();
    
    const clickHandler = (event) => {
      if (this.isDisposed) return;
      
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(Array.from(this.buildings.values()));
      
      if (intersects.length > 0) {
        const building = intersects[0].object;
        callback(building.userData);
      }
    };
    
    this.renderer.domElement.addEventListener('click', clickHandler);
    this.eventListeners.add({ element: this.renderer.domElement, event: 'click', handler: clickHandler });
  }

  // Utility methods
  calculateDistrictBounds(district) {
    // Implementation would calculate bounds of buildings in district
    return {
      center: new this.THREE.Vector3(0, 0, 0),
      size: new this.THREE.Vector3(100, 50, 100)
    };
  }

  getDOMElement() {
    return this.renderer ? this.renderer.domElement : null;
  }

  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Create material based on verification status
   */
  createVerificationMaterial(language, complexity, linesOfCode, verification) {
    let baseColor = this.getLanguageColor(language);
    
    // Modify color based on verification status
    if (verification && verification.status) {
      switch (verification.status) {
        case 'VERIFIED':
          baseColor = 0x00ff00; // Green for verified
          break;
        case 'FAILED':
          baseColor = 0xff4444; // Red for failed
          break;
        case 'NO_VERIFICATION':
          baseColor = 0xffaa00; // Orange for contracts but no verification
          break;
        case 'NO_CONTRACTS':
          baseColor = 0x888888; // Gray for no contracts
          break;
        default:
          baseColor = 0x666666; // Dark gray for unknown
      }
      
      // Adjust brightness based on trust score
      if (verification.trustScore) {
        const factor = verification.trustScore / 100;
        baseColor = this.adjustColorBrightness(baseColor, factor * 0.5);
      }
    }
    
    const material = new this.THREE.MeshPhongMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.8 + (complexity * 0.1),
      shininess: verification?.trustScore || 30
    });
    
    // Note: materials.add() doesn't exist, this was a bug. Materials are tracked in the cache.
    return material;
  }

  /**
   * Add verification-specific visual effects
   */
  addVerificationEffects(building, verification, x, y, width, height, depth) {
    const effects = verification.effects || [];
    
    // Green glow for verified buildings
    if (effects.includes('glow_green')) {
      this.addGlowEffect(building, 0x00ff00, x, y, width, height, depth);
    }
    
    // Contract foundation for buildings with contracts
    if (effects.includes('contract_foundation')) {
      this.addContractFoundation(x, y, width, depth);
    }
    
    // Verification badge
    if (effects.includes('verified_badge')) {
      this.addVerificationBadge(x, y + height, width);
    }
    
    // Trust score indicator
    if (verification.trustScore) {
      this.addTrustScoreIndicator(x, y, verification.trustScore, height);
    }
  }

  /**
   * Add glowing effect around building
   */
  addGlowEffect(building, color, x, y, width, height, depth) {
    const glowGeometryKey = `glow-${width * 1.1}-${height * 1.1}-${depth * 1.1}`;
    let glowGeometry = this.geometries.get(glowGeometryKey);
    if (!glowGeometry) {
      glowGeometry = new this.THREE.BoxGeometry(width * 1.1, height * 1.1, depth * 1.1);
      this.geometries.set(glowGeometryKey, glowGeometry);
    }
    
    const glowMaterialKey = `glow-${color}`;
    let glowMaterial = this.materials.get(glowMaterialKey);
    if (!glowMaterial) {
      glowMaterial = new this.THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.2,
        blending: this.THREE.AdditiveBlending
      });
      this.materials.set(glowMaterialKey, glowMaterial);
    }
    
    const glow = new this.THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(x, height / 2, y);
    glow.userData.isEffect = true;
    glow.userData.effectType = 'glow';
    this.scene.add(glow);
    this.effects.push(glow);
  }

  /**
   * Add contract foundation
   */
  addContractFoundation(x, y, width, depth) {
    const foundationGeometryKey = `foundation-${width * 1.2}-${depth * 1.2}`;
    let foundationGeometry = this.geometries.get(foundationGeometryKey);
    if (!foundationGeometry) {
      foundationGeometry = new this.THREE.BoxGeometry(width * 1.2, 2, depth * 1.2);
      this.geometries.set(foundationGeometryKey, foundationGeometry);
    }
    
    const foundationMaterialKey = 'contract-foundation';
    let foundationMaterial = this.materials.get(foundationMaterialKey);
    if (!foundationMaterial) {
      foundationMaterial = new this.THREE.MeshPhongMaterial({
        color: 0x4169E1, // Royal blue for contracts
        transparent: true,
        opacity: 0.7
      });
      this.materials.set(foundationMaterialKey, foundationMaterial);
    }
    
    const foundation = new this.THREE.Mesh(foundationGeometry, foundationMaterial);
    foundation.position.set(x, -1, y); // Below ground level
    foundation.castShadow = true;
    foundation.userData.isEffect = true;
    foundation.userData.effectType = 'foundation';
    this.scene.add(foundation);
    this.effects.push(foundation);
  }

  /**
   * Add verification badge (floating icon)
   */
  addVerificationBadge(x, y, width) {
    const badgeGeometryKey = `badge-sphere-${width * 0.1}`;
    let badgeGeometry = this.geometries.get(badgeGeometryKey);
    if (!badgeGeometry) {
      badgeGeometry = new this.THREE.SphereGeometry(width * 0.1, 8, 8);
      this.geometries.set(badgeGeometryKey, badgeGeometry);
    }
    
    const badgeMaterialKey = 'verification-badge';
    let badgeMaterial = this.materials.get(badgeMaterialKey);
    if (!badgeMaterial) {
      badgeMaterial = new this.THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8
      });
      this.materials.set(badgeMaterialKey, badgeMaterial);
    }
    
    const badge = new this.THREE.Mesh(badgeGeometry, badgeMaterial);
    badge.position.set(x + width * 0.4, y + 5, y + width * 0.4);
    badge.userData.isEffect = true;
    badge.userData.effectType = 'badge';
    this.scene.add(badge);
    this.effects.push(badge);
  }

  /**
   * Add trust score indicator as floating bar
   */
  addTrustScoreIndicator(x, y, trustScore, buildingHeight) {
    const barWidth = 8;
    const barHeight = (trustScore / 100) * 20;
    
    const barGeometryKey = `trust-bar-${barHeight}`;
    let barGeometry = this.geometries.get(barGeometryKey);
    if (!barGeometry) {
      barGeometry = new this.THREE.BoxGeometry(1, barHeight, 1);
      this.geometries.set(barGeometryKey, barGeometry);
    }
    
    let barColor = 0xff0000; // Red for low trust
    if (trustScore > 70) barColor = 0x00ff00; // Green for high trust
    else if (trustScore > 40) barColor = 0xffaa00; // Orange for medium trust
    
    const barMaterialKey = `trust-bar-${barColor}`;
    let barMaterial = this.materials.get(barMaterialKey);
    if (!barMaterial) {
      barMaterial = new this.THREE.MeshPhongMaterial({ color: barColor });
      this.materials.set(barMaterialKey, barMaterial);
    }
    
    const bar = new this.THREE.Mesh(barGeometry, barMaterial);
    bar.position.set(x + barWidth, buildingHeight + barHeight / 2 + 5, y);
    bar.userData.isEffect = true;
    bar.userData.effectType = 'trustBar';
    this.scene.add(bar);
    this.effects.push(bar);
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    
    console.log('🧹 Starting Three.js Canvas Engine disposal...');
    
    // Stop render loop first
    this.stopRenderLoop();
    
    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
    
    // Clear buildings from scene and dispose their children
    this.buildings.forEach((building, filePath) => {
      this.removeBuildingFromScene(building);
    });
    this.buildings.clear();
    
    // Clear roads
    this.roads.forEach(road => {
      this.scene.remove(road);
      // Children (markings) are disposed with the road
    });
    this.roads.length = 0;
    
    // Clear effects
    this.effects.forEach(effect => {
      this.scene.remove(effect);
    });
    this.effects.length = 0;
    
    // Clear districts
    this.districts.clear();
    
    // Dispose of cached geometries
    this.geometries.forEach(geometry => {
      geometry.dispose();
    });
    this.geometries.clear();
    
    // Dispose of cached materials
    this.materials.forEach(material => {
      material.dispose();
    });
    this.materials.clear();
    
    // Clear scene
    if (this.scene) {
      // Remove remaining objects from scene
      while (this.scene.children.length > 0) {
        const object = this.scene.children[0];
        this.scene.remove(object);
        
        // Dispose geometry and material if present
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    }
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    
    // Dispose controls
    if (this.controls && this.controls.dispose) {
      this.controls.dispose();
    }
    
    // Clear references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.ground = null;
    
    console.log('✅ Three.js Canvas Engine disposal complete');
  }
  
  /**
   * Remove a building and all its children from the scene
   */
  removeBuildingFromScene(building) {
    if (!building || !this.scene) return;
    
    // Remove building and all its children (windows, etc.)
    this.scene.remove(building);
    
    // Dispose building's children geometries and materials
    building.traverse(child => {
      if (child.geometry) {
        // Don't dispose shared geometries - they're managed in this.geometries
        // Only dispose if it's not in our cache
        if (!Array.from(this.geometries.values()).includes(child.geometry)) {
          child.geometry.dispose();
        }
      }
      if (child.material) {
        // Don't dispose shared materials - they're managed in this.materials
        if (!Array.from(this.materials.values()).includes(child.material)) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
  
  /**
   * Remove specific building by file path
   */
  removeBuilding(filePath) {
    const building = this.buildings.get(filePath);
    if (building) {
      this.removeBuildingFromScene(building);
      this.buildings.delete(filePath);
      
      // Also remove related effects
      this.effects = this.effects.filter(effect => {
        if (effect.userData.parentBuilding === filePath) {
          this.scene.remove(effect);
          return false;
        }
        return true;
      });
    }
  }
  
  /**
   * Update building - remove old and add new
   */
  updateBuilding(filePath, options) {
    this.removeBuilding(filePath);
    return this.drawBuilding({ ...options, filePath });
  }
  
  /**
   * Clear all city elements for rebuild
   */
  clearCity() {
    // Remove all buildings
    this.buildings.forEach((building, filePath) => {
      this.removeBuildingFromScene(building);
    });
    this.buildings.clear();
    
    // Remove all roads
    this.roads.forEach(road => {
      this.scene.remove(road);
    });
    this.roads.length = 0;
    
    // Remove all effects
    this.effects.forEach(effect => {
      this.scene.remove(effect);
    });
    this.effects.length = 0;
    
    // Clear districts
    this.districts.clear();
    
    console.log('🏙️ City cleared for rebuild');
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    if (this.isServerSide) {
      return { isServerSide: true, totalObjects: 0 };
    }
    return {
      buildings: this.buildings.size,
      roads: this.roads.length,
      effects: this.effects.length,
      districts: this.districts.size,
      cachedMaterials: this.materials.size,
      cachedGeometries: this.geometries.size,
      eventListeners: this.eventListeners.size,
      sceneChildren: this.scene ? this.scene.children.length : 0,
      isDisposed: this.isDisposed,
      totalObjects: this.buildings.size + this.roads.length + this.effects.length + (this.scene ? this.scene.children.length : 0)
    };
  }
  
  /**
   * Log memory usage to console
   */
  logMemoryUsage() {
    const stats = this.getMemoryStats();
    console.log('🧠 Three.js Memory Usage:', stats);
    
    if (stats.totalObjects > 1000) {
      console.warn('⚠️ High object count detected. Consider calling clearCity() or dispose()');
    }
    
    return stats;
  }

  // Server-side fallback
  initializeServerSide() {
    console.log('⚠️  Three.js not available server-side, using fallback');
    this.isServerSide = true;
  }

  // Required base class methods
  clear() {
    if (this.isServerSide) return;
    
    this.clearCity();
    
    // Reset camera to default position
    if (this.camera) {
      this.camera.position.set(200, 300, 400);
      this.camera.lookAt(0, 0, 0);
    }
    
    // Reset controls
    if (this.controls) {
      this.controls.reset();
    }
    
    console.log('🧹 Three.js canvas cleared');
  }

  drawRectangle(options) {
    if (this.isServerSide) return null;
    
    // Convert 2D rectangle to 3D building
    const { x, y, width, height, fillColor, metadata = {} } = options;
    
    return this.drawBuilding({
      x: x,
      y: y,
      width: width,
      height: height || 10, // Default building height
      depth: width, // Square footprint
      ...metadata
    });
  }

  drawCircle(options) {
    if (this.isServerSide) return null;
    
    const { x, y, radius, fillColor = 0x888888 } = options;
    
    const geometry = new this.THREE.CylinderGeometry(radius, radius, 2, 16);
    const material = new this.THREE.MeshPhongMaterial({ color: fillColor });
    
    const cylinder = new this.THREE.Mesh(geometry, material);
    cylinder.position.set(x, 1, y);
    cylinder.userData.isCircle = true;
    
    this.scene.add(cylinder);
    this.effects.push(cylinder);
    
    return cylinder;
  }

  drawLine(options) {
    if (this.isServerSide) return null;
    
    const { x1, y1, x2, y2, strokeColor = 0x666666, strokeWidth = 2 } = options;
    
    return this.drawRoad({
      x1, y1, x2, y2,
      width: strokeWidth,
      type: 'line'
    });
  }

  drawPolygon(options) {
    if (this.isServerSide) return null;
    
    const { points, fillColor = 0x888888, height = 1 } = options;
    
    // Create shape from points
    const shape = new this.THREE.Shape();
    if (points && points.length > 0) {
      shape.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
      }
    }
    
    const geometry = new this.THREE.ExtrudeGeometry(shape, { depth: height });
    const material = new this.THREE.MeshPhongMaterial({ color: fillColor });
    
    const polygon = new this.THREE.Mesh(geometry, material);
    polygon.rotation.x = -Math.PI / 2; // Lay flat
    polygon.userData.isPolygon = true;
    
    this.scene.add(polygon);
    this.effects.push(polygon);
    
    return polygon;
  }

  drawText(options) {
    if (this.isServerSide) return null;
    
    const { x, y, text, fontSize = 12, fillColor = 0x000000 } = options;
    
    // For now, create a simple label sphere (text rendering in Three.js requires additional setup)
    const geometry = new this.THREE.SphereGeometry(fontSize / 4, 8, 8);
    const material = new this.THREE.MeshBasicMaterial({ color: fillColor });
    
    const textMesh = new this.THREE.Mesh(geometry, material);
    textMesh.position.set(x, fontSize, y);
    textMesh.userData.isText = true;
    textMesh.userData.text = text;
    
    this.scene.add(textMesh);
    this.effects.push(textMesh);
    
    return textMesh;
  }

  drawPath(options) {
    if (this.isServerSide) return null;
    
    const { points, strokeColor = 0x666666, strokeWidth = 2 } = options;
    
    if (!points || points.length < 2) return null;
    
    const curve = new this.THREE.CatmullRomCurve3(
      points.map(p => new this.THREE.Vector3(p.x, 0.2, p.y))
    );
    
    const geometry = new this.THREE.TubeGeometry(curve, points.length * 2, strokeWidth / 2, 8, false);
    const material = new this.THREE.MeshPhongMaterial({ color: strokeColor });
    
    const path = new this.THREE.Mesh(geometry, material);
    path.userData.isPath = true;
    
    this.scene.add(path);
    this.effects.push(path);
    
    return path;
  }

  drawImage(options) {
    // Images in 3D context are complex - for now return null
    // This could be implemented as textures on planes
    console.warn('drawImage not yet implemented for Three.js engine');
    return null;
  }

  toDataURL() {
    if (this.isServerSide) {
      return 'data:text/plain;base64,VGhyZWUuanMgbm90IGF2YWlsYWJsZSBzZXJ2ZXItc2lkZQ==';
    }
    
    return this.renderer ? this.renderer.domElement.toDataURL() : '';
  }

  toBuffer() {
    if (this.isServerSide) {
      return Buffer.from('Three.js not available server-side');
    }
    
    const dataURL = this.toDataURL();
    if (!dataURL) return Buffer.alloc(0);
    
    // Convert data URL to buffer
    const base64 = dataURL.split(',')[1];
    return Buffer.from(base64, 'base64');
  }

  toHTML() {
    // Generate complete HTML page with the 3D viewer
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏙️ Topolop 3D City Viewer</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #87CEEB; font-family: Arial, sans-serif; }
        #container { width: 100vw; height: 100vh; position: relative; }
        #info { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 8px; z-index: 100; }
        #controls { position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 8px; z-index: 100; }
    </style>
</head>
<body>
    <div id="container">
        <div id="info">
            <h3>🏙️ Topolop 3D City</h3>
            <div>🏢 Buildings: <span id="buildingCount">0</span></div>
            <div>🛣️ Roads: <span id="roadCount">0</span></div>
            <div>📊 Performance: <span id="performance">Good</span></div>
        </div>
        <div id="controls">
            <strong>🎮 Controls:</strong><br>
            🖱️ Mouse: Orbit camera<br>
            🔍 Scroll: Zoom in/out<br>
            🔧 R: Reset view
        </div>
    </div>
    <script>
        // Three.js city viewer implementation would go here
        console.log('🏙️ 3D City Viewer loaded');
    </script>
</body>
</html>`;
  }
}

module.exports = ThreeJSCanvasEngine;