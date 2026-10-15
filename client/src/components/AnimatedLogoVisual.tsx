import React, { useState } from 'react';

export const AnimatedLogoVisual: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = -((e.clientY - rect.top) / rect.height - 0.5) * 16;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // Node tip coordinates in 1254x1254 viewBox
  const nodes = [
    { id: 'node-top', cx: 715, cy: 172 },
    { id: 'node-right', cx: 1095, cy: 735 },
    { id: 'node-bottom', cx: 540, cy: 1080 },
    { id: 'node-left', cx: 150, cy: 595 },
  ];

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full min-h-[520px] flex items-center justify-center overflow-hidden bg-white select-none"
    >
      <style>{`
        @keyframes logoLevitate {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-16px) scale(1.02);
          }
        }

        @keyframes auraGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.03);
          }
        }

        @keyframes rippleWave {
          0% {
            r: 28px;
            opacity: 0.8;
            stroke-width: 3px;
          }
          100% {
            r: 65px;
            opacity: 0;
            stroke-width: 0.5px;
          }
        }

        @keyframes ambientDrift {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          50% {
            transform: translate(20px, -20px) scale(1.06);
          }
        }

        .anim-logo-float {
          animation: logoLevitate 6.5s ease-in-out infinite;
        }

        .anim-aura-pulse {
          animation: auraGlow 4s ease-in-out infinite;
        }

        .anim-ripple-1 {
          animation: rippleWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }

        .anim-ripple-2 {
          animation: rippleWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 1.4s;
        }

        .anim-ambient-drift {
          animation: ambientDrift 12s ease-in-out infinite;
        }
      `}</style>

      {/* Signature Soft Ambient Color Blooms behind the logo on White Canvas */}
      <div
        aria-hidden
        className="anim-ambient-drift pointer-events-none absolute"
        style={{
          width: 580,
          height: 580,
          filter: 'blur(95px)',
          opacity: 0.45,
          zIndex: 0,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div style={{ position: 'absolute', left: '15%', top: '15%', width: 240, height: 240, borderRadius: '50%', background: '#8789FF' }} />
          <div style={{ position: 'absolute', right: '15%', top: '12%', width: 240, height: 240, borderRadius: '50%', background: '#82FFCF' }} />
          <div style={{ position: 'absolute', right: '12%', bottom: '15%', width: 240, height: 240, borderRadius: '50%', background: '#FF99E7' }} />
          <div style={{ position: 'absolute', left: '12%', bottom: '12%', width: 240, height: 240, borderRadius: '50%', background: '#FFFD99' }} />
        </div>
      </div>

      {/* Subtle Concentric Scientific Measurement Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[480px] h-[480px] rounded-full border border-dashed border-[#CBD5E1]" />
        <div className="absolute w-[320px] h-[320px] rounded-full border border-[#CBD5E1]/60" />
      </div>

      {/* Interactive 3D Card / Frame */}
      <div
        style={{
          transform: `perspective(900px) rotateX(${mousePos.y}deg) rotateY(${mousePos.x}deg)`,
          transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="relative z-10 w-full max-w-[460px] max-h-[460px] aspect-square flex items-center justify-center"
      >
        {/* Floating Animated Logo Container */}
        <div className="anim-logo-float w-full h-full relative flex items-center justify-center">
          <svg
            viewBox="0 0 1254 1254"
            className="w-full h-full overflow-visible drop-shadow-[0_20px_40px_rgba(96,85,232,0.18)]"
            fill="none"
          >
            <defs>
              {/* Soft Glow Filter for Orbiting Energy Particles and Rings */}
              <filter id="logo-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Radiant Gradient for Logo Depth */}
              <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7B6CF5" />
                <stop offset="45%" stopColor="#6055E8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>

              {/* Central Orbital Path 1 (Tilted -24 deg) */}
              <path
                id="orbit-track-1"
                d="M 627 482 A 330 145 -24 1 1 626.9 482 Z"
                fill="none"
              />

              {/* Central Orbital Path 2 (Tilted 66 deg) */}
              <path
                id="orbit-track-2"
                d="M 627 482 A 330 145 66 1 1 626.9 482 Z"
                fill="none"
              />
            </defs>

            {/* Layer 1: Ambient Glowing Aura behind the logo */}
            <g className="anim-aura-pulse" filter="url(#logo-glow)" opacity="0.45">
              <image
                href="/logo.svg"
                x="0"
                y="0"
                width="1254"
                height="1254"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>

            {/* Layer 2: Main Crisp Vector Logo */}
            <g className="main-logo-vector">
              <image
                href="/logo.svg"
                x="0"
                y="0"
                width="1254"
                height="1254"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>

            {/* Layer 3: Expanding Energy Ripples at the 4 Atomic Nodes */}
            <g className="node-energy-ripples">
              {nodes.map((node) => (
                <g key={node.id}>
                  {/* Outer Ripple 1 */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    className="anim-ripple-1"
                    fill="none"
                    stroke="#6055E8"
                    opacity="0.8"
                  />
                  {/* Outer Ripple 2 (phase-delayed) */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    className="anim-ripple-2"
                    fill="none"
                    stroke="#8789FF"
                    opacity="0.8"
                  />
                  {/* Inner Glowing Core Sparkle */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r="8"
                    fill="#FFFFFF"
                    opacity="0.85"
                    filter="url(#particle-glow)"
                  />
                </g>
              ))}
            </g>

            {/* Layer 4: Orbiting Quantum Particles along the 2 Orbital Loops */}
            <g className="orbital-quantum-particles">
              {/* Particle on Loop 1 */}
              <g>
                <circle r="9" fill="#82FFCF" filter="url(#particle-glow)">
                  <animateMotion dur="4.2s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#orbit-track-1" />
                  </animateMotion>
                </circle>
                <circle r="4" fill="#FFFFFF">
                  <animateMotion dur="4.2s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#orbit-track-1" />
                  </animateMotion>
                </circle>
              </g>

              {/* Particle on Loop 2 */}
              <g>
                <circle r="9" fill="#FF99E7" filter="url(#particle-glow)">
                  <animateMotion dur="4.8s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1">
                    <mpath href="#orbit-track-2" />
                  </animateMotion>
                </circle>
                <circle r="4" fill="#FFFFFF">
                  <animateMotion dur="4.8s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1">
                    <mpath href="#orbit-track-2" />
                  </animateMotion>
                </circle>
              </g>

              {/* Secondary Fast Particle on Loop 1 */}
              <g>
                <circle r="6" fill="#8789FF" filter="url(#particle-glow)">
                  <animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto" keyPoints="0.5;1;0.5" keyTimes="0;0.5;1">
                    <mpath href="#orbit-track-1" />
                  </animateMotion>
                </circle>
                <circle r="2.5" fill="#FFFFFF">
                  <animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto" keyPoints="0.5;1;0.5" keyTimes="0;0.5;1">
                    <mpath href="#orbit-track-1" />
                  </animateMotion>
                </circle>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
