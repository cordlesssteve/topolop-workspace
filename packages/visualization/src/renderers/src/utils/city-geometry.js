class CityGeometry {
  static generateDistrictBoundary(district) {
    const { x, y, size, population } = district;
    const sides = Math.max(6, Math.min(12, Math.floor(population / 5) + 6));
    const points = [];
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const radius = size * (0.8 + 0.4 * Math.random()); // Irregular boundary
      points.push({
        x: x + radius * Math.cos(angle),
        y: y + radius * Math.sin(angle)
      });
    }
    
    return points;
  }

  static computeForceLayout(nodes, options = {}) {
    const {
      nodeRadius = 50,
      linkDistance = 100,
      centerForce = 0.1,
      iterations = 300,
      width = 1200,
      height = 800
    } = options;

    // Initialize positions randomly
    const positions = nodes.map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0
    }));

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - (iter / iterations);
      
      // Apply repulsive forces between nodes
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = (nodeRadius * nodeRadius) / distance;
            const fx = (dx / distance) * force * alpha;
            const fy = (dy / distance) * force * alpha;
            
            positions[i].vx -= fx;
            positions[i].vy -= fy;
            positions[j].vx += fx;
            positions[j].vy += fy;
          }
        }
      }

      // Apply centering force
      const centerX = width / 2;
      const centerY = height / 2;
      
      positions.forEach(pos => {
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;
        pos.vx += dx * centerForce * alpha;
        pos.vy += dy * centerForce * alpha;
      });

      // Update positions
      positions.forEach(pos => {
        pos.x += pos.vx;
        pos.y += pos.vy;
        pos.vx *= 0.9; // Damping
        pos.vy *= 0.9;
        
        // Keep within bounds
        pos.x = Math.max(nodeRadius, Math.min(width - nodeRadius, pos.x));
        pos.y = Math.max(nodeRadius, Math.min(height - nodeRadius, pos.y));
      });
    }

    return positions;
  }

  static positionBuildingsInDistrict(buildings, district) {
    const { x: centerX, y: centerY, size } = district;
    const radius = size * 0.8;
    
    // Use a spiral pattern for building placement
    buildings.forEach((building, index) => {
      const angle = index * 2.4; // Golden angle for good distribution
      const r = radius * Math.sqrt(index / buildings.length);
      
      building.x = centerX + r * Math.cos(angle);
      building.y = centerY + r * Math.sin(angle);
      
      // Add some randomness to avoid perfect grid
      building.x += (Math.random() - 0.5) * 20;
      building.y += (Math.random() - 0.5) * 20;
    });
  }

  static calculateShortestPath(from, to, obstacles = []) {
    // Simplified A* pathfinding for road layout
    const start = { x: from.x, y: from.y, g: 0, h: 0, f: 0, parent: null };
    const goal = { x: to.x, y: to.y };
    
    const openSet = [start];
    const closedSet = [];
    const gridSize = 20;

    const heuristic = (a, b) => {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    };

    const getNeighbors = (node) => {
      const neighbors = [];
      const directions = [
        { x: 0, y: -gridSize }, // North
        { x: gridSize, y: 0 },  // East
        { x: 0, y: gridSize },  // South
        { x: -gridSize, y: 0 }  // West
      ];

      directions.forEach(dir => {
        const neighbor = {
          x: node.x + dir.x,
          y: node.y + dir.y,
          g: node.g + gridSize,
          parent: node
        };

        neighbor.h = heuristic(neighbor, goal);
        neighbor.f = neighbor.g + neighbor.h;
        neighbors.push(neighbor);
      });

      return neighbors;
    };

    while (openSet.length > 0) {
      // Find node with lowest f score
      let current = openSet[0];
      let currentIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < current.f) {
          current = openSet[i];
          currentIndex = i;
        }
      }

      // Remove current from open set and add to closed set
      openSet.splice(currentIndex, 1);
      closedSet.push(current);

      // Check if we reached the goal
      if (Math.abs(current.x - goal.x) < gridSize && Math.abs(current.y - goal.y) < gridSize) {
        const path = [];
        let temp = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return path.reverse();
      }

      // Explore neighbors
      const neighbors = getNeighbors(current);
      
      for (const neighbor of neighbors) {
        // Skip if in closed set
        if (closedSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
          continue;
        }

        // Skip if obstacle
        const hasObstacle = obstacles.some(obstacle => {
          const dx = obstacle.x - neighbor.x;
          const dy = obstacle.y - neighbor.y;
          return Math.sqrt(dx * dx + dy * dy) < obstacle.radius;
        });
        
        if (hasObstacle) continue;

        // Add to open set if not already there
        const existingNode = openSet.find(node => node.x === neighbor.x && node.y === neighbor.y);
        if (!existingNode) {
          openSet.push(neighbor);
        } else if (neighbor.g < existingNode.g) {
          existingNode.g = neighbor.g;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = neighbor.parent;
        }
      }
    }

    // No path found, return direct line
    return [from, to];
  }

  static generateLandmarkShape(landmark) {
    const { x, y, size, type } = landmark;
    
    switch (type) {
      case 'tower':
        return [
          { x: x - size/4, y: y + size/2 },
          { x: x + size/4, y: y + size/2 },
          { x: x + size/6, y: y - size/2 },
          { x: x - size/6, y: y - size/2 }
        ];
      
      case 'monument':
        const points = [];
        const sides = 8;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides;
          const radius = i % 2 === 0 ? size : size * 0.7;
          points.push({
            x: x + radius * Math.cos(angle),
            y: y + radius * Math.sin(angle)
          });
        }
        return points;
      
      default: // Default to diamond shape
        return [
          { x: x, y: y - size },
          { x: x + size, y: y },
          { x: x, y: y + size },
          { x: x - size, y: y }
        ];
    }
  }

  static interpolatePath(points, segments = 10) {
    if (points.length < 2) return points;
    
    const interpolated = [points[0]];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      for (let t = 1; t <= segments; t++) {
        const ratio = t / segments;
        interpolated.push({
          x: p1.x + (p2.x - p1.x) * ratio,
          y: p1.y + (p2.y - p1.y) * ratio
        });
      }
    }
    
    return interpolated;
  }

  static calculateBoundingBox(points) {
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  static isPointInPolygon(point, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  static generateGridLayout(items, bounds, cellSize = 50) {
    const cols = Math.floor(bounds.width / cellSize);
    const rows = Math.floor(bounds.height / cellSize);
    const positions = [];
    
    let index = 0;
    for (let row = 0; row < rows && index < items.length; row++) {
      for (let col = 0; col < cols && index < items.length; col++) {
        positions.push({
          x: bounds.x + col * cellSize + cellSize / 2,
          y: bounds.y + row * cellSize + cellSize / 2,
          item: items[index]
        });
        index++;
      }
    }
    
    return positions;
  }
}

module.exports = CityGeometry;