import React, { useMemo, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import ConnectionPanel from "./components/ConnectionPanel";
import CurrentBidDisplay from "./components/CurrentBidDisplay";
import GameLog from "./components/GameLog";
import GameTable from "./components/GameTable";
import MyHand from "./components/MyHand";
import RoundResultPopup from "./components/RoundResultPopup";
import { useGameSocket } from "./hooks/useGameSocket";

function App() {
  const [playerName] = useState(() => `Player-${Math.floor(Math.random() * 900 + 100)}`);
  const { game, connected, error, socketId, role, placeBid, callLiar } = useGameSocket(playerName);

  const players = useMemo(() => game.players || [], [game.players]);
  const isMyTurn = useMemo(() => Boolean(socketId) && game.currentTurn === socketId, [game.currentTurn, socketId]);
  const myPlayer = useMemo(() => players.find((player) => player.id === socketId) || null, [players, socketId]);
  const roleLabel = useMemo(() => {
    if (myPlayer) {
      return "player";
    }
    return role;
  }, [myPlayer, role]);

  return (
    <main className="layout">
      <header className="banner">
        <h1>Liar's Poker Full Integration</h1>
        <p>Open this app in multiple browser windows to play in real time.</p>
      </header>

      <div className="grid two">
        <ConnectionPanel
          connected={connected}
          playerName={playerName}
          error={error}
          role={roleLabel}
          assignedPlayerName={myPlayer?.name || ""}
        />
        <CurrentBidDisplay bid={game.currentBid} gameState={game.gameState} turnDeadlineMs={game.turnDeadlineMs} />
      </div>

      <div className="grid two">
        <GameTable players={players} currentTurn={game.currentTurn} myPlayerId={socketId} />
        <MyHand role={roleLabel} cards={game.myHand || []} cardTarget={game.myCardTarget || 0} />
      </div>

      <div className="grid two">
        <ActionPanel
          onPlaceBid={placeBid}
          onCallLiar={callLiar}
          currentBid={game.currentBid}
          isMyTurn={isMyTurn}
        />
      </div>

      <GameLog entries={game.log || []} />
      <RoundResultPopup roundResult={game.roundResult} />
    </main>
  );
}

export default App;
