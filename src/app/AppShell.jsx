import { useState } from "react";

import TopBar from "./TopBar.jsx";
import Dashboard from "./Dashboard.jsx";
import BoardView from "./BoardView.jsx";

// The signed-in experience. Simple state-based navigation between the board
// list and a single board (a router can come later if the app grows deep).
export default function AppShell() {
  const [activeBoardId, setActiveBoardId] = useState(null);

  return (
    <div className="app-shell">
      <TopBar onHome={() => setActiveBoardId(null)} showHome={activeBoardId !== null} />
      {activeBoardId ? (
        <BoardView boardId={activeBoardId} onBack={() => setActiveBoardId(null)} />
      ) : (
        <Dashboard onOpenBoard={setActiveBoardId} />
      )}
    </div>
  );
}
