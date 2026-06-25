// Pure formatting and sorting helpers.

export function formatShortDate(dateString) {
  const date = new Date(`${dateString}T00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function sortSchedule(schedule) {
  return [...schedule].sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

export function timeLabel(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function initialsFor(name) {
  return (
    name
      .replace(/\(you\)/i, "")
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  );
}
