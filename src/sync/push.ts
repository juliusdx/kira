import { getSupabase } from './client'
import { ensureSession } from './client'

// Web push subscription management.
//
// Deliberately NOT a native app: iOS has supported web push since 16.4, so the
// pedagogically important capability (a daily nudge) is reachable without an
// App Store presence. The one real catch is that iOS only allows it for a PWA
// the user has added to the Home Screen — hence `iosNeedsInstall()`, so we can
// tell an iPhone user WHY the button is unavailable rather than showing them a
// control that silently does nothing.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY)

export type PushState =
  | 'unsupported' // browser has no push at all
  | 'ios-needs-install' // Safari on iOS, not yet added to Home Screen
  | 'denied' // user said no; only they can undo it, in browser settings
  | 'off'
  | 'on'

/**
 * base64url VAPID key -> the bytes the Push API expects.
 *
 * Backed by an explicit ArrayBuffer (not the default ArrayBufferLike) because
 * `applicationServerKey` requires a BufferSource over a plain ArrayBuffer.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch check disambiguates
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** True when this is iOS Safari in a browser tab, where push cannot work yet. */
export function iosNeedsInstall(): boolean {
  return isIos() && !isStandalone()
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return iosNeedsInstall() ? 'ios-needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'

  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/**
 * Ask for permission, subscribe, and store the subscription server-side.
 * Returns the resulting state so the caller can render the real outcome
 * rather than assuming success.
 */
export async function enablePush(sendHour = 19): Promise<PushState> {
  if (!PUSH_CONFIGURED) return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return iosNeedsInstall() ? 'ios-needs-install' : 'unsupported'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Chrome refuses a subscription without this; a silent push would be a
      // tracking vector, so every push must show a notification.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }))

  const userId = await ensureSession()
  const pending = getSupabase()
  if (!userId || !pending) return 'off'
  const supabase = await pending

  const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      // the sender needs the learner's zone to pick their local hour
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      send_hour: sendHour,
      failure_count: 0,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.warn('[kira] could not store push subscription', error.message)
    return 'off'
  }
  return 'on'
}

/** Unsubscribe on this device and drop the row so the sender stops. */
export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    const pending = getSupabase()
    if (pending) {
      const supabase = await pending
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  }
  return 'off'
}

export interface PushDiagnostics {
  permission: NotificationPermission
  hasServiceWorker: boolean
  /** the SW is registered AND controlling this page */
  swActive: boolean
  hasSubscription: boolean
  /** true when the running SW has our push handler — the usual failure */
  pushHandlerPresent: boolean
  endpointHost: string | null
  p256dhLength: number
  authLength: number
}

/**
 * Everything needed to tell WHY a push did not appear, without a phone in
 * hand. The common cause is a service worker that registered before
 * push-sw.js existed: the push arrives, nothing handles it, and it is dropped
 * with no error anywhere.
 */
export async function pushDiagnostics(): Promise<PushDiagnostics> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  const json = sub?.toJSON() as { keys?: Record<string, string> } | undefined

  let pushHandlerPresent = false
  try {
    // If the SW imported push-sw.js, that file is in the cache/network and
    // its text contains our listener. Fetching it proves it is reachable at
    // the scope the SW would have resolved.
    const res = await fetch(new URL('push-sw.js', window.location.href), {
      cache: 'no-store',
    })
    pushHandlerPresent = res.ok && (await res.text()).includes("addEventListener('push'")
  } catch {
    pushHandlerPresent = false
  }

  return {
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    hasServiceWorker: Boolean(reg),
    swActive: Boolean(reg?.active) && Boolean(navigator.serviceWorker?.controller),
    hasSubscription: Boolean(sub),
    pushHandlerPresent,
    endpointHost: sub ? new URL(sub.endpoint).host : null,
    p256dhLength: json?.keys?.p256dh?.length ?? 0,
    authLength: json?.keys?.auth?.length ?? 0,
  }
}

/**
 * Show a notification locally, bypassing push entirely. If this works but a
 * real reminder does not, the fault is in delivery (subscription keys, the
 * sender, the push service). If this also fails, it is permission or the OS.
 */
export async function testNotification(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker?.ready
  if (!reg) return false
  await reg.showNotification('Kira', {
    body: 'Test notification — reminders are working on this device.',
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    tag: 'kira-test',
  })
  return true
}

/** Change the reminder hour for this device's existing subscription. */
export async function setReminderHour(hour: number): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const pending = getSupabase()
  if (!pending) return
  const supabase = await pending
  await supabase
    .from('push_subscriptions')
    .update({
      send_hour: hour,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    })
    .eq('endpoint', sub.endpoint)
}
