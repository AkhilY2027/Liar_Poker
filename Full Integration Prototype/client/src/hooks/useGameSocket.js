import { useEffect, useMemo, useState } from "react";
import { createSocketClient } from "../network/socketClient";
import protocol from "../../../shared/socketProtocol.json";

const { events: EVENT } = protocol;

export function useGameSocket(playerName) {
  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState({
    players: [],
    currentTurn: null,
    currentBid: null,
    gameState: "waiting",
    myHand: [],
    myCardTarget: 0,
    roundResult: null,
    log: [],
    settings: {
      turnTimeoutSeconds: 60,
      maxCardsToLose: 6,
      autoFoldBehavior: "none",
    },
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [socketId, setSocketId] = useState(null);
  const [role, setRole] = useState("viewer");
  const [gameId, setGameId] = useState("main-room");

  useEffect(() => {
    const client = createSocketClient();
    setSocket(client);

    client.on("connect", () => {
      setConnected(true);
      setSocketId(client.id || null);
      setRole("viewer");
      setError("");
      setErrorCode("");
      client.emit(EVENT.joinGame, { name: playerName });
    });

    client.on("disconnect", () => {
      setConnected(false);
      setSocketId(null);
      setRole("viewer");
    });

    client.on(EVENT.connectionReady, () => {
      setError("");
      setErrorCode("");
    });

    client.on(EVENT.gameCreated, ({ gameId: createdGameId } = {}) => {
      if (!createdGameId) {
        return;
      }
      setGameId(createdGameId);
      client.emit(EVENT.joinGame, { name: playerName, gameId: createdGameId });
    });

    client.on(EVENT.gameUpdate, (state) => {
      setGame(state);
      if (state?.id) {
        setGameId(state.id);
      }
      if (state?.role === "player" || state?.role === "viewer") {
        setRole(state.role);
      }
      setError("");
      setErrorCode("");
    });

    client.on(EVENT.invalidMove, ({ message, code } = {}) => {
      setError(message || "Invalid move");
      setErrorCode(code || "");
    });

    client.on(EVENT.roleUpdate, ({ role: nextRole } = {}) => {
      if (nextRole === "player" || nextRole === "viewer") {
        setRole(nextRole);
      }
    });

    return () => {
      client.disconnect();
      setSocket(null);
    };
  }, [playerName]);

  const actions = useMemo(
    () => ({
      placeBid(hand) {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.placeBid, { hand });
      },
      callLiar() {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.callLiar);
      },
      resetGame() {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.resetGame);
      },
      resetAllCards() {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.resetAllCards);
      },
      setDisplayName(displayName) {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.setDisplayName, { displayName });
      },
      updateGameSettings(settings) {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.updateGameSettings, { settings });
      },
      createGame(preferredGameId = "") {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.createGame, { gameId: preferredGameId });
      },
      joinGame(nextGameId = "") {
        if (!socket) {
          return;
        }
        socket.emit(EVENT.joinGame, { name: playerName, gameId: nextGameId });
      },
      clearError() {
        setError("");
        setErrorCode("");
      },
    }),
    [socket, playerName]
  );

  return {
    game,
    connected,
    error,
    errorCode,
    socketId,
    role,
    gameId,
    ...actions,
  };
}
