/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export function ChatKitWidget() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        if (existing) {
          // Implement session refresh if needed
          // For now, we'll just fetch a new token
        }

        try {
          const res = await fetch(`${BACKEND_URL}/api/chatkit/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            console.error('ChatKit session fetch failed:', res.status, await res.text());
            throw new Error('Failed to get ChatKit session token');
          }

          const { client_secret } = await res.json();
          return client_secret;
        } catch (error) {
          console.error('ChatKit session error:', error);
          throw error;
        }
      },
    },
  });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ChatKit control={control} />
    </div>
  );
}
