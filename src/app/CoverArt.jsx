// A game's cover: the real catalog art when we have it, otherwise a styled
// box-art placeholder whose color is derived from the title so each game keeps
// a distinct, stable "box".

function hueFrom(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export default function CoverArt({ game }) {
  if (game.coverImageUrl) {
    return <img className="cover-img" src={game.coverImageUrl} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="cover-ph" style={{ "--h": hueFrom(game.title || "game") }}>
      <span className="cover-ph-icon" aria-hidden="true">
        {game.kind === "party" ? "🎲" : "🎮"}
      </span>
      <span className="cover-ph-title">{game.title}</span>
    </div>
  );
}
