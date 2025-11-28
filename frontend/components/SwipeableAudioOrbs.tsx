import React, { useState, useRef, useEffect } from 'react';
import { AudioOrb } from './AudioOrb';

interface OrbData {
  audioSrc: string;
  label: string;
  icon?: string;
}

interface SwipeableAudioOrbsProps {
  orbs: OrbData[];
}

export const SwipeableAudioOrbs: React.FC<SwipeableAudioOrbsProps> = ({ orbs }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance (in px) to trigger a page change
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < orbs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < orbs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div style={styles.container}>
      <div
        ref={containerRef}
        style={styles.orbWrapper}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrevious}
            style={{...styles.navButton, ...styles.navButtonLeft}}
            aria-label="Previous orb"
          >
            ‹
          </button>
        )}

        {/* Current Orb */}
        <div style={styles.orbContainer}>
          <AudioOrb
            audioSrc={orbs[currentIndex].audioSrc}
            label={orbs[currentIndex].label}
            icon={orbs[currentIndex].icon}
          />
        </div>

        {currentIndex < orbs.length - 1 && (
          <button
            onClick={goToNext}
            style={{...styles.navButton, ...styles.navButtonRight}}
            aria-label="Next orb"
          >
            ›
          </button>
        )}
      </div>

      {/* Dot Indicators */}
      <div style={styles.indicators}>
        {orbs.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            style={{
              ...styles.dot,
              ...(index === currentIndex ? styles.dotActive : {}),
            }}
            aria-label={`Go to ${orbs[index].label}`}
          />
        ))}
      </div>

      {/* Swipe Hint */}
      {orbs.length > 1 && (
        <p style={styles.hint}>
          Swipe or click arrows to explore
        </p>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    margin: '2rem 0',
    position: 'relative',
  },
  orbWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: '220px',
    touchAction: 'pan-y',
  },
  orbContainer: {
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    fontSize: '32px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    zIndex: 10,
    lineHeight: '1',
    padding: 0,
  },
  navButtonLeft: {
    left: '20px',
  },
  navButtonRight: {
    right: '20px',
  },
  indicators: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.3)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: 0,
  },
  dotActive: {
    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    width: '12px',
    height: '12px',
    boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.85rem',
    margin: '0.5rem 0 0 0',
    textAlign: 'center',
  },
};
