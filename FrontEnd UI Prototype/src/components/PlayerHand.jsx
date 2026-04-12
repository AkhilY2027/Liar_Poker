import React from "react";
import { formatHandHuman, rankLabel } from "../handUtils";

function PlayerHand({ playerName, cards }) {
  const mockHand = {
    type: "HIGH_CARD",
    primaryRanks: cards,
    suit: null,
  };

  return (
    <section className="card">
      <h2>{playerName} Hand (Mock)</h2>
      <p className="muted">{formatHandHuman(mockHand)}</p>
      <div className="chips">
        {cards.map((rank, index) => (
          <span key={`${rank}-${index}`} className="chip">
            {rankLabel(rank)}
          </span>
        ))}
      </div>
    </section>
  );
}

export default PlayerHand;
