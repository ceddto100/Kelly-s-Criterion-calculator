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

