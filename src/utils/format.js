// Pure formatting and sorting helpers.

export function formatShortDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function sortSchedule(schedule) {
  return [...schedule].sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

export function timeLabel(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// "20:00" -> "8:00 PM"
export function formatTime12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function sessionTimeLabel(start, end) {
  if (!start) return "";
  return end ? `${formatTime12(start)} - ${formatTime12(end)}` : formatTime12(start);
}

// Day-of-week abbreviation ("FRI") for a yyyy-mm-dd string.
export function dowShort(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).toUpperCase();
}

export function dayNum(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00`).getDate();
}

// Paints an existing avatar-shaped element: a photo if one is set, otherwise
// initials text (the element's own CSS supplies the background/size).
export function paintAvatar(el, photoURL, fallbackText) {
  el.replaceChildren();
  if (photoURL) {
    const img = document.createElement("img");
    img.src = photoURL;
    img.alt = "";
    img.loading = "lazy";
    el.append(img);
  } else {
    el.textContent = fallbackText;
  }
}

export function initialsFor(name) {
  return (
    String(name)
      .replace(/\(you\)/i, "")
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  );
}

