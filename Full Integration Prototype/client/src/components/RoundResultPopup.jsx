import React, { useEffect, useMemo, useState } from "react";

function RoundResultPopup({ roundResult }) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    if (!roundResult || !roundResult.showUntilMs) {
      return false;
    }
    return nowMs < roundResult.showUntilMs;
  }, [nowMs, roundResult]);

  if (!visible) {
    return null;
  }

  return (
    <div className="roundResultPopup" role="status" aria-live="polite">
      <p className="roundResultTitle">Round Result</p>
      <p className="roundResultMessage">{roundResult.message}</p>
    </div>
  );
}

export default RoundResultPopup;
