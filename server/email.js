// Transactional email via Resend's REST API (no SDK dependency — Node's global
// fetch is enough). Email is optional to boot: if RESEND_API_KEY or
// INVITE_FROM_EMAIL isn't set, sends are skipped and reported, never thrown, so
// invites still work (the accept link is surfaced in the UI instead).

const { RESEND_API_KEY, INVITE_FROM_EMAIL } = process.env;

export const emailConfigured = Boolean(RESEND_API_KEY && INVITE_FROM_EMAIL);

if (!emailConfigured) {
  console.warn(
    "[email] DISABLED — set RESEND_API_KEY and INVITE_FROM_EMAIL to send invite emails. " +
      "Invites still work; the accept link is shown in the app instead."
  );
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Send a crew invitation. Resolves { sent } — false (not an error) when email
// isn't configured, so callers can still return the invite + accept link.
export async function sendInviteEmail({ to, crewName, inviterName, acceptUrl }) {
  if (!emailConfigured) return { sent: false, reason: "not-configured" };

  const who = inviterName ? `${inviterName} invited you` : "You've been invited";
  const crew = escapeHtml(crewName || "a crew");
  const url = escapeHtml(acceptUrl);

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="font-size:32px">🎮</div>
      <h1 style="font-size:20px;margin:12px 0 4px">${who} to join ${crew} on Huddle</h1>
      <p style="color:#555;line-height:1.5;margin:0 0 20px">Huddle is where crews plan game nights together — vote on what to play and pick a time that works.</p>
      <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">Accept invite</a>
      <p style="color:#888;font-size:12px;margin-top:20px">Or paste this link into your browser:<br>${url}</p>
    </div>`;
  const text = `${who} to join ${crewName} on Huddle.\n\nAccept your invite: ${acceptUrl}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: INVITE_FROM_EMAIL,
        to,
        subject: `${who} to join ${crewName} on Huddle`,
        html,
        text
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend responded ${res.status}: ${detail}`);
      return { sent: false, reason: `resend-${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed:", err.message);
    return { sent: false, reason: "network" };
  }
}
