// "Games You All Own" — links each member's Steam library (via Sign in through
// Steam) and shows the intersection across the board as a cover-art grid.

import { store, activeBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { getSteamLoginUrl, subscribeBoardSteam } from "../../services/steam-service.js";
import { emptyState } from "../../components/empty-state.js";
import { showToast } from "../shell/shell.js";
import { openSettings } from "../profile/profile.js";

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

  // Prompt the current user to link Steam — sends them to the Settings page
  // (where the actual Link Steam button lives) rather than linking inline.
  elements.steamLink.replaceChildren();
  if (!iLinked) {
    const prompt = document.createElement("p");
    prompt.style.cssText = "font-size:12.5px;color:#6b6d85;margin:0 0 14px;";
    prompt.append(document.createTextNode("To compare Steam games, link your account "));
    const link = document.createElement("button");
    link.type = "button";
    link.style.cssText = "background:none;border:none;color:var(--accent,#7c5cff);font-size:12.5px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline;";
    link.textContent = "in Account settings";
    link.addEventListener("click", () => openSettings("account"));
    prompt.append(link, document.createTextNode("."));
    elements.steamLink.append(prompt);
  }

  // Games "in common" only mean something with 2+ linked members — intersect
  // owned-game app ids across everyone who has linked.
  let common = [];
  if (linkedUids.length >= 2) {
    const libs = linkedUids.map((uid) => steamData[uid].games || {});
    const [first, ...rest] = libs;
    common = Object.keys(first || {})
      .filter((appid) => rest.every((g) => g[appid]))
      .map((appid) => ({ appid, name: first[appid] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  elements.commonCount.textContent = String(common.length);

  if (common.length) {
    elements.commonGames.replaceChildren(...common.map(steamCard));
    return;
  }

  let message;
  if (linkedUids.length === 0) message = "No one's linked Steam yet";
  else if (linkedUids.length === 1) message = "Just you so far — shared games appear once another member links Steam";
  else message = "No games in common yet (or a profile is private)";
  elements.commonGames.replaceChildren(emptyState(message));
}

function steamCard(game) {
  const card = document.createElement("a");
  card.href = `https://store.steampowered.com/app/${game.appid}`;
  card.target = "_blank";
  card.rel = "noopener";
  card.style.cssText =
    "background:#13141d;border:1px solid #23253560;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:block;";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = game.name;
  img.style.cssText = "width:100%;display:block;aspect-ratio:460/215;object-fit:cover;background:#0b0c12;";
  img.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
  img.addEventListener("error", () => {
    img.style.display = "none";
  });

  const name = document.createElement("div");
  name.style.cssText = "padding:11px 13px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  name.textContent = game.name;

  card.append(img, name);
  return card;
}

export async function startSteamLink() {
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
  // Handle the redirect back from Steam.
  const params = new URLSearchParams(window.location.search);
  const steam = params.get("steam");
  if (steam) {
    window.history.replaceState({}, "", window.location.pathname);
    showToast(steam === "linked" ? "Steam linked! 🎮" : "Steam sign-in didn't complete");
  }
}
