import React, { useState, useRef, useEffect } from 'react';

interface AudioOrbProps {
  audioSrc: string;
}

export const AudioOrb: React.FC<AudioOrbProps> = ({ audioSrc }) => {
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
        <div className="orb-inner">
          <div className="orb-glow"></div>
          <div className="orb-core">
            {isPlaying ? (
              // Pause icon
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              // Play icon
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor"/>
              </svg>
            )}
          </div>
        </div>
        <div className="orb-ripple"></div>
        <div className="orb-ripple-2"></div>
      </button>
      <p className="audio-orb-label">Quick Start Guide</p>
    </div>
  );
};

export const AudioOrbStyles = () => (
  <style>{`
    .audio-orb-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      margin: 1.5rem 0;
    }

    .audio-orb {
      position: relative;
      width: 120px;
      height: 120px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .audio-orb:hover {
      transform: scale(1.1);
    }

    .audio-orb:active {
      transform: scale(0.95);
    }

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

    .orb-glow {
      position: absolute;
      inset: -10px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(6, 182, 212, 0.4) 0%,
        rgba(139, 92, 246, 0.3) 50%,
        transparent 70%
      );
      filter: blur(20px);
      opacity: 0.6;
      animation: pulse 2s ease-in-out infinite;
    }

    .audio-orb.playing .orb-glow {
      animation: pulse-fast 1s ease-in-out infinite;
      opacity: 1;
    }

    .audio-orb.hovered .orb-glow {
      opacity: 1;
      filter: blur(25px);
    }

    .orb-core {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15));
      border: 2px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 0 20px rgba(6, 182, 212, 0.2);
      transition: all 0.3s ease;
    }

    .audio-orb:hover .orb-core {
      border-color: rgba(6, 182, 212, 0.5);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.15) inset,
        0 0 30px rgba(6, 182, 212, 0.4);
    }

    .audio-orb.playing .orb-core {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(139, 92, 246, 0.25));
      border-color: rgba(6, 182, 212, 0.6);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset,
        0 0 40px rgba(6, 182, 212, 0.5);
    }

    .orb-ripple,
    .orb-ripple-2 {
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 2px solid rgba(6, 182, 212, 0.3);
      opacity: 0;
      z-index: 1;
    }

    .audio-orb.playing .orb-ripple {
      animation: ripple 2s ease-out infinite;
    }

    .audio-orb.playing .orb-ripple-2 {
      animation: ripple 2s ease-out infinite 1s;
    }

    .audio-orb-label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.95rem;
      font-weight: 500;
      margin: 0;
      text-align: center;
      letter-spacing: 0.5px;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(1.05);
        opacity: 0.8;
      }
    }

    @keyframes pulse-fast {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.8;
      }
    }

    @keyframes ripple {
      0% {
        transform: scale(1);
        opacity: 0.5;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }

    @media (max-width: 480px) {
      .audio-orb {
        width: 100px;
        height: 100px;
      }

      .audio-orb svg {
        width: 28px;
        height: 28px;
      }

      .audio-orb-label {
        font-size: 0.875rem;
      }
    }
  `}</style>
);
