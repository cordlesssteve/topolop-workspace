class CityAnimations {
  constructor() {
    this.animationState = {
      buildingGrowth: new Map(),
      trafficParticles: new Map(),
      constructionProgress: new Map(),
      timeScale: 1.0,
      isPaused: false,
      startTime: Date.now()
    };
    this.animationFrame = null;
  }

  startAnimations() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    const animate = () => {
      if (!this.animationState.isPaused) {
        this.updateAnimations();
      }
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
  }

  stopAnimations() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  pauseAnimations() {
    this.animationState.isPaused = true;
  }

  resumeAnimations() {
    this.animationState.isPaused = false;
  }

  setTimeScale(scale) {
    this.animationState.timeScale = Math.max(0.1, Math.min(10, scale));
  }

  initializeBuildingGrowth(buildings, options = {}) {
    const {
      growthDuration = 3000, // 3 seconds
      staggerDelay = 100,    // 100ms between buildings
      easeFunction = 'easeOutBounce'
    } = options;

    buildings.forEach((building, index) => {
      const startTime = Date.now() + (index * staggerDelay);
      
      this.animationState.buildingGrowth.set(building.id, {
        targetHeight: building.height,
        currentHeight: 0,
        startTime: startTime,
        duration: growthDuration,
        easeFunction: easeFunction,
        isComplete: false
      });
    });
  }

  initializeTrafficFlow(trafficFlows) {
    trafficFlows.forEach(flow => {
      const particles = this.generateTrafficParticles(flow);
      this.animationState.trafficParticles.set(flow.id, {
        particles: particles,
        flow: flow,
        lastSpawnTime: Date.now()
      });
    });
  }

  initializeConstructionAnimation(constructionSites) {
    constructionSites.forEach(site => {
      this.animationState.constructionProgress.set(site.id, {
        progress: site.progress,
        targetProgress: Math.min(1.0, site.progress + 0.1),
        animationSpeed: 0.002, // Progress per frame
        effects: this.generateConstructionEffects(site)
      });
    });
  }

  updateAnimations() {
    const currentTime = Date.now();
    const deltaTime = 16 * this.animationState.timeScale; // ~60fps scaled

    // Update building growth animations
    this.updateBuildingGrowth(currentTime);

    // Update traffic particle animations
    this.updateTrafficParticles(currentTime, deltaTime);

    // Update construction animations
    this.updateConstructionAnimations(deltaTime);
  }

  updateBuildingGrowth(currentTime) {
    for (const [buildingId, animation] of this.animationState.buildingGrowth.entries()) {
      if (animation.isComplete) continue;

      const elapsed = currentTime - animation.startTime;
      
      if (elapsed >= 0) { // Animation has started
        const progress = Math.min(1, elapsed / animation.duration);
        const easedProgress = this.applyEasing(progress, animation.easeFunction);
        
        animation.currentHeight = animation.targetHeight * easedProgress;
        
        if (progress >= 1) {
          animation.isComplete = true;
        }
      }
    }
  }

  updateTrafficParticles(currentTime, deltaTime) {
    for (const [flowId, trafficData] of this.animationState.trafficParticles.entries()) {
      const { particles, flow, lastSpawnTime } = trafficData;

      // Spawn new particles
      const spawnInterval = 1000 / (flow.volume || 1); // Milliseconds between spawns
      if (currentTime - lastSpawnTime > spawnInterval) {
        const newParticle = this.createTrafficParticle(flow);
        particles.push(newParticle);
        trafficData.lastSpawnTime = currentTime;

        // Limit number of particles to prevent performance issues
        if (particles.length > 50) {
          particles.splice(0, particles.length - 50);
        }
      }

      // Update existing particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        particle.progress += particle.speed * (deltaTime / 1000);
        
        if (particle.progress >= 1) {
          particles.splice(i, 1); // Remove completed particle
        } else {
          // Update particle position along the path
          this.updateParticlePosition(particle);
        }
      }
    }
  }

  updateConstructionAnimations(deltaTime) {
    for (const [siteId, construction] of this.animationState.constructionProgress.entries()) {
      if (construction.progress < construction.targetProgress) {
        construction.progress += construction.animationSpeed * deltaTime;
        construction.progress = Math.min(construction.progress, construction.targetProgress);
      }

      // Update construction effects
      construction.effects.forEach(effect => {
        effect.age += deltaTime;
        effect.alpha = Math.max(0, 1 - (effect.age / effect.lifetime));
        
        // Update effect positions
        if (effect.type === 'dust') {
          effect.x += effect.vx * deltaTime;
          effect.y += effect.vy * deltaTime;
          effect.vy += 0.001 * deltaTime; // Gravity
        }
      });

      // Remove expired effects
      construction.effects = construction.effects.filter(effect => effect.alpha > 0);

      // Generate new effects periodically
      if (Math.random() < 0.1) { // 10% chance per update
        construction.effects.push(...this.generateConstructionEffects({
          id: siteId,
          buildingId: siteId.replace('construction_', '')
        }));
      }
    }
  }

  generateTrafficParticles(flow) {
    const particles = [];
    const initialCount = Math.min(10, flow.volume);

    for (let i = 0; i < initialCount; i++) {
      particles.push(this.createTrafficParticle(flow));
    }

    return particles;
  }

  createTrafficParticle(flow) {
    return {
      id: `particle_${Date.now()}_${Math.random()}`,
      flowId: flow.id,
      progress: 0,
      speed: flow.speed || 0.5,
      size: this.getParticleSize(flow.vehicleType),
      color: this.getParticleColor(flow.vehicleType),
      path: flow.path || [flow.from, flow.to],
      x: flow.from.x,
      y: flow.from.y,
      rotation: 0
    };
  }

  updateParticlePosition(particle) {
    if (!particle.path || particle.path.length < 2) return;

    const totalSegments = particle.path.length - 1;
    const segmentLength = 1.0 / totalSegments;
    const currentSegmentIndex = Math.floor(particle.progress / segmentLength);
    const segmentProgress = (particle.progress % segmentLength) / segmentLength;

    if (currentSegmentIndex < totalSegments) {
      const from = particle.path[currentSegmentIndex];
      const to = particle.path[currentSegmentIndex + 1];

      particle.x = from.x + (to.x - from.x) * segmentProgress;
      particle.y = from.y + (to.y - from.y) * segmentProgress;

      // Calculate rotation for particle direction
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      particle.rotation = Math.atan2(dy, dx);
    }
  }

  generateConstructionEffects(site) {
    const effects = [];
    const building = this.getBuildingById(site.buildingId);
    
    if (!building) return effects;

    // Generate dust particles
    for (let i = 0; i < 3; i++) {
      effects.push({
        type: 'dust',
        x: building.x + (Math.random() - 0.5) * building.width,
        y: building.y + (Math.random() - 0.5) * building.depth,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -(Math.random() * 0.2 + 0.05),
        size: Math.random() * 3 + 1,
        color: `rgba(139, 115, 85, 0.6)`, // Dust brown
        age: 0,
        lifetime: 2000 + Math.random() * 1000,
        alpha: 1
      });
    }

    // Generate spark effects for certain construction types
    if (Math.random() < 0.3) {
      for (let i = 0; i < 2; i++) {
        effects.push({
          type: 'spark',
          x: building.x + (Math.random() - 0.5) * building.width * 0.5,
          y: building.y + (Math.random() - 0.5) * building.depth * 0.5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(Math.random() * 0.4 + 0.1),
          size: Math.random() * 2 + 0.5,
          color: `rgba(255, 165, 0, 0.8)`, // Orange spark
          age: 0,
          lifetime: 800 + Math.random() * 400,
          alpha: 1
        });
      }
    }

    return effects;
  }

  applyEasing(t, easingFunction) {
    switch (easingFunction) {
      case 'easeOutBounce':
        return this.easeOutBounce(t);
      case 'easeOutElastic':
        return this.easeOutElastic(t);
      case 'easeInOutCubic':
        return this.easeInOutCubic(t);
      case 'easeOutQuart':
        return this.easeOutQuart(t);
      default:
        return t; // Linear
    }
  }

  easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }

  easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  getParticleSize(vehicleType) {
    const sizes = {
      'car': 3,
      'truck': 5,
      'data': 2,
      'signal': 1.5,
      'message': 2.5
    };
    return sizes[vehicleType] || 2;
  }

  getParticleColor(vehicleType) {
    const colors = {
      'car': '#4CAF50',
      'truck': '#FF9800',
      'data': '#2196F3',
      'signal': '#E91E63',
      'message': '#9C27B0'
    };
    return colors[vehicleType] || '#757575';
  }

  getBuildingAnimationHeight(buildingId) {
    const animation = this.animationState.buildingGrowth.get(buildingId);
    return animation ? animation.currentHeight : null;
  }

  getTrafficParticles(flowId) {
    const trafficData = this.animationState.trafficParticles.get(flowId);
    return trafficData ? trafficData.particles : [];
  }

  getConstructionEffects(siteId) {
    const construction = this.animationState.constructionProgress.get(siteId);
    return construction ? construction.effects : [];
  }

  getConstructionProgress(siteId) {
    const construction = this.animationState.constructionProgress.get(siteId);
    return construction ? construction.progress : 0;
  }

  getBuildingById(buildingId) {
    // This would need to be injected or accessed from the city renderer
    // For now, return null and let the calling code handle it
    return null;
  }

  reset() {
    this.stopAnimations();
    this.animationState.buildingGrowth.clear();
    this.animationState.trafficParticles.clear();
    this.animationState.constructionProgress.clear();
    this.animationState.startTime = Date.now();
  }

  getAnimationStats() {
    return {
      buildingsAnimating: Array.from(this.animationState.buildingGrowth.values())
        .filter(anim => !anim.isComplete).length,
      totalTrafficParticles: Array.from(this.animationState.trafficParticles.values())
        .reduce((sum, data) => sum + data.particles.length, 0),
      constructionSites: this.animationState.constructionProgress.size,
      timeScale: this.animationState.timeScale,
      isPaused: this.animationState.isPaused,
      uptime: Date.now() - this.animationState.startTime
    };
  }
}

module.exports = CityAnimations;