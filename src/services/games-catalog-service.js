import { httpsCallable } from "firebase/functions";

// Searches the games catalog (proxied through searchCatalogGames so the API
// key stays server-side) for the propose-game modal's title autocomplete.
export async function searchCatalog(functions, query) {
  if (!functions) return [];
  const callable = httpsCallable(functions, "searchCatalogGames");
  const result = await callable({ query });
  return result.data?.results ?? [];
}
