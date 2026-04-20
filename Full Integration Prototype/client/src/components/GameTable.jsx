import React from "react";

function GameTable({ players, currentTurn, myPlayerId }) {
  return (
    <section className="card">
      <h2>Players</h2>
      <ul className="list">
        {players.map((player) => (
          <li
            key={player.id}
            className={player.id === currentTurn ? "row current" : "row"}
          >
            <span className={player.id === myPlayerId ? "playerName self" : "playerName"}>
              {player.displayName || player.name}
            </span>
            <span className="status">
              {player.id === currentTurn ? "Currently bidding" : "Waiting"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GameTable;
