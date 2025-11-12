/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const CHATKIT_DOMAIN_PUBLIC_KEY = import.meta.env.VITE_CHATKIT_DOMAIN_PUBLIC_KEY || "domain_pk_6913ba67aad88190a6fef9a51e2d3f6108fb0c7c5b509380";

export function ChatKitWidget() {
  const { control } = useChatKit({
    publicKey: CHATKIT_DOMAIN_PUBLIC_KEY,
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
      <ChatKit
        control={control}
        config={{
          name: "StatScopeAI",
          theme: "light" // or "dark" depending on your preference
        }}
      />
    </div>
  );
}
