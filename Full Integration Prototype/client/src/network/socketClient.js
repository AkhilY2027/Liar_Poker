import { io } from "socket.io-client";

function resolveServerUrl() {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

const SERVER_URL = resolveServerUrl();

export function createSocketClient() {
  return io(SERVER_URL, {
    transports: ["websocket"],
  });
}
