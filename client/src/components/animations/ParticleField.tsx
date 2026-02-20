import { useRef } from 'react';
import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

interface ParticleFieldProps {
  /** Whether particles should converge to center (active generation) */
  converging?: boolean;
  /** Number of particles */
  count?: number;
  /** CSS class for container */
  className?: string;
  /** Particle color — defaults to accent */
  color?: string;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
  }));
}

function ParticleField({
  converging = false,
  count = 40,
  className = '',
  color = 'var(--bmn-color-accent)',
}: ParticleFieldProps) {
  const particlesRef = useRef<Particle[]>(generateParticles(count));
  const particles = particlesRef.current;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={
            converging
              ? {
                  left: '50%',
                  top: '50%',
                  opacity: [0.3, 0.8, 0],
                  scale: [1, 1.5, 0],
                }
              : {
                  x: [0, (Math.random() - 0.5) * 60, 0],
                  y: [0, (Math.random() - 0.5) * 60, 0],
                  opacity: [0.15, 0.4, 0.15],
                }
          }
          transition={{
            duration: converging ? p.duration * 0.6 : p.duration,
            delay: p.delay,
            repeat: converging ? 0 : Infinity,
            repeatType: 'reverse',
            ease: converging ? 'easeIn' : 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export { ParticleField };
export type { ParticleFieldProps };
