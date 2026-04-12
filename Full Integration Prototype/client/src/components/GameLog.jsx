import React from "react";

function GameLog({ entries }) {
  return (
    <section className="card">
      <h2>Game Log</h2>
      <ul className="logList">
        {entries.length ? (
          entries.map((entry) => <li key={entry.id}>{entry.message}</li>)
        ) : (
          <li>No events yet</li>
        )}
      </ul>
    </section>
  );
}

export default GameLog;
