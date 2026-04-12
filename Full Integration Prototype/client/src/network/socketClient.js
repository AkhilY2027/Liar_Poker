import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export function createSocketClient() {
  return io(SERVER_URL, {
    transports: ["websocket"],
  });
}
