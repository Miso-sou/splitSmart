import { useState, useEffect } from 'react';

export function useBackendWakeup() {
  const [status, setStatus] = useState('waking'); // 'waking' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(1);

  useEffect(() => {
    let timeoutId;
    let isActive = true;

    const ping = async () => {
      try {
        const signal = AbortSignal.timeout(5000);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/health`, { signal });
        
        if (res.status === 200) {
          if (isActive) setStatus('ready');
          return; // Stop polling
        }
      } catch (err) {
        // Fetch failed (timeout or network error), will retry
      }

      if (!isActive) return;

      setAttempt((prev) => {
        const nextAttempt = prev + 1;
        if (nextAttempt > 10) {
          setStatus('error');
        } else {
          timeoutId = setTimeout(ping, 2500);
        }
        return nextAttempt;
      });
    };

    ping();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return { status, attempt };
}

