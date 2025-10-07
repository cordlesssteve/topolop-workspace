const BaseCanvasEngine = require('./base-canvas-engine');

/**
 * SVG Canvas Engine - Generates scalable vector graphics
 * Creates SVG markup that can be saved to file or displayed in browsers
 */
class SVGCanvasEngine extends BaseCanvasEngine {
  constructor(options = {}) {
    super(options);
    
    this.elements = [];
    this.definitions = new Set(); // For gradients, patterns, etc.
    
    // Initialize SVG with background
    this.clear();
    
    console.log(`📐 SVG Canvas initialized: ${this.width}x${this.height}`);
  }

  clear() {
    this.elements = [];
    
    // Add background rectangle
    if (this.backgroundColor !== 'transparent') {
      this.elements.push({
        type: 'rect',
        attributes: {
          x: 0,
          y: 0,
          width: this.width,
          height: this.height,
          fill: this.backgroundColor
        }
      });
    }
  }

  drawRectangle(options) {
    this.validateOptions(options, ['x', 'y', 'width', 'height']);
    
    const { x, y, width, height, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0 } = options;
    
    const attributes = {
      x: x,
      y: y,
      width: width,
      height: height
    };
    
    if (fillColor) {
      attributes.fill = fillColor;
      if (fillAlpha < 1.0) {
        attributes['fill-opacity'] = fillAlpha;
      }
    } else {
      attributes.fill = 'none';
    }
    
    if (strokeColor) {
      attributes.stroke = strokeColor;
      attributes['stroke-width'] = strokeWidth;
    }
    
    this.elements.push({
      type: 'rect',
      attributes: attributes
    });
  }

  drawCircle(options) {
    this.validateOptions(options, ['x', 'y', 'radius']);
    
    const { x, y, radius, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0 } = options;
    
    const attributes = {
      cx: x,
      cy: y,
      r: radius
    };
    
    if (fillColor) {
      attributes.fill = fillColor;
      if (fillAlpha < 1.0) {
        attributes['fill-opacity'] = fillAlpha;
      }
    } else {
      attributes.fill = 'none';
    }
    
    if (strokeColor) {
      attributes.stroke = strokeColor;
      attributes['stroke-width'] = strokeWidth;
    }
    
    this.elements.push({
      type: 'circle',
      attributes: attributes
    });
  }

  drawLine(options) {
    this.validateOptions(options, ['x1', 'y1', 'x2', 'y2']);
    
    const { x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 1, strokeStyle = 'solid' } = options;
    
    const attributes = {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      stroke: strokeColor,
      'stroke-width': strokeWidth
    };
    
    // Set stroke dash pattern
    if (strokeStyle === 'dashed') {
      attributes['stroke-dasharray'] = '5,5';
    } else if (strokeStyle === 'dotted') {
      attributes['stroke-dasharray'] = '2,2';
    }
    
    this.elements.push({
      type: 'line',
      attributes: attributes
    });
  }

  drawPolygon(options) {
    this.validateOptions(options, ['points']);
    
    const { points, fillColor, strokeColor, strokeWidth = 1, fillAlpha = 1.0, strokeStyle = 'solid' } = options;
    
    if (!Array.isArray(points) || points.length < 3) {
      throw new Error('Polygon requires at least 3 points');
    }
    
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    
    const attributes = {
      points: pointsStr
    };
    
    if (fillColor) {
      attributes.fill = fillColor;
      if (fillAlpha < 1.0) {
        attributes['fill-opacity'] = fillAlpha;
      }
    } else {
      attributes.fill = 'none';
    }
    
    if (strokeColor) {
      attributes.stroke = strokeColor;
      attributes['stroke-width'] = strokeWidth;
      
      // Set stroke dash pattern
      if (strokeStyle === 'dashed') {
        attributes['stroke-dasharray'] = '5,5';
      } else if (strokeStyle === 'dotted') {
        attributes['stroke-dasharray'] = '2,2';
      }
    }
    
    this.elements.push({
      type: 'polygon',
      attributes: attributes
    });
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
    
    const attributes = {
      x: x,
      y: y,
      fill: color,
      'font-family': this.parseFontFamily(font),
      'font-size': this.parseFontSize(font)
    };
    
    // Text alignment
    if (align === 'center') {
      attributes['text-anchor'] = 'middle';
    } else if (align === 'right') {
      attributes['text-anchor'] = 'end';
    }
    
    // Baseline alignment
    if (baseline === 'middle') {
      attributes['dominant-baseline'] = 'middle';
    } else if (baseline === 'bottom') {
      attributes['dominant-baseline'] = 'baseline';
    }
    
    this.elements.push({
      type: 'text',
      attributes: attributes,
      content: this.escapeXML(text)
    });
  }

