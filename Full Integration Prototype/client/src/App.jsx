import React, { useEffect, useMemo, useState } from "react";
import ActionPanel from "./components/ActionPanel";
import ConnectionPanel from "./components/ConnectionPanel";
import GameSettingsPanel from "./components/GameSettingsPanel";
import GameLog from "./components/GameLog";
import GameTable from "./components/GameTable";
import MyHand from "./components/MyHand";
import RoundResultPopup from "./components/RoundResultPopup";
import { cardImageName, cardLabel, formatHand } from "./handUtils";
import { useGameSocket } from "./hooks/useGameSocket";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

function App() {
  const [playerName] = useState(() => `Player-${Math.floor(Math.random() * 900 + 100)}`);
  const [screen, setScreen] = useState("table");
  const [settingsTab, setSettingsTab] = useState("play");
  const [nowMs, setNowMs] = useState(Date.now());
  const { game, connected, error, errorCode, socketId, role, placeBid, callLiar, resetGame, setDisplayName, updateGameSettings, resetAllCards } =
    useGameSocket(playerName);

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
    if (myPlayer?.displayName || myPlayer?.name) {
      return myPlayer.displayName || myPlayer.name;
    }
    return roleLabel === "viewer" ? "Viewer" : playerName;
  }, [myPlayer?.displayName, myPlayer?.name, playerName, roleLabel]);

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

  const gameSettings = useMemo(
    () => ({
      turnTimeoutSeconds: Number(game?.settings?.turnTimeoutSeconds || 60),
      maxCardsToLose: Number(game?.settings?.maxCardsToLose || 6),
      autoFoldBehavior: String(game?.settings?.autoFoldBehavior || "next_highest"),
      maxCardsLoserBehavior: String(game?.settings?.maxCardsLoserBehavior || "rejoin_if_open_seat"),
    }),
    [
      game?.settings?.autoFoldBehavior,
      game?.settings?.maxCardsLoserBehavior,
      game?.settings?.maxCardsToLose,
      game?.settings?.turnTimeoutSeconds,
    ]
  );

  const displayedPlayerName = useMemo(() => {
    if (myPlayer?.displayName || myPlayer?.name) {
      return myPlayer.displayName || myPlayer.name;
    }
    return roleLabel === "viewer" ? "Viewer" : "";
  }, [myPlayer?.displayName, myPlayer?.name, roleLabel]);

  const isRevealPhase = game.gameState === "reveal";
  const winnerId = game?.roundResult?.winnerId || null;
  const loserId = game?.roundResult?.loserId || null;
  const winningCardKeys = useMemo(() => new Set(game?.roundResult?.winningCardKeys || []), [game?.roundResult?.winningCardKeys]);

  function seatClassName(playerId) {
    const classes = ["seatRow"];
    if (!isRevealPhase && playerId === game.currentTurn) {
      classes.push("current");
    }
    if (isRevealPhase && playerId === winnerId) {
      classes.push("winner");
    }
    if (isRevealPhase && playerId === loserId) {
      classes.push("loser");
    }
    return classes.join(" ");
  }

  function seatCardsClassName(player) {
    const classes = ["seatCards"];
    const cardCount = Number(player?.cardCount || 0);
    const isCurrentSeat = player?.id === game.currentTurn;
    if (!isRevealPhase && (cardCount > 6 || (isCurrentSeat && cardCount >= 6))) {
      classes.push("splitRows");
    }
    return classes.join(" ");
  }

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
            Reset round
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
              Connection Settings
            </button>
            <button
              className={`settingsNavBtn ${settingsTab === "game" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("game")}
            >
              Game Settings
            </button>
            <button
              className={`settingsNavBtn ${settingsTab === "history" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("history")}
            >
              Hand History
            </button>
            <button
              className={`settingsNavBtn ${settingsTab === "private" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("private")}
            >
              Private Rooms
            </button>
          </aside>

          <div className="settingsContent">
            <h2>Salon Preferences</h2>
            <div className="settingsGrid">
              {settingsTab === "play" ? (
                <ConnectionPanel
                  connected={connected}
                  playerName={playerName}
                  role={roleLabel}
                  assignedPlayerName={displayedPlayerName}
                  currentDisplayName={displayedPlayerName}
                  onSaveDisplayName={setDisplayName}
                  disabled={!connected}
                />
              ) : null}

              {settingsTab === "game" ? (
                <GameSettingsPanel
                  settings={gameSettings}
                  disabled={!connected}
                  onUpdateSettings={(partial) => updateGameSettings(partial)}
                  onResetAllCards={resetAllCards}
                />
              ) : null}

              {settingsTab === "history" ? <GameLog entries={game.log || []} /> : null}

              {settingsTab === "private" ? <GameTable players={players} currentTurn={game.currentTurn} myPlayerId={socketId} /> : null}
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
                      <div className={seatClassName(player.id)} key={player.id}>
                        <div className="seatName">{player.id === socketId ? "YOU" : player.displayName || player.name}</div>
                        <div className={seatCardsClassName(player)}>
                          {isRevealPhase && Array.isArray(player.revealedCards) && player.revealedCards.length
                            ? player.revealedCards.map((card, i) => {
                                const cardKey = `${card.rank}-${card.suit}`;
                                const isWinningCard = winningCardKeys.has(cardKey);
                                return (
                                  <span className={isWinningCard ? "seatCard reveal winningBid" : "seatCard reveal"} key={`${player.id}-${cardKey}-${i}`}>
                                    <img src={`${SERVER_URL}/card_deck_images/${cardImageName(card)}`} alt={cardLabel(card)} />
                                  </span>
                                );
                              })
                            : Array.from({ length: Math.max(0, player.cardCount || 0) }).map((_, i) => (
                                <span className="seatCard" key={`${player.id}-${i}`} />
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
                      {currentTurnPlayer
                        ? `${
                            currentTurnPlayer.id === socketId
                              ? "YOUR"
                              : `${currentTurnPlayer.displayName || currentTurnPlayer.name}'S`
                          } TURN`
                        : "WAITING"}
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
                      <div className={seatClassName(player.id)} key={player.id}>
                        <div className="seatName">{player.id === socketId ? "YOU" : player.displayName || player.name}</div>
                        <div className={seatCardsClassName(player)}>
                          {isRevealPhase && Array.isArray(player.revealedCards) && player.revealedCards.length
                            ? player.revealedCards.map((card, i) => {
                                const cardKey = `${card.rank}-${card.suit}`;
                                const isWinningCard = winningCardKeys.has(cardKey);
                                return (
                                  <span className={isWinningCard ? "seatCard reveal winningBid" : "seatCard reveal"} key={`${player.id}-${cardKey}-${i}`}>
                                    <img src={`${SERVER_URL}/card_deck_images/${cardImageName(card)}`} alt={cardLabel(card)} />
                                  </span>
                                );
                              })
                            : Array.from({ length: Math.max(0, player.cardCount || 0) }).map((_, i) => (
                                <span className="seatCard" key={`${player.id}-${i}`} />
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

      <RoundResultPopup roundResult={game.roundResult} errorMessage={error} errorCode={errorCode} />
    </main>
  );
}

export default App;
