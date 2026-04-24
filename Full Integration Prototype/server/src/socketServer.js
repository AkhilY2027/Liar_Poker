const {
  DEFAULT_GAME_SETTINGS,
  createGame,
  addOrReconnectPlayer,
  updatePlayerDisplayName,
  normalizeGameSettings,
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
  compareHands,
  isValidBid,
  isBidAchievableFromActiveHands,
  findBidHighlightCards,
} = require("./gameLogic");
const { events: EVENT, errorCodes: ERROR_CODE } = require("../../shared/socketProtocol.json");

const DEFAULT_ROOM_ID = "main-room";
const DISCONNECT_MODE = String(process.env.DISCONNECT_MODE || "autofold").toLowerCase();
const MAX_PLAYERS = 8;
const REVEAL_DURATION_MS = 5000;

const TIMEOUT_BEHAVIOR = Object.freeze({
  NEXT_HIGHEST: "next_highest",
  KICK_AND_RESET_ROUND: "kick_and_reset_round",
  AUTO_FOLD: "auto_fold",
});

const DEFAULT_TURN_TIMEOUT_SECONDS = clampInt(
  Math.round(Number(process.env.TURN_TIMEOUT_MS || 60000) / 1000),
  20,
  120,
  60,
  5
);
const DEFAULT_MAX_CARDS_TO_LOSE = clampInt(Number(process.env.MAX_CARDS_TO_LOSE || 6), 6, 8, 6);
const DEFAULT_AUTO_FOLD_BEHAVIOR = normalizeTimeoutBehavior(
  process.env.AUTO_FOLD_BEHAVIOR || process.env.TIMEOUT_ACTION || DEFAULT_GAME_SETTINGS.autoFoldBehavior
);

const games = new Map();
const timers = new Map();
const revealTimers = new Map();
const BID_LADDER = buildBidLadder();

