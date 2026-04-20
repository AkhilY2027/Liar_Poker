import React, { useMemo } from "react";
import { cardImageName, cardLabel } from "../handUtils";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

function MyHand({ role, cards }) {
  const title = "Your Hand";

  const handCards = useMemo(() => cards || [], [cards]);

  return (
    <section className="card handCardPanel">
      <h2>{title}</h2>
      {role !== "player" ? (
        <p className="muted">You are currently a viewer. You will receive cards when promoted to player.</p>
      ) : null}

      {role === "player" && handCards.length ? (
        <div className="handGrid">
          {handCards.map((card, index) => {
            const file = cardImageName(card);
            return (
              <div className="playingCard" key={`${card.rank}-${card.suit}-${index}`}>
                <img src={`${SERVER_URL}/card_deck_images/${file}`} alt={cardLabel(card)} />
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default MyHand;
