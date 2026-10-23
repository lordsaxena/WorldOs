import {useEffect, useState} from "react";
import {getSystemStatus} from "../api/client.js";
import "./SystemStatus.css";

export function SystemStatus() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({state: "loading"});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResult({state: "loading"});

    getSystemStatus(controller.signal)
      .then(data => {
        if (active) setResult({state: "loaded", data});
      })
      .catch(error => {
        if (active && !controller.signal.aborted) {
          setResult({state: "error", message: error.message});
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const serviceStatus = result.state === "loaded" ? result.data.status : result.state;
  const statusLabel =
    result.state === "loaded"
      ? result.data.status.toUpperCase()
      : result.state === "loading"
        ? "CONNECTING"
        : "UNAVAILABLE";

  return (
    <div
      className={`system-status system-status--${serviceStatus}`}
      role="status"
      aria-live="polite"
      title={result.state === "error" ? result.message : "Python backend service status"}
    >
      <span className="system-status__dot" aria-hidden="true" />
      <span className="system-status__label">PYTHON API</span>
      <b>{statusLabel}</b>
      {result.state === "error" && (
        <button
          className="system-status__retry"
          type="button"
          onClick={() => setAttempt(value => value + 1)}
        >
          Retry
        </button>
      )}
    </div>
  );
}
