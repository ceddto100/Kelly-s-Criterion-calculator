/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main entry point for ChatGPT widgets
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import KellyWidget from './widgets/KellyWidget';
import ProbabilityWidget from './widgets/ProbabilityWidget';
import UnitWidget from './widgets/UnitWidget';
import type { DisplayMode } from './types/openai';
import './styles/widget.css';

function App() {
  const [widgetType, setWidgetType] = useState<'kelly' | 'probability' | 'unit' | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline');
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    // 1. Get displayMode and maxHeight from window.openai
    const mode = window.openai?.displayMode || 'inline';
    setDisplayMode(mode);

    const height = window.openai?.maxHeight;
    if (height) {
      setMaxHeight(height);
    }

    // 2. Determine which widget to render based on tool output
    const toolOutput = window.openai?.toolOutput;

    if (!toolOutput) {
      console.warn('No toolOutput found in window.openai');
      return;
    }

    // Check if we have the old structuredContent wrapper (backward compatibility)
    const data = toolOutput.structuredContent || toolOutput;

    // Detect widget type based on data structure
    if ('stake' in data && 'stakePercentage' in data) {
      setWidgetType('kelly');
    } else if ('predictedMargin' in data && 'sport' in data) {
      setWidgetType('probability');
    } else if ('calculatedUnitSize' in data && 'unitsToWager' in data) {
      setWidgetType('unit');
    } else {
      console.error('Unknown widget type from tool output:', data);
    }
  }, []);

  // Apply container style based on displayMode and maxHeight at root level
  const containerStyle: React.CSSProperties = {};
  if (displayMode === 'inline' && maxHeight) {
    containerStyle.maxHeight = `${maxHeight}px`;
    containerStyle.overflowY = 'auto';
  }

  // Error boundary fallback
  if (widgetType === null) {
    return (
      <div
        className={`widget-container mode-${displayMode}`}
        style={{
          padding: '20px',
          fontFamily: 'system-ui',
          color: 'var(--widget-text-muted)',
          ...containerStyle
        }}
      >
        <p>Loading widget...</p>
      </div>
    );
  }

  // Render appropriate widget
  switch (widgetType) {
    case 'kelly':
      return <KellyWidget />;
    case 'probability':
      return <ProbabilityWidget />;
    case 'unit':
      return <UnitWidget />;
    default:
      return (
        <div
          className={`widget-container mode-${displayMode}`}
          style={{
            padding: '20px',
            fontFamily: 'system-ui',
            color: 'var(--widget-text-muted)',
            ...containerStyle
          }}
        >
          <p>Unknown widget type</p>
        </div>
      );
  }
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
