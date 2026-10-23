const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, "");
const requestTimeoutMs = 5000;

export class ApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isSystemStatus(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.service === "string" &&
    typeof value.version === "string" &&
    ["healthy", "starting"].includes(value.status) &&
    typeof value.uptime_seconds === "number" &&
    value.runtime !== null &&
    typeof value.runtime === "object" &&
    typeof value.runtime.python_version === "string" &&
    value.components !== null &&
    typeof value.components === "object" &&
    value.components.python_api !== null &&
    typeof value.components.python_api === "object" &&
    ["healthy", "starting"].includes(value.components.python_api.status) &&
    value.components.postgresql !== null &&
    typeof value.components.postgresql === "object" &&
    ["healthy", "starting"].includes(value.components.postgresql.status)
  );
}

export async function getSystemStatus(signal) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal.reason);
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeoutMs);

  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else {
    signal?.addEventListener("abort", abortFromCaller, {once: true});
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/system/status`, {
      headers: {Accept: "application/json"},
      credentials: "include",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`Python API returned HTTP ${response.status}.`, response.status);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError("Python API returned invalid JSON.");
    }

    if (!isSystemStatus(payload)) {
      throw new ApiError("Python API returned an unexpected system status response.");
    }
    return payload;
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Python API request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function requestJson(path, {method = "GET", body, signal} = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : {"Content-Type": "application/json"}),
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the WorldOS API.");
  }

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("WorldOS API returned invalid JSON.", response.status);
  }
  if (!response.ok) {
    const message =
      typeof payload?.detail?.message === "string"
        ? payload.detail.message
        : `WorldOS API returned HTTP ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return payload;
}

export function registerAccount(account) {
  return requestJson("/api/v1/auth/register", {method: "POST", body: account});
}

export function loginAccount(credentials) {
  return requestJson("/api/v1/auth/login", {method: "POST", body: credentials});
}

export function logoutAccount() {
  return requestJson("/api/v1/auth/logout", {method: "POST"});
}

export function getCurrentUser(signal) {
  return requestJson("/api/v1/auth/me", {signal});
}

export function updateUserProfile(profile) {
  return requestJson("/api/v1/auth/me", {method: "PUT", body: profile});
}
