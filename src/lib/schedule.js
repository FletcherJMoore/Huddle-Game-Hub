// Schedule domain helpers: RSVP tallies, chronological ordering, and friendly
// date/time formatting. Sessions store date as YYYY-MM-DD and times as HH:MM.

export function rsvpCounts(session) {
  const values = Object.values(session.rsvps ?? {});
  return {
    in: values.filter((v) => v === "in").length,
    maybe: values.filter((v) => v === "maybe").length,
    out: values.filter((v) => v === "out").length
  };
}

export function myRsvp(session, userId) {
  return session.rsvps?.[userId] ?? null;
}

export function sortSessions(sessions) {
  return [...sessions].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export function isPast(session) {
  return session.date < new Date().toISOString().slice(0, 10);
}

export function formatSessionDate(date) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "pm" : "am";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m || 0).padStart(2, "0")}${period}`;
}

export function formatTimeRange(start, end) {
  if (!start) return "";
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}
