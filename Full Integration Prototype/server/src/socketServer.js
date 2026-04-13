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
const MAX_PLAYERS = 8;

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
      socket.join(roomId);
      socket.data.gameId = roomId;

      removeViewer(game, socket.id);

      const label = nextPlayerLabel(game);
      const atCapacity = getActivePlayers(game).length >= MAX_PLAYERS || !label;

      if (atCapacity) {
        addViewer(game, { id: socket.id, name });
        socket.data.role = "viewer";

        appendLog(game, `${sanitizeViewerName(name)} joined ${roomId} as viewer (table full).`);
        logInfo("join_game_viewer", { roomId, viewerId: socket.id });
        socket.emit("role_update", { role: "viewer", reason: "table_full" });
        broadcastGame(io, roomId);
        return;
      }

      const player = addOrReconnectPlayer(game, { id: socket.id, name: label });
      socket.data.role = "player";

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
        if (socket.data.role === "viewer") {
          emitInvalid(socket, "Viewers cannot place bids.");
          return;
        }

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
        if (socket.data.role === "viewer") {
          emitInvalid(socket, "Viewers cannot call liar.");
          return;
        }

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

        resetRoundAndRefill(io, game);
        scheduleTurnTimer(io, game);
      });
    });

    socket.on("disconnect", () => {
      const game = getSocketGame(socket);
      if (!game) {
        return;
      }

      withGameLock(io, game, socket, "disconnect", () => {
        const viewerRemoved = removeViewer(game, socket.id);
        if (viewerRemoved) {
          appendLog(game, `A viewer disconnected.`);
          return;
        }

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
            if (!game.viewers.length) {
              games.delete(game.id);
            } else {
              game.gameState = "waiting";
              game.currentTurn = null;
              game.currentBid = null;
              game.pausedReason = null;
            }
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
          resetRoundAndRefill(io, sameGame);
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
  const game = games.get(gameId);
  if (!Array.isArray(game.viewers)) {
    game.viewers = [];
  }
  return game;
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
    viewerCount: state.viewers?.length || 0,
    maxPlayers: MAX_PLAYERS,
    pausedReason: state.pausedReason,
    turnDeadlineMs: state.turnDeadlineMs,
  };
}

function resetRoundAndRefill(io, game) {
  removeInactivePlayers(game);
  const promoted = promoteViewers(io, game);
  resetRound(game);

  if (promoted > 0) {
    appendLog(game, `${promoted} viewer${promoted === 1 ? " was" : "s were"} added as new player${
      promoted === 1 ? "" : "s"
    }.`);
  }
}

function removeInactivePlayers(game) {
  game.players = game.players.filter((player) => player.active);
}

function promoteViewers(io, game) {
  if (!Array.isArray(game.viewers) || !game.viewers.length) {
    return 0;
  }

  let promoted = 0;
  while (getActivePlayers(game).length < MAX_PLAYERS && game.viewers.length) {
    const nextViewer = game.viewers.shift();
    if (!nextViewer) {
      break;
    }

    const viewerSocket = io.sockets.sockets.get(nextViewer.id);
    if (!viewerSocket) {
      continue;
    }

    const label = nextPlayerLabel(game);
    if (!label) {
      break;
    }

    const player = addOrReconnectPlayer(game, { id: nextViewer.id, name: label });
    viewerSocket.data.role = "player";
    viewerSocket.emit("role_update", { role: "player", reason: "slot_opened" });
    appendLog(game, `${player.name} moved from viewer to player.`);
    promoted += 1;
  }

  return promoted;
}

function addViewer(game, viewer) {
  if (!Array.isArray(game.viewers)) {
    game.viewers = [];
  }
  if (game.viewers.some((item) => item.id === viewer.id)) {
    return;
  }
  game.viewers.push({
    id: viewer.id,
    name: sanitizeViewerName(viewer.name),
  });
}

function removeViewer(game, viewerId) {
  if (!Array.isArray(game.viewers) || !game.viewers.length) {
    return false;
  }

  const before = game.viewers.length;
  game.viewers = game.viewers.filter((viewer) => viewer.id !== viewerId);
  return game.viewers.length < before;
}

function nextPlayerLabel(game) {
  const used = new Set(
    game.players
      .map((player) => {
        const match = /^Player\s+(\d+)$/i.exec(String(player.name || ""));
        return match ? Number(match[1]) : null;
      })
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= MAX_PLAYERS)
  );

  for (let i = 1; i <= MAX_PLAYERS; i += 1) {
    if (!used.has(i)) {
      return `Player ${i}`;
    }
  }

  return null;
}

function sanitizeViewerName(name) {
  const safe = String(name || "Viewer").trim();
  return safe.length ? safe.slice(0, 24) : "Viewer";
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
