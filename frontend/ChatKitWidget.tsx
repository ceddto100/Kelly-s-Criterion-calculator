/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export function ChatKitWidget() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        if (existing) {
          // Implement session refresh if needed
          // For now, we'll just fetch a new token
        }

        const res = await fetch(`${BACKEND_URL}/api/chatkit/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to get ChatKit session token');
        }

        const { client_secret } = await res.json();
        return client_secret;
      },
    },
  });

  return <ChatKit control={control} className="h-[600px] w-[320px]" />;
}
