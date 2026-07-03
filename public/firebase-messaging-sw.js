/* Firebase Cloud Messaging service worker for background (tab closed) push.
 *
 * The Firebase config is passed as query params when the page registers this
 * worker, so we don't have to hardcode/commit it here. These values are the
 * public web config (safe to expose to the client). */

/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId")
});

const messaging = firebase.messaging();

// The Cloud Function sends data-only messages, so we build the notification here
// (avoids the browser auto-showing a second one).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Huddle", {
    body: data.body || "",
    tag: data.boardId || "huddle-chat",
    data
  });
});

// Focus an existing tab (or open one) when the notification is clicked.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
