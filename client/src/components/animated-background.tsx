import { useEffect, useRef, useState } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
      fadeDirection: number;
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = (): Particle => {
      const colors = [
        "rgba(59, 130, 246,", // blue
        "rgba(220, 38, 38,",  // red
        "rgba(148, 163, 184,", // slate/neutral
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];

      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.08 + 0.02,
        color,
        fadeDirection: Math.random() > 0.5 ? 1 : -1,
      };
    };

    const init = () => {
      resize();
      // Fewer particles for performance
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 25000), 40);
      particles = Array.from({ length: count }, createParticle);
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Move
        p.x += p.speedX;
        p.y += p.speedY;

        // Gentle opacity pulse
        p.opacity += p.fadeDirection * 0.0003;
        if (p.opacity > 0.1) p.fadeDirection = -1;
        if (p.opacity < 0.02) p.fadeDirection = 1;

        // Wrap around edges
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        // Draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity})`;
        ctx.fill();

        // Draw glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity * 0.3})`;
        ctx.fill();
      });

      // Draw subtle connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.03 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener("resize", init);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", init);
    };
    } catch {
      setHasError(true);
    }
  }, []);

  if (hasError) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
