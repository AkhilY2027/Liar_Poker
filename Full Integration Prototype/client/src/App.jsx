import React, { useMemo, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import ConnectionPanel from "./components/ConnectionPanel";
import CurrentBidDisplay from "./components/CurrentBidDisplay";
import GameLog from "./components/GameLog";
import GameTable from "./components/GameTable";
import { useGameSocket } from "./hooks/useGameSocket";

function App() {
  const [playerName] = useState(() => `Player-${Math.floor(Math.random() * 900 + 100)}`);
  const { game, connected, error, placeBid, callLiar } = useGameSocket(playerName);

  const players = useMemo(() => game.players || [], [game.players]);

  return (
    <main className="layout">
      <header className="banner">
        <h1>Liar's Poker Full Integration</h1>
        <p>Open this app in multiple browser windows to play in real time.</p>
      </header>

      <div className="grid two">
        <ConnectionPanel connected={connected} playerName={playerName} error={error} />
        <CurrentBidDisplay bid={game.currentBid} gameState={game.gameState} />
      </div>

      <div className="grid two">
        <GameTable players={players} currentTurn={game.currentTurn} />
        <ActionPanel onPlaceBid={placeBid} onCallLiar={callLiar} />
      </div>

      <GameLog entries={game.log || []} />
    </main>
  );
}

export default App;
