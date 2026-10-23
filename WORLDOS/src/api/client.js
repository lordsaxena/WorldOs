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
    ["healthy", "starting"].includes(value.components.python_api.status)
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
