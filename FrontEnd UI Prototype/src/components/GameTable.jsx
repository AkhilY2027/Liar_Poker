import React from "react";

function GameTable({ players, currentTurn }) {
  return (
    <section className="card">
      <h2>Game Table</h2>
      <ul className="players-list">
        {players.map((player) => {
          const isCurrent = player.id === currentTurn;
          return (
            <li key={player.id} className={isCurrent ? "player-row current" : "player-row"}>
              <span>{player.name}</span>
              <span className="pill">{isCurrent ? "Current Turn" : "Waiting"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default GameTable;
