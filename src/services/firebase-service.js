import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

import { firebaseConfig, hasFirebaseConfig } from "../config/firebase-config.js";

let services = null;

// Storage requires a one-time "enable" step in the Firebase console; until
// that's done, getStorage() throws. Avatar upload is the only feature that
// needs it, so a missing bucket shouldn't take down auth/db/functions too.
function getStorageSafely(app) {
  try {
    return getStorage(app);
  } catch (error) {
    console.error("Firebase Storage unavailable — enable it in the Firebase console", error);
    return null;
  }
}

export function getFirebaseServices() {
  if (services) return services;

  if (!hasFirebaseConfig(firebaseConfig)) {
    throw new Error("Firebase environment variables are missing.");
  }

  const app = initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    db: getDatabase(app),
    functions: getFunctions(app),
    storage: getStorageSafely(app)
  };

  return services;
}
