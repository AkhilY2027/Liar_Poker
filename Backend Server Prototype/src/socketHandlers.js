const {
  createGame,
  addPlayer,
  setPlayerInactive,
  getActivePlayers,
  startGame,
  advanceTurn,
  getPreviousActivePlayerId,
  normalizeHand,
  isValidBid,
  isPlayersTurn,
} = require("./gameLogic");

const games = new Map();

function registerGameSocketHandlers(io) {
  io.on("connection", (socket) => {
    log("player connected", { socketId: socket.id });

    socket.on("create_game", ({ name } = {}) => {
      try {
        const game = createGame(name, socket.id);
        games.set(game.id, game);
        socket.join(game.id);

        log("game created", { gameId: game.id, ownerId: socket.id });
        emitState(io, game.id);
      } catch (error) {
        emitError(socket, error.message);
      }
    });

    socket.on("join_game", ({ gameId, name } = {}) => {
      const game = games.get(gameId);
      if (!game) {
        emitError(socket, "Game not found");
        logInvalid("join_game", socket.id, "Game not found");
        return;
      }

      if (game.gameState !== "waiting") {
        emitError(socket, "Cannot join a game that is already in progress");
        logInvalid("join_game", socket.id, "Game already started", gameId);
        return;
      }

      addPlayer(game, socket.id, name);
      socket.join(gameId);
      log("player joined", { gameId, playerId: socket.id });
      emitState(io, gameId);
    });

    socket.on("start_game", ({ gameId } = {}) => {
      const game = games.get(gameId);
      if (!game) {
        emitError(socket, "Game not found");
        logInvalid("start_game", socket.id, "Game not found", gameId);
        return;
      }

      if (socket.id !== game.ownerId) {
        emitError(socket, "Only the game owner can start the game");
        logInvalid("start_game", socket.id, "Only owner can start", gameId);
        return;
      }

      try {
        startGame(game);
        log("game started", { gameId, currentTurn: game.currentTurn });
        emitState(io, gameId);
      } catch (error) {
        emitError(socket, error.message);
        logInvalid("start_game", socket.id, error.message, gameId);
      }
    });

    socket.on("place_bid", ({ gameId, hand } = {}) => {
      const game = games.get(gameId);
      if (!game) {
        emitError(socket, "Game not found");
        logInvalid("place_bid", socket.id, "Game not found", gameId);
        return;
      }

      if (game.gameState !== "in_progress") {
        emitError(socket, "Bids are only allowed while game is in progress");
        logInvalid("place_bid", socket.id, "Game is not in progress", gameId);
        return;
      }

      if (!isPlayersTurn(game, socket.id)) {
        emitError(socket, "It is not your turn");
        logInvalid("place_bid", socket.id, "Out-of-turn action", gameId);
        return;
      }

      try {
        const normalizedBid = normalizeHand(hand);
        if (!isValidBid(game.currentBid, normalizedBid)) {
          emitError(socket, "Invalid bid: bid must be strictly higher than current bid");
          logInvalid("place_bid", socket.id, "Bid is not higher than current", gameId);
          return;
        }

        game.currentBid = normalizedBid;
        const nextTurn = advanceTurn(game);
        log("bid accepted", {
          gameId,
          playerId: socket.id,
          bid: normalizedBid,
          nextTurn,
        });

        emitState(io, gameId);
      } catch (error) {
        emitError(socket, `Invalid hand: ${error.message}`);
        logInvalid("place_bid", socket.id, error.message, gameId);
      }
    });

    socket.on("call_liar", ({ gameId } = {}) => {
      const game = games.get(gameId);
      if (!game) {
        emitError(socket, "Game not found");
        logInvalid("call_liar", socket.id, "Game not found", gameId);
        return;
      }

      if (game.gameState !== "in_progress") {
        emitError(socket, "call_liar is only available while game is in progress");
        logInvalid("call_liar", socket.id, "Game is not in progress", gameId);
        return;
      }

      if (!isPlayersTurn(game, socket.id)) {
        emitError(socket, "It is not your turn");
        logInvalid("call_liar", socket.id, "Out-of-turn action", gameId);
        return;
      }

      if (!game.currentBid) {
        emitError(socket, "No bid to challenge");
        logInvalid("call_liar", socket.id, "No current bid", gameId);
        return;
      }

      const challengedPlayerId = getPreviousActivePlayerId(game);
      game.gameState = "reveal";
      game.reveal = {
        callerId: socket.id,
        challengedPlayerId,
        challengedBid: game.currentBid,
        timestamp: new Date().toISOString(),
      };

      log("liar called", {
        gameId,
        callerId: socket.id,
        challengedPlayerId,
        challengedBid: game.currentBid,
      });

      emitState(io, gameId);
    });

    socket.on("disconnect", () => {
      for (const [gameId, game] of games.entries()) {
        const disconnectedPlayer = setPlayerInactive(game, socket.id);
        if (!disconnectedPlayer) {
          continue;
        }

        log("player disconnected", { gameId, playerId: socket.id });

        const activePlayers = getActivePlayers(game);
        if (activePlayers.length === 0) {
          games.delete(gameId);
          log("game removed", { gameId, reason: "no active players" });
          continue;
        }

        if (game.currentTurn === socket.id && game.gameState === "in_progress") {
          const nextTurn = advanceTurn(game);
          log("turn advanced after disconnect", { gameId, nextTurn });
        }

        emitState(io, gameId);
      }
    });
  });
}

function emitState(io, gameId) {
  const game = games.get(gameId);
  if (!game) {
    return;
  }

  io.to(gameId).emit("game_state", serializeGame(game));
}

function emitError(socket, message) {
  socket.emit("action_error", { message });
}

function serializeGame(game) {
  return {
    id: game.id,
    players: game.players.map((player) => ({
      id: player.id,
      name: player.name,
      active: player.active,
    })),
    currentTurn: game.currentTurn,
    currentBid: game.currentBid,
    gameState: game.gameState,
    reveal: game.reveal,
    ownerId: game.ownerId,
  };
}

function log(message, payload) {
  console.info(`[game] ${message}`, payload || {});
}

function logInvalid(event, playerId, reason, gameId) {
  console.warn("[game] invalid action", {
    event,
    gameId: gameId || null,
    playerId,
    reason,
  });
}

module.exports = {
  registerGameSocketHandlers,
  games,
};
