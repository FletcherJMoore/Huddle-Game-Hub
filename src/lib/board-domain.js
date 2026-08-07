// Derives the board-catalog buckets from the real game model (approvals map),
// with the design's "In rotation / Pending approval / Everyone owns these"
// framing. `owners` is optional personal-catalog data; when absent the
// "everyone owns" bucket is simply empty.

import { voteCounts, majorityThreshold, isAgreed } from "./games.js";

export function upVotes(game) {
  return voteCounts(game).up;
}

export function threshold(memberCount) {
  return majorityThreshold(memberCount);
}

// Games the crew has voted into rotation.
export function inRotation(games, memberCount) {
  return games.filter((g) => isAgreed(g, memberCount));
}

// Not yet agreed, but actively being voted on (or freshly proposed).
export function pendingApproval(games, memberCount) {
  return games.filter((g) => !isAgreed(g, memberCount) && !isCommon(g, memberCount));
}

// Widely owned but not yet proposed for rotation (needs personal-catalog data).
function isCommon(g, memberCount) {
  return !isAgreed(g, memberCount) && upVotes(g) === 0 && g.owners != null && g.owners >= memberCount - 1;
}

export function everyoneOwns(games, memberCount) {
  return games.filter((g) => isCommon(g, memberCount)).sort((a, b) => (b.owners || 0) - (a.owners || 0));
}
