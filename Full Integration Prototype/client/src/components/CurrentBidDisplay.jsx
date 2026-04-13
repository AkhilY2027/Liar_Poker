import React, { useEffect, useMemo, useState } from "react";
import { formatHand } from "../handUtils";

function CurrentBidDisplay({ bid, gameState, turnDeadlineMs }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!turnDeadlineMs) {
      return null;
    }
    const ms = Math.max(0, turnDeadlineMs - nowMs);
    return (ms / 1000).toFixed(1);
  }, [nowMs, turnDeadlineMs]);

  return (
    <section className="card">
      <h2>Current Bid</h2>
      <p className="headline">{formatHand(bid)}</p>
      <p className="muted">State: {gameState}</p>
      <p className="muted">Time left: {secondsLeft === null ? "-" : `${secondsLeft}s`}</p>
    </section>
  );
}

export default CurrentBidDisplay;
