/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from "react";

export default function ChatKitWidget() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initChatKit = async () => {
      try {
        // Fetch client_secret from backend
        const response = await fetch('/api/chatkit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: 'anonymous' // You can make this dynamic based on user session
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create ChatKit session');
        }

        const { client_secret } = await response.json();

        // Load ChatKit script
        const script = document.createElement("script");
        script.src = "https://cdn.openai.com/chatkit/v1/chatkit.js";
        script.async = true;

        script.onload = () => {
          // @ts-ignore
          if (window.ChatKit) {
            // @ts-ignore
            window.ChatKit.mount({
              workflow: "wf_6913ae8d21588190822630566a8233ca0416772e440b6b71",
              version: "2",
              clientSecret: client_secret, // Use secure client_secret from backend
              domainPublicKey: "domain_pk_6913ba67aad88190a6fef9a51e2d3f6108fb0c7c5b509380",
              container: document.body,
              theme: "dark",
              title: "📊 SportsBot AI",
              subtitle: "Search real-time team stats across NFL, NBA, WNBA, NCAAF & NCAAM",
              position: "bottom-right",
              accentColor: "#38bdf8",
              greeting: "Hey there! Ask me for any team's stats."
            });
          }
        };

        script.onerror = () => {
          setError('Failed to load ChatKit script');
        };

        document.body.appendChild(script);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('ChatKit initialization error:', errorMessage);
        setError(errorMessage);
      }
    };

    initChatKit();
  }, []);

  // Optionally render error message for debugging
  if (error) {
    console.error('ChatKit Error:', error);
  }

  return null;
}
