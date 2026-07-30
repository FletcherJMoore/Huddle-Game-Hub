// Socket.IO realtime layer. Clients join a room per board they belong to; the
// REST mutation handlers call emitToBoard() after they write, so every member's
// screen updates live (votes, RSVPs, chat). The socket shares the Express
// session, so we know who is connecting and can gate room membership.

import { Server } from "socket.io";

import { sessionMiddleware } from "./auth.js";
import { query } from "./db.js";

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer);
  io.engine.use(sessionMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.request.session?.passport?.user;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.on("join", async (boardId) => {
      try {
        const { rows } = await query(
          "select 1 from board_members where board_id = $1 and user_id = $2",
          [boardId, userId]
        );
        if (rows.length) socket.join(`board:${boardId}`);
      } catch {
        /* ignore — a failed join just means no live updates for that board */
      }
    });

    socket.on("leave", (boardId) => socket.leave(`board:${boardId}`));
  });

  return io;
}

export function emitToBoard(boardId, event, payload) {
  io?.to(`board:${boardId}`).emit(event, payload);
}
