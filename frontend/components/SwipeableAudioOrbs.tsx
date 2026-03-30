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
    <div className="flex flex-col items-center gap-4 my-8 relative">
      <div
        ref={containerRef}
        className="relative flex items-center justify-center w-full min-h-[220px]"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-lg border border-white/20 text-white text-3xl font-bold cursor-pointer flex items-center justify-center transition-all duration-300 z-10 leading-none p-0 left-5"
            aria-label="Previous orb"
          >
            ‹
          </button>
        )}

        {/* Current Orb */}
        <div className="transition-all duration-300">
          <AudioOrb
            audioSrc={orbs[currentIndex].audioSrc}
            label={orbs[currentIndex].label}
            icon={orbs[currentIndex].icon}
          />
        </div>

        {currentIndex < orbs.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-lg border border-white/20 text-white text-3xl font-bold cursor-pointer flex items-center justify-center transition-all duration-300 z-10 leading-none p-0 right-5"
            aria-label="Next orb"
          >
            ›
          </button>
        )}
      </div>

      {/* Dot Indicators */}
      <div className="flex gap-2 items-center justify-center">
        {orbs.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`rounded-full border-none cursor-pointer transition-all duration-300 p-0 ${
              index === currentIndex
                ? 'w-3 h-3 bg-[var(--accent)] shadow-[var(--accent-glow)]'
                : 'w-2.5 h-2.5 bg-white/30'
            }`}
            aria-label={`Go to ${orbs[index].label}`}
          />
        ))}
      </div>

      {/* Swipe Hint */}
      {orbs.length > 1 && (
        <p className="text-white/50 text-sm mt-2 text-center">
          Swipe or click arrows to explore
        </p>
      )}
    </div>
  );
};
