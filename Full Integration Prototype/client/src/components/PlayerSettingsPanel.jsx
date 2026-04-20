import React, { useEffect, useState } from "react";

function PlayerSettingsPanel({ currentDisplayName, onSaveDisplayName, disabled }) {
  const [draftName, setDraftName] = useState(currentDisplayName || "");

  useEffect(() => {
    setDraftName(currentDisplayName || "");
  }, [currentDisplayName]);

  function submit(event) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    onSaveDisplayName(draftName);
  }

  return (
    <section className="card">
      <h2>Player Settings</h2>
      <form className="form" onSubmit={submit}>
        <label>
          Display Name
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            maxLength={24}
            placeholder="Player 1"
          />
        </label>

        <p className="muted">This changes how your name appears to other players.</p>

        <div className="buttonRow">
          <button type="submit" disabled={disabled}>
            Save Display Name
          </button>
        </div>
      </form>
    </section>
  );
}

export default PlayerSettingsPanel;
