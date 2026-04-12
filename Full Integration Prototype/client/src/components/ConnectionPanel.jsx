import React from "react";

function ConnectionPanel({ connected, playerName, error }) {
  return (
    <section className="card">
      <h2>Connection</h2>
      <p>
        Player: <strong>{playerName}</strong>
      </p>
      <p className={connected ? "ok" : "warn"}>{connected ? "Connected" : "Disconnected"}</p>
      {error ? <p className="error">{error}</p> : <p className="muted">Server is authoritative for all rules.</p>}
    </section>
  );
}

export default ConnectionPanel;
