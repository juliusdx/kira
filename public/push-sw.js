/* eslint-disable no-undef */
// Push handlers, pulled into the Workbox-generated service worker via
// `workbox.importScripts` in vite.config.ts. Kept as a plain file in public/
// so the generateSW strategy can stay — switching to injectManifest just to
// add two listeners would mean owning the whole precache pipeline.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A push with no payload (or a malformed one) should still surface
    // something useful rather than being dropped silently.
  }

  const title = data.title || 'Kira'
  const options = {
    body: data.body || 'Time to practise.',
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    // Replaces any earlier unread reminder instead of stacking a week of them.
    tag: 'kira-review-reminder',
    renotify: true,
    data: { url: data.url || './' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || './', self.location.origin).href

  event.waitUntil(
    // Focus an existing tab if the app is already open; only open a new one
    // as a fallback. Otherwise a daily tap leaves a trail of duplicate tabs.
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})
