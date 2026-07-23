// Games domain helpers (ported from the old board-model): scoring, the majority
// threshold that marks a game "agreed", and score-ranked ordering.

export function voteCounts(game) {
  const votes = Object.values(game.approvals ?? {});
  const up = votes.filter((v) => v === "up").length;
  const down = votes.filter((v) => v === "down").length;
  return { up, down, score: up - down };
}

export function majorityThreshold(memberCount) {
  return Math.floor(memberCount / 2) + 1;
}

// Agreed once up-votes reach a majority of the crew — shown as "in rotation".
export function isAgreed(game, memberCount) {
  return voteCounts(game).up >= majorityThreshold(memberCount);
}

export function myVote(game, userId) {
  return game.approvals?.[userId] ?? null;
}

// Highest score first, ties broken by title so ordering is stable.
export function sortByScore(games) {
  return [...games].sort((a, b) => {
    const diff = voteCounts(b).score - voteCounts(a).score;
    return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "");
  });
}
