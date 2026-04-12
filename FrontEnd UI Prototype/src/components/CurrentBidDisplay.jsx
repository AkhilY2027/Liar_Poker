import React from "react";
import { formatHandHuman, handTypeLabel, rankLabel } from "../handUtils";

function CurrentBidDisplay({ currentBid }) {
  return (
    <section className="card">
      <h2>Current Bid</h2>
      {!currentBid ? (
        <p className="muted">No bid has been placed yet.</p>
      ) : (
        <>
          <p className="headline">{formatHandHuman(currentBid)}</p>
          <p className="muted">
            {handTypeLabel(currentBid.type)} | Ranks: {currentBid.primaryRanks.map(rankLabel).join(", ")}
            {currentBid.suit ? ` | Suit: ${currentBid.suit}` : ""}
          </p>
        </>
      )}
    </section>
  );
}

export default CurrentBidDisplay;
