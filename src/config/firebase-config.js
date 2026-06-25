const env = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? "",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: env.VITE_FIREBASE_APP_ID ?? ""
};

export function hasFirebaseConfig(config = firebaseConfig) {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.databaseURL &&
      config.projectId &&
      config.appId
  );
}
