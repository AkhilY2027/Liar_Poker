import { io } from "socket.io-client";
import { resolveBackendBaseUrl } from "./backendUrl";

const SERVER_URL = resolveBackendBaseUrl();

export function createSocketClient() {
  return io(SERVER_URL, {
    transports: ["websocket"],
  });
}
