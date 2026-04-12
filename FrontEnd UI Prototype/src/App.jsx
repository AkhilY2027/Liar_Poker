import React, { useMemo, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import CurrentBidDisplay from "./components/CurrentBidDisplay";
import GameLog from "./components/GameLog";
import GameTable from "./components/GameTable";
import PlayerHand from "./components/PlayerHand";
import { compareHandsSimple, formatHandHuman } from "./handUtils";

const MOCK_PLAYERS = [
  { id: "p1", name: "Alex" },
  { id: "p2", name: "Blair" },
  { id: "p3", name: "Casey" },
];

const MOCK_HANDS = {
  p1: [14, 11, 9, 7, 3],
  p2: [13, 12, 8, 5, 2],
  p3: [10, 10, 6, 4, 2],
};

function App() {
  const [players] = useState(MOCK_PLAYERS);
  const [turnIndex, setTurnIndex] = useState(0);
  const [currentBid, setCurrentBid] = useState(null);
  const [logEntries, setLogEntries] = useState([
    {
      id: 1,
      text: "Prototype ready. Submit a bid to begin.",
    },
  ]);

  const currentTurn = players[turnIndex]?.id || null;
  const activePlayer = players[turnIndex]?.name || "Unknown";

  const tablePlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        active: true,
      })),
    [players]
  );

  function appendLog(text) {
    setLogEntries((previous) => [{ id: Date.now() + Math.random(), text }, ...previous]);
  }

  function submitBid(hand) {
    if (currentBid && compareHandsSimple(hand, currentBid) <= 0) {
      appendLog(`${activePlayer} attempted an invalid lower/equal bid: ${formatHandHuman(hand)}.`);
      return;
    }

    setCurrentBid(hand);
    appendLog(`${activePlayer} bid ${formatHandHuman(hand)}.`);
    setTurnIndex((previous) => (previous + 1) % players.length);
  }

  function callLiar() {
    if (!currentBid) {
      appendLog(`${activePlayer} tried to call liar, but no bid exists yet.`);
      return;
    }

    const previousIndex = (turnIndex - 1 + players.length) % players.length;
    const challengedPlayer = players[previousIndex]?.name || "Previous player";

    appendLog(`${activePlayer} called LIAR on ${challengedPlayer}. Round reset.`);
    setCurrentBid(null);
    setTurnIndex(0);
  }

  return (
    <main className="layout">
      <header className="banner">
        <h1>Liar&apos;s Poker UI Prototype</h1>
        <p>No backend connection. Local state simulation only.</p>
      </header>

      <div className="grid two">
        <GameTable players={tablePlayers} currentTurn={currentTurn} />
        <CurrentBidDisplay currentBid={currentBid} />
      </div>

      <div className="grid two">
        <PlayerHand playerName={activePlayer} cards={MOCK_HANDS[currentTurn] || []} />
        <ActionPanel onSubmitBid={submitBid} onCallLiar={callLiar} currentBid={currentBid} />
      </div>

      <GameLog entries={logEntries} />
    </main>
  );
}

export default App;
