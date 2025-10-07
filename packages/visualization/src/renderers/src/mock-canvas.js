class MockCanvasEngine {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.backgroundColor = options.backgroundColor || '#ffffff';
    this.drawCalls = [];
    
    console.log(`📐 Mock Canvas initialized: ${this.width}x${this.height}`);
  }

  clear() {
    this.drawCalls = [];
    this.drawCalls.push({ type: 'clear' });
  }

  drawRectangle(options) {
    this.drawCalls.push({ type: 'rectangle', ...options });
  }

  drawCircle(options) {
    this.drawCalls.push({ type: 'circle', ...options });
  }

  drawLine(options) {
    this.drawCalls.push({ type: 'line', ...options });
  }

  drawPolygon(options) {
    this.drawCalls.push({ type: 'polygon', ...options });
  }

  drawText(options) {
    this.drawCalls.push({ type: 'text', ...options });
  }

  drawPath(options) {
    this.drawCalls.push({ type: 'path', ...options });
  }

  drawImage(options) {
    this.drawCalls.push({ type: 'image', ...options });
  }

  setZoom(factor) {
    this.drawCalls.push({ type: 'zoom', factor });
  }

  setPan(x, y) {
    this.drawCalls.push({ type: 'pan', x, y });
  }

  getDrawStats() {
    const stats = {};
    this.drawCalls.forEach(call => {
      stats[call.type] = (stats[call.type] || 0) + 1;
    });
    return stats;
  }

  getTotalDrawCalls() {
    return this.drawCalls.length;
  }

  getLastDrawCall() {
    return this.drawCalls[this.drawCalls.length - 1];
  }

  reset() {
    this.drawCalls = [];
  }
}

module.exports = MockCanvasEngine;