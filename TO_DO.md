11. LAN Play/Website
- How do we want to play this across devices
- Perhaps convert it to C/C++
- https://render.com/docs/web-services

Other Notes:
- Apparently have a functionality for multiple games to be played (create_game, game_created at socketServer:47)

## Bugs:
- Make the borders on victory screen more legible (Both the borders around the player cards and the cards for winning hands)
- If "loser" of liar game gets more than max cards, then they may not be pushed to be a viewer (letting other viewers have their turn)
	Looking at behavior, loser just gets reset to three – not necessarily becoming viewer if someone is in waiting room
	Of course, this only happens if total players <= 8, otherwise, can just have player replay with 3 cards
		Maybe have it as options in game options?
- Combine functions isBidAchievableFromActiveHands and findBidHighlightCards if possible, since they seem to overlap functions
	Maybe. First function can ensure achievability while second just gets the cards. Idk if tiny bit more efficiency is worth not having the functions separate

## Completed:
8. Should have a limit of 8 players
6. Have UI automatically update and blank out hand options that are lesser than the current bid
1. Give player an initial hand of 3 cards from a 52-card deck (The total cards of the player pool should all be contained in one deck)
2. Liar Button should then check the last bid and see if all players' hands can make the bid
3. Assign players scores based on whether they win or lose the liar
4. This score should determine how high a player's hand becomes (With each loss, player's hand is added by 1 card)
5. When a player's hand becomes 6 cards, player is "out" from the game
7. Horrendous UI – Redesign
Bug: If another player joins while game is in session, they need to become a visitor
9. Options:
- Should allow game to edit the limit each player's hands can go to (So 6 is default limit, up until 8)
- Also edit number of players that can play (Also up to 8)
- Time-out (Up till 60s or none)
10. Victory Screen:
- Reveal all hands
- Highlight cards that make up the current bid/if they fail
- Say victor and loser
Bug: Instead of immediately game_updating on connection (socketServer:340), remove and rely on the join_game path as the actual room join happens later at socketServer:55
	Maybe ask what is the use of automatically game_updating upon an immediate connection
Bug: invalid_move is emitted for both validation errors and lock/contention cases (in withGameLock at socketServer:344), but client treates both moves the same. Create a structured error payload for more granular error messages
	Payload: code (example: BUSY, OUT_OF_TURN, BAD_BID, NOT_IN_GAME), message, retriable true/false, Then map UI behavior by code (toast vs inline vs auto-retry hint)
13. Differentiated "Reset Round" from "Reset Game"
  - "Reset Round" button: Keeps all players at their current card counts, clears bid/turn/round state, deals fresh cards
  - "Reset Game" button: In Game Settings tab, with confirmation dialog; resets all players to 3 cards with a fresh game
  - Game settings changes now reset the round (not the full game)
12. Timeout Behavior
- Create many options:
- 1. Auto-fold. So turn is passed to next player. Not particularly worth it.
	Current bug where if players continuously auto-fold, then current bet is attributed to previous player instead of actual player
		Ex. So player 1 starts auto-folding chain, but player 5 plays. Bid is attributed to player 4.
- 2. Have player bet next highest hand or fold if at highest
	Probably best
- 3. Kick player out and "Reset round"
	Not reset the game itself, but reset the round with player kicked out
- Don't need to reset round upon changing, as this only applies upon timeout
Bug: "Folding" – If a player auto-folds to another player, that player is now treated as owner as current bid
	Basically, if we auto-fold for a long time, then current bid is just attributed to previous player regardless of if they actually made that bid
Bug: If we have more cards than 6, then when current player's turn, shrinked view of board will not display the many face-down cards of other players properly
14. Need to have error codes appear in the same text box as the victory text box
Bug: Game requires only 3-card straights instead of 5 (gameLogic:538)
Bug: Check Flush logic
	Ex. Something like a "2-high" flush is not possible, as there have to be four other cards of the same suit that are lower than 2 to work
	Flush must work by seeing if the high cards are present within the set, then checking if there are other (lower) cards within the set that can be made with the flush
Bug: Do suit comparisons ever matter here?
	We do this at gamelogic:316 for some reason. Need to understand what the suit comparison is for, as there is never a situation where suits have to be compared.