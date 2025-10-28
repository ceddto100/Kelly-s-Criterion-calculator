/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loading State Component
 */

import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="widget-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '120px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--widget-border)',
            borderTopColor: 'var(--widget-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{
            color: 'var(--widget-text-muted)',
            fontSize: '0.875rem',
            margin: 0
          }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
