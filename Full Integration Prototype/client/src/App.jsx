import React, { useEffect, useMemo, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import ConnectionPanel from "./components/ConnectionPanel";
import GameLog from "./components/GameLog";
import GameTable from "./components/GameTable";
import MyHand from "./components/MyHand";
import RoundResultPopup from "./components/RoundResultPopup";
import { formatHand } from "./handUtils";
import { useGameSocket } from "./hooks/useGameSocket";

function App() {
  const [playerName] = useState(() => `Player-${Math.floor(Math.random() * 900 + 100)}`);
  const [screen, setScreen] = useState("table");
  const [settingsTab, setSettingsTab] = useState("play");
  const [nowMs, setNowMs] = useState(Date.now());
  const { game, connected, error, socketId, role, placeBid, callLiar, resetGame } = useGameSocket(playerName);

  const players = useMemo(() => game.players || [], [game.players]);
  const isMyTurn = useMemo(() => Boolean(socketId) && game.currentTurn === socketId, [game.currentTurn, socketId]);
  const myPlayer = useMemo(() => players.find((player) => player.id === socketId) || null, [players, socketId]);
  const currentTurnPlayer = useMemo(
    () => players.find((player) => player.id === game.currentTurn) || null,
    [game.currentTurn, players]
  );
  const roleLabel = useMemo(() => {
    if (myPlayer) {
      return "player";
    }
    return role;
  }, [myPlayer, role]);

  const headerIdentity = useMemo(() => {
    if (myPlayer?.name) {
      return myPlayer.name;
    }
    return roleLabel === "viewer" ? "Viewer" : playerName;
  }, [myPlayer?.name, playerName, roleLabel]);

  const displaySeats = useMemo(() => {
    const seatPlayers = [...players].slice(0, 8);
    while (seatPlayers.length < 8) {
      seatPlayers.push(null);
    }
    return seatPlayers;
  }, [players]);

  const leftSeats = useMemo(() => displaySeats.slice(0, 4), [displaySeats]);
  const rightSeats = useMemo(() => displaySeats.slice(4, 8), [displaySeats]);

  const secondsLeft = useMemo(() => {
    if (!game.turnDeadlineMs) {
      return "-";
    }
    const ms = Math.max(0, game.turnDeadlineMs - nowMs);
    return `${(ms / 1000).toFixed(1)}s`;
  }, [game.turnDeadlineMs, nowMs]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="appRoot">
      <header className="topbar">
        <h1>LIAR&apos;S POKER</h1>
        <div className="topbarActions">
          <button className="resetBtn" type="button" onClick={resetGame}>
            Reset game
          </button>
          <button className="iconBtn" type="button" title="Help">
            ?
          </button>
          <button
            className="iconBtn"
            type="button"
            title="Settings"
            onClick={() => setScreen((prev) => (prev === "settings" ? "table" : "settings"))}
          >
            ⚙
          </button>
          <button className="avatarBtn" type="button" title="Return to table" onClick={() => setScreen("table")}>
            {headerIdentity}
          </button>
        </div>
      </header>

      {screen === "settings" ? (
        <section className="settingsShell">
          <aside className="settingsNav">
            <button
              className={`settingsNavBtn ${settingsTab === "play" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("play")}
            >
              Play Now
            </button>
            <button
              className={`settingsNavBtn ${settingsTab === "private" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("private")}
            >
              Private Rooms
            </button>
            <button
              className={`settingsNavBtn ${settingsTab === "history" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("history")}
            >
              Hand History
            </button>
          </aside>

          <div className="settingsContent">
            <h2>Salon Preferences</h2>
            <div className="settingsGrid">
              {settingsTab !== "history" ? (
                <>
                  <ConnectionPanel
                    connected={connected}
                    playerName={playerName}
                    error={error}
                    role={roleLabel}
                    assignedPlayerName={myPlayer?.name || ""}
                  />
                  <GameTable players={players} currentTurn={game.currentTurn} myPlayerId={socketId} />
                </>
              ) : null}

              {settingsTab === "history" ? <GameLog entries={game.log || []} /> : null}
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className={`tableStage ${isMyTurn ? "turnMode" : "idleMode"}`}>
            <div className="playScene">
              <div className="felt">
                <div className="seatColumn leftColumn">
                  {leftSeats.map((player, index) =>
                    player ? (
                      <div className={`seatRow ${player.id === game.currentTurn ? "current" : ""}`} key={player.id}>
                        <div className="seatName">{player.id === socketId ? "YOU" : player.name}</div>
                        <div className="seatCards">
                          {Array.from({ length: Math.max(0, player.cardCount || 0) }).map((_, i) => (
                            <span key={`${player.id}-${i}`} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="seatRow empty" key={`left-empty-${index}`}>
                        Empty Seat
                      </div>
                    )
                  )}
                </div>

                <div className="centerColumn">
                  <div className="challengeCard">
                    <p className="challengeTitle">CURRENT CHALLENGE</p>
                    <p className="challengeValue">{formatHand(game.currentBid)}</p>
                    <p className="challengeSub">
                      {currentTurnPlayer ? `${currentTurnPlayer.id === socketId ? "YOUR" : `${currentTurnPlayer.name}'S`} TURN` : "WAITING"}
                    </p>
                    <p className="challengeTimer">{secondsLeft}</p>
                  </div>

                  <div className="handArea">
                    <MyHand role={roleLabel} cards={game.myHand || []} />
                  </div>
                </div>

                <div className="seatColumn rightColumn">
                  {rightSeats.map((player, index) =>
                    player ? (
                      <div className={`seatRow ${player.id === game.currentTurn ? "current" : ""}`} key={player.id}>
                        <div className="seatName">{player.id === socketId ? "YOU" : player.name}</div>
                        <div className="seatCards">
                          {Array.from({ length: Math.max(0, player.cardCount || 0) }).map((_, i) => (
                            <span key={`${player.id}-${i}`} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="seatRow empty" key={`right-empty-${index}`}>
                        Empty Seat
                      </div>
                    )
                  )}
                </div>
              </div>

              {isMyTurn ? (
                <aside className="turnComposer">
                  <div className="turnComposerHeader">
                    <p>INPUT NEW BET</p>
                  </div>
                  <ActionPanel
                    onPlaceBid={placeBid}
                    onCallLiar={callLiar}
                    currentBid={game.currentBid}
                    isMyTurn={isMyTurn}
                    submitLabel="Submit a Hand"
                    showCallButton={true}
                  />
                </aside>
              ) : null}
            </div>
          </section>
        </>
      )}

      <RoundResultPopup roundResult={game.roundResult} />
    </main>
  );
}

export default App;
