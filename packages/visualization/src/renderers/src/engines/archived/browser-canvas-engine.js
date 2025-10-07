const BaseCanvasEngine = require('./base-canvas-engine');

/**
 * Browser Canvas Engine - Uses HTML5 Canvas API for real-time visualization
 * Requires browser environment with DOM support
 */
class BrowserCanvasEngine extends BaseCanvasEngine {
  constructor(options = {}) {
    super(options);
    
    // Create or get canvas element
    if (options.canvas) {
      this.canvas = options.canvas;
    } else if (options.canvasId) {
      this.canvas = document.getElementById(options.canvasId);
      if (!this.canvas) {
        throw new Error(`Canvas element with id '${options.canvasId}' not found`);
      }
    } else {
      // Create new canvas element
      this.canvas = document.createElement('canvas');
      if (options.container) {
        const container = typeof options.container === 'string' 
          ? document.getElementById(options.container)
          : options.container;
        container.appendChild(this.canvas);
      }
    }

    // Set canvas dimensions
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.backgroundColor = this.backgroundColor;

    // Get 2D context
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Unable to get 2D rendering context');
    }

    // Set initial transform
    this.updateTransform();
    
    console.log(`🎨 Browser Canvas initialized: ${this.width}x${this.height}`);
  }

  clear() {
    // Reset transform for clearing
    this.ctx.resetTransform();
    
    // Clear entire canvas
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Restore transform
    this.updateTransform();
  }

  drawRectangle(options) {
    this.validateOptions(options, ['x', 'y', 'width', 'height']);
    
    const { x, y, width, height, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0 } = options;
    
    this.ctx.save();
    
    // Set fill style
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.globalAlpha = this.parseAlpha(fillAlpha);
      this.ctx.fillRect(x, y, width, height);
    }
    
    // Set stroke style  
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.globalAlpha = 1.0;
      this.ctx.strokeRect(x, y, width, height);
    }
    
    this.ctx.restore();
  }

  drawCircle(options) {
    this.validateOptions(options, ['x', 'y', 'radius']);
    
    const { x, y, radius, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0 } = options;
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    
    // Fill circle
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.globalAlpha = this.parseAlpha(fillAlpha);
      this.ctx.fill();
    }
    
    // Stroke circle
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.globalAlpha = 1.0;
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  drawLine(options) {
    this.validateOptions(options, ['x1', 'y1', 'x2', 'y2']);
    
    const { x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 1, strokeStyle = 'solid' } = options;
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = strokeWidth;
    
    // Set line dash pattern
    if (strokeStyle === 'dashed') {
      this.ctx.setLineDash([5, 5]);
    } else if (strokeStyle === 'dotted') {
      this.ctx.setLineDash([2, 2]);
    } else {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPolygon(options) {
    this.validateOptions(options, ['points']);
    
    const { points, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0, strokeStyle = 'solid' } = options;
    
    if (!Array.isArray(points) || points.length < 3) {
      throw new Error('Polygon requires at least 3 points');
    }
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    this.ctx.closePath();
    
    // Fill polygon
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.globalAlpha = this.parseAlpha(fillAlpha);
      this.ctx.fill();
    }
    
    // Stroke polygon
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.globalAlpha = 1.0;
      
      // Set line dash pattern
      if (strokeStyle === 'dashed') {
        this.ctx.setLineDash([5, 5]);
      } else if (strokeStyle === 'dotted') {
        this.ctx.setLineDash([2, 2]);
      } else {
        this.ctx.setLineDash([]);
      }
      
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  drawText(options) {
    this.validateOptions(options, ['text', 'x', 'y']);
    
    const { 
      text, x, y, 
      font = '12px Arial', 
      color = '#000000', 
      align = 'left',
      baseline = 'top'
    } = options;
    
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  drawPath(options) {
    this.validateOptions(options, ['path']);
    
    const { path, fillColor, strokeColor, strokeWidth = 1 } = options;
    
    this.ctx.save();
    
    // Use Path2D if available (modern browsers)
    if (window.Path2D && typeof path === 'string') {
      const path2D = new Path2D(path);
      
      if (fillColor) {
        this.ctx.fillStyle = fillColor;
        this.ctx.fill(path2D);
      }
      
      if (strokeColor) {
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.stroke(path2D);
      }
    } else {
      // Fallback for older browsers or custom path formats
      console.warn('Path2D not supported or invalid path format');
    }
    
    this.ctx.restore();
  }

  drawImage(options) {
    this.validateOptions(options, ['image', 'x', 'y']);
    
    const { image, x, y, width, height } = options;
    
    this.ctx.save();
    
    if (width !== undefined && height !== undefined) {
      this.ctx.drawImage(image, x, y, width, height);
    } else {
      this.ctx.drawImage(image, x, y);
    }
    
    this.ctx.restore();
  }

  onTransformChanged() {
    this.updateTransform();
  }

  updateTransform() {
    this.ctx.resetTransform();
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(this.panX, this.panY);
  }

  toDataURL(format = 'image/png') {
    return this.canvas.toDataURL(format);
  }

  toBuffer(format = 'png') {
    // Convert data URL to buffer
    const dataURL = this.toDataURL(`image/${format}`);
    const base64 = dataURL.split(',')[1];
    return Buffer.from(base64, 'base64');
  }

  // Browser-specific methods
  addEventListeners() {
    let isDragging = false;
    let lastX, lastY;
    
    // Mouse drag for panning
    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = (e.clientX - lastX) / this.zoom;
        const deltaY = (e.clientY - lastY) / this.zoom;
        this.setPan(this.panX + deltaX, this.panY + deltaY);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    
    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
      this.canvas.style.cursor = 'grab';
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      this.canvas.style.cursor = 'default';
    });
    
    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.setZoom(this.zoom * zoomFactor);
    });
    
    this.canvas.style.cursor = 'grab';
  }

  getCanvas() {
    return this.canvas;
  }

  getContext() {
    return this.ctx;
  }
}

module.exports = BrowserCanvasEngine;