// Descriptive metadata — category (genre), studio (developer), a short blurb,
// and a key-art gradient — keyed by game title. This is the single source the
// catalog, the board views, and the Steam library all read from, so every game
// tile shows the same rich info and the same hero art.
export const GAME_META = {
  "Overwatch 2": {
    genre: "Shooter", developer: "Blizzard Entertainment",
    description: "Team-based hero shooter where two squads of five clash across objective maps, each hero built around a distinct kit.",
    hero: "linear-gradient(135deg,#f97316,#b45309)"
  },
  "World of Warcraft": {
    genre: "MMORPG", developer: "Blizzard Entertainment",
    description: "The sprawling online world of Azeroth — quest, raid, and explore with thousands of other players across decades of story.",
    hero: "linear-gradient(135deg,#1d4ed8,#1e3a8a)"
  },
  "Diablo IV": {
    genre: "Action RPG", developer: "Blizzard Entertainment",
    description: "A dark dungeon crawler through the world of Sanctuary — grind loot, master classes, and hunt Lilith across a shared open world.",
    hero: "linear-gradient(135deg,#b91c1c,#450a0a)"
  },
  "Hearthstone": {
    genre: "Card", developer: "Blizzard Entertainment",
    description: "A fast, friendly digital card game — build decks from Warcraft heroes and duel opponents in quick tactical matches.",
    hero: "linear-gradient(135deg,#d97706,#78350f)"
  },
  "League of Legends": {
    genre: "MOBA", developer: "Riot Games",
    description: "The definitive MOBA — pick a champion, push lanes, and destroy the enemy Nexus in five-on-five strategic team battles.",
    hero: "linear-gradient(135deg,#0891b2,#164e63)"
  },
  "Valorant": {
    genre: "Shooter", developer: "Riot Games",
    description: "A tactical five-on-five shooter blending precise gunplay with agent abilities across tight, round-based matches.",
    hero: "linear-gradient(135deg,#e11d48,#831843)"
  },
  "Counter-Strike 2": {
    genre: "Shooter", developer: "Valve",
    description: "The legendary competitive shooter, rebuilt — plant, defuse, and out-aim the enemy team round after round.",
    hero: "linear-gradient(135deg,#ca8a04,#3f3f46)"
  },
  "Dota 2": {
    genre: "MOBA", developer: "Valve",
    description: "A deep, high-skill MOBA with over a hundred heroes and endless strategic depth in five-on-five lane battles.",
    hero: "linear-gradient(135deg,#7c3aed,#312e81)"
  },
  "Portal 2": {
    genre: "Puzzle", developer: "Valve",
    description: "A mind-bending first-person puzzler — think with portals, solo or in co-op, through Aperture's test chambers.",
    hero: "linear-gradient(135deg,#2563eb,#1e293b)"
  },
  "Elden Ring": {
    genre: "Action RPG", developer: "FromSoftware",
    description: "An open-world dark fantasy epic — explore the Lands Between, face towering bosses, and forge your own path to the throne.",
    hero: "linear-gradient(135deg,#a16207,#1c1917)"
  },
  "Sekiro: Shadows Die Twice": {
    genre: "Action RPG", developer: "FromSoftware",
    description: "A punishing single-player action game of posture-breaking swordplay and stealth in a reimagined Sengoku-era Japan.",
    hero: "linear-gradient(135deg,#dc2626,#292524)"
  },
  "Baldur's Gate 3": {
    genre: "RPG", developer: "Larian Studios",
    description: "A sweeping party-based RPG built on D&D — every choice matters across a richly reactive world, solo or in co-op.",
    hero: "linear-gradient(135deg,#b45309,#7c2d12)"
  },
  "Mario Kart 8 Deluxe": {
    genre: "Racing", developer: "Nintendo",
    description: "The definitive kart racer — drift, boost, and sling shells across wild tracks with up to eight players.",
    hero: "linear-gradient(135deg,#dc2626,#c2410c)"
  },
  "Splatoon 3": {
    genre: "Shooter", developer: "Nintendo",
    description: "A colorful team shooter about covering turf in ink — splat rivals and out-splash them in four-on-four matches.",
    hero: "linear-gradient(135deg,#7c3aed,#0d9488)"
  },
  "Fortnite": {
    genre: "Battle Royale", developer: "Epic Games",
    description: "Build, battle, and be the last one standing — a hundred players drop onto a shrinking island in a fight to survive.",
    hero: "linear-gradient(135deg,#6d28d9,#1e40af)"
  },
  "Among Us": {
    genre: "Party", developer: "Innersloth",
    description: "Work together to prep your ship — but one of you is an impostor. Deceive, deduce, and vote to survive.",
    hero: "linear-gradient(135deg,#dc2626,#1e3a8a)"
  },

  // Titles that show up in boards and Steam libraries but aren't in the store catalog.
  "Overcooked 2": {
    genre: "Co-op", developer: "Team17",
    description: "A frantic couch co-op cooking game — chop, cook, and plate orders together before the kitchen falls into chaos.",
    hero: "linear-gradient(135deg,#f97316,#dc2626)"
  },
  "It Takes Two": {
    genre: "Co-op", developer: "Hazelight Studios",
    description: "A two-player-only adventure of constantly shifting mechanics, built entirely around playing side by side.",
    hero: "linear-gradient(135deg,#0d9488,#7c3aed)"
  },
  "Jackbox Party Pack 10": {
    genre: "Party", developer: "Jackbox Games",
    description: "A bundle of quick, phone-controlled party games made for a room full of friends and a shared screen.",
    hero: "linear-gradient(135deg,#db2777,#6d28d9)"
  },
  "Catan": {
    genre: "Board", developer: "Catan Studio",
    description: "The classic game of trading and building — settle the island, trade resources, and race to ten victory points.",
    hero: "linear-gradient(135deg,#d97706,#15803d)"
  },
  "Lethal Company": {
    genre: "Co-op Horror", developer: "Zeekers",
    description: "Scavenge abandoned moons for scrap with friends while dodging the monsters lurking in the dark.",
    hero: "linear-gradient(135deg,#4d7c0f,#111827)"
  },
  "Rocket League": {
    genre: "Sports", developer: "Psyonix",
    description: "Soccer, but with rocket-powered cars — flip, boost, and aerial the ball into the net in fast arena matches.",
    hero: "linear-gradient(135deg,#2563eb,#ea580c)"
  },
  "Stardew Valley": {
    genre: "Simulation", developer: "ConcernedApe",
    description: "Inherit an overgrown farm and build the life you want — grow crops, raise animals, and befriend the town, solo or co-op.",
    hero: "linear-gradient(135deg,#16a34a,#ca8a04)"
  },
  "Hades": {
    genre: "Roguelike", developer: "Supergiant Games",
    description: "A fast, stylish roguelike — fight your way out of the Underworld one run at a time, growing stronger with every death.",
    hero: "linear-gradient(135deg,#dc2626,#6d28d9)"
  },
  "Five Nights at Freddy's": {
    genre: "Horror", developer: "Scott Cawthon",
    description: "Survive the night shift at a haunted pizzeria — watch the cameras, ration the power, and keep the animatronics out.",
    hero: "linear-gradient(135deg,#78350f,#111827)"
  },
  "Terraria": {
    genre: "Sandbox", developer: "Re-Logic",
    description: "Dig, build, and battle across a procedurally generated world of loot, bosses, and endless crafting, solo or with friends.",
    hero: "linear-gradient(135deg,#15803d,#0ea5e9)"
  },
  "PEAK": {
    genre: "Co-op Adventure", developer: "Aggro Crab & Landfall",
    description: "A co-op climbing game — scale a treacherous mountain together, sharing gear and catching each other's falls.",
    hero: "linear-gradient(135deg,#0ea5e9,#0d9488)"
  }
};
