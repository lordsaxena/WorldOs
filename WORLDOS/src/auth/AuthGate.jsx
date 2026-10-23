import {useEffect, useState} from "react";
import {
  ApiError,
  getCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateUserProfile,
} from "../api/client.js";
import {SystemStatus} from "../components/SystemStatus.jsx";
import "./auth.css";

function AuthForm({onAuthenticated}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState({
    city_name: "",
    state_region: "",
    country: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const account =
        mode === "register"
          ? await registerAccount({
              email,
              password,
              ...Object.fromEntries(
                Object.entries(location).map(([key, value]) => [key, value.trim() || null]),
              ),
            })
          : await loginAccount({email, password});
      onAuthenticated(account);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>W</span> WORLDOS</div>
        <div className="auth-eyebrow">URBAN INTELLIGENCE / PERSONAL ACCOUNT</div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-intro">
          {mode === "login"
            ? "Sign in to access your private profile and location details."
            : "Create a private account to save your city, state, and country."}
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Create account
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={mode === "register" ? 12 : undefined}
              maxLength={128}
              required
            />
            {mode === "register" && (
              <small>Use at least 12 characters.</small>
            )}
          </label>
          {mode === "register" && (
            <>
              <div className="auth-location-heading">PRIVATE PROFILE LOCATION</div>
              <div className="auth-location-grid">
                <label>
                  City or town
                  <input
                    value={location.city_name}
                    onChange={event =>
                      setLocation(current => ({...current, city_name: event.target.value}))
                    }
                    maxLength={120}
                    autoComplete="address-level2"
                  />
                </label>
                <label>
                  State or region
                  <input
                    value={location.state_region}
                    onChange={event =>
                      setLocation(current => ({...current, state_region: event.target.value}))
                    }
                    maxLength={120}
                    autoComplete="address-level1"
                  />
                </label>
                <label className="auth-location-country">
                  Country
                  <input
                    value={location.country}
                    onChange={event =>
                      setLocation(current => ({...current, country: event.target.value}))
                    }
                    maxLength={120}
                    autoComplete="country-name"
                  />
                </label>
              </div>
              <p className="auth-privacy-note">
                Location details are manually entered, private to your account, and
                not verified or used to change the synthetic city model.
              </p>
            </>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </section>
      <SystemStatus/>
    </main>
  );
}

function AccountControls({user, onUserUpdated, onLogout}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({
    city_name: user.city_name || "",
    state_region: user.state_region || "",
    country: user.country || "",
    location_description: user.location_description || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfile({
      city_name: user.city_name || "",
      state_region: user.state_region || "",
      country: user.country || "",
      location_description: user.location_description || "",
    });
  }, [user]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateUserProfile(
        Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, value.trim() || null]),
        ),
      );
      onUserUpdated(updated);
      setMessage("Private profile saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await logoutAccount();
      onLogout();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <aside className="account-controls">
      {open && (
        <form className="account-panel" onSubmit={save}>
          <div className="account-panel-heading">
            <div>
              <span className="auth-eyebrow">ACCOUNT PROFILE</span>
              <h2>Private location</h2>
            </div>
            <button
              type="button"
              className="account-close"
              aria-label="Close profile"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="account-email">{user.email}</div>
          {[
            ["city_name", "City or town"],
            ["state_region", "State or region"],
            ["country", "Country"],
            ["location_description", "Description or local facts"],
          ].map(([key, label]) => (
            <label key={key} className="account-field">
              {label}
              {key === "location_description" ? (
                <textarea
                  value={profile[key]}
                  maxLength={500}
                  rows={3}
                  onChange={event =>
                    setProfile(current => ({...current, [key]: event.target.value}))
                  }
                />
              ) : (
                <input
                  value={profile[key]}
                  maxLength={120}
                  onChange={event =>
                    setProfile(current => ({...current, [key]: event.target.value}))
                  }
                />
              )}
            </label>
          ))}
          <p className="auth-privacy-note">
            Only your account can view these manually entered details. They are not
            validated geographic facts or simulation inputs.
          </p>
          {message && <div className="account-success" role="status">{message}</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save profile"}
          </button>
          <button className="account-signout" type="button" onClick={signOut}>
            Sign out
          </button>
        </form>
      )}
      <button
        type="button"
        className="account-launch"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="account-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
        <span>{user.email}</span>
      </button>
    </aside>
  );
}

export function AuthGate({children}) {
  const [user, setUser] = useState(null);
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getCurrentUser(controller.signal)
      .then(currentUser => {
        if (!active) return;
        setUser(currentUser);
        setState("authenticated");
        setError("");
      })
      .catch(requestError => {
        if (!active || controller.signal.aborted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          setUser(null);
          setState("unauthenticated");
          setError("");
        } else {
          setState("error");
          setError(requestError.message);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  if (state === "checking") {
    return (
      <main className="auth-page">
        <div className="auth-loading" role="status">Checking your account...</div>
        <SystemStatus/>
      </main>
    );
  }
  if (state === "error") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand"><span>W</span> WORLDOS</div>
          <h1>Account service unavailable</h1>
          <p className="auth-intro">{error}</p>
          <button className="auth-submit" onClick={() => setAttempt(value => value + 1)}>
            Retry
          </button>
        </section>
        <SystemStatus/>
      </main>
    );
  }
  if (!user) {
    return (
      <AuthForm
        onAuthenticated={authenticatedUser => {
          setUser(authenticatedUser);
          setState("authenticated");
        }}
      />
    );
  }
  return (
    <>
      {children}
      <AccountControls
        user={user}
        onUserUpdated={setUser}
        onLogout={() => {
          setUser(null);
          setState("unauthenticated");
        }}
      />
      <SystemStatus/>
    </>
  );
}
