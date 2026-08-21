import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  getCanonicalOrigin,
  getHealthUrl,
  getReadyUrl,
  getSocketUrl,
  validateHealthResponse,
} from '../frontend/src/utils/apiUrl.js';

describe('Shared API URL Helper Tests', () => {
  describe('1. URL Normalization (getCanonicalOrigin)', () => {
    it('handles root URL correctly', () => {
      assert.equal(getCanonicalOrigin('http://localhost:5000'), 'http://localhost:5000');
      assert.equal(
        getCanonicalOrigin('https://splitsmart-backend.onrender.com'),
        'https://splitsmart-backend.onrender.com'
      );
    });

    it('normalizes /api URL by stripping trailing /api', () => {
      assert.equal(getCanonicalOrigin('http://localhost:5000/api'), 'http://localhost:5000');
      assert.equal(
        getCanonicalOrigin('https://splitsmart-backend.onrender.com/api'),
        'https://splitsmart-backend.onrender.com'
      );
    });

    it('normalizes URLs with trailing slashes', () => {
      assert.equal(getCanonicalOrigin('http://localhost:5000/'), 'http://localhost:5000');
      assert.equal(getCanonicalOrigin('http://localhost:5000///'), 'http://localhost:5000');
      assert.equal(
        getCanonicalOrigin('https://splitsmart-backend.onrender.com/api/'),
        'https://splitsmart-backend.onrender.com'
      );
      assert.equal(
        getCanonicalOrigin('https://splitsmart-backend.onrender.com/api///'),
        'https://splitsmart-backend.onrender.com'
      );
    });

    it('handles missing or empty URL', () => {
      assert.equal(getCanonicalOrigin(''), '');
      assert.equal(getCanonicalOrigin(undefined), '');
      assert.equal(getCanonicalOrigin(null), '');
      assert.equal(getCanonicalOrigin('   '), '');
    });
  });

  describe('2. Endpoint Resolvers (getHealthUrl, getReadyUrl, getSocketUrl)', () => {
    it('resolves health URL correctly across all input formats', () => {
      assert.equal(getHealthUrl('http://localhost:5000'), 'http://localhost:5000/health');
      assert.equal(getHealthUrl('http://localhost:5000/api'), 'http://localhost:5000/health');
      assert.equal(getHealthUrl('http://localhost:5000/'), 'http://localhost:5000/health');
      assert.equal(getHealthUrl(''), '/health');
      assert.equal(getHealthUrl(undefined), '/health');
    });

    it('resolves ready URL correctly across all input formats', () => {
      assert.equal(getReadyUrl('http://localhost:5000'), 'http://localhost:5000/ready');
      assert.equal(getReadyUrl('http://localhost:5000/api/'), 'http://localhost:5000/ready');
      assert.equal(getReadyUrl(''), '/ready');
    });

    it('resolves socket URL correctly to origin only', () => {
      assert.equal(getSocketUrl('http://localhost:5000/api'), 'http://localhost:5000');
      assert.equal(
        getSocketUrl('https://splitsmart-backend.onrender.com/'),
        'https://splitsmart-backend.onrender.com'
      );
    });
  });

  describe('3. Response Validation (validateHealthResponse)', () => {
    it('accepts valid 200 JSON with status ok and db connected', () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      };
      const mockData = { status: 'ok', db: 'connected', uptime: 12.34 };

      assert.equal(validateHealthResponse(mockRes, mockData), true);
    });

    it('rejects 200 HTML SPA fallback response', () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      };
      const mockData = null; // HTML string failed to parse as JSON

      assert.equal(validateHealthResponse(mockRes, mockData), false);
    });

    it('rejects 200 response if content-type is HTML even if body is an object', () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
      };
      const mockData = { status: 'ok' };

      assert.equal(validateHealthResponse(mockRes, mockData), false);
    });

    it('rejects 404 Not Found responses', () => {
      const mockRes = {
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
      };
      const mockData = { message: 'Not Found' };

      assert.equal(validateHealthResponse(mockRes, mockData), false);
    });

    it('rejects 502 Bad Gateway responses (Render proxy waking)', () => {
      const mockRes = {
        ok: false,
        status: 502,
        headers: new Headers({ 'content-type': 'text/plain' }),
      };
      const mockData = null;

      assert.equal(validateHealthResponse(mockRes, mockData), false);
    });

    it('rejects 503 Service Unavailable / DB connecting responses', () => {
      const mockRes = {
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
      };
      const mockData = { status: 'unavailable', db: 'connecting' };

      assert.equal(validateHealthResponse(mockRes, mockData), false);
    });

    it('rejects 200 response if payload status is not ok or db is disconnected', () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      };
      assert.equal(validateHealthResponse(mockRes, { status: 'error' }), false);
      assert.equal(validateHealthResponse(mockRes, { status: 'ok', db: 'disconnected' }), false);
    });

    it('rejects a response without a JSON content type', () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
      };

      assert.equal(
        validateHealthResponse(mockRes, { status: 'ok', db: 'connected' }),
        false
      );
    });
  });
});

