/**
 * Normalizes any backend URL string to the canonical format:
 * Origin only without trailing slashes or /api suffix.
 * Example: "https://splitsmart-backend.onrender.com/api/" -> "https://splitsmart-backend.onrender.com"
 * Example: "http://localhost:5000/" -> "http://localhost:5000"
 * Example: "" or undefined -> ""
 *
 * @param {string} [rawUrl]
 * @returns {string}
 */
export function getCanonicalOrigin(rawUrl = import.meta.env?.VITE_API_URL) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  return rawUrl
    .trim()
    .replace(/\/+$/, '')         // Remove trailing slashes
    .replace(/\/api\/?$/i, '')   // Remove trailing /api or /api/
    .replace(/\/+$/, '');        // Clean any remaining trailing slashes
}

/**
 * Returns the Render liveness/readiness endpoint URL.
 *
 * @param {string} [rawUrl]
 * @returns {string}
 */
export function getHealthUrl(rawUrl) {
  const origin = getCanonicalOrigin(rawUrl);
  return origin ? `${origin}/healthz` : '/healthz';
}

/**
 * Returns the readiness check endpoint URL.
 *
 * @param {string} [rawUrl]
 * @returns {string}
 */
export function getReadyUrl(rawUrl) {
  const origin = getCanonicalOrigin(rawUrl);
  return origin ? `${origin}/ready` : '/ready';
}

/**
 * Returns the socket connection URL (origin only).
 *
 * @param {string} [rawUrl]
 * @returns {string}
 */
export function getSocketUrl(rawUrl) {
  const origin = getCanonicalOrigin(rawUrl);
  return origin || (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * Validates a health / readiness response from the backend.
 * Ensures the response is HTTP 2xx, content-type is JSON, and payload has status === 'ok'
 * with a healthy database state.
 * Prevents false-positives from 200 HTML SPA fallbacks.
 *
 * @param {Response} response - Fetch response object
 * @param {any} data - Parsed JSON body
 * @returns {boolean}
 */
export function validateHealthResponse(response, data) {
  if (!response || !response.ok) {
    return false;
  }

  // Ensure content-type is JSON (not HTML fallback)
  const contentType = response.headers?.get ? response.headers.get('content-type') : response.headers?.['content-type'];
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return false;
  }

  // Ensure parsed JSON body indicates health
  if (!data || typeof data !== 'object') {
    return false;
  }

  const isStatusOk = data.status === 'ok';
  const isDbOk = !data.db || data.db === 'connected';

  return isStatusOk && isDbOk;
}
