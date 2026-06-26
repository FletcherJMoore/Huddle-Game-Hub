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
const demoBoardId = crypto.randomUUID();

export const defaultState = {
  activeBoardId: demoBoardId,
  boards: [
    {
      id: demoBoardId,
      name: "Couch Co-op Crew",
      emoji: "🎮",
      accent: "#7c5cff",
      createdAt: new Date().toISOString(),
      members: {},
      memberProfiles: {},
      reads: {},
      games: [
        game("Helldivers 2", "Co-op Shooter", ["PC", "PS5"], "rotation"),
        game("Stardew Valley", "Farming Sim", ["PC", "Switch"], "rotation"),
        game("Lethal Company", "Co-op Horror", ["PC"], "maybe"),
        game("Overcooked 2", "Party", ["PC", "Switch"], "maybe")
      ],
      schedule: [
        {
          id: crypto.randomUUID(),
          date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
          start: "20:00",
          end: "22:30",
          activity: "Co-op night",
          votes: {}
        }
      ],
      messages: [
        {
          id: crypto.randomUUID(),
          author: "Huddle",
          authorUid: null,
          text: "Propose a game and give it a 👍 or 👎.",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ]
};
