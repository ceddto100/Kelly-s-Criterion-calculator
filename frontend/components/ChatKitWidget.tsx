/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from "react";

// Backend URL configuration - uses environment variable or falls back to relative path
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function ChatKitWidget() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initChatKit = async () => {
      setIsLoading(true);
      
      try {
        // Fetch client_secret from backend
        const apiUrl = BACKEND_URL 
          ? `${BACKEND_URL}/api/chatkit/session` 
          : '/api/chatkit/session';
        
        console.log('Fetching ChatKit session from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: 'anonymous' // You can make this dynamic based on user session
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Session creation failed:', errorData);
          throw new Error(errorData.error || `Failed to create ChatKit session (${response.status})`);
        }

        const { client_secret } = await response.json();
        
        if (!client_secret) {
          throw new Error('No client_secret received from backend');
        }

        console.log('Client secret received, loading ChatKit script...');

        // Load ChatKit script - USE THE CORRECT URL
        const script = document.createElement("script");
        script.src = "https://cdn.platform.openai.com/deployments/chatkit/chatkit.js";
        script.async = true;

        script.onload = () => {
          console.log('ChatKit script loaded, mounting widget...');
          
          // @ts-ignore
          if (window.ChatKit) {
            try {
              // @ts-ignore
              window.ChatKit.mount({
                workflow: "wf_6913ae8d21588190822630566a8233ca0416772e440b6b71",
                version: "2",
                clientSecret: client_secret,
                domainPublicKey: "domain_pk_6913ba67aad88190a6fef9a51e2d3f6108fb0c7c5b509380",
                container: document.body,
                theme: "dark",
                title: "📊 SportsBot AI",
                subtitle: "Search real-time team stats across NFL, NBA, WNBA, NCAAF & NCAAM",
                position: "bottom-right",
                accentColor: "#38bdf8",
                greeting: "Hey there! Ask me for any team's stats."
              });
              console.log('ChatKit widget mounted successfully');
              setIsLoading(false);
            } catch (mountError) {
              console.error('ChatKit mount error:', mountError);
              setError(`Failed to mount ChatKit: ${mountError instanceof Error ? mountError.message : 'Unknown error'}`);
              setIsLoading(false);
            }
          } else {
            const err = 'ChatKit library not available after script load';
            console.error(err);
            setError(err);
            setIsLoading(false);
          }
        };

        script.onerror = (e) => {
          console.error('Script loading error:', e);
          setError('Failed to load ChatKit script');
          setIsLoading(false);
        };

        document.body.appendChild(script);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('ChatKit initialization error:', err);
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initChatKit();
  }, []);

  // Render error message in development
  if (error && import.meta.env.DEV) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#dc2626',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        maxWidth: '300px',
        fontSize: '14px',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <strong>ChatKit Error:</strong> {error}
      </div>
    );
  }

  return null;
}
