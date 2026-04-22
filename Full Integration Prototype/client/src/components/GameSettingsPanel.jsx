import React, { useState } from "react";

const AUTO_FOLD_OPTIONS = [
  { value: "none", label: "Option 1 (TBD)" },
  { value: "blank_a", label: "Option 2 (TBD)" },
  { value: "blank_b", label: "Option 3 (TBD)" },
];

function GameSettingsPanel({ settings, onUpdateSettings, onResetAllCards, disabled }) {
  const turnTimeoutSeconds = Number(settings?.turnTimeoutSeconds || 60);
  const maxCardsToLose = Number(settings?.maxCardsToLose || 6);
  const autoFoldBehavior = String(settings?.autoFoldBehavior || "none");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  function update(partial) {
    if (disabled) {
      return;
    }
    onUpdateSettings(partial);
  }

  function handleResetAllCards() {
    if (disabled || !onResetAllCards) {
      return;
    }
    onResetAllCards();
    setShowResetConfirmation(false);
  }

  return (
    <section className="card">
      <h2>Game Settings</h2>
      <div className="form">
        <label>
          Turn Timeout: <strong>{turnTimeoutSeconds}s</strong>
          <input
            type="range"
            min="20"
            max="120"
            step="5"
            value={turnTimeoutSeconds}
            onChange={(event) =>
              update({
                turnTimeoutSeconds: Number(event.target.value),
              })
            }
            disabled={disabled}
          />
        </label>

        <label>
          Max Cards Before Reset: <strong>{maxCardsToLose}</strong>
          <input
            type="range"
            min="6"
            max="8"
            step="1"
            value={maxCardsToLose}
            onChange={(event) =>
              update({
                maxCardsToLose: Number(event.target.value),
              })
            }
            disabled={disabled}
          />
        </label>

        <label>
          Auto-Fold Behavior
          <select
            value={autoFoldBehavior}
            onChange={(event) =>
              update({
                autoFoldBehavior: event.target.value,
              })
            }
            disabled={disabled}
          >
            {AUTO_FOLD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="muted">Changing any game setting resets the current round immediately.</p>

        <div className="resetGameSection">
          <button
            type="button"
            className="resetGameBtn"
            onClick={() => setShowResetConfirmation(true)}
            disabled={disabled}
          >
            Reset Game
          </button>
          <p className="muted">Reset all players to 3 cards and start fresh.</p>
        </div>
      </div>

      {showResetConfirmation && (
        <div className="modal">
          <div className="modalContent">
            <h3>Reset Game?</h3>
            <p>This will reset all players to 3 cards and start a new game.</p>
            <div className="modalActions">
              <button type="button" onClick={() => setShowResetConfirmation(false)} className="cancelBtn">
                Cancel
              </button>
              <button type="button" onClick={handleResetAllCards} className="confirmBtn">
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default GameSettingsPanel;
