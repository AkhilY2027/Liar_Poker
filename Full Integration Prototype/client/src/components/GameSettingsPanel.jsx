import React from "react";

const AUTO_FOLD_OPTIONS = [
  { value: "none", label: "Option 1 (TBD)" },
  { value: "blank_a", label: "Option 2 (TBD)" },
  { value: "blank_b", label: "Option 3 (TBD)" },
];

function GameSettingsPanel({ settings, onUpdateSettings, disabled }) {
  const turnTimeoutSeconds = Number(settings?.turnTimeoutSeconds || 60);
  const maxCardsToLose = Number(settings?.maxCardsToLose || 6);
  const autoFoldBehavior = String(settings?.autoFoldBehavior || "none");

  function update(partial) {
    if (disabled) {
      return;
    }
    onUpdateSettings(partial);
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

        <p className="muted">Changing any game setting resets the game immediately.</p>
      </div>
    </section>
  );
}

export default GameSettingsPanel;
