import React, { useMemo } from "react";
import { cardImageName, cardLabel } from "../handUtils";
import { resolveAssetBasePath } from "../network/backendUrl";

const ASSET_BASE = resolveAssetBasePath();

function MyHand({ role, cards }) {
  const title = "Your Hand";

  const handCards = useMemo(() => cards || [], [cards]);
  const handRows = useMemo(() => {
    const count = handCards.length;
    if (!count) {
      return [];
    }

    if (count <= 4) {
      return [handCards];
    }

    if (count <= 6) {
      return [handCards.slice(0, 3), handCards.slice(3)];
    }

    const topRowCount = Math.ceil(count / 2);
    return [handCards.slice(0, topRowCount), handCards.slice(topRowCount)];
  }, [handCards]);

  return (
    <section className="card handCardPanel">
      <h2>{title}</h2>
      {role !== "player" ? (
        <p className="muted">You are currently a viewer. You will receive cards when promoted to player.</p>
      ) : null}

      {role === "player" && handRows.length ? (
        <div className="handRows">
          {handRows.map((row, rowIndex) => (
            <div className="handRow" key={`hand-row-${rowIndex}`}>
              {row.map((card, index) => {
                const file = cardImageName(card);
                return (
                  <div className="playingCard" key={`${rowIndex}-${card.rank}-${card.suit}-${index}`}>
                    <img src={`${ASSET_BASE}/card_deck_images/${file}`} alt={cardLabel(card)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default MyHand;
