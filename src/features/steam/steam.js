// "Games You All Own" — links each member's Steam library (via Sign in through
// Steam) and shows the intersection across the board as a cover-art grid.

import { store, activeBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { getSteamLoginUrl, subscribeBoardSteam } from "../../services/steam-service.js";
import { emptyState } from "../../components/empty-state.js";
import { showToast } from "../shell/shell.js";

let steamBoardId = null;
let unsubscribe = null;
let steamData = {}; // uid -> { steamId, persona, games }

export function renderCommonGames(board) {
  if (steamBoardId !== board.id) {
    steamBoardId = board.id;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    steamData = {};
    if (store.services) {
      unsubscribe = subscribeBoardSteam(store.services.db, board.id, (data) => {
        steamData = data || {};
        paint();
      });
    }
  }
  paint();
}

function paint() {
  const linkedUids = Object.keys(steamData);
  const iLinked = linkedUids.includes(store.currentUser?.uid);

  // Link prompt for the current user.
  elements.steamLink.replaceChildren();
  if (!iLinked) {
    const btn = document.createElement("button");
    btn.className = "btn btn-surface";
    btn.type = "button";
    btn.textContent = "🎮 Link your Steam to compare libraries";
    btn.addEventListener("click", startSteamLink);
    elements.steamLink.append(btn);
  }

  // Intersect owned-game app ids across everyone who has linked.
  let common = [];
  if (linkedUids.length) {
    const libs = linkedUids.map((uid) => steamData[uid].games || {});
    const [first, ...rest] = libs;
    common = Object.keys(first || {})
      .filter((appid) => rest.every((g) => g[appid]))
      .map((appid) => ({ appid, name: first[appid] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  elements.commonCount.textContent = String(common.length);

  if (!linkedUids.length) {
    elements.commonGames.replaceChildren(emptyState("No one's linked Steam yet"));
    return;
  }
  if (!common.length) {
    elements.commonGames.replaceChildren(
      emptyState(
        linkedUids.length === 1
          ? "Link more members' Steam to find shared games"
          : "No games in common yet (or a profile is private)"
      )
    );
    return;
  }
  elements.commonGames.replaceChildren(...common.map(steamCard));
}

function steamCard(game) {
  const card = document.createElement("a");
  card.className = "steam-card";
  card.href = `https://store.steampowered.com/app/${game.appid}`;
  card.target = "_blank";
  card.rel = "noopener";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = game.name;
  img.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
  img.addEventListener("error", () => {
    img.style.display = "none";
  });

  const name = document.createElement("div");
  name.className = "steam-name";
  name.textContent = game.name;

  card.append(img, name);
  return card;
}

async function startSteamLink() {
  if (!store.services) return;
  try {
    const url = await getSteamLoginUrl(store.services.functions);
    if (url) window.location.href = url;
  } catch (error) {
    console.error("Steam link failed", error);
    showToast("Couldn't start Steam sign-in");
  }
}

export function bindSteamEvents() {
  elements.linkSteamButton.addEventListener("click", startSteamLink);

  // Handle the redirect back from Steam.
  const params = new URLSearchParams(window.location.search);
  const steam = params.get("steam");
  if (steam) {
    window.history.replaceState({}, "", window.location.pathname);
    showToast(steam === "linked" ? "Steam linked! 🎮" : "Steam sign-in didn't complete");
  }
}
