const d3 = require('d3');

class CanvasEngine {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      width: 1200,
      height: 800,
      backgroundColor: '#2D3748',
      enableZoom: true,
      enablePan: true,
      ...options
    };

    this.container = null;
    this.canvas = null;
    this.context = null;
    this.transform = d3.zoomIdentity;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    this.nodes = [];
    this.edges = [];
    this.layers = new Map();
    this.animations = [];
    
    this.isAnimating = false;
    this.lastFrameTime = 0;
    
    this.init();
  }

  init() {
    // Create container if it doesn't exist
    this.container = d3.select(`#${this.containerId}`);
    if (this.container.empty()) {
      throw new Error(`Container with ID "${this.containerId}" not found`);
    }

    // Clear existing content
    this.container.selectAll('*').remove();

    // Create canvas
    this.canvas = this.container
      .append('canvas')
      .attr('width', this.options.width * this.devicePixelRatio)
      .attr('height', this.options.height * this.devicePixelRatio)
      .style('width', `${this.options.width}px`)
      .style('height', `${this.options.height}px`);

    this.context = this.canvas.node().getContext('2d');
    this.context.scale(this.devicePixelRatio, this.devicePixelRatio);

    // Set up zoom and pan
    if (this.options.enableZoom || this.options.enablePan) {
      this.setupZoomPan();
    }

    // Set up layers
    this.initLayers();

    console.log('🎨 Canvas engine initialized');
  }

  setupZoomPan() {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.transform = event.transform;
        this.render();
      });

    this.canvas.call(zoom);
  }

  initLayers() {
    // Define rendering layers (back to front)
    this.layers.set('background', { visible: true, opacity: 1.0, items: [] });
    this.layers.set('edges', { visible: true, opacity: 1.0, items: [] });
    this.layers.set('nodes', { visible: true, opacity: 1.0, items: [] });
    this.layers.set('labels', { visible: true, opacity: 1.0, items: [] });
    this.layers.set('ui', { visible: true, opacity: 1.0, items: [] });
  }

  // Data management
  setNodes(nodes) {
    this.nodes = nodes || [];
    this.updateLayer('nodes', this.nodes);
    return this;
  }

  setEdges(edges) {
    this.edges = edges || [];
    this.updateLayer('edges', this.edges);
    return this;
  }

  updateLayer(layerName, items) {
    if (this.layers.has(layerName)) {
      this.layers.get(layerName).items = items || [];
    }
  }

  addToLayer(layerName, item) {
    if (this.layers.has(layerName)) {
      this.layers.get(layerName).items.push(item);
    }
  }

  // Rendering methods
  render() {
    const ctx = this.context;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.options.width, this.options.height);
    
    // Set background
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, this.options.width, this.options.height);

    // Apply transform
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);

    // Render layers in order
    for (const [layerName, layer] of this.layers) {
      if (layer.visible && layer.items.length > 0) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        this.renderLayer(layerName, layer.items, ctx);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  renderLayer(layerName, items, ctx) {
    switch (layerName) {
      case 'edges':
        this.renderEdges(items, ctx);
        break;
      case 'nodes':
        this.renderNodes(items, ctx);
        break;
      case 'labels':
        this.renderLabels(items, ctx);
        break;
      case 'background':
        this.renderBackground(items, ctx);
        break;
      case 'ui':
        this.renderUI(items, ctx);
        break;
    }
  }

  renderNodes(nodes, ctx) {
    nodes.forEach(node => {
      if (!node.x || !node.y) return;

      ctx.save();
      
      // Apply node transforms
      ctx.translate(node.x, node.y);
      
      if (node.rotation) {
        ctx.rotate(node.rotation);
      }

      // Render based on node type
      switch (node.shape || 'circle') {
        case 'circle':
          this.drawCircle(ctx, node);
          break;
        case 'rectangle':
          this.drawRectangle(ctx, node);
          break;
        case 'building':
          this.drawBuilding(ctx, node);
          break;
        default:
          this.drawCircle(ctx, node);
      }

      ctx.restore();
    });
  }

  renderEdges(edges, ctx) {
    edges.forEach(edge => {
      if (!edge.source || !edge.target) return;
      if (!edge.source.x || !edge.source.y || !edge.target.x || !edge.target.y) return;

      ctx.save();
      
      // Set edge style
      ctx.strokeStyle = edge.color || '#4A5568';
      ctx.lineWidth = edge.width || 2;
      ctx.globalAlpha = edge.opacity || 1.0;

      // Set line style
      if (edge.style === 'dashed') {
        ctx.setLineDash([5, 5]);
      } else if (edge.style === 'dotted') {
        ctx.setLineDash([2, 2]);
      }

      // Draw edge
      switch (edge.type || 'line') {
        case 'line':
          this.drawLine(ctx, edge.source, edge.target);
          break;
        case 'curve':
          this.drawCurve(ctx, edge.source, edge.target, edge.curvature || 0.3);
          break;
        case 'arrow':
          this.drawArrow(ctx, edge.source, edge.target);
          break;
      }

      ctx.restore();
    });
  }

  renderLabels(labels, ctx) {
    labels.forEach(label => {
      if (!label.x || !label.y || !label.text) return;

      ctx.save();
      
      ctx.fillStyle = label.color || '#E2E8F0';
      ctx.font = label.font || '12px Arial';
      ctx.textAlign = label.align || 'center';
      ctx.textBaseline = label.baseline || 'middle';

      if (label.backgroundColor) {
        const metrics = ctx.measureText(label.text);
        const padding = 4;
        ctx.fillStyle = label.backgroundColor;
        ctx.fillRect(
          label.x - metrics.width / 2 - padding,
          label.y - 6 - padding,
          metrics.width + padding * 2,
          12 + padding * 2
        );
      }

      ctx.fillStyle = label.color || '#E2E8F0';
      ctx.fillText(label.text, label.x, label.y);

      ctx.restore();
    });
  }

  renderBackground(items, ctx) {
    items.forEach(item => {
      switch (item.type) {
        case 'grid':
          this.drawGrid(ctx, item);
          break;
        case 'pattern':
          this.drawPattern(ctx, item);
          break;
      }
    });
  }

  renderUI(items, ctx) {
    // UI elements are rendered in screen coordinates (not transformed)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

    items.forEach(item => {
      switch (item.type) {
        case 'button':
          this.drawButton(ctx, item);
          break;
        case 'legend':
          this.drawLegend(ctx, item);
          break;
        case 'minimap':
          this.drawMinimap(ctx, item);
          break;
      }
    });

    ctx.restore();
  }

  // Drawing primitives
  drawCircle(ctx, node) {
    const radius = node.radius || node.size || 10;
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    
    if (node.fillColor) {
      ctx.fillStyle = node.fillColor;
      ctx.fill();
    }
    
    if (node.strokeColor) {
      ctx.strokeStyle = node.strokeColor;
      ctx.lineWidth = node.strokeWidth || 1;
      ctx.stroke();
    }
  }

  drawRectangle(ctx, node) {
    const width = node.width || node.size || 20;
    const height = node.height || node.size || 20;
    
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    
    if (node.fillColor) {
      ctx.fillStyle = node.fillColor;
      ctx.fill();
    }
    
    if (node.strokeColor) {
      ctx.strokeStyle = node.strokeColor;
      ctx.lineWidth = node.strokeWidth || 1;
      ctx.stroke();
    }
  }

  drawBuilding(ctx, node) {
    const width = node.width || 30;
    const height = node.height || 50;
    const floors = node.floors || 3;
    
    // Draw building base
    ctx.fillStyle = node.fillColor || '#4A90E2';
    ctx.fillRect(-width / 2, -height, width, height);
    
    // Draw building details
    ctx.strokeStyle = node.strokeColor || '#2C5282';
    ctx.lineWidth = 1;
    
    // Floor lines
    const floorHeight = height / floors;
    for (let i = 1; i < floors; i++) {
      const y = -height + i * floorHeight;
      ctx.beginPath();
      ctx.moveTo(-width / 2, y);
      ctx.lineTo(width / 2, y);
      ctx.stroke();
    }
    
    // Windows
    const windowWidth = 4;
    const windowHeight = 4;
    const windowsPerFloor = Math.floor(width / 8);
    
    ctx.fillStyle = node.windowColor || '#FED7D7';
    
    for (let floor = 0; floor < floors; floor++) {
      const y = -height + floor * floorHeight + floorHeight / 2;
      
      for (let win = 0; win < windowsPerFloor; win++) {
        const x = -width / 2 + (win + 1) * (width / (windowsPerFloor + 1));
        ctx.fillRect(x - windowWidth / 2, y - windowHeight / 2, windowWidth, windowHeight);
      }
    }
  }

  drawLine(ctx, source, target) {
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }

  drawCurve(ctx, source, target, curvature) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const controlX = source.x + dx / 2 + dy * curvature;
    const controlY = source.y + dy / 2 - dx * curvature;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
    ctx.stroke();
  }

  drawArrow(ctx, source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);
    const arrowSize = 8;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x - Math.cos(angle) * arrowSize, target.y - Math.sin(angle) * arrowSize);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(
      target.x - Math.cos(angle - Math.PI / 6) * arrowSize,
      target.y - Math.sin(angle - Math.PI / 6) * arrowSize
    );
    ctx.lineTo(
      target.x - Math.cos(angle + Math.PI / 6) * arrowSize,
      target.y - Math.sin(angle + Math.PI / 6) * arrowSize
    );
    ctx.closePath();
    ctx.fill();
  }

  drawGrid(ctx, grid) {
    const spacing = grid.spacing || 50;
    const color = grid.color || '#4A5568';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    // Vertical lines
    for (let x = 0; x < this.options.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.options.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.options.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.options.width, y);
      ctx.stroke();
    }
  }

  // Animation system
  animate(duration = 1000) {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.lastFrameTime = performance.now();

    const animationLoop = (currentTime) => {
      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      // Update animations
      this.updateAnimations(deltaTime);

      // Render frame
      this.render();

      if (this.isAnimating) {
        requestAnimationFrame(animationLoop);
      }
    };

    requestAnimationFrame(animationLoop);
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  updateAnimations(deltaTime) {
    this.animations = this.animations.filter(animation => {
      animation.elapsed += deltaTime;
      const progress = Math.min(animation.elapsed / animation.duration, 1);
      
      // Apply easing
      const easedProgress = this.easeInOutCubic(progress);
      
      // Update animated properties
      animation.update(easedProgress);
      
      // Remove completed animations
      if (progress >= 1) {
        if (animation.onComplete) {
          animation.onComplete();
        }
        return false;
      }
      
      return true;
    });

    // Stop animation loop if no animations remain
    if (this.animations.length === 0) {
      this.isAnimating = false;
    }
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Utility methods
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.transform.x) / this.transform.k,
      y: (screenY - this.transform.y) / this.transform.k
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.transform.k + this.transform.x,
      y: worldY * this.transform.k + this.transform.y
    };
  }

  getBounds() {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.options.width, this.options.height);
    
    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }

  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    this.canvas
      .attr('width', width * this.devicePixelRatio)
      .attr('height', height * this.devicePixelRatio)
      .style('width', `${width}px`)
      .style('height', `${height}px`);
    
    this.context.scale(this.devicePixelRatio, this.devicePixelRatio);
    this.render();
  }

  destroy() {
    this.stopAnimation();
    this.container.selectAll('*').remove();
  }
}

module.exports = CanvasEngine;