import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./auth/AuthProvider.jsx";
import { AchievementProvider } from "./app/AchievementProvider.jsx";
import App from "./App.jsx";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AchievementProvider>
        <App />
      </AchievementProvider>
    </AuthProvider>
  </StrictMode>
);
