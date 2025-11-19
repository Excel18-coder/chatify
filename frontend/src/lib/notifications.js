// Lightweight notification helper that prefers Capacitor LocalNotifications
// when available, and falls back to the browser Notification API.
export async function requestNotificationPermission() {
  try {
    const ln = await import("@capacitor/local-notifications");
    if (
      ln &&
      ln.LocalNotifications &&
      ln.LocalNotifications.requestPermissions
    ) {
      const perm = await ln.LocalNotifications.requestPermissions();
      return perm?.display === "granted" || perm?.display === "granted";
    }
  } catch (e) {
    // plugin not available
  }

  try {
    if (typeof Notification !== "undefined" && Notification.requestPermission) {
      const p = await Notification.requestPermission();
      return p === "granted";
    }
  } catch (e) {
    console.log("Notification permission request failed:", e);
  }

  return false;
}

export async function notify(title, body) {
  try {
    const ln = await import("@capacitor/local-notifications");
    if (ln && ln.LocalNotifications && ln.LocalNotifications.schedule) {
      await ln.LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Date.now(),
          },
        ],
      });
      return true;
    }
  } catch (e) {
    // plugin missing or scheduling failed — fall back
  }

  try {
    if (typeof Notification !== "undefined") {
      if (Notification.permission !== "granted")
        await Notification.requestPermission();
      if (Notification.permission === "granted") {
        new Notification(title, { body });
        return true;
      }
    }
  } catch (e) {
    console.log("Browser notification failed:", e);
  }

  return false;
}

export default { requestNotificationPermission, notify };
