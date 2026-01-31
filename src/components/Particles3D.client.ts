/**
 * Particles 3D Animation
 * Ultra-lightweight canvas animation with "faux 3D" effect
 * Respects prefers-reduced-motion and low-performance devices
 */

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export function mountParticles(canvas: HTMLCanvasElement): () => void {
  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return () => {};
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return () => {};
  }

  // Device pixel ratio (capped for performance)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Configuration
  const config = {
    particleCount: 50,
    baseColor: "#7B7A2A", // olive
    accentColor: "#8B4A2B", // terracotta
    minOpacity: 0.15,
    maxOpacity: 0.5,
    minSize: 1.5,
    maxSize: 4,
    speed: 0.0004,
    connectionDistance: 120,
    connectionOpacity: 0.08
  };

  // Particles array
  const particles: Particle[] = [];

  // Resize handler
  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
  };

  // Initialize particles
  const initParticles = (): void => {
    particles.length = 0;
    for (let i = 0; i < config.particleCount; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        vz: (Math.random() - 0.5) * config.speed * 0.5
      });
    }
  };

  // Hex to RGB helper
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 123, g: 122, b: 42 };
  };

  const baseRgb = hexToRgb(config.baseColor);
  const accentRgb = hexToRgb(config.accentColor);

  // Animation frame
  let animationId = 0;
  let isRunning = true;

  const animate = (): void => {
    if (!isRunning) return;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    // Update and draw particles
    for (const p of particles) {
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Boundary bounce
      if (p.x < 0 || p.x > 1) {
        p.vx *= -1;
        p.x = Math.max(0, Math.min(1, p.x));
      }
      if (p.y < 0 || p.y > 1) {
        p.vy *= -1;
        p.y = Math.max(0, Math.min(1, p.y));
      }
      if (p.z < 0 || p.z > 1) {
        p.vz *= -1;
        p.z = Math.max(0, Math.min(1, p.z));
      }

      // Calculate screen position with perspective
      const perspective = 0.5 + p.z * 0.5;
      const px = p.x * width;
      const py = p.y * height;

      // Size based on Z depth
      const size = (config.minSize + p.z * (config.maxSize - config.minSize)) * perspective;

      // Opacity based on Z depth
      const opacity = config.minOpacity + p.z * (config.maxOpacity - config.minOpacity);

      // Color blend based on position
      const colorBlend = p.x;
      const r = Math.round(baseRgb.r + (accentRgb.r - baseRgb.r) * colorBlend);
      const g = Math.round(baseRgb.g + (accentRgb.g - baseRgb.g) * colorBlend);
      const b = Math.round(baseRgb.b + (accentRgb.b - baseRgb.b) * colorBlend);

      // Draw particle
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      ctx.fill();
    }

    // Draw connections (limited for performance)
    ctx.strokeStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${config.connectionOpacity})`;
    ctx.lineWidth = 0.5;

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        const dx = (p1.x - p2.x) * width;
        const dy = (p1.y - p2.y) * height;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < config.connectionDistance) {
          const opacity = (1 - distance / config.connectionDistance) * config.connectionOpacity;
          ctx.strokeStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${opacity})`;
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(animate);
  };

  // Initialize
  resize();
  initParticles();
  animate();

  // Event listeners
  window.addEventListener("resize", resize, { passive: true });

  // Pause when not visible (performance optimization)
  const handleVisibility = (): void => {
    if (document.hidden) {
      isRunning = false;
      cancelAnimationFrame(animationId);
    } else {
      isRunning = true;
      animate();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  // Cleanup function
  return () => {
    isRunning = false;
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
