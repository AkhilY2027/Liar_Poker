import React, { useEffect, useMemo, useRef, useState } from "react";

function RoundResultPopup({ roundResult, errorMessage, errorCode }) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [errorUntilMs, setErrorUntilMs] = useState(0);
  const lastErrorKeyRef = useRef("");

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!errorMessage) {
      lastErrorKeyRef.current = "";
      setErrorUntilMs(0);
      return;
    }

    const nextErrorKey = `${errorCode || ""}:${errorMessage}`;
    if (lastErrorKeyRef.current !== nextErrorKey) {
      lastErrorKeyRef.current = nextErrorKey;
      setErrorUntilMs(Date.now() + 5000);
    }
  }, [errorCode, errorMessage]);

  const payload = useMemo(() => {
    if (errorMessage && nowMs < errorUntilMs) {
      return {
        title: "Action Error",
        message: errorCode ? `[${errorCode}] ${errorMessage}` : errorMessage,
        isError: true,
      };
    }

    if (!roundResult || !roundResult.showUntilMs || nowMs >= roundResult.showUntilMs) {
      return null;
    }

    return {
      title: "Round Result",
      message: roundResult.message,
      isError: false,
    };
  }, [errorCode, errorMessage, nowMs, roundResult]);

  if (!payload) {
    return null;
  }

  return (
    <div className={`roundResultPopup ${payload.isError ? "error" : ""}`} role="status" aria-live="polite">
      <p className="roundResultTitle">{payload.title}</p>
      <p className="roundResultMessage">{payload.message}</p>
    </div>
  );
}

export default RoundResultPopup;
