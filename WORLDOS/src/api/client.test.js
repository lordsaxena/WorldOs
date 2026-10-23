import assert from "node:assert/strict";
import test from "node:test";
import {ApiError, getSystemStatus} from "./client.js";

const healthyStatus = {
  service: "ai-python",
  version: "1.0.0",
  status: "healthy",
  started_at: "2026-10-23T06:00:00Z",
  uptime_seconds: 12.5,
  runtime: {python_version: "3.14.0", environment: "development"},
  components: {python_api: {status: "healthy"}},
};

test("requests and validates the real versioned status endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {ok: true, json: async () => healthyStatus};
  };
  try {
    assert.deepEqual(await getSystemStatus(), healthyStatus);
    assert.equal(requestUrl, "http://localhost:8000/api/v1/system/status");
    assert.equal(requestOptions.headers.Accept, "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports backend HTTP errors without converting them to success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ok: false, status: 503});
  try {
    await assert.rejects(
      getSystemStatus(),
      error => error instanceof ApiError && error.status === 503,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects responses that do not match the system status schema", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ok: true, json: async () => ({status: "healthy"})});
  try {
    await assert.rejects(getSystemStatus(), /unexpected system status response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("times out a stalled backend request", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let triggerTimeout;
  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 5000);
    triggerTimeout = callback;
    return 1;
  };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (_url, options) =>
    new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      });
      triggerTimeout();
    });
  try {
    await assert.rejects(getSystemStatus(), /request timed out/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
