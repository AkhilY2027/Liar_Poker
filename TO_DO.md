11. LAN Play/Website
- How do we want to play this across devices
- Perhaps convert it to C/C++
- https://render.com/docs/web-services

9. Options:
- Should allow game to edit the limit each player's hands can go to (So 6 is default limit, up until 8)
- Also edit number of players that can play (Also up to 8)
- Time-out (Up till 60s or none)

10. Victory Screen:
- Reveal all hands
- Highlight cards that make up the current bid/if they fail
- Say victor and loser

Bugs:
- "Folding" – If a player auto-folds to another player, that player is now treated as owner as current bid
	Basically, if we auto-fold for a long time, then current bid is just attributed to previous player regardless of if they actually made that bid
	Either need to attribute properly or redesign "auto-fold" system
		Potential Solution: Go to next highest hand
		Potential Solution: Go to a "standby" role where they act as a viewer but their hand/cards is in play?



Completed:
8. Should have a limit of 8 players
6. Have UI automatically update and blank out hand options that are lesser than the current bid
1. Give player an initial hand of 3 cards from a 52-card deck (The total cards of the player pool should all be contained in one deck)
2. Liar Button should then check the last bid and see if all players' hands can make the bid
3. Assign players scores based on whether they win or lose the liar
4. This score should determine how high a player's hand becomes (With each loss, player's hand is added by 1 card)
5. When a player's hand becomes 6 cards, player is "out" from the game
7. Horrendous UI – Redesign
Bug: If another player joins while game is in session, they need to become a visitor