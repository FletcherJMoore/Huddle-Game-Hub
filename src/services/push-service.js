// Firebase Cloud Messaging (web push) enrollment. Registers the messaging
// service worker, requests notification permission, retrieves the device's FCM
// token, and stores it under fcmTokens/{uid}/{token} for the Cloud Function to
// target. A thrown Error's message is a short code the UI maps to a friendly line.

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { ref, set } from "firebase/database";
import { firebaseConfig, vapidKey } from "../config/firebase-config.js";

const SW_PATH = "/firebase-messaging-sw.js";

// Pass the public web config to the worker via query string (see the SW file).
function swUrlWithConfig() {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId
  });
  return `${SW_PATH}?${params.toString()}`;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
}

export function currentPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
}

// Enroll this device. `silent` skips the permission prompt (used on load to
// refresh the token when permission was already granted).
export async function enablePush(services, uid, { silent = false } = {}) {
  if (!pushSupported() || !(await isSupported())) throw new Error("unsupported");
  if (!vapidKey) throw new Error("missing-vapid");

  const permission = silent ? Notification.permission : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  const registration = await navigator.serviceWorker.register(swUrlWithConfig());
  const messaging = getMessaging(services.app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("no-token");

  await set(ref(services.db, `fcmTokens/${uid}/${token}`), {
    createdAt: Date.now(),
    ua: navigator.userAgent.slice(0, 140)
  });
  return token;
}
