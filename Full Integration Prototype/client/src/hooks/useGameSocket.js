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

  useEffect(() => {
    const client = createSocketClient();
    setSocket(client);

    client.on("connect", () => {
      setConnected(true);
      setError("");
      client.emit("join_game", { name: playerName });
    });

    client.on("disconnect", () => {
      setConnected(false);
    });

    client.on("game_update", (state) => {
      setGame(state);
      setError("");
    });

    client.on("invalid_move", ({ message }) => {
      setError(message || "Invalid move");
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
    ...actions,
  };
}
