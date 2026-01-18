'use client';

/**
 * TwoFA Setup Component
 * =====================
 * Sets up the 2FA callback for MMI client when the component mounts.
 * Should be included within TwoFAProvider context.
 */

import { useEffect } from 'react';
import { useTwoFA } from '@/components/TwoFAProvider';

export function TwoFASetup() {
  const { request2FA } = useTwoFA();

  useEffect(() => {
    // The MMI client is server-side, so we can't directly connect it.
    // Instead, the 2FA flow will be triggered via the API route.
    // This component ensures the context is available and could be
    // extended to poll for pending 2FA sessions if needed.

    // NOTE: 2FA polling disabled - MMI integration requires manual auth
    // To re-enable: set NEXT_PUBLIC_ENABLE_MMI_2FA_POLLING=true
    const enablePolling = process.env.NEXT_PUBLIC_ENABLE_MMI_2FA_POLLING === 'true';

    if (!enablePolling) {
      return; // Don't poll for 2FA sessions
    }

    // Optional: Poll for pending 2FA sessions
    const checkPending2FA = async () => {
      try {
        const response = await fetch('/api/mmi/2fa');
        const data = await response.json();

        if (data.success && data.pending2FA?.count > 0) {
          // There's a pending 2FA session - trigger the modal
          const sessionId = data.pending2FA.sessionIds[0];
          if (sessionId) {
            request2FA(sessionId, 'mmi');
          }
        }
      } catch (error) {
        // Silently fail - this is just a background check
      }
    };

    // Check once on mount
    checkPending2FA();

    // Optional: Set up periodic polling (every 30 seconds)
    const interval = setInterval(checkPending2FA, 30000);

    return () => clearInterval(interval);
  }, [request2FA]);

  return null; // This component doesn't render anything
}

export default TwoFASetup;
