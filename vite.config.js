import { defineConfig } from "vite";

// During local development the SPA runs on Vite's dev server while the API runs
// on the Node server (default :3000). Proxy /api and the WebSocket endpoint so
// the browser talks to one origin, matching how Railway serves both in prod.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true }
    }
  }
});
