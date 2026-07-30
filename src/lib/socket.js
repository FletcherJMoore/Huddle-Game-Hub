import { io } from "socket.io-client";

// One shared socket for the session. Connects to the same origin (proxied to
// the API server in dev); the session cookie authenticates the handshake.
let socket = null;

export function getSocket() {
  if (!socket) socket = io({ transports: ["websocket", "polling"] });
  return socket;
}
