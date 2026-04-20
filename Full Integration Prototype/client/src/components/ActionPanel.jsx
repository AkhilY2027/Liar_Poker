import React, { useEffect, useMemo, useState } from "react";
import {
  HAND_STRENGTH,
  HAND_TYPES,
  SUITS,
  compareHandsSimple,
  handTypeLabel,
  needsSuit,
  rankLabel,
  requiredRankSpec,
} from "../handUtils";

const RANKS = Array.from({ length: 13 }, (_, i) => i + 2);

function rankOptionsForType(type) {
  if (type === "STRAIGHT" || type === "STRAIGHT_FLUSH") {
    return RANKS.filter((rank) => rank >= 4);
  }
  return RANKS;
}

function ActionPanel({
  onPlaceBid,
  onCallLiar,
  currentBid,
  isMyTurn,
  submitLabel = "Place Bid",
  showCallButton = true,
}) {
  const [type, setType] = useState("");
  const [primaryRanks, setPrimaryRanks] = useState([2]);
  const [suit, setSuit] = useState("");

  const spec = useMemo(() => (type ? requiredRankSpec(type) : null), [type]);

  useEffect(() => {
    if (!spec) {
      return;
    }
    if (spec.mode === "fixed") {
      setPrimaryRanks((prev) => {
        const next = [...prev];
        while (next.length < spec.count) {
          next.push(2);
        }
        return next.slice(0, spec.count);
      });
      return;
    }

    setPrimaryRanks((prev) => {
      if (!prev.length) {
        return [2];
      }
      return prev.slice(0, spec.max);
    });
  }, [spec]);

  useEffect(() => {
    if (!type || !needsSuit(type)) {
      setSuit("");
    }
  }, [type]);

  useEffect(() => {
    if (type !== "STRAIGHT" && type !== "STRAIGHT_FLUSH") {
      return;
    }

    setPrimaryRanks((prev) => {
      if (!prev.length || prev[0] >= 4) {
        return prev;
      }
      const next = [...prev];
      next[0] = 4;
      return next;
    });
  }, [type]);

  useEffect(() => {
    if (isMyTurn) {
      return;
    }
    setType("");
    setPrimaryRanks([2]);
    setSuit("");
  }, [isMyTurn]);

  useEffect(() => {
    if (!type || !currentBid) {
      return;
    }

    const selectedStrength = HAND_STRENGTH[type] || 1;
    const currentStrength = HAND_STRENGTH[currentBid.type] || 1;
    if (selectedStrength < currentStrength) {
      setType(currentBid.type);
    }
  }, [currentBid, type]);

  const draftBid = useMemo(() => {
    if (!type) {
      return null;
    }
    return {
      type,
      primaryRanks: [...primaryRanks],
      suit: needsSuit(type) ? suit : null,
    };
  }, [primaryRanks, suit, type]);

  const isLowerOrEqualBid = useMemo(() => {
    if (!currentBid || !draftBid) {
      return false;
    }
    return compareHandsSimple(draftBid, currentBid) <= 0;
  }, [currentBid, draftBid]);

  const canAddRank = useMemo(() => {
    if (!spec || spec.mode !== "variable" || primaryRanks.length >= spec.max) {
      return false;
    }

    if (!currentBid || !type) {
      return true;
    }

    return RANKS.some((candidateRank) => {
      const nextDraft = {
        type,
        primaryRanks: [...primaryRanks, candidateRank],
        suit: needsSuit(type) ? suit : null,
      };
      return compareHandsSimple(nextDraft, currentBid) > 0;
    });
  }, [currentBid, primaryRanks, spec, suit, type]);

  const submitText = type ? submitLabel : "Bid a hand";

  function isRankOptionDisabled(index, value) {
    if (!type || !currentBid) {
      return false;
    }

    const nextRanks = primaryRanks.map((rank, i) => (i === index ? Number(value) : rank));
    const nextDraft = {
      type,
      primaryRanks: nextRanks,
      suit: needsSuit(type) ? suit : null,
    };

    return compareHandsSimple(nextDraft, currentBid) <= 0;
  }

  function setRankAt(index, value) {
    const rank = Number(value);
    setPrimaryRanks((prev) => {
      const next = [...prev];
      next[index] = rank;
      return next;
    });
  }

  function addRank() {
    if (!spec || spec.mode !== "variable" || !canAddRank) {
      return;
    }
    setPrimaryRanks((prev) => (prev.length < spec.max ? [...prev, 2] : prev));
  }

  function removeRank(index) {
    if (!spec || spec.mode !== "variable") {
      return;
    }
    setPrimaryRanks((prev) => (prev.length > spec.min ? prev.filter((_, i) => i !== index) : prev));
  }

  function submit(event) {
    event.preventDefault();
    if (!draftBid || isLowerOrEqualBid) {
      return;
    }
    onPlaceBid(draftBid);
  }

  return (
    <section className="card">
      <h2>Actions</h2>
      <form className="form" onSubmit={submit}>
        <label>
          Hand Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Select hand type</option>
            {HAND_TYPES.map((item) => (
              <option
                key={item}
                value={item}
                disabled={Boolean(currentBid) && (HAND_STRENGTH[item] || 1) < (HAND_STRENGTH[currentBid.type] || 1)}
              >
                {handTypeLabel(item)}
              </option>
            ))}
          </select>
        </label>

        {type ? (
          <div>
            <p className="muted">Ranks</p>
            {primaryRanks.map((rank, index) => (
              <div className="rankRow" key={`rank-${index}`}>
                <select value={rank} onChange={(event) => setRankAt(index, event.target.value)}>
                  {rankOptionsForType(type).map((value) => (
                    <option key={value} value={value} disabled={isRankOptionDisabled(index, value)}>
                      {rankLabel(value)}
                    </option>
                  ))}
                </select>
                {spec && spec.mode === "variable" && primaryRanks.length > spec.min ? (
                  <button type="button" className="ghost" onClick={() => removeRank(index)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {spec && spec.mode === "variable" ? (
              <button type="button" className="ghost" onClick={addRank} disabled={!canAddRank}>
                Add rank
              </button>
            ) : null}
          </div>
        ) : null}

        {type && needsSuit(type) ? (
          <label>
            Suit
            <select value={suit} onChange={(event) => setSuit(event.target.value)}>
              <option value="">Select suit</option>
              {SUITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="buttonRow">
          <button type="submit" disabled={!isMyTurn || !draftBid || isLowerOrEqualBid}>
            {submitText}
          </button>
          {showCallButton ? (
            <button type="button" className="danger" onClick={onCallLiar} disabled={!isMyTurn}>
              Call Liar
            </button>
          ) : null}
        </div>
        {isLowerOrEqualBid ? <p className="error">Bid must be strictly higher than the current bid.</p> : null}
      </form>
    </section>
  );
}

export default ActionPanel;
