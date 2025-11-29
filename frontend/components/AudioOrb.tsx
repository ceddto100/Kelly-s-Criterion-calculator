import React, { useState, useRef, useEffect } from 'react';

interface AudioOrbProps {
  audioSrc: string;
  label: string;
  icon?: string;
}

export const AudioOrb: React.FC<AudioOrbProps> = ({ audioSrc, label, icon = '🎧' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(audioSrc);

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
      }
    };
  }, [audioSrc]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="audio-orb-container">
      <button
        className={`audio-orb ${isPlaying ? 'playing' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={togglePlay}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isPlaying ? 'Pause quick guide audio' : 'Play quick guide audio'}
      >
        {/* Outer glow layers */}
        <div className="orb-glow-outer"></div>
        <div className="orb-glow-mid"></div>

        {/* Rotating gradient ring */}
        <div className="orb-ring"></div>

        {/* Particle effects */}
        <div className="orb-particle orb-particle-1"></div>
        <div className="orb-particle orb-particle-2"></div>
        <div className="orb-particle orb-particle-3"></div>
        <div className="orb-particle orb-particle-4"></div>

        {/* Main orb */}
        <div className="orb-inner">
          <div className="orb-shimmer"></div>
          <div className="orb-core">
            <div className="orb-gradient-layer"></div>
            {isPlaying ? (
              // Pause icon
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="orb-icon">
                <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              // Play icon
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="orb-icon">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor"/>
              </svg>
            )}
          </div>
        </div>

        {/* Ripple effects */}
        <div className="orb-ripple"></div>
        <div className="orb-ripple-2"></div>
        <div className="orb-ripple-3"></div>
      </button>
      <p className="audio-orb-label">
        <span className="label-icon">{icon}</span> {label}
      </p>
    </div>
  );
};

export const AudioOrbStyles = () => `
    .audio-orb-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      margin: 2rem 0;
      perspective: 1000px;
    }

    .audio-orb {
      position: relative;
      width: 140px;
      height: 140px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-style: preserve-3d;
    }

    .audio-orb:hover {
      transform: scale(1.15) rotateY(5deg);
    }

    .audio-orb:active {
      transform: scale(0.92);
    }

    /* Outer glow layers */
    .orb-glow-outer {
      position: absolute;
      inset: -30px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(var(--orb-primary-rgb), 0.6) 0%,
        rgba(var(--orb-secondary-rgb), 0.4) 40%,
        transparent 70%
      );
      filter: blur(30px);
      opacity: 0.5;
      animation: pulse-glow 3s ease-in-out infinite;
      z-index: 0;
    }

    .orb-glow-mid {
      position: absolute;
      inset: -20px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(var(--orb-primary-rgb), 0.8) 0%,
        rgba(var(--orb-tertiary-rgb), 0.5) 50%,
        transparent 70%
      );
      filter: blur(25px);
      opacity: 0.4;
      animation: pulse-glow 2s ease-in-out infinite;
      z-index: 0;
    }

    /* Rotating gradient ring */
    .orb-ring {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        rgba(var(--orb-primary-rgb), 0.8),
        rgba(var(--orb-secondary-rgb), 0.8),
        rgba(var(--orb-tertiary-rgb), 0.8),
        rgba(var(--orb-primary-rgb), 0.8)
      );
      opacity: 0;
      animation: rotate 4s linear infinite;
      z-index: 1;
      transition: opacity 0.3s ease;
    }

    .audio-orb.playing .orb-ring {
      opacity: 0.6;
    }

    .audio-orb:hover .orb-ring {
      opacity: 0.8;
      animation: rotate 2s linear infinite;
    }

    /* Orbital particles */
    .orb-particle {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(var(--orb-primary-rgb), 1), rgba(var(--orb-primary-rgb), 0.2));
      opacity: 0;
      z-index: 3;
      box-shadow: 0 0 12px rgba(var(--orb-primary-rgb), 0.8);
    }

    .audio-orb.playing .orb-particle {
      opacity: 1;
    }

    .orb-particle-1 {
      animation: orbit1 3s linear infinite;
    }

    .orb-particle-2 {
      animation: orbit2 3s linear infinite;
      background: radial-gradient(circle, rgba(var(--orb-secondary-rgb), 1), rgba(var(--orb-secondary-rgb), 0.2));
      box-shadow: 0 0 12px rgba(var(--orb-secondary-rgb), 0.8);
    }

    .orb-particle-3 {
      animation: orbit3 3s linear infinite;
      background: radial-gradient(circle, rgba(var(--orb-tertiary-rgb), 1), rgba(var(--orb-tertiary-rgb), 0.2));
      box-shadow: 0 0 12px rgba(var(--orb-tertiary-rgb), 0.8);
    }

    .orb-particle-4 {
      animation: orbit4 3s linear infinite;
    }

    /* Main orb structure */
    .orb-inner {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    /* Shimmer effect */
    .orb-shimmer {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.3) 0%,
        transparent 50%,
        rgba(255, 255, 255, 0.2) 100%
      );
      opacity: 0.6;
      animation: shimmer 3s ease-in-out infinite;
      z-index: 3;
    }

    .audio-orb.playing .orb-shimmer {
      animation: shimmer-fast 1.5s ease-in-out infinite;
    }

    /* Core orb */
    .orb-core {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15), transparent 50%),
        linear-gradient(135deg, rgba(var(--orb-primary-rgb), 0.2), rgba(var(--orb-secondary-rgb), 0.2));
      border: 3px solid rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow:
        0 10px 40px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.15) inset,
        0 0 30px rgba(var(--orb-primary-rgb), 0.3),
        inset 0 -20px 40px rgba(0, 0, 0, 0.2);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }

    /* Animated gradient layer */
    .orb-gradient-layer {
      position: absolute;
      inset: -50%;
      background: conic-gradient(
        from 0deg,
        transparent 0%,
        rgba(var(--orb-primary-rgb), 0.3) 25%,
        transparent 50%,
        rgba(var(--orb-secondary-rgb), 0.3) 75%,
        transparent 100%
      );
      animation: rotate 8s linear infinite;
      opacity: 0.5;
    }

    .audio-orb.playing .orb-gradient-layer {
      animation: rotate 3s linear infinite;
      opacity: 0.8;
    }

    .audio-orb:hover .orb-core {
      border-color: rgba(var(--orb-primary-rgb), 0.6);
      box-shadow:
        0 15px 50px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset,
        0 0 50px rgba(var(--orb-primary-rgb), 0.5),
        0 0 80px rgba(var(--orb-secondary-rgb), 0.3),
        inset 0 -20px 40px rgba(0, 0, 0, 0.2);
      transform: translateZ(10px);
    }

    .audio-orb.playing .orb-core {
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), transparent 50%),
        linear-gradient(135deg, rgba(var(--orb-primary-rgb), 0.35), rgba(var(--orb-secondary-rgb), 0.35));
      border-color: rgba(var(--orb-primary-rgb), 0.8);
      box-shadow:
        0 15px 50px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 255, 255, 0.25) inset,
        0 0 60px rgba(var(--orb-primary-rgb), 0.6),
        0 0 100px rgba(var(--orb-secondary-rgb), 0.4),
        inset 0 -20px 40px rgba(0, 0, 0, 0.2);
    }

    /* Icon styling */
    .orb-icon {
      position: relative;
      z-index: 4;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
      transition: transform 0.3s ease;
    }

    .audio-orb:hover .orb-icon {
      transform: scale(1.1);
    }

    .audio-orb.playing .orb-icon {
      animation: pulse-icon 1.5s ease-in-out infinite;
    }

    /* Ripple effects */
    .orb-ripple,
    .orb-ripple-2,
    .orb-ripple-3 {
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 3px solid rgba(var(--orb-primary-rgb), 0.4);
      opacity: 0;
      z-index: 1;
    }

    .orb-ripple-2 {
      border-color: rgba(var(--orb-secondary-rgb), 0.4);
    }

    .orb-ripple-3 {
      border-color: rgba(var(--orb-tertiary-rgb), 0.4);
    }

    .audio-orb.playing .orb-ripple {
      animation: ripple 2s ease-out infinite;
    }

    .audio-orb.playing .orb-ripple-2 {
      animation: ripple 2s ease-out infinite 0.66s;
    }

    .audio-orb.playing .orb-ripple-3 {
      animation: ripple 2s ease-out infinite 1.33s;
    }

    /* Label styling */
    .audio-orb-label {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      text-align: center;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: linear-gradient(135deg, rgba(var(--orb-primary-rgb), 1), rgba(var(--orb-secondary-rgb), 1));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }

    .label-icon {
      display: inline-block;
      margin-right: 0.5rem;
      font-size: 1.1rem;
      filter: none;
      -webkit-text-fill-color: initial;
    }

    /* Animations */
    @keyframes pulse-glow {
      0%, 100% {
        transform: scale(1);
        opacity: 0.5;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.8;
      }
    }

    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes shimmer {
      0%, 100% {
        transform: rotate(0deg) scale(1);
        opacity: 0.6;
      }
      50% {
        transform: rotate(180deg) scale(1.05);
        opacity: 0.9;
      }
    }

    @keyframes shimmer-fast {
      0%, 100% {
        transform: rotate(0deg) scale(1);
        opacity: 0.8;
      }
      50% {
        transform: rotate(180deg) scale(1.08);
        opacity: 1;
      }
    }

    @keyframes pulse-icon {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.15);
      }
    }

    @keyframes ripple {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      100% {
        transform: scale(2.2);
        opacity: 0;
      }
    }

    @keyframes orbit1 {
      0% {
        transform: rotate(0deg) translateX(80px) rotate(0deg);
      }
      100% {
        transform: rotate(360deg) translateX(80px) rotate(-360deg);
      }
    }

    @keyframes orbit2 {
      0% {
        transform: rotate(90deg) translateX(80px) rotate(-90deg);
      }
      100% {
        transform: rotate(450deg) translateX(80px) rotate(-450deg);
      }
    }

    @keyframes orbit3 {
      0% {
        transform: rotate(180deg) translateX(80px) rotate(-180deg);
      }
      100% {
        transform: rotate(540deg) translateX(80px) rotate(-540deg);
      }
    }

    @keyframes orbit4 {
      0% {
        transform: rotate(270deg) translateX(80px) rotate(-270deg);
      }
      100% {
        transform: rotate(630deg) translateX(80px) rotate(-630deg);
      }
    }

    /* Responsive design */
    @media (max-width: 480px) {
      .audio-orb {
        width: 110px;
        height: 110px;
      }

      .orb-icon {
        width: 32px !important;
        height: 32px !important;
      }

      .audio-orb-label {
        font-size: 0.9rem;
      }

      .label-icon {
        font-size: 1rem;
      }

      .orb-particle {
        width: 6px;
        height: 6px;
      }
    }
  `;
