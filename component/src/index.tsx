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
import './styles/widget.css';

declare global {
  interface Window {
    openai?: {
      toolOutput?: any;
    };
  }
}

function App() {
  const [widgetType, setWidgetType] = useState<'kelly' | 'probability' | 'unit' | null>(null);

  useEffect(() => {
    // Determine which widget to render based on tool output
    const toolOutput = window.openai?.toolOutput;

    if (!toolOutput?.structuredContent) {
      console.warn('No structured content found in toolOutput');
      return;
    }

    const data = toolOutput.structuredContent;

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

  // Error boundary fallback
  if (widgetType === null) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui', color: '#666' }}>
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
        <div style={{ padding: '20px', fontFamily: 'system-ui', color: '#666' }}>
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
