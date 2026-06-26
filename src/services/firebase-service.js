import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

import { firebaseConfig, hasFirebaseConfig } from "../config/firebase-config.js";

let services = null;

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
    functions: getFunctions(app)
  };

  return services;
}
