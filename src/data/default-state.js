// Seed data used the first time the app runs (before any cloud boards exist).

export function game(title, genre, platforms, status) {
  return {
    id: crypto.randomUUID(),
    title,
    genre,
    platforms,
    status,
    approvals: {},
    addedBy: null,
    createdAt: new Date().toISOString()
  };
}

// Unique per browser session so each user's starter board has its own id.
// A hardcoded id would collide across users and break invite codes.
const demoBoardId = crypto.randomUUID();

export const defaultState = {
  activeBoardId: demoBoardId,
  boards: [
    {
      id: demoBoardId,
      name: "Friday Night Squad",
      createdAt: new Date().toISOString(),
      members: {},
      memberProfiles: {},
      reads: {},
      games: [
        game("Fortnite", "Battle Royale", ["PC", "Xbox", "PS5", "Switch"], "rotation"),
        game("Mortal Kombat", "Fighting", ["PC", "Xbox", "PS5", "Switch"], "rotation"),
        game("Dead by Daylight", "Survival Horror", ["PC", "Xbox", "PS5"], "maybe"),
        game("Destiny 2", "FPS/MMO", ["PC", "Xbox", "PS5"], "maybe")
      ],
      schedule: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          start: "20:00",
          end: "22:30",
          activity: "Warm-up matches, then vote"
        }
      ],
      messages: [
        {
          id: crypto.randomUUID(),
          author: "Huddle",
          authorUid: null,
          text: "Drop games in 'Hear Me Out' and give them a 👍 or 👎.",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ]
};
