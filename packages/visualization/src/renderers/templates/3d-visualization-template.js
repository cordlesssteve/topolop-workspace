#!/usr/bin/env node

/**
 * Topolop 3D Visualization Template System
 * Reusable template for generating consistent 3D visualizations
 */

class Topolop3DVisualizationTemplate {
  constructor(config = {}) {
    this.config = {
      // Server config
      port: config.port || 8080,
      title: config.title || 'Topolop 3D Explorer',
      subtitle: config.subtitle || '3D Architecture Visualization',
      
      // Visual config
      theme: {
        background: '#001122',
        panelBackground: 'rgba(0,0,0,0.9)',
        textColor: '#fff',
        accentColor: '#4CAF50',
        ...config.theme
      },
      
      // Scene config  
      scene: {
        cameraPosition: { x: 50, y: 40, z: 50 },
        lighting: {
          ambient: { color: 0x404040, intensity: 0.4 },
          directional: { color: 0xffffff, intensity: 0.8, position: { x: 100, y: 100, z: 50 } }
        },
        ground: { size: 1000, color: 0x002244 },
        shadows: true,
        ...config.scene
      },
      
      // Building config
      buildings: {
        shapes: {
          box: { color: 0x4488ff, geometry: 'BoxGeometry' },
          pyramid: { color: 0x4CAF50, geometry: 'ConeGeometry', sides: 4 },
          cylinder: { color: 0x9C27B0, geometry: 'CylinderGeometry', sides: 8 },
          cone: { color: 0xFF9800, geometry: 'ConeGeometry', sides: 8 }
        },
        positioning: config.buildings?.positioning || 'directory-clustered', // 'grid' | 'directory-clustered'
        heightRange: { min: 2, max: 10 },
        spacing: 3,
        ...config.buildings
      },
      
      // Road/relationship config
      roads: {
        types: {
          imports: { color: '#FF8800', style: 'solid', width: 1, label: 'Import Dependencies' },
          configuration: { color: '#9C27B0', style: 'dotted', width: 1, label: 'Configuration' },
          test: { color: '#4CAF50', style: 'dashed', width: 2, label: 'Test Relationships' },
          documentation: { color: '#FF9800', style: 'dash-dot', width: 1, label: 'Documentation' },
          build: { color: '#3F51B5', style: 'solid', width: 1, label: 'Build/Package' }
        },
        defaultType: 'imports',
        ...config.roads
      },
      
      // UI config
      ui: {
        showInfoPanel: true,
        showControlPanel: true,
        showStatistics: true,
        showLegend: true,
        showCollapsibleLegend: true,
        controls: [
          { type: 'road-toggles', label: 'Road Types' },
          { type: 'shape-toggle', label: 'Building Shapes' },
          { type: 'road-style', label: 'Road Pattern' }
        ],
        ...config.ui
      },
      
      // Keyboard controls config
      keyboard: {
        enabled: true,
        moveSpeed: 1.5,
        ...config.keyboard
      }
    };
  }

  /**
   * Generate HTML template for 3D visualization
   */
  generateHTML(data) {
    const { buildings, roads, districts } = data.cityVisualization;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.config.title}</title>
    <meta charset="utf-8">
    <style>
        ${this._generateCSS()}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    ${this._generateInfoPanel(data)}
    ${this._generateControlPanel()}
    ${this.config.ui.showCollapsibleLegend ? this._generateCollapsibleLegend(data) : ''}
    <div id="container"></div>
    
    <script>
        const data = ${JSON.stringify(data, null, 2)};
        const config = ${JSON.stringify(this.config, null, 2)};
        
