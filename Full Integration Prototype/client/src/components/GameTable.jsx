import React from "react";

function GameTable({ players, currentTurn }) {
  return (
    <section className="card">
      <h2>Players</h2>
      <ul className="list">
        {players.map((player) => (
          <li
            key={player.id}
            className={player.id === currentTurn ? "row current" : "row"}
          >
            <span>{player.name}</span>
            <span className="status">
              {player.active ? (player.id === currentTurn ? "Your move" : "Active") : "Away"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GameTable;