  drawPath(options) {
    this.validateOptions(options, ['path']);
    
    const { path, fillColor, strokeColor, strokeWidth = 1 } = options;
    
    const attributes = {
      d: path
    };
    
    if (fillColor) {
      attributes.fill = fillColor;
    } else {
      attributes.fill = 'none';
    }
    
    if (strokeColor) {
      attributes.stroke = strokeColor;
      attributes['stroke-width'] = strokeWidth;
    }
    
    this.elements.push({
      type: 'path',
      attributes: attributes
    });
  }

  drawImage(options) {
    this.validateOptions(options, ['image', 'x', 'y']);
    
    const { image, x, y, width, height } = options;
    
    const attributes = {
      x: x,
      y: y,
      href: typeof image === 'string' ? image : image.src || image.url
    };
    
    if (width !== undefined) {
      attributes.width = width;
    }
    if (height !== undefined) {
      attributes.height = height;
    }
    
    this.elements.push({
      type: 'image',
      attributes: attributes
    });
  }

  onTransformChanged() {
    // SVG handles transforms differently - could add transform groups here
  }

  toDataURL(format = 'image/svg+xml') {
    const svgString = this.toSVG();
    if (format === 'image/svg+xml') {
      return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
    } else {
      throw new Error(`Format ${format} not supported by SVG engine`);
    }
  }

  toBuffer(format = 'svg') {
    const svgString = this.toSVG();
    return Buffer.from(svgString, 'utf8');
  }

  toSVG() {
    let svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add definitions if any
    if (this.definitions.size > 0) {
      svg += '<defs>';
      this.definitions.forEach(def => svg += def);
      svg += '</defs>';
    }
    
    // Add transform group if needed
    if (this.zoom !== 1.0 || this.panX !== 0 || this.panY !== 0) {
      svg += `<g transform="scale(${this.zoom}) translate(${this.panX}, ${this.panY})">`;
    }
    
    // Add elements
    this.elements.forEach(element => {
      svg += this.elementToSVG(element);
    });
    
    // Close transform group if opened
    if (this.zoom !== 1.0 || this.panX !== 0 || this.panY !== 0) {
      svg += '</g>';
    }
    
    svg += '</svg>';
    
    return svg;
  }

  elementToSVG(element) {
    const { type, attributes, content } = element;
    
    let svg = `<${type}`;
    
    // Add attributes
    Object.entries(attributes).forEach(([key, value]) => {
      svg += ` ${key}="${value}"`;
    });
    
    if (content) {
      svg += `>${content}</${type}>`;
    } else {
      svg += '/>';
    }
    
    return svg;
  }

  // Utility methods
  parseFontFamily(font) {
    const match = font.match(/([^0-9]+)$/);
    return match ? match[1].trim() : 'Arial';
  }

  parseFontSize(font) {
    const match = font.match(/(\d+(?:\.\d+)?)px/);
    return match ? match[1] + 'px' : '12px';
  }

  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // SVG-specific methods
  addGradient(id, stops, type = 'linear') {
    let gradient = `<${type}Gradient id="${id}">`;
    stops.forEach(stop => {
      gradient += `<stop offset="${stop.offset}" stop-color="${stop.color}" />`;
    });
    gradient += `</${type}Gradient>`;
    
    this.definitions.add(gradient);
  }

  saveToFile(filename) {
    const fs = require('fs');
    const svgContent = this.toSVG();
    fs.writeFileSync(filename, svgContent, 'utf8');
    console.log(`💾 Saved SVG to ${filename}`);
  }

  async saveToFileAsync(filename) {
    const fs = require('fs').promises;
    const svgContent = this.toSVG();
    await fs.writeFile(filename, svgContent, 'utf8');
    console.log(`💾 Saved SVG to ${filename}`);
  }
}

module.exports = SVGCanvasEngine;