describe('Backend Health & DB Readiness Server Tests', () => {
  let server;
  let serverUrl;
  let simulatedDbReadyState = 2; // 2 = connecting, 1 = connected

  before(async () => {
    const app = express();

    const checkReadiness = (req, res) => {
      if (simulatedDbReadyState !== 1) {
        return res.status(503).json({
          status: 'unavailable',
          db: 'connecting',
          timestamp: Date.now(),
        });
      }
      return res.status(200).json({
        status: 'ok',
        db: 'connected',
        uptime: 42,
        timestamp: Date.now(),
      });
    };

    app.get('/health', checkReadiness);
    app.get('/ready', checkReadiness);
    app.get('/api/health', checkReadiness);
    app.get('/api/ready', checkReadiness);

    // SPA fallback simulation on unknown routes
    app.get('/spa-fallback', (req, res) => {
      res.setHeader('content-type', 'text/html');
      res.status(200).send('<!DOCTYPE html><html><body>SPA Root</body></html>');
    });

    // Simulated 502 Bad Gateway endpoint
    app.get('/bad-gateway', (req, res) => {
      res.status(502).send('Bad Gateway');
    });

    // Slow endpoint for timeout simulation
    app.get('/slow-endpoint', (req, res) => {
      setTimeout(() => {
        res.json({ status: 'ok', db: 'connected' });
      }, 500);
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    serverUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('handles Delayed DB Readiness (503 while connecting -> 200 when connected)', async () => {
    simulatedDbReadyState = 2; // DB is still connecting

    // Step 1: Query while DB is connecting
    const resConnecting = await fetch(getHealthUrl(serverUrl));
    assert.equal(resConnecting.status, 503);
    const dataConnecting = await resConnecting.json();
    assert.equal(dataConnecting.status, 'unavailable');
    assert.equal(dataConnecting.db, 'connecting');
    assert.equal(validateHealthResponse(resConnecting, dataConnecting), false);

    // Step 2: Simulate DB successfully connected
    simulatedDbReadyState = 1;

    const resConnected = await fetch(getHealthUrl(serverUrl));
    assert.equal(resConnected.status, 200);
    const dataConnected = await resConnected.json();
    assert.equal(dataConnected.status, 'ok');
    assert.equal(dataConnected.db, 'connected');
    assert.equal(validateHealthResponse(resConnected, dataConnected), true);
  });

  it('responds correctly on all alias routes (/health, /ready, /api/health, /api/ready)', async () => {
    simulatedDbReadyState = 1;

    for (const path of ['/health', '/ready', '/api/health', '/api/ready']) {
      const res = await fetch(`${serverUrl}${path}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.db, 'connected');
      assert.equal(validateHealthResponse(res, data), true);
    }
  });

  it('rejects 404 response on non-existent endpoints', async () => {
    const res = await fetch(`${serverUrl}/non-existent-route`);
    assert.equal(res.status, 404);
    assert.equal(validateHealthResponse(res, null), false);
  });

  it('rejects 502 Bad Gateway response', async () => {
    const res = await fetch(`${serverUrl}/bad-gateway`);
    assert.equal(res.status, 502);
    assert.equal(validateHealthResponse(res, null), false);
  });

  it('rejects 200 HTML SPA fallback page', async () => {
    const res = await fetch(`${serverUrl}/spa-fallback`);
    assert.equal(res.status, 200);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    assert.equal(validateHealthResponse(res, data), false);
  });

  it('handles probe timeout with AbortController', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50);

    let errorCaught = null;
    try {
      await fetch(`${serverUrl}/slow-endpoint`, { signal: controller.signal });
    } catch (err) {
      errorCaught = err;
    } finally {
      clearTimeout(timeout);
    }

    assert.ok(errorCaught);
    assert.equal(errorCaught.name, 'AbortError');
  });
});
