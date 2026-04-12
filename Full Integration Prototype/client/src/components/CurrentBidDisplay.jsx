import React from "react";
import { formatHand } from "../handUtils";

function CurrentBidDisplay({ bid, gameState }) {
  return (
    <section className="card">
      <h2>Current Bid</h2>
      <p className="headline">{formatHand(bid)}</p>
      <p className="muted">State: {gameState}</p>
    </section>
  );
}

export default CurrentBidDisplay;
