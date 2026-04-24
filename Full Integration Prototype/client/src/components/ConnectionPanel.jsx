import React, { useEffect, useState } from "react";

function ConnectionPanel({ connected, playerName, role, assignedPlayerName, currentDisplayName, onSaveDisplayName, disabled }) {
  const roleText = role === "player" ? `Player (${assignedPlayerName || "Unassigned"})` : "Viewer";
  const [draftName, setDraftName] = useState(currentDisplayName || "");

  useEffect(() => {
    setDraftName(currentDisplayName || "");
  }, [currentDisplayName]);

  function submit(event) {
    event.preventDefault();
    if (disabled || !onSaveDisplayName) {
      return;
    }
    onSaveDisplayName(draftName);
  }

  return (
    <section className="card">
      <h2>Connection Settings</h2>
      <form className="form" onSubmit={submit}>
        <label>
          Display Name
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            maxLength={24}
            placeholder="Player 1"
            disabled={disabled}
          />
        </label>

        <div className="buttonRow">
          <button type="submit" disabled={disabled}>
            Save Display Name
          </button>
        </div>
      </form>

      <p>
        Session: <strong>{playerName}</strong>
      </p>
      <p>
        Role: <strong>{roleText}</strong>
      </p>
      <p className={connected ? "ok" : "warn"}>{connected ? "Connected" : "Disconnected"}</p>
      <p className="muted">Server is authoritative for all rules.</p>
    </section>
  );
}

export default ConnectionPanel;
