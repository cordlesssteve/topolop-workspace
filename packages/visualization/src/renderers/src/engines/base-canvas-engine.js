/**
 * Base Canvas Engine - Abstract interface for all canvas implementations
 * This defines the common API that all canvas engines must implement
 */
class BaseCanvasEngine {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.backgroundColor = options.backgroundColor || '#ffffff';
    this.zoom = options.zoom || 1.0;
    this.panX = options.panX || 0;
    this.panY = options.panY || 0;
  }

  // Abstract methods - must be implemented by subclasses
  clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  drawRectangle(options) {
    throw new Error('drawRectangle() must be implemented by subclass');
  }

  drawCircle(options) {
    throw new Error('drawCircle() must be implemented by subclass');
  }

  drawLine(options) {
    throw new Error('drawLine() must be implemented by subclass');
  }

  drawPolygon(options) {
    throw new Error('drawPolygon() must be implemented by subclass');
  }

  drawText(options) {
    throw new Error('drawText() must be implemented by subclass');
  }

  drawPath(options) {
    throw new Error('drawPath() must be implemented by subclass');
  }

  drawImage(options) {
    throw new Error('drawImage() must be implemented by subclass');
  }

  // Transform methods
  setZoom(factor) {
    this.zoom = Math.max(0.1, Math.min(10, factor));
    this.onTransformChanged();
  }

  setPan(x, y) {
    this.panX = x;
    this.panY = y;
    this.onTransformChanged();
  }

  // Utility methods that can be overridden
  onTransformChanged() {
    // Override in subclass if needed
  }

  // Export methods
  toDataURL(format = 'image/png') {
    throw new Error('toDataURL() must be implemented by subclass');
  }

  toBuffer(format = 'png') {
    throw new Error('toBuffer() must be implemented by subclass');
  }

  // Coordinate transformation helpers
  transformPoint(x, y) {
    return {
      x: (x + this.panX) * this.zoom,
      y: (y + this.panY) * this.zoom
    };
  }

  inverseTransformPoint(x, y) {
    return {
      x: (x / this.zoom) - this.panX,
      y: (y / this.zoom) - this.panY
    };
  }

  // Color utilities
  parseColor(color) {
    if (typeof color !== 'string') return '#000000';
    return color.startsWith('#') ? color : `#${color}`;
  }

  parseAlpha(alpha) {
    if (typeof alpha !== 'number') return 1.0;
    return Math.max(0, Math.min(1, alpha));
  }

  // Validation helpers
  validateOptions(options, required = []) {
    const missing = required.filter(key => !(key in options));
    if (missing.length > 0) {
      throw new Error(`Missing required options: ${missing.join(', ')}`);
    }
  }
}

module.exports = BaseCanvasEngine;