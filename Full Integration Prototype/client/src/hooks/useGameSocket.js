import { useEffect, useMemo, useState } from "react";
import { createSocketClient } from "../network/socketClient";

export function useGameSocket(playerName) {
  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState({
    players: [],
    currentTurn: null,
    currentBid: null,
    gameState: "waiting",
    log: [],
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [socketId, setSocketId] = useState(null);
  const [role, setRole] = useState("viewer");

  useEffect(() => {
    const client = createSocketClient();
    setSocket(client);

    client.on("connect", () => {
      setConnected(true);
      setSocketId(client.id || null);
      setRole("viewer");
      setError("");
      client.emit("join_game", { name: playerName });
    });

    client.on("disconnect", () => {
      setConnected(false);
      setSocketId(null);
      setRole("viewer");
    });

    client.on("game_update", (state) => {
      setGame(state);
      setError("");
    });

    client.on("invalid_move", ({ message }) => {
      setError(message || "Invalid move");
    });

    client.on("role_update", ({ role: nextRole } = {}) => {
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
        socket.emit("place_bid", { hand });
      },
      callLiar() {
        if (!socket) {
          return;
        }
        socket.emit("call_liar");
      },
      clearError() {
        setError("");
      },
    }),
    [socket]
  );

  return {
    game,
    connected,
    error,
    socketId,
    role,
    ...actions,
  };
}
