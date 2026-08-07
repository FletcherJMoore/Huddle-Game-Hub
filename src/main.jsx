import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./auth/AuthProvider.jsx";
import { AchievementProvider } from "./app/AchievementProvider.jsx";
import { ThemeProvider } from "./app/theme.jsx";
import App from "./App.jsx";
import "./styles/app.css";
import "./styles/shell.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AchievementProvider>
          <App />
        </AchievementProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
