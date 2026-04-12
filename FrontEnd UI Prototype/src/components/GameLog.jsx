import React from "react";

function GameLog({ entries }) {
  return (
    <section className="card">
      <h2>Game Log</h2>
      {entries.length === 0 ? (
        <p className="muted">No actions yet.</p>
      ) : (
        <ol className="log-list">
          {entries.map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default GameLog;