        ${this._generateJavaScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Generate reusable CSS styles
   */
  _generateCSS() {
    const { theme } = this.config;
    
    return `
        body { 
            margin: 0; 
            font-family: Arial, sans-serif; 
            background: ${theme.background};
            color: ${theme.textColor};
            overflow: hidden;
        }
        
        #info {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 100;
            background: ${theme.panelBackground};
            padding: 15px;
            border-radius: 5px;
            max-width: 320px;
        }
        
        #controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 100;
            background: ${theme.panelBackground};
            padding: 15px;
            border-radius: 5px;
            max-width: 250px;
        }
        
        #container { 
            width: 100vw; 
            height: 100vh; 
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: ${theme.accentColor};
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .stats, .control-group {
            font-size: 14px;
            margin: 5px 0;
        }
        
        .road-type {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 3px 0;
            font-size: 12px;
        }
        
        .color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 5px;
            display: inline-block;
        }
        
        input[type="checkbox"] {
            margin-right: 5px;
        }
        
        .control-group {
            border-top: 1px solid #333;
            padding-top: 10px;
            margin-top: 10px;
        }
        
        .control-group:first-child {
            border-top: none;
            padding-top: 0;
            margin-top: 0;
        }
        
        .help-text {
            font-size: 11px;
            color: #888;
            margin-top: 10px;
        }
        
        .legend {
            position: absolute;
            bottom: 10px;
            left: 10px;
            z-index: 100;
            background: ${theme.panelBackground};
            padding: 15px;
            border-radius: 5px;
            max-width: 400px;
            border: 1px solid #333;
        }
        
        .legend-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            margin-bottom: 10px;
            font-weight: bold;
            user-select: none;
        }
        
        .legend-toggle {
            font-size: 18px;
            transition: transform 0.3s ease;
        }
        
        .legend-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .legend-content {
            overflow: hidden;
            transition: max-height 0.3s ease;
            max-height: 500px;
        }
        
        .legend-content.collapsed {
            max-height: 0;
            padding: 0;
            margin: 0;
            opacity: 0;
        }
        
        .road-style-option {
            margin: 5px 0;
            font-size: 13px;
        }`;
  }

  /**
   * Generate info panel HTML
   */
  _generateInfoPanel(data) {
    if (!this.config.ui.showInfoPanel) return '';
    
    const { buildings, roads, districts } = data.cityVisualization;
    const roadTypeCounts = this._getRoadTypeCounts(roads);
    
    return `
    <div id="info">
        <div class="title">${this.config.title}</div>
        <div class="subtitle">${this.config.subtitle}</div>
        
        ${this.config.ui.showStatistics ? `
        <div class="stats">🏢 Buildings: ${buildings.length}${this.config.buildings.positioning === 'directory-clustered' ? ' (clustered by directory)' : ''}</div>
        <div class="stats">🛣️ Total Roads: ${roads.length}</div>
        ` : ''}
        
        ${this.config.ui.showLegend ? this._generateLegendHTML(roadTypeCounts) : ''}
        
        <div class="stats">🏘️ ${districts?.length || 0} Districts</div>
        <div class="stats">📊 ${Math.round(JSON.stringify(data).length / 1024)}KB Data</div>
        
        ${this._generateShapeLegend()}
    </div>`;
  }

  /**
   * Generate control panel HTML
   */
  _generateControlPanel() {
    if (!this.config.ui.showControlPanel) return '';
    
    return `
    <div id="controls">
        <div class="title">🎛️ View Controls</div>
        
        ${this._generateRoadToggles()}
        ${this._generateShapeToggle()}
        ${this._generateRoadStyleToggle()}
        
        <div class="help-text">
            🖱️ Mouse: Rotate | Scroll: Zoom<br>
            ⌨️ WASD/Arrows: Move camera<br>
            🎚️ Toggle controls to filter view
        </div>
    </div>`;
  }

  /**
   * Generate JavaScript for 3D scene
   */
  _generateJavaScript() {
    return `
        // Initialize 3D visualization using template config
        const topolop3D = new Topolop3DRenderer(data, config);
        topolop3D.init();
        topolop3D.render();
        
        // Global legend toggle function
        window.toggleLegend = function() {
            const content = document.getElementById('legend-content');
            const toggle = document.getElementById('legend-toggle');
            
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                toggle.classList.remove('collapsed');
                toggle.textContent = '🔽';
            } else {
                content.classList.add('collapsed');
                toggle.classList.add('collapsed');
                toggle.textContent = '▶️';
            }
        };
        
        // Scene management class
        class Topolop3DRenderer {
            constructor(data, config) {
                this.data = data;
                this.config = config;
                this.scene = null;
                this.camera = null;
                this.renderer = null;
                this.controls = null;
                this.buildingMeshes = [];
                this.roadGroups = {};
                this.roadStyle = 'curved'; // 'curved' or 'orthogonal'
                this.keys = {
                    w: false, a: false, s: false, d: false,
                    up: false, down: false, left: false, right: false
                };
            }
            
            init() {
                this.setupScene();
                this.setupLighting();
                this.setupCamera();
                this.setupControls();
                this.createBuildings();
                this.createRoads();
                this.createGround();
                this.setupEventListeners();
                if (this.config.keyboard?.enabled) {
                    this.setupKeyboardControls();
                }
            }
            
            setupScene() {
                this.scene = new THREE.Scene();
                this.renderer = new THREE.WebGLRenderer({ antialias: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setClearColor(new THREE.Color(this.config.theme.background));
                
                if (this.config.scene.shadows) {
                    this.renderer.shadowMap.enabled = true;
                    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                }
                
                document.getElementById('container').appendChild(this.renderer.domElement);
            }
            
            setupLighting() {
                const { ambient, directional } = this.config.scene.lighting;
                
                const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
                this.scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity);
                directionalLight.position.set(directional.position.x, directional.position.y, directional.position.z);
                
                if (this.config.scene.shadows) {
                    directionalLight.castShadow = true;
                    directionalLight.shadow.mapSize.width = 2048;
                    directionalLight.shadow.mapSize.height = 2048;
                }
                
                this.scene.add(directionalLight);
            }
            
            setupCamera() {
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
                const pos = this.config.scene.cameraPosition;
                this.camera.position.set(pos.x, pos.y, pos.z);
            }
            
            setupControls() {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
            }
            
            createBuildings() {
                const buildingGroup = new THREE.Group();
                const materials = this.createBuildingMaterials();
                
                this.data.cityVisualization.buildings.forEach((building, i) => {
                    const mesh = this.createBuildingMesh(building, i, materials);
                    this.buildingMeshes.push(mesh);
                    buildingGroup.add(mesh);
                });
                
                this.scene.add(buildingGroup);
            }
            
            createBuildingMaterials() {
                const materials = {};
                Object.entries(this.config.buildings.shapes).forEach(([shape, shapeConfig]) => {
                    materials[shape] = new THREE.MeshLambertMaterial({ color: shapeConfig.color });
                });
                return materials;
            }
            
            createBuildingMesh(building, index, materials) {
                const height = Math.max(
                    this.config.buildings.heightRange.min,
                    Math.random() * this.config.buildings.heightRange.max + this.config.buildings.heightRange.min
                );
                
                const shape = building.shape || 'box';
                const shapeConfig = this.config.buildings.shapes[shape];
                let geometry;
                
                switch(shapeConfig.geometry) {
                    case 'ConeGeometry':
                        geometry = new THREE.ConeGeometry(1.5, height, shapeConfig.sides || 8);
                        break;
                    case 'CylinderGeometry':
                        geometry = new THREE.CylinderGeometry(1, 1, height, shapeConfig.sides || 8);
                        break;
                    default: // BoxGeometry
                        geometry = new THREE.BoxGeometry(2, height, 2);
                }
                
                const mesh = new THREE.Mesh(geometry, materials[shape] || materials.box);
                
                if (this.config.scene.shadows) {
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
                
                // Position building
                this.positionBuilding(mesh, building, index, height);
                
                mesh.userData = { building, originalShape: shape };
                return mesh;
            }
            
            positionBuilding(mesh, building, index, height) {
                if (this.config.buildings.positioning === 'directory-clustered' && building.position) {
                    mesh.position.set(building.position.x || 0, height/2, building.position.z || 0);
                } else {
                    // Grid fallback
                    const gridSize = Math.ceil(Math.sqrt(this.data.cityVisualization.buildings.length));
                    const spacing = this.config.buildings.spacing;
                    const x = (index % gridSize) * spacing - (gridSize * spacing / 2);
                    const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing / 2);
                    mesh.position.set(x, height/2, z);
                }
            }
            
            createRoads() {
                // Initialize road groups
                Object.keys(this.config.roads.types).forEach(type => {
                    this.roadGroups[type] = new THREE.Group();
                    this.scene.add(this.roadGroups[type]);
                });
                
                this.data.cityVisualization.roads.forEach(road => {
                    this.createRoadMesh(road);
                });
            }
            
            createRoadMesh(road) {
                const startMesh = this.buildingMeshes.find(m => m.userData.building.id === road.start);
                const endMesh = this.buildingMeshes.find(m => m.userData.building.id === road.end);
                
                if (!startMesh || !endMesh) return;
                
                const roadType = road.type || this.config.roads.defaultType;
                const roadConfig = this.config.roads.types[roadType] || this.config.roads.types[this.config.roads.defaultType];
                
                const startPos = startMesh.position.clone();
                const endPos = endMesh.position.clone();
                startPos.y += 5;
                endPos.y += 5;
                
                let points;
                
                if (this.roadStyle === 'orthogonal') {
                    // NYC-style orthogonal (Manhattan distance) roads
                    const midPoint = new THREE.Vector3(
                        startPos.x,
                        (startPos.y + endPos.y) / 2,
                        endPos.z
                    );
                    points = [startPos, midPoint, endPos];
                } else {
                    // Direct curved connection
                    points = [startPos, endPos];
                }
                
                const geometry = new THREE.BufferGeometry();
                geometry.setFromPoints(points);
                
                let material;
                const color = new THREE.Color(road.color || roadConfig.color);
                
                if (roadConfig.style === 'dotted' || roadConfig.style === 'dashed') {
                    material = new THREE.LineDashedMaterial({
                        color: color,
                        linewidth: road.width || roadConfig.width,
                        scale: 1,
                        dashSize: roadConfig.style === 'dotted' ? 0.5 : 1,
                        gapSize: 0.5
                    });
                } else {
                    material = new THREE.LineBasicMaterial({
                        color: color,
                        linewidth: road.width || roadConfig.width
                    });
                }
                
                const line = new THREE.Line(geometry, material);
                if (material.isDashed) {
                    line.computeLineDistances();
                }
                
                line.userData = { road, type: roadType };
                this.roadGroups[roadType].add(line);
            }
            
            createGround() {
                if (!this.config.scene.ground) return;
                
                const groundGeometry = new THREE.PlaneGeometry(this.config.scene.ground.size, this.config.scene.ground.size);
                const groundMaterial = new THREE.MeshLambertMaterial({ color: this.config.scene.ground.color });
                const ground = new THREE.Mesh(groundGeometry, groundMaterial);
                ground.rotation.x = -Math.PI / 2;
                
                if (this.config.scene.shadows) {
                    ground.receiveShadow = true;
                }
                
                this.scene.add(ground);
            }
            
            setupEventListeners() {
                // Road type toggles
                Object.keys(this.config.roads.types).forEach(type => {
                    const checkbox = document.getElementById(\`show-\${type}\`);
                    if (checkbox) {
                        checkbox.addEventListener('change', (e) => {
                            if (this.roadGroups[type]) {
                                this.roadGroups[type].visible = e.target.checked;
                            }
                        });
                    }
                });
                
                // Shape toggle
                const shapeToggle = document.getElementById('different-shapes');
                if (shapeToggle) {
                    shapeToggle.addEventListener('change', (e) => {
                        const materials = this.createBuildingMaterials();
                        this.buildingMeshes.forEach(mesh => {
                            const shape = e.target.checked ? mesh.userData.originalShape : 'box';
                            mesh.material = materials[shape] || materials.box;
                        });
                    });
                }
                
                // Road style toggles
                const roadStyleRadios = document.querySelectorAll('input[name="road-style"]');
                roadStyleRadios.forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            this.roadStyle = e.target.value;
                            this.updateRoadStyle();
                        }
                    });
                });
                
                // Window resize
                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                });
            }
            
            setupKeyboardControls() {
                document.addEventListener('keydown', (event) => {
                    switch(event.code) {
                        case 'KeyW': this.keys.w = true; break;
                        case 'KeyA': this.keys.a = true; break;
                        case 'KeyS': this.keys.s = true; break;
                        case 'KeyD': this.keys.d = true; break;
                        case 'ArrowUp': this.keys.up = true; break;
                        case 'ArrowDown': this.keys.down = true; break;
                        case 'ArrowLeft': this.keys.left = true; break;
                        case 'ArrowRight': this.keys.right = true; break;
                    }
                });
                
                document.addEventListener('keyup', (event) => {
                    switch(event.code) {
                        case 'KeyW': this.keys.w = false; break;
                        case 'KeyA': this.keys.a = false; break;
                        case 'KeyS': this.keys.s = false; break;
                        case 'KeyD': this.keys.d = false; break;
                        case 'ArrowUp': this.keys.up = false; break;
                        case 'ArrowDown': this.keys.down = false; break;
                        case 'ArrowLeft': this.keys.left = false; break;
                        case 'ArrowRight': this.keys.right = false; break;
                    }
                });
            }
            
            updateCameraMovement() {
                if (!this.config.keyboard?.enabled) return;
                
                const moveSpeed = this.config.keyboard.moveSpeed;
                
                // Camera-relative movement (proper RTS standard)
                // Movement feels natural regardless of camera rotation angle
                
                // Get camera's forward and right vectors, but flatten them to horizontal plane
                const forward = new THREE.Vector3();
                this.camera.getWorldDirection(forward);
                
                const right = new THREE.Vector3();
                right.crossVectors(this.camera.up, forward);
                
                // Flatten vectors to horizontal plane (ignore Y component for ground-level movement)
                const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();
                const flatRight = new THREE.Vector3(right.x, 0, right.z).normalize();
                
                // W/Up = Move forward relative to camera view
                if (this.keys.w || this.keys.up) {
                    this.camera.position.addScaledVector(flatForward, moveSpeed);
                    this.controls.target.addScaledVector(flatForward, moveSpeed);
                }
                // S/Down = Move backward relative to camera view
                if (this.keys.s || this.keys.down) {
                    this.camera.position.addScaledVector(flatForward, -moveSpeed);
                    this.controls.target.addScaledVector(flatForward, -moveSpeed);
                }
                // A/Left = Strafe left relative to camera view
                if (this.keys.a || this.keys.left) {
                    this.camera.position.addScaledVector(flatRight, moveSpeed);
                    this.controls.target.addScaledVector(flatRight, moveSpeed);
                }
                // D/Right = Strafe right relative to camera view
                if (this.keys.d || this.keys.right) {
                    this.camera.position.addScaledVector(flatRight, -moveSpeed);
                    this.controls.target.addScaledVector(flatRight, -moveSpeed);
                }
            }
            
            updateRoadStyle() {
                // Clear existing roads
                Object.values(this.roadGroups).forEach(group => {
                    group.clear();
                });
                
                // Recreate roads with new style
                this.createRoads();
                
                console.log(\`🛣️ Road style updated to: \${this.roadStyle}\`);
            }
            
            render() {
                const animate = () => {
                    requestAnimationFrame(animate);
                    this.updateCameraMovement();
                    this.controls.update();
                    this.renderer.render(this.scene, this.camera);
                };
                animate();
                
                console.log('🎉 3D Visualization loaded with enhanced immersive features!');
            }
        }`;
  }

  /**
   * Helper methods for HTML generation
   */
  _getRoadTypeCounts(roads) {
    const counts = {};
    Object.keys(this.config.roads.types).forEach(type => {
      counts[type] = roads.filter(r => r.type === type || (!r.type && type === this.config.roads.defaultType)).length;
    });
    return counts;
  }

  _generateLegendHTML(roadTypeCounts) {
    return Object.entries(this.config.roads.types).map(([type, typeConfig]) => `
        <div class="road-type">
            <span><div class="color-dot" style="background: ${typeConfig.color};"></div>${typeConfig.label} (${roadTypeCounts[type] || 0})</span>
        </div>`).join('');
  }

  _generateShapeLegend() {
    return `
        <div style="margin-top: 10px; font-size: 12px;">
            <strong>Building Shapes:</strong><br>
            📦 Box = Code files<br>
            🔺 Pyramid = Tests<br>
            🟣 Cylinder = Config<br>
            🔸 Cone = Docs
        </div>`;
  }

  _generateRoadToggles() {
    return `
        <div class="control-group">
            <strong>Road Types:</strong><br>
            ${Object.entries(this.config.roads.types).map(([type, typeConfig]) => `
                <label><input type="checkbox" id="show-${type}" checked> ${typeConfig.label}</label><br>
            `).join('')}
        </div>`;
  }

  _generateShapeToggle() {
    return `
        <div class="control-group">
            <strong>Building Shapes:</strong><br>
            <label><input type="checkbox" id="different-shapes" checked> Use Different Shapes</label>
        </div>`;
  }

  _generateRoadStyleToggle() {
    return `
        <div class="control-group">
            <strong>Road Pattern:</strong><br>
            <div class="road-style-option">
                <label><input type="radio" name="road-style" value="curved" checked> 🌊 Curved (Natural)</label>
            </div>
            <div class="road-style-option">
                <label><input type="radio" name="road-style" value="orthogonal"> 🏙️ NYC Grid (Orthogonal)</label>
            </div>
        </div>`;
  }

  _generateCollapsibleLegend(data) {
    const { buildings, roads } = data.cityVisualization;
    const roadTypeCounts = this._getRoadTypeCounts(roads);
    
    return `
    <div class="legend">
        <div class="legend-header" onclick="toggleLegend()">
            <span>📊 Legend & Statistics</span>
            <span class="legend-toggle" id="legend-toggle">🔽</span>
        </div>
        <div class="legend-content" id="legend-content">
            <div style="margin-bottom: 10px;">
                <strong>Statistics:</strong><br>
                🏢 ${buildings.length} Buildings<br>
                🛣️ ${roads.length} Total Connections<br>
                🏘️ ${data.cityVisualization.districts?.length || 0} Districts
            </div>
            
            <div style="margin-bottom: 10px;">
                <strong>Road Types:</strong><br>
                ${Object.entries(this.config.roads.types).map(([type, typeConfig]) => `
                    <div class="road-type">
                        <span><div class="color-dot" style="background: ${typeConfig.color};"></div>${typeConfig.label}</span>
                        <span>${roadTypeCounts[type] || 0}</span>
                    </div>
                `).join('')}
            </div>
            
            <div>
                <strong>Building Shapes:</strong><br>
                📦 Box = Code files<br>
                🔺 Pyramid = Tests<br>
                🟣 Cylinder = Config<br>
                🔸 Cone = Docs
            </div>
            
            <div style="margin-top: 10px; font-size: 11px; color: #888;">
                <strong>Controls:</strong><br>
                <span>🖱️ Mouse: Orbit view</span><br>
                <span>⌨️ WASD or Arrow Keys: Move camera</span><br>
                <span>🔍 Scroll: Zoom in/out</span>
            </div>
        </div>
    </div>`;
  }
}

module.exports = { Topolop3DVisualizationTemplate };