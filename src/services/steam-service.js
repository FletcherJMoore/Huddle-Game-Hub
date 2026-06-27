import { httpsCallable } from "firebase/functions";
import { onValue, ref } from "firebase/database";

// Ask the backend for a "Sign in through Steam" URL (nonce tied to the caller).
export async function getSteamLoginUrl(functions) {
  const callable = httpsCallable(functions, "steamLoginUrl");
  const result = await callable();
  return result.data?.url;
}

// Live map of uid -> { steamId, persona, games } for everyone on a board who
// has linked Steam. Written server-side; readable by board members.
export function subscribeBoardSteam(db, boardId, onChange) {
  return onValue(ref(db, `boardSteam/${boardId}`), (snapshot) => onChange(snapshot.val() || {}));
}
