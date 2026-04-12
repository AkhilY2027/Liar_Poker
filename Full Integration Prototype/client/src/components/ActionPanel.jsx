import React, { useEffect, useMemo, useState } from "react";
import { HAND_TYPES, SUITS, handTypeLabel, needsSuit, rankLabel, requiredRankSpec } from "../handUtils";

const RANKS = Array.from({ length: 13 }, (_, i) => i + 2);

function ActionPanel({ onPlaceBid, onCallLiar }) {
  const [type, setType] = useState("PAIR");
  const [primaryRanks, setPrimaryRanks] = useState([2]);
  const [suit, setSuit] = useState("");

  const spec = useMemo(() => requiredRankSpec(type), [type]);

  useEffect(() => {
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
    if (!needsSuit(type)) {
      setSuit("");
    }
  }, [type]);

  function setRankAt(index, value) {
    const rank = Number(value);
    setPrimaryRanks((prev) => {
      const next = [...prev];
      next[index] = rank;
      return next;
    });
  }

  function addRank() {
    if (spec.mode !== "variable") {
      return;
    }
    setPrimaryRanks((prev) => (prev.length < spec.max ? [...prev, 2] : prev));
  }

  function removeRank(index) {
    if (spec.mode !== "variable") {
      return;
    }
    setPrimaryRanks((prev) => (prev.length > spec.min ? prev.filter((_, i) => i !== index) : prev));
  }

  function submit(event) {
    event.preventDefault();
    const hand = {
      type,
      primaryRanks: [...primaryRanks],
      suit: needsSuit(type) ? suit : null,
    };
    onPlaceBid(hand);
  }

  return (
    <section className="card">
      <h2>Actions</h2>
      <form className="form" onSubmit={submit}>
        <label>
          Hand Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {HAND_TYPES.map((item) => (
              <option key={item} value={item}>
                {handTypeLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="muted">Ranks</p>
          {primaryRanks.map((rank, index) => (
            <div className="rankRow" key={`rank-${index}`}>
              <select value={rank} onChange={(event) => setRankAt(index, event.target.value)}>
                {RANKS.map((value) => (
                  <option key={value} value={value}>
                    {rankLabel(value)}
                  </option>
                ))}
              </select>
              {spec.mode === "variable" && primaryRanks.length > spec.min ? (
                <button type="button" className="ghost" onClick={() => removeRank(index)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {spec.mode === "variable" ? (
            <button type="button" className="ghost" onClick={addRank}>
              Add rank
            </button>
          ) : null}
        </div>

        {needsSuit(type) ? (
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
          <button type="submit">Place Bid</button>
          <button type="button" className="danger" onClick={onCallLiar}>
            Call Liar
          </button>
        </div>
      </form>
    </section>
  );
}

export default ActionPanel;
