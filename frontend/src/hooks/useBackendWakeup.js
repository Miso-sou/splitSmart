import { useState, useEffect, useCallback, useRef } from 'react';
import { getHealthUrl, validateHealthResponse } from '../utils/apiUrl';

const PROBE_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 2500;
const MAX_POLL_DURATION_MS = 120000;

export function useBackendWakeup() {
  const [status, setStatus] = useState('waking'); // 'waking' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(1);
  const isMountedRef = useRef(true);
  const runIdRef = useRef(0);
  const activeRequestRef = useRef(null);
  const timeoutIdRef = useRef(null);

  const cleanupPending = useCallback(() => {
    if (activeRequestRef.current) {
      activeRequestRef.current.controller.abort();
      activeRequestRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const ping = useCallback(async (currentAttempt, runId, deadlineAt) => {
    if (!isMountedRef.current || runId !== runIdRef.current) return;

    cleanupPending();

    const controller = new AbortController();
    activeRequestRef.current = { controller, runId };

    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, PROBE_TIMEOUT_MS);

    let isHealthy = false;

    try {
      const endpoint = getHealthUrl();
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutTimer);

      if (res.ok) {
        let json = null;
        try {
          json = await res.json();
        } catch {
          // If body is not valid JSON (e.g. HTML 200 SPA fallback), json remains null
        }

        if (validateHealthResponse(res, json)) {
          isHealthy = true;
        }
      }
    } catch {
      // Abort, network error, 502/504, or cold start in progress
    } finally {
      clearTimeout(timeoutTimer);
      if (activeRequestRef.current?.runId === runId) {
        activeRequestRef.current = null;
      }
    }

    if (!isMountedRef.current || runId !== runIdRef.current) return;

    if (isHealthy) {
      setStatus('ready');
      return;
    }

    if (Date.now() + RETRY_DELAY_MS >= deadlineAt) {
      setStatus('error');
    } else {
      const nextAttempt = currentAttempt + 1;
      setAttempt(nextAttempt);
      timeoutIdRef.current = setTimeout(() => {
        if (isMountedRef.current && runId === runIdRef.current) {
          timeoutIdRef.current = null;
          ping(nextAttempt, runId, deadlineAt);
        }
      }, RETRY_DELAY_MS);
    }
  }, [cleanupPending]);

  const retry = useCallback(() => {
    const nextRunId = runIdRef.current + 1;
    runIdRef.current = nextRunId;
    cleanupPending();
    setStatus('waking');
    setAttempt(1);
    ping(1, nextRunId, Date.now() + MAX_POLL_DURATION_MS);
  }, [cleanupPending, ping]);

  useEffect(() => {
    isMountedRef.current = true;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    ping(1, runId, Date.now() + MAX_POLL_DURATION_MS);

    return () => {
      isMountedRef.current = false;
      runIdRef.current += 1;
      cleanupPending();
    };
  }, [cleanupPending, ping]);

  return { status, attempt, retry };
}
