const {
  createGame,
  addOrReconnectPlayer,
  markPlayerInactive,
  removePlayer,
  getActivePlayers,
  startGameIfReady,
  resetRound,
  pauseGame,
  appendLog,
  isPlayersTurn,
  advanceTurn,
  getPreviousPlayer,
  normalizeHand,
  isValidBid,
} = require("./gameLogic");

const DEFAULT_ROOM_ID = "main-room";
const DISCONNECT_MODE = String(process.env.DISCONNECT_MODE || "autofold").toLowerCase();
const TIMEOUT_ACTION = String(process.env.TIMEOUT_ACTION || "pass").toLowerCase();
const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS || 20000);

const games = new Map();
const timers = new Map();

games.set(DEFAULT_ROOM_ID, createGame(DEFAULT_ROOM_ID));

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("create_game", ({ gameId } = {}) => {
      const roomId = sanitizeGameId(gameId) || `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      if (!games.has(roomId)) {
        games.set(roomId, createGame(roomId));
      }
      socket.emit("game_created", { gameId: roomId });
    });

    socket.on("join_game", ({ name, gameId } = {}) => {
      const roomId = sanitizeGameId(gameId) || DEFAULT_ROOM_ID;
      const game = getOrCreateGame(roomId);

      const player = addOrReconnectPlayer(game, { id: socket.id, name });
      socket.join(roomId);
      socket.data.gameId = roomId;

      appendLog(game, `${player.name} joined ${roomId}.`);
      logInfo("join_game", { roomId, playerId: socket.id, playerName: player.name });
      startGameIfReady(game);
      scheduleTurnTimer(io, game);
      broadcastGame(io, roomId);
    });

    socket.on("place_bid", ({ hand } = {}) => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before placing bids.");
        return;
      }

      withGameLock(io, game, socket, "place_bid", () => {
        const player = game.players.find((item) => item.id === socket.id);
        if (!player || !player.active) {
          emitInvalid(socket, "Join the game before placing bids.");
          return;
        }

        if (game.gameState !== "in_progress") {
          emitInvalid(socket, "Game is not in progress yet.");
          return;
        }

        if (!isPlayersTurn(game, socket.id)) {
          emitInvalid(socket, "It is not your turn.");
          return;
        }

        try {
          const normalized = normalizeHand(hand);
          if (!isValidBid(game.currentBid, normalized)) {
            emitInvalid(socket, "Bid must be strictly higher than current bid.");
            return;
          }

          game.currentBid = normalized;
          appendLog(game, `${player.name} bid ${formatForLog(normalized)}.`);
          logInfo("place_bid", { roomId: game.id, playerId: socket.id, bid: normalized });

          advanceTurn(game);
          scheduleTurnTimer(io, game);
        } catch (error) {
          emitInvalid(socket, error.message);
        }
      });
    });

    socket.on("call_liar", () => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before calling liar.");
        return;
      }

      withGameLock(io, game, socket, "call_liar", () => {
        const player = game.players.find((item) => item.id === socket.id);
        if (!player || !player.active) {
          emitInvalid(socket, "Join the game before calling liar.");
          return;
        }

        if (game.gameState !== "in_progress") {
          emitInvalid(socket, "Game is not in progress.");
          return;
        }

        if (!isPlayersTurn(game, socket.id)) {
          emitInvalid(socket, "It is not your turn.");
          return;
        }

        const previous = getPreviousPlayer(game);
        if (!previous || !game.currentBid) {
          emitInvalid(socket, "No bid is available to challenge.");
          return;
        }

        game.gameState = "reveal";
        appendLog(game, `${player.name} called LIAR on ${previous.name}. Round reset.`);
        logInfo("call_liar", { roomId: game.id, caller: player.id, challenged: previous.id });

        resetRound(game);
        scheduleTurnTimer(io, game);
      });
    });

    socket.on("disconnect", () => {
      const game = getSocketGame(socket);
      if (!game) {
        return;
      }

      withGameLock(io, game, socket, "disconnect", () => {
        const player = game.players.find((item) => item.id === socket.id);
        if (!player) {
          return;
        }

        const wasCurrentTurn = game.currentTurn === socket.id;

        if (DISCONNECT_MODE === "remove") {
          removePlayer(game, socket.id);
          appendLog(game, `${player.name} disconnected and was removed.`);
        } else if (DISCONNECT_MODE === "pause") {
          markPlayerInactive(game, socket.id);
          pauseGame(game, `${player.name} disconnected. Game paused.`);
          appendLog(game, `${player.name} disconnected. Game paused.`);
        } else {
          markPlayerInactive(game, socket.id);
          appendLog(game, `${player.name} disconnected and auto-folded.`);
        }

        logInfo("disconnect", {
          roomId: game.id,
          playerId: socket.id,
          mode: DISCONNECT_MODE,
          wasCurrentTurn,
        });

        if (DISCONNECT_MODE !== "pause") {
          const active = getActivePlayers(game);
          if (!active.length) {
            clearGameTimer(game.id);
            games.delete(game.id);
            return;
          }

          if (wasCurrentTurn) {
            game.currentTurn = active[0].id;
          }

          startGameIfReady(game);
          scheduleTurnTimer(io, game);
        } else {
          clearGameTimer(game.id);
        }
      });
    });

    const defaultGame = getOrCreateGame(DEFAULT_ROOM_ID);
    socket.emit("game_update", serializeGame(defaultGame));
  });
}

function withGameLock(io, game, socket, eventName, fn) {
  if (game.processingAction) {
    emitInvalid(socket, "Game is processing another action. Try again.");
    return;
  }

  game.processingAction = true;
  try {
    fn();
  } catch (error) {
    emitInvalid(socket, "Unexpected server error.");
    logError("withGameLock", {
      roomId: game.id,
      eventName,
      playerId: socket.id,
      error: error.message,
    });
  } finally {
    game.processingAction = false;
    io.to(game.id).emit("game_update", serializeGame(game));
  }
}

function emitInvalid(socket, message) {
  const game = getSocketGame(socket);
  if (game) {
    const player = game.players.find((item) => item.id === socket.id);
    appendLog(game, `Invalid action by ${player?.name || socket.id}: ${message}`);
    logWarn("invalid_move", {
      roomId: game.id,
      playerId: socket.id,
      reason: message,
    });
  }
  socket.emit("invalid_move", { message });
}

function broadcastGame(io, gameId) {
  const game = games.get(gameId);
  if (!game) {
    return;
  }
  io.to(gameId).emit("game_update", serializeGame(game));
}

function scheduleTurnTimer(io, game) {
  clearGameTimer(game.id);
  if (game.gameState !== "in_progress" || !game.currentTurn) {
    game.turnDeadlineMs = null;
    return;
  }

  game.turnDeadlineMs = Date.now() + TURN_TIMEOUT_MS;
  const timerId = setTimeout(() => {
    const sameGame = games.get(game.id);
    if (!sameGame || sameGame.gameState !== "in_progress") {
      return;
    }

    if (sameGame.processingAction) {
      scheduleTurnTimer(io, sameGame);
      return;
    }

    sameGame.processingAction = true;
    try {
      const timedOutPlayer = sameGame.players.find((player) => player.id === sameGame.currentTurn);
      if (!timedOutPlayer) {
        return;
      }

      if (TIMEOUT_ACTION === "liar" && sameGame.currentBid) {
        const previous = getPreviousPlayer(sameGame);
        if (previous) {
          appendLog(
            sameGame,
            `${timedOutPlayer.name} timed out. Auto-called LIAR on ${previous.name}. Round reset.`
          );
          resetRound(sameGame);
        }
      } else {
        appendLog(sameGame, `${timedOutPlayer.name} timed out. Auto-pass applied.`);
        advanceTurn(sameGame);
      }

      logInfo("turn_timeout", {
        roomId: sameGame.id,
        playerId: timedOutPlayer.id,
        timeoutAction: TIMEOUT_ACTION,
      });

      scheduleTurnTimer(io, sameGame);
    } finally {
      sameGame.processingAction = false;
      broadcastGame(io, sameGame.id);
    }
  }, TURN_TIMEOUT_MS);

  timers.set(game.id, timerId);
}

function clearGameTimer(gameId) {
  const timer = timers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(gameId);
  }
}

function getOrCreateGame(gameId) {
  if (!games.has(gameId)) {
    games.set(gameId, createGame(gameId));
  }
  return games.get(gameId);
}

function getSocketGame(socket) {
  const gameId = socket.data.gameId;
  if (!gameId) {
    return null;
  }
  return games.get(gameId) || null;
}

function sanitizeGameId(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  return normalized.slice(0, 40);
}

function serializeGame(state) {
  return {
    id: state.id,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      active: player.active,
    })),
    currentTurn: state.currentTurn,
    currentBid: state.currentBid,
    gameState: state.gameState,
    log: state.log,
    pausedReason: state.pausedReason,
    turnDeadlineMs: state.turnDeadlineMs,
  };
}

function formatForLog(hand) {
  const ranks = hand.primaryRanks.join(",");
  return `${hand.type} ${ranks}${hand.suit ? ` ${hand.suit}` : ""}`;
}

function logInfo(event, payload) {
  console.info(`[socket] ${event}`, payload);
}

function logWarn(event, payload) {
  console.warn(`[socket] ${event}`, payload);
}

function logError(event, payload) {
  console.error(`[socket] ${event}`, payload);
}

module.exports = {
  registerSocketHandlers,
  games,
};
