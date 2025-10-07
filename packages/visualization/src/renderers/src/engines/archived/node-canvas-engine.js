const BaseCanvasEngine = require('./base-canvas-engine');

/**
 * Node.js Canvas Engine - Server-side rendering using node-canvas
 * Requires 'canvas' npm package for headless rendering
 */
class NodeCanvasEngine extends BaseCanvasEngine {
  constructor(options = {}) {
    super(options);
    
    try {
      // Import canvas only when needed (optional dependency)
      const { createCanvas, loadImage } = require('canvas');
      this.createCanvas = createCanvas;
      this.loadImage = loadImage;
    } catch (error) {
      throw new Error(
        'node-canvas package is required for server-side rendering. Install with: npm install canvas'
      );
    }
    
    // Create canvas
    this.canvas = this.createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
    
    // Initialize with background
    this.clear();
    
    console.log(`🖥️  Node Canvas initialized: ${this.width}x${this.height}`);
  }

  clear() {
    // Clear and set background
    this.ctx.resetTransform();
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
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
    
    // Parse SVG-like path commands (simplified)
    if (typeof path === 'string') {
      console.warn('SVG path parsing not fully implemented in Node canvas engine');
    }
    
    this.ctx.restore();
  }

  async drawImage(options) {
    this.validateOptions(options, ['image', 'x', 'y']);
    
    const { image, x, y, width, height } = options;
    
    this.ctx.save();
    
    try {
      // Load image if it's a URL/path string
      let img = image;
      if (typeof image === 'string') {
        img = await this.loadImage(image);
      }
      
      if (width !== undefined && height !== undefined) {
        this.ctx.drawImage(img, x, y, width, height);
      } else {
        this.ctx.drawImage(img, x, y);
      }
    } catch (error) {
      console.error('Failed to draw image:', error.message);
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
    const mimeMap = {
      'png': 'image/png',
      'jpg': 'image/jpeg', 
      'jpeg': 'image/jpeg',
      'pdf': 'application/pdf'
    };
    
    const mimeType = mimeMap[format.toLowerCase()] || 'image/png';
    
    if (format.toLowerCase() === 'pdf') {
      // PDF export requires different canvas setup
      console.warn('PDF export requires special handling - returning PNG buffer');
      return this.canvas.toBuffer('image/png');
    }
    
    return this.canvas.toBuffer(mimeType);
  }

  // Node.js specific methods
  writeToFile(filename, format = 'png') {
    const fs = require('fs');
    const buffer = this.toBuffer(format);
    fs.writeFileSync(filename, buffer);
    console.log(`💾 Saved canvas to ${filename}`);
  }

  async writeToFileAsync(filename, format = 'png') {
    const fs = require('fs').promises;
    const buffer = this.toBuffer(format);
    await fs.writeFile(filename, buffer);
    console.log(`💾 Saved canvas to ${filename}`);
  }

  getCanvas() {
    return this.canvas;
  }

  getContext() {
    return this.ctx;
  }
}

module.exports = NodeCanvasEngine;