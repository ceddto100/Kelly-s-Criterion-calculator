/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from "react";

export default function ChatKitWidget() {
  useEffect(() => {
    console.log('[ChatKit] Initializing widget...');

    const script = document.createElement("script");
    script.src = "https://cdn.openai.com/chatkit/v1/chatkit.js";
    script.async = true;

    script.onload = () => {
      console.log('[ChatKit] Script loaded successfully');

      // @ts-ignore
      if (window.ChatKit) {
        console.log('[ChatKit] ChatKit object found, mounting widget...');

        try {
          // @ts-ignore
          window.ChatKit.mount({
            workflow: "wf_6913ae8d21588190822630566a8233ca0416772e440b6b71",
            version: "2",
            domainPublicKey: "domain_pk_6913ba67aad88190a6fef9a51e2d3f6108fb0c7c5b509380",
            container: document.body,
            theme: "dark",
            title: "📊 SportsBot AI",
            subtitle: "Search real-time team stats across NFL, NBA, WNBA, NCAAF & NCAAM",
            position: "bottom-right",
            accentColor: "#38bdf8",
            greeting: "Hey there! Ask me for any team's stats."
          });
          console.log('[ChatKit] Widget mounted successfully');
        } catch (error) {
          console.error('[ChatKit] Error mounting widget:', error);
        }
      } else {
        console.error('[ChatKit] ChatKit object not found on window');
      }
    };

    script.onerror = (error) => {
      console.error('[ChatKit] Failed to load script:', error);
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