games.set(DEFAULT_ROOM_ID, createGame(DEFAULT_ROOM_ID, defaultGameSettings()));

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.emit(EVENT.connectionReady, { connected: true });

    socket.on(EVENT.createGame, ({ gameId } = {}) => {
      const roomId = sanitizeGameId(gameId) || `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      if (!games.has(roomId)) {
        games.set(roomId, createGame(roomId, defaultGameSettings()));
      }
      socket.emit(EVENT.gameCreated, { gameId: roomId });
    });

    socket.on(EVENT.joinGame, ({ name, gameId } = {}) => {
      const roomId = sanitizeGameId(gameId) || DEFAULT_ROOM_ID;
      const game = getOrCreateGame(roomId);
      socket.join(roomId);
      socket.data.gameId = roomId;

      removeViewer(game, socket.id);

      const label = nextPlayerLabel(game);
      const gameUnderway = game.gameState === "in_progress" || game.gameState === "reveal";
      const atCapacity = getActivePlayers(game).length >= MAX_PLAYERS || !label || gameUnderway;

      if (atCapacity) {
        addViewer(game, { id: socket.id, name });
        socket.data.role = "viewer";

        appendLog(
          game,
          `${sanitizeViewerName(name)} joined ${roomId} as viewer (${gameUnderway ? "game in progress" : "table full"}).`
        );
        logInfo("join_game_viewer", { roomId, viewerId: socket.id });
        socket.emit(EVENT.roleUpdate, { role: "viewer", reason: gameUnderway ? "game_in_progress" : "table_full" });
        broadcastGame(io, roomId);
        return;
      }

      const player = addOrReconnectPlayer(game, { id: socket.id, name: label, cardTarget: 3 });
      socket.data.role = "player";

      appendLog(game, `${playerDisplayName(player)} joined ${roomId}.`);
      logInfo("join_game", { roomId, playerId: socket.id, playerName: player.name, displayName: player.displayName });
      startGameIfReady(game);
      scheduleTurnTimer(io, game);
      broadcastGame(io, roomId);
    });

    socket.on(EVENT.setDisplayName, ({ displayName } = {}) => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before changing display name.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "set_display_name", () => {
        if (socket.data.role === "viewer") {
          const viewer = game.viewers?.find((item) => item.id === socket.id);
          if (!viewer) {
            emitInvalid(socket, "Join a game before changing display name.", ERROR_CODE.notInGame);
            return;
          }

          const previousName = viewer.name;
          viewer.name = sanitizeViewerName(displayName || "Viewer");
          appendLog(game, `${previousName} changed display name to ${viewer.name}.`);
          return;
        }

        const previous = game.players.find((item) => item.id === socket.id);
        const updated = updatePlayerDisplayName(game, socket.id, displayName);
        if (!updated || !previous) {
          emitInvalid(socket, "Join the game before changing display name.", ERROR_CODE.notPlayer);
          return;
        }

        appendLog(game, `${previous.name} is now ${updated.displayName}.`);
        logInfo("set_display_name", {
          roomId: game.id,
          playerId: socket.id,
          internalName: updated.name,
          displayName: updated.displayName,
        });
      });
    });

    socket.on(EVENT.updateGameSettings, ({ settings } = {}) => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before changing game settings.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "update_game_settings", () => {
        const nextSettings = normalizeGameSettings(settings, game.settings || defaultGameSettings());
        const currentSettings = game.settings || defaultGameSettings();

        const didChange =
          currentSettings.turnTimeoutSeconds !== nextSettings.turnTimeoutSeconds ||
          currentSettings.maxCardsToLose !== nextSettings.maxCardsToLose ||
          currentSettings.autoFoldBehavior !== nextSettings.autoFoldBehavior;

        if (!didChange) {
          return;
        }

        game.settings = nextSettings;
        clearRevealTimer(game.id);
        resetRoundAndRefill(io, game);
        clearGameTimer(game.id);
        scheduleTurnTimer(io, game);

        appendLog(
          game,
          `Game settings updated: timeout ${nextSettings.turnTimeoutSeconds}s, max cards ${nextSettings.maxCardsToLose}. Round reset.`
        );
        logInfo("update_game_settings", {
          roomId: game.id,
          playerId: socket.id,
          settings: nextSettings,
        });
      });
    });

    socket.on(EVENT.placeBid, ({ hand } = {}) => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before placing bids.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "place_bid", () => {
        if (socket.data.role === "viewer") {
          emitInvalid(socket, "Viewers cannot place bids.", ERROR_CODE.viewerForbidden);
          return;
        }

        const player = game.players.find((item) => item.id === socket.id);
        if (!player || !player.active) {
          emitInvalid(socket, "Join the game before placing bids.", ERROR_CODE.notPlayer);
          return;
        }

        if (game.gameState !== "in_progress") {
          emitInvalid(socket, "Game is not in progress yet.", ERROR_CODE.notInProgress);
          return;
        }

        if (!isPlayersTurn(game, socket.id)) {
          emitInvalid(socket, "It is not your turn.", ERROR_CODE.outOfTurn);
          return;
        }

        try {
          const normalized = normalizeHand(hand);
          if (!isValidBid(game.currentBid, normalized)) {
            emitInvalid(socket, "Bid must be strictly higher than current bid.", ERROR_CODE.badBid);
            return;
          }

          game.currentBid = normalized;
          game.currentBidBy = socket.id;
          appendLog(game, `${playerDisplayName(player)} bid ${formatForLog(normalized)}.`);
          logInfo("place_bid", { roomId: game.id, playerId: socket.id, bid: normalized });

          advanceTurn(game);
          scheduleTurnTimer(io, game);
        } catch (error) {
          emitInvalid(socket, error.message, ERROR_CODE.badBidPayload);
        }
      });
    });

    socket.on(EVENT.callLiar, () => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before calling liar.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "call_liar", () => {
        if (socket.data.role === "viewer") {
          emitInvalid(socket, "Viewers cannot call liar.", ERROR_CODE.viewerForbidden);
          return;
        }

        const player = game.players.find((item) => item.id === socket.id);
        if (!player || !player.active) {
          emitInvalid(socket, "Join the game before calling liar.", ERROR_CODE.notPlayer);
          return;
        }

        if (game.gameState !== "in_progress") {
          emitInvalid(socket, "Game is not in progress.", ERROR_CODE.notInProgress);
          return;
        }

        if (!isPlayersTurn(game, socket.id)) {
          emitInvalid(socket, "It is not your turn.", ERROR_CODE.outOfTurn);
          return;
        }

        const challenged = game.players.find((item) => item.id === game.currentBidBy) || getPreviousPlayer(game);
        if (!challenged || !game.currentBid) {
          emitInvalid(socket, "No bid is available to challenge.", ERROR_CODE.noBidToChallenge);
          return;
        }

        resolveLiarCall(io, game, player, challenged);
        scheduleTurnTimer(io, game);
      });
    });

    socket.on(EVENT.resetGame, () => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before resetting the round.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "reset_game", () => {
        clearRevealTimer(game.id);
        resetRoundAndRefill(io, game);
        clearGameTimer(game.id);
        scheduleTurnTimer(io, game);
        appendLog(game, "Round reset.");
        logInfo("reset_game", { roomId: game.id, playerId: socket.id });
      });
    });

    socket.on(EVENT.resetAllCards, () => {
      const game = getSocketGame(socket);
      if (!game) {
        emitInvalid(socket, "Join a game before resetting all cards.", ERROR_CODE.notInGame);
        return;
      }

      withGameLock(io, game, socket, "reset_all_cards", () => {
        clearRevealTimer(game.id);
        resetGameState(io, game);
        clearGameTimer(game.id);
        scheduleTurnTimer(io, game);
        appendLog(game, "Game reset. All players reset to 3 cards.");
        logInfo("reset_all_cards", { roomId: game.id, playerId: socket.id });
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
          appendLog(game, `${playerDisplayName(player)} disconnected and was removed.`);
        } else if (DISCONNECT_MODE === "pause") {
          markPlayerInactive(game, socket.id);
          pauseGame(game, `${playerDisplayName(player)} disconnected. Game paused.`);
          appendLog(game, `${playerDisplayName(player)} disconnected. Game paused.`);
        } else {
          markPlayerInactive(game, socket.id);
          appendLog(game, `${playerDisplayName(player)} disconnected and auto-folded.`);
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
            clearRevealTimer(game.id);
            if (!game.viewers.length) {
              games.delete(game.id);
            } else {
              game.gameState = "waiting";
              game.currentTurn = null;
              game.currentBid = null;
              game.currentBidBy = null;
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

  });
}

function withGameLock(io, game, socket, eventName, fn) {
  if (game.processingAction) {
    emitInvalid(socket, "Game is processing another action. Try again.", ERROR_CODE.busy, true);
    return;
  }

  game.processingAction = true;
  try {
    fn();
  } catch (error) {
    emitInvalid(socket, "Unexpected server error.", ERROR_CODE.serverError);
    logError("withGameLock", {
      roomId: game.id,
      eventName,
      playerId: socket.id,
      error: error.message,
    });
  } finally {
    game.processingAction = false;
    broadcastGame(io, game.id);
  }
}

function emitInvalid(socket, message, code = ERROR_CODE.badBid, retriable = false) {
  const game = getSocketGame(socket);
  if (game) {
    const player = game.players.find((item) => item.id === socket.id);
    appendLog(game, `Invalid action by ${player ? playerDisplayName(player) : socket.id}: [${code}] ${message}`);
    logWarn("invalid_move", {
      roomId: game.id,
      playerId: socket.id,
      code,
      retriable,
      reason: message,
    });
  }
  socket.emit(EVENT.invalidMove, { code, message, retriable });
}

function broadcastGame(io, gameId) {
  const game = games.get(gameId);
  if (!game) {
    return;
  }

  const room = io.sockets.adapter.rooms.get(gameId);
  if (!room) {
    return;
  }

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      continue;
    }
    socket.emit(EVENT.gameUpdate, serializeGame(game, socketId, socket.data.role || "viewer"));
  }
}

function scheduleTurnTimer(io, game) {
  clearGameTimer(game.id);
  if (game.gameState !== "in_progress" || !game.currentTurn) {
    game.turnDeadlineMs = null;
    return;
  }

  const timeoutMs = Number(game.settings?.turnTimeoutSeconds || DEFAULT_TURN_TIMEOUT_SECONDS) * 1000;

  game.turnDeadlineMs = Date.now() + timeoutMs;
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

      const timeoutBehavior = resolveTimeoutBehavior(sameGame);
      applyTimeoutBehavior(io, sameGame, timedOutPlayer, timeoutBehavior);

      logInfo("turn_timeout", {
        roomId: sameGame.id,
        playerId: timedOutPlayer.id,
        timeoutBehavior,
      });

      scheduleTurnTimer(io, sameGame);
    } finally {
      sameGame.processingAction = false;
      broadcastGame(io, sameGame.id);
    }
  }, timeoutMs);

  timers.set(game.id, timerId);
}

function clearGameTimer(gameId) {
  const timer = timers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(gameId);
  }
}

function clearRevealTimer(gameId) {
  const timer = revealTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    revealTimers.delete(gameId);
  }
}

function getOrCreateGame(gameId) {
  if (!games.has(gameId)) {
    games.set(gameId, createGame(gameId, defaultGameSettings()));
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

function serializeGame(state, socketId, role = "viewer") {
  const myPlayer = state.players.find((player) => player.id === socketId) || null;
  return {
    id: state.id,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      displayName: player.displayName || player.name,
      active: player.active,
      cardCount: Array.isArray(player.cards) ? player.cards.length : Number(player.cardTarget || 0),
      revealedCards: state.gameState === "reveal" ? (player.cards || []) : [],
    })),
    currentTurn: state.currentTurn,
    currentBid: state.currentBid,
    gameState: state.gameState,
    role,
    myHand: myPlayer ? myPlayer.cards || [] : [],
    myCardTarget: myPlayer ? Number(myPlayer.cardTarget || 0) : 0,
    roundResult: state.roundResult || null,
    log: state.log,
    viewerCount: state.viewers?.length || 0,
    maxPlayers: MAX_PLAYERS,
    roundNumber: Number(state.roundNumber || 0),
    pausedReason: state.pausedReason,
    turnDeadlineMs: state.turnDeadlineMs,
    settings: normalizeGameSettings(state.settings, defaultGameSettings()),
  };
}

function resetRoundAndRefill(io, game, options = {}) {
  let promoted = 0;
  removeInactivePlayers(game);

  if (options.promoteViewers !== false) {
    promoted = promoteViewers(io, game);
  }

  resetRound(game);

  if (promoted > 0) {
    appendLog(game, `${promoted} viewer${promoted === 1 ? " was" : "s were"} added as new player${
      promoted === 1 ? "" : "s"
    }.`);
  }
}

function applyTimeoutBehavior(io, game, timedOutPlayer, timeoutBehavior) {
  if (timeoutBehavior === TIMEOUT_BEHAVIOR.KICK_AND_RESET_ROUND) {
    markPlayerInactive(game, timedOutPlayer.id);
    addViewer(game, { id: timedOutPlayer.id, name: playerDisplayName(timedOutPlayer) });

    const playerSocket = io.sockets.sockets.get(timedOutPlayer.id);
    if (playerSocket) {
      playerSocket.data.role = "viewer";
      playerSocket.emit(EVENT.roleUpdate, { role: "viewer", reason: "timeout_kick" });
    }

    appendLog(game, `${playerDisplayName(timedOutPlayer)} timed out and was moved to viewer. Round reset.`);
    resetRoundAndRefill(io, game, { promoteViewers: false });
    return;
  }

  if (timeoutBehavior === TIMEOUT_BEHAVIOR.NEXT_HIGHEST) {
    const nextBid = getNextHigherBid(game.currentBid);
    if (nextBid) {
      game.currentBid = nextBid;
      game.currentBidBy = timedOutPlayer.id;
      appendLog(game, `${playerDisplayName(timedOutPlayer)} timed out. Auto-bid applied: ${formatForLog(nextBid)}.`);
      advanceTurn(game);
      return;
    }

    const challenged = game.players.find((player) => player.id === game.currentBidBy) || getPreviousPlayer(game);
    if (game.currentBid && challenged) {
      appendLog(game, `${playerDisplayName(timedOutPlayer)} timed out at the highest bid. Auto-called LIAR.`);
      resolveLiarCall(io, game, timedOutPlayer, challenged, true);
      return;
    }

    appendLog(game, `${playerDisplayName(timedOutPlayer)} timed out with no active bid. Auto-fold applied.`);
    advanceTurn(game);
    return;
  }

  appendLog(game, `${playerDisplayName(timedOutPlayer)} timed out. Auto-fold applied.`);
  advanceTurn(game);
}

function resolveTimeoutBehavior(game) {
  return normalizeTimeoutBehavior(game.settings?.autoFoldBehavior || DEFAULT_AUTO_FOLD_BEHAVIOR);
}

function normalizeTimeoutBehavior(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === TIMEOUT_BEHAVIOR.NEXT_HIGHEST) {
    return TIMEOUT_BEHAVIOR.NEXT_HIGHEST;
  }
  if (normalized === TIMEOUT_BEHAVIOR.KICK_AND_RESET_ROUND) {
    return TIMEOUT_BEHAVIOR.KICK_AND_RESET_ROUND;
  }
  if (normalized === TIMEOUT_BEHAVIOR.AUTO_FOLD || normalized === "pass") {
    return TIMEOUT_BEHAVIOR.AUTO_FOLD;
  }

  if (normalized === "none") {
    return TIMEOUT_BEHAVIOR.NEXT_HIGHEST;
  }

  return TIMEOUT_BEHAVIOR.NEXT_HIGHEST;
}

function getNextHigherBid(currentBid) {
  if (!currentBid) {
    return BID_LADDER[0] || null;
  }

  for (const candidate of BID_LADDER) {
    if (compareHands(candidate, currentBid) > 0) {
      return candidate;
    }
  }

  return null;
}

function buildBidLadder() {
  const candidates = [];

  for (let rank = 2; rank <= 14; rank += 1) {
    candidates.push(normalizeHand({ type: "HIGH_CARD", primaryRanks: [rank] }));
    candidates.push(normalizeHand({ type: "PAIR", primaryRanks: [rank] }));
    candidates.push(normalizeHand({ type: "THREE_OF_A_KIND", primaryRanks: [rank] }));
    if (rank >= 6) {
      candidates.push(normalizeHand({ type: "FLUSH", primaryRanks: [rank], suit: "CLUBS" }));
    }
  }

  for (let rank = 5; rank <= 14; rank += 1) {
    candidates.push(normalizeHand({ type: "STRAIGHT", primaryRanks: [rank] }));
    candidates.push(normalizeHand({ type: "STRAIGHT_FLUSH", primaryRanks: [rank], suit: "CLUBS" }));
  }

  for (let high = 3; high <= 14; high += 1) {
    for (let low = 2; low < high; low += 1) {
      candidates.push(normalizeHand({ type: "TWO_PAIR", primaryRanks: [high, low] }));
      candidates.push(normalizeHand({ type: "FULL_HOUSE", primaryRanks: [high, low] }));
    }
  }

  candidates.sort((left, right) => compareHands(left, right));
  return candidates;
}

function resetGameState(io, game) {
  removeInactivePlayers(game);
  promoteViewers(io, game);

  game.players.forEach((player) => {
    if (player.active) {
      player.cardTarget = 3;
    }
  });

  game.currentBid = null;
  game.currentBidBy = null;
  game.currentTurn = null;
  game.reveal = null;
  game.roundResult = null;
  game.pausedReason = null;

  resetRound(game);
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

    const player = addOrReconnectPlayer(game, {
      id: nextViewer.id,
      name: label,
      displayName: nextViewer.name || label,
      cardTarget: 3,
    });
    player.cardTarget = 3;
    viewerSocket.data.role = "player";
    viewerSocket.emit(EVENT.roleUpdate, { role: "player", reason: "slot_opened" });
    appendLog(game, `${playerDisplayName(player)} moved from viewer to player.`);
    promoted += 1;
  }

  return promoted;
}

function resolveLiarCall(io, game, caller, previous, isAuto = false) {
  game.gameState = "reveal";
  game.currentTurn = null;
  game.turnDeadlineMs = null;
  clearGameTimer(game.id);
  clearRevealTimer(game.id);

  const bidWasAchievable = isBidAchievableFromActiveHands(game, game.currentBid);
  const loser = bidWasAchievable ? caller : previous;
  const winner = bidWasAchievable ? previous : caller;
  if (!loser) {
    appendLog(game, "Liar call could not be resolved. Round reset.");
    resetRoundAndRefill(io, game);
    return;
  }

  const prefix = isAuto ? "Auto-called LIAR" : "called LIAR";
  const resolutionText = bidWasAchievable ? "Bid was possible" : "Bid was not possible";
  const roundResultMessage = `${playerDisplayName(caller)} ${prefix} on ${playerDisplayName(previous)}. ${resolutionText}. ${playerDisplayName(loser)} loses the round.`;
  const winningCardKeys = bidWasAchievable ? findBidHighlightCards(game, game.currentBid) : [];

  game.roundResult = {
    id: `${Date.now()}-${Math.random()}`,
    message: roundResultMessage,
    winnerId: winner?.id || null,
    winnerName: winner ? playerDisplayName(winner) : null,
    loserId: loser.id,
    loserName: playerDisplayName(loser),
    bidWasAchievable,
    winningCardKeys,
    showUntilMs: Date.now() + 5000,
  };

  appendLog(
    game,
    roundResultMessage
  );

  logInfo("call_liar", {
    roomId: game.id,
    caller: caller.id,
    challenged: previous.id,
    loser: loser.id,
    bidWasAchievable,
  });

  const revealResultId = game.roundResult.id;
  const revealTimerId = setTimeout(() => {
    const sameGame = games.get(game.id);
    if (!sameGame || !sameGame.roundResult) {
      return;
    }

    if (sameGame.roundResult.id !== revealResultId) {
      return;
    }

    finalizeRevealPhase(io, sameGame, loser.id);
  }, REVEAL_DURATION_MS);

  revealTimers.set(game.id, revealTimerId);
}

function finalizeRevealPhase(io, game, loserId) {
  clearRevealTimer(game.id);

  const loser = game.players.find((player) => player.id === loserId);
  if (loser) {
    loser.cardTarget = Number(loser.cardTarget || 3) + 1;
    const maxCardsToLose = Number(game.settings?.maxCardsToLose || DEFAULT_MAX_CARDS_TO_LOSE);
    if (loser.cardTarget >= maxCardsToLose) {
      loser.cardTarget = 3;
      appendLog(game, `${playerDisplayName(loser)} reached the ${maxCardsToLose}th card and resets to 3 cards.`);
    } else {
      appendLog(game, `${playerDisplayName(loser)} now has ${loser.cardTarget} cards for the next round.`);
    }
  }

  game.roundResult = null;
  resetRoundAndRefill(io, game);
  scheduleTurnTimer(io, game);
  broadcastGame(io, game.id);
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

function playerDisplayName(player) {
  return player?.displayName || player?.name || "Player";
}

function defaultGameSettings() {
  return normalizeGameSettings(
    {
      turnTimeoutSeconds: DEFAULT_TURN_TIMEOUT_SECONDS,
      maxCardsToLose: DEFAULT_MAX_CARDS_TO_LOSE,
      autoFoldBehavior: DEFAULT_AUTO_FOLD_BEHAVIOR,
    },
    DEFAULT_GAME_SETTINGS
  );
}

function clampInt(value, min, max, fallback, step = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  let next = Math.round(numeric);
  next = Math.max(min, Math.min(max, next));

  if (step > 1) {
    const offset = next - min;
    next = min + Math.round(offset / step) * step;
    next = Math.max(min, Math.min(max, next));
  }

  return next;
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
