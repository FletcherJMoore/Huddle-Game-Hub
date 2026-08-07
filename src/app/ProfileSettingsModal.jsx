import { useRef, useState } from "react";

import { X } from "./icons.jsx";

// Profile settings. The user-facing form is complete; the save is a no-op until
// the profile-update endpoint lands (see server/auth.js), at which point this
// posts displayName/username/photo and the password change.
export default function ProfileSettingsModal({ user, onClose }) {
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(user?.photo_url || null);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [username, setUsername] = useState((user?.email || "you").split("@")[0]);
  const initial = (displayName || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Profile settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="photo-row">
            <button
              className="photo-drop"
              style={photo ? { backgroundImage: `url(${photo})` } : undefined}
              onClick={() => fileRef.current?.click()}
            >
              {!photo && initial}
            </button>
            <div className="col">
              <span className="field-label">Profile photo</span>
              <span className="hint">Click to browse for an image.</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setPhoto(reader.result);
                reader.readAsDataURL(file);
              }}
            />
          </div>

          <label className="field-col">
            <span className="field-label">Display name</span>
            <input className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>

          <label className="field-col">
            <span className="field-label">Username</span>
            <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>

          <div className="menu-divider" />
          <span className="eyebrow">CHANGE PASSWORD</span>

          <label className="field-col">
            <span className="field-label">Current password</span>
            <input className="text-input" type="password" autoComplete="current-password" />
          </label>
          <label className="field-col">
            <span className="field-label">New password</span>
            <input className="text-input" type="password" autoComplete="new-password" />
          </label>
          <label className="field-col">
            <span className="field-label">Confirm new password</span>
            <input className="text-input" type="password" autoComplete="new-password" />
          </label>
        </div>

        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={onClose}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
