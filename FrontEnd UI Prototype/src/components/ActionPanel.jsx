import React, { useEffect, useMemo, useState } from "react";
import {
  HAND_TYPES,
  HAND_STRENGTH,
  SUITS,
  compareHandsSimple,
  handTypeLabel,
  rankLabel,
  requiredRankMode,
  handNeedsSuit,
  normalizeHandStructure,
  validateHandStructure,
} from "../handUtils";

const RANK_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 2);

function ensureUniqueRanks(ranks) {
  const used = new Set();
  return ranks.map((rank) => {
    if (!used.has(rank)) {
      used.add(rank);
      return rank;
    }

    const replacement = RANK_OPTIONS.find((option) => !used.has(option));
    if (replacement === undefined) {
      return rank;
    }
    used.add(replacement);
    return replacement;
  });
}

function ActionPanel({ onSubmitBid, onCallLiar, currentBid }) {
  const [type, setType] = useState("PAIR");
  const [primaryRanks, setPrimaryRanks] = useState([2]);
  const [suit, setSuit] = useState("");

  const mode = useMemo(() => requiredRankMode(type), [type]);

  useEffect(() => {
    if (mode.mode === "fixed") {
      setPrimaryRanks((previous) => {
        const next = [...previous];
        while (next.length < mode.count) {
          next.push(2);
        }
        return ensureUniqueRanks(next.slice(0, mode.count));
      });
      return;
    }

    setPrimaryRanks((previous) => {
      if (!previous.length) {
        return [2];
      }
      return ensureUniqueRanks(previous.slice(0, mode.max));
    });
  }, [mode]);

  useEffect(() => {
    if (primaryRanks.length <= 1) {
      return;
    }

    const unique = ensureUniqueRanks(primaryRanks);
    const changed = unique.some((value, index) => value !== primaryRanks[index]);
    if (changed) {
      setPrimaryRanks(unique);
    }
  }, [primaryRanks]);

  useEffect(() => {
    if (!handNeedsSuit(type)) {
      setSuit("");
    }
  }, [type]);

  const draftHand = useMemo(
    () =>
      normalizeHandStructure({
        type,
        primaryRanks,
        suit: handNeedsSuit(type) ? suit : null,
      }),
    [type, primaryRanks, suit]
  );

  const validation = useMemo(() => validateHandStructure(draftHand), [draftHand]);
  const bidStrengthMessage = useMemo(() => {
    if (!currentBid) {
      return null;
    }
    if (compareHandsSimple(draftHand, currentBid) <= 0) {
      return "Bid must be strictly higher than the current bid.";
    }
    return null;
  }, [currentBid, draftHand]);

  const canSubmit = validation.valid && !bidStrengthMessage;

  useEffect(() => {
    if (!currentBid) {
      return;
    }

    const currentStrength = HAND_STRENGTH[currentBid.type] || 1;
    const selectedStrength = HAND_STRENGTH[type] || 1;
    if (selectedStrength < currentStrength) {
      setType(currentBid.type);
    }
  }, [currentBid, type]);

  function updateRank(index, value) {
    const rank = Number(value);
    setPrimaryRanks((previous) => {
      const next = [...previous];
      next[index] = rank;
      return ensureUniqueRanks(next);
    });
  }

  function addRank() {
    if (mode.mode !== "variable") {
      return;
    }
    setPrimaryRanks((previous) => {
      if (previous.length >= mode.max) {
        return previous;
      }
      return [...previous, 2];
    });
  }

  function removeRank(index) {
    if (mode.mode !== "variable") {
      return;
    }
    setPrimaryRanks((previous) => {
      if (previous.length <= mode.min) {
        return previous;
      }
      return previous.filter((_, i) => i !== index);
    });
  }

  function submit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmitBid(draftHand);
  }

  return (
    <section className="card">
      <h2>Action Panel</h2>
      <form onSubmit={submit} className="action-form">
        <label>
          Hand type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {HAND_TYPES.map((handType) => (
              <option
                key={handType}
                value={handType}
                disabled={
                  Boolean(currentBid) &&
                  (HAND_STRENGTH[handType] || 1) < (HAND_STRENGTH[currentBid.type] || 1)
                }
              >
                {handTypeLabel(handType)}
              </option>
            ))}
          </select>
        </label>

        <div className="ranks-block">
          <p>Ranks</p>
          {primaryRanks.map((rank, index) => (
            <div className="rank-row" key={`rank-${index}`}>
              <select value={rank} onChange={(event) => updateRank(index, event.target.value)}>
                {RANK_OPTIONS.filter(
                  (option) => option === rank || !primaryRanks.some((selected, i) => i !== index && selected === option)
                ).map((option) => (
                  <option key={option} value={option}>
                    {option >= 11 ? rankLabel(option) : option}
                  </option>
                ))}
              </select>
              {mode.mode === "variable" && primaryRanks.length > mode.min ? (
                <button type="button" onClick={() => removeRank(index)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}

          {mode.mode === "variable" ? (
            <button type="button" onClick={addRank} disabled={primaryRanks.length >= mode.max}>
              Add rank
            </button>
          ) : null}
        </div>

        {handNeedsSuit(type) ? (
          <label>
            Suit
            <select value={suit} onChange={(event) => setSuit(event.target.value)}>
              <option value="">Select suit</option>
              {SUITS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={canSubmit ? "status ok" : "status err"}>
          {validation.valid ? bidStrengthMessage || validation.message : validation.message}
        </div>

        <div className="action-buttons">
          <button type="submit" disabled={!canSubmit}>
            Submit Bid
          </button>
          <button type="button" className="secondary" onClick={onCallLiar}>
            Call Liar
          </button>
        </div>
      </form>
    </section>
  );
}

export default ActionPanel;